begin;

-- Additive migration: existing JSON records, originals and import markers are preserved.
alter table public.redi_records add column if not exists deleted_at timestamptz;
alter table public.redi_records add column if not exists updated_at timestamptz not null default now();
create table if not exists public.redi_memberships (
  user_id uuid primary key references auth.users(id),
  role text not null check (role in ('public_viewer','authorized_viewer','gis_editor','administrator')),
  active boolean not null default true,
  scopes jsonb not null default '[]' check (jsonb_typeof(scopes) = 'array'),
  can_review boolean not null default false,
  can_export boolean not null default true,
  updated_at timestamptz not null default now()
);
create table if not exists public.redi_proposals (
  id uuid primary key default gen_random_uuid(),
  submitted_by uuid references auth.users(id),
  status text not null default 'submitted' check (status in ('submitted','pending_review','under_validation','approved','rejected','published')),
  data jsonb not null check (jsonb_typeof(data)='object'),
  submitted_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  review_note text,
  published_record_id text
);
create table if not exists public.redi_audit_events (
  id uuid primary key default gen_random_uuid(), occurred_at timestamptz not null default now(),
  actor_id uuid, entity_type text not null, entity_id text not null, action text not null,
  before_data jsonb, after_data jsonb
);
create index if not exists redi_proposal_status_idx on public.redi_proposals(status,submitted_at);
create index if not exists redi_audit_entity_idx on public.redi_audit_events(entity_type,entity_id,occurred_at);
alter table public.redi_memberships enable row level security;
alter table public.redi_proposals enable row level security;
alter table public.redi_audit_events enable row level security;
revoke all on public.redi_memberships,public.redi_proposals,public.redi_audit_events from public,anon,authenticated;
grant all on public.redi_memberships,public.redi_proposals,public.redi_audit_events to service_role;
-- Application users never access raw tables; only bounded, permission-aware RPCs below.

create or replace function public.redi_role() returns text language sql stable security definer set search_path='' as $$
  select coalesce((select role from public.redi_memberships where user_id=auth.uid() and active),'public_viewer');
$$;
create or replace function public.redi_in_scope(d jsonb) returns boolean language sql stable security definer set search_path='' as $$
  select public.redi_role()='administrator' or exists (
    select 1 from public.redi_memberships m, jsonb_array_elements(m.scopes) s
    where m.user_id=auth.uid() and m.active and m.role<>'public_viewer'
    and (s->>'country'='*' or upper(trim(s->>'country'))=upper(trim(d->>'country')))
    and (coalesce(s->>'region','')='' or lower(trim(s->>'region'))=lower(trim(d->>'region')))
    and (coalesce(s->>'county','')='' or lower(trim(s->>'county'))=lower(trim(d->>'county')))
    and (coalesce(s->>'municipality','')='' or lower(trim(s->>'municipality'))=lower(trim(coalesce(d->>'municipality',d->>'locality'))))
    and (coalesce(s->>'communityId','')='' or s->>'communityId'=d->>'id' or s->>'communityId'=d->>'communityId')
  );
$$;
create or replace function public.redi_is_global() returns boolean language sql stable security definer set search_path='' as $$
  select public.redi_role()='administrator' or exists (
    select 1 from public.redi_memberships m, jsonb_array_elements(m.scopes) s where m.user_id=auth.uid() and m.active and m.role<>'public_viewer'
    and s = '{"country":"*"}'::jsonb
  );
$$;
create or replace function public.redi_can_export() returns boolean language sql stable security definer set search_path='' as $$
  select public.redi_role()='administrator' or exists(select 1 from public.redi_memberships where user_id=auth.uid() and active and role<>'public_viewer' and can_export);
$$;
create or replace function public.redi_can_review() returns boolean language sql stable security definer set search_path='' as $$
  select public.redi_role()='administrator' or exists(select 1 from public.redi_memberships where user_id=auth.uid() and active and role='gis_editor' and can_review);
$$;
create or replace function public.redi_access_profile() returns jsonb language sql stable security definer set search_path='' as $$
  select jsonb_build_object('role',public.redi_role(),'scopes',coalesce((select scopes from public.redi_memberships where user_id=auth.uid() and active),'[]'::jsonb),
    'canReview',public.redi_can_review(),'canExport',public.redi_can_export());
$$;

-- A public projection contains only deliberately published, privacy-reviewed information.
-- Legacy records default to restricted; no historical location is silently made public.
create or replace function public.redi_workspace_data() returns jsonb language sql stable security definer set search_path='' as $$
  with visible as (
    select collection,created_at,id,
      case when public.redi_role()<>'public_viewer' and public.redi_in_scope(data)
        and (coalesce(data->>'visibility','restricted')<>'confidential' or public.redi_role()='administrator') then data
      else jsonb_build_object('id',id,'name',data->>'name','country',data->>'country','county',data->>'county','locality',data->>'locality',
        'kind',data->>'kind','status',data->>'status','classification',data->>'classification','source',data->>'source','geometry',data->'publicGeometry') end as data
    from public.redi_records where deleted_at is null and (
      (public.redi_role()<>'public_viewer' and public.redi_in_scope(data) and (coalesce(data->>'visibility','restricted')<>'confidential' or public.redi_role()='administrator'))
      or (collection='communities' and data->>'visibility'='public' and data->>'publicationStatus'='published' and data->'privacyReviewed'='true'::jsonb)
    )
  ) select jsonb_build_object(
    'communities',coalesce(jsonb_agg(data order by created_at,id) filter(where collection='communities'),'[]'::jsonb),
    'entrepreneurs',coalesce(jsonb_agg(data order by created_at,id) filter(where collection='entrepreneurs'),'[]'::jsonb),
    'clients',coalesce(jsonb_agg(data order by created_at,id) filter(where collection='clients'),'[]'::jsonb),
    'localities',coalesce(jsonb_agg(data order by created_at,id) filter(where collection='localities'),'[]'::jsonb)
  ) from visible;
$$;

-- Immutable version snapshots include the old and new JSON plus actor and time.
create or replace function public.redi_audit_record() returns trigger language plpgsql security definer set search_path='' as $$
begin
  if TG_OP='INSERT' then
    insert into public.redi_audit_events(actor_id,entity_type,entity_id,action,after_data) values(auth.uid(),NEW.collection,NEW.id,'create',NEW.data);
  elsif TG_OP='UPDATE' then
    insert into public.redi_audit_events(actor_id,entity_type,entity_id,action,before_data,after_data) values(auth.uid(),NEW.collection,NEW.id,
      case when OLD.deleted_at is null and NEW.deleted_at is not null then 'delete' when OLD.deleted_at is not null and NEW.deleted_at is null then 'restore' else 'update' end,OLD.data,NEW.data);
  else
    insert into public.redi_audit_events(actor_id,entity_type,entity_id,action,before_data) values(auth.uid(),OLD.collection,OLD.id,'legacy_delete',OLD.data);
  end if;
  return null;
end; $$;
drop trigger if exists redi_record_audit on public.redi_records;
create trigger redi_record_audit after insert or update or delete on public.redi_records for each row execute function public.redi_audit_record();

create or replace function public.redi_mutate_records(p_collection text,p_operation text,p_items jsonb default '[]',p_ids text[] default '{}',p_all boolean default false)
returns jsonb language plpgsql security definer set search_path='' as $$
declare item jsonb; previous public.redi_records%rowtype; next_data jsonb; result jsonb:='[]'; rid text; n integer:=0;
begin
  if p_collection is null or p_operation is null or p_collection not in ('communities','entrepreneurs','clients','localities') or p_operation not in ('create','update','delete','restore') then raise exception 'Invalid operation' using errcode='22023'; end if;
  if public.redi_role() not in ('gis_editor','administrator') then raise exception 'Editing requires GIS editor access' using errcode='42501'; end if;
  if p_operation in ('delete','restore') and public.redi_role()<>'administrator' then raise exception 'Administrator required' using errcode='42501'; end if;
  if jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items)>2000 or cardinality(p_ids)>2000 then raise exception 'Invalid batch' using errcode='22023'; end if;
  if p_operation in ('delete','restore') then
    for previous in select * from public.redi_records where collection=p_collection and (p_all or id=any(p_ids)) for update loop
      if not public.redi_in_scope(previous.data) then raise exception 'Outside geographic scope' using errcode='42501'; end if;
      if (p_operation='delete' and previous.deleted_at is null) or (p_operation='restore' and previous.deleted_at is not null) then
        update public.redi_records set deleted_at=case when p_operation='delete' then now() else null end,updated_at=now() where collection=p_collection and id=previous.id;
        n:=n+1;
      end if;
    end loop;
    return jsonb_build_object('removed',n);
  end if;
  for item in select * from jsonb_array_elements(p_items) loop
    if jsonb_typeof(item)<>'object' or octet_length(item::text)>1000000 then raise exception 'Invalid record' using errcode='22023'; end if;
    if p_operation='update' then
      select * into previous from public.redi_records where collection=p_collection and id=item->>'id' and deleted_at is null for update;
      if not found then raise exception 'Record not found' using errcode='P0002'; end if;
      if not public.redi_in_scope(previous.data) or (previous.data->>'visibility'='confidential' and public.redi_role()<>'administrator') then raise exception 'Outside geographic scope' using errcode='42501'; end if;
      next_data:=previous.data || item || jsonb_build_object('id',previous.id);
    else
      rid:=gen_random_uuid()::text;
      next_data:=item || jsonb_build_object('id',rid,'createdAt',now(),'visibility','restricted','publicationStatus','draft');
    end if;
    if public.redi_role()<>'administrator' then
      if p_operation='update' and exists(select 1 from unnest(array['visibility','publicationStatus','privacyReviewed','publicGeometry']) k where item ? k and item->k is distinct from previous.data->k) then raise exception 'Publication requires administrator' using errcode='42501'; end if;
    end if;
    if not public.redi_in_scope(next_data) then raise exception 'Outside geographic scope' using errcode='42501'; end if;
    -- Publishing is only possible through the proposal review RPC, with an audit trail.
    if p_operation='update' and exists(select 1 from unnest(array['visibility','publicationStatus','privacyReviewed','publicGeometry']) k where next_data->k is distinct from previous.data->k) then raise exception 'Use the publication workflow' using errcode='42501'; end if;
    if p_operation='create' then
      insert into public.redi_records(collection,id,data) values(p_collection,next_data->>'id',next_data);
    else
      update public.redi_records set data=next_data,updated_at=now() where collection=p_collection and id=previous.id;
    end if;
    result:=result || jsonb_build_array(next_data);
  end loop;
  return result;
end; $$;

create or replace function public.redi_valid_geometry(g jsonb) returns boolean language plpgsql immutable set search_path='' as $$
declare p jsonb; ring jsonb; poly jsonb; x numeric; y numeric;
begin
  if g is null or jsonb_typeof(g)<>'object' or jsonb_typeof(g->'coordinates')<>'array' then return false; end if;
  if g->>'type'='Point' then
    if jsonb_array_length(g->'coordinates')<>2 then return false; end if;
    if jsonb_typeof(g->'coordinates'->0)<>'number' or jsonb_typeof(g->'coordinates'->1)<>'number' then return false; end if;
    x:=(g->'coordinates'->>0)::numeric; y:=(g->'coordinates'->>1)::numeric;
    return x between -180 and 180 and y between -90 and 90;
  elsif g->>'type' in ('Polygon','MultiPolygon') then
    if jsonb_array_length(g->'coordinates')<1 then return false; end if;
    for poly in select * from jsonb_array_elements(case when g->>'type'='Polygon' then jsonb_build_array(g->'coordinates') else g->'coordinates' end) loop
      if jsonb_typeof(poly)<>'array' or jsonb_array_length(poly)<1 then return false; end if;
      for ring in select * from jsonb_array_elements(poly) loop
        if jsonb_typeof(ring)<>'array' or jsonb_array_length(ring)<4 or ring->0 is distinct from ring->(jsonb_array_length(ring)-1) then return false; end if;
        for p in select * from jsonb_array_elements(ring) loop
          if not public.redi_valid_geometry(jsonb_build_object('type','Point','coordinates',p)) then return false; end if;
        end loop;
      end loop;
    end loop;
    return true;
  end if;
  return false;
exception when others then return false;
end; $$;

create or replace function public.redi_submit_proposal(p_data jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare clean jsonb; pid uuid;
begin
  if jsonb_typeof(p_data) is distinct from 'object' or jsonb_typeof(p_data->'name') is distinct from 'string' or octet_length(p_data::text)>64000 or length(trim(coalesce(p_data->>'name','')))<3 or length(p_data->>'name')>200
    or coalesce(p_data->>'country','') !~ '^[A-Z]{2}$' or p_data->'consent' is distinct from 'true'::jsonb
    or not public.redi_valid_geometry(p_data->'geometry') then raise exception 'Invalid proposal or consent' using errcode='22023'; end if;
  -- Database-enforced caps also cover direct RPC calls. No raw IP addresses are stored.
  perform pg_advisory_xact_lock(270011);
  if (select count(*) from public.redi_proposals where submitted_at>now()-interval '1 hour')>=100
    or (auth.uid() is not null and (select count(*) from public.redi_proposals where submitted_by=auth.uid() and submitted_at>now()-interval '1 hour')>=10) then raise exception 'Submission limit reached. Try later.' using errcode='P0001'; end if;
  select coalesce(jsonb_object_agg(key,value),'{}') into clean from jsonb_each(p_data) where key=any(array['name','country','region','county','locality','classification','population','notes','supportingInformation','geometry']);
  if length(coalesce(clean->>'notes',''))>4000 or length(coalesce(clean->>'supportingInformation',''))>4000 then raise exception 'Supporting information too long' using errcode='22023'; end if;
  insert into public.redi_proposals(submitted_by,data) values(auth.uid(),clean) returning id into pid;
  insert into public.redi_audit_events(actor_id,entity_type,entity_id,action,after_data) values(auth.uid(),'proposal',pid::text,'submitted',clean);
  return jsonb_build_object('id',pid,'status','submitted');
end; $$;

create or replace function public.redi_list_proposals() returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
  if not public.redi_can_review() then raise exception 'Review permission required' using errcode='42501'; end if;
  return coalesce((select jsonb_agg(to_jsonb(p) order by submitted_at) from public.redi_proposals p where public.redi_in_scope(p.data)),'[]');
end; $$;
create or replace function public.redi_transition_proposal(p_id uuid,p_status text,p_expected text,p_note text default '',p_public boolean default false,p_share_geometry boolean default false,p_privacy_reviewed boolean default false)
returns jsonb language plpgsql security definer set search_path='' as $$
declare proposal public.redi_proposals%rowtype; rid text; record_data jsonb;
begin
  select * into proposal from public.redi_proposals where id=p_id for update;
  if not found then raise exception 'Proposal not found' using errcode='P0002'; end if;
  if not public.redi_can_review() or not public.redi_in_scope(proposal.data) then raise exception 'Review permission required' using errcode='42501'; end if;
  if proposal.status is distinct from p_expected then raise exception 'Proposal changed. Reload before continuing.' using errcode='40001'; end if;
  if not ((proposal.status='submitted' and p_status='pending_review') or (proposal.status='pending_review' and p_status='under_validation')
    or (proposal.status='under_validation' and p_status in ('approved','rejected') and public.redi_role()='administrator')
    or (proposal.status='approved' and p_status='published' and public.redi_role()='administrator')) then raise exception 'Invalid status transition' using errcode='22023'; end if;
  if p_status='rejected' and length(trim(coalesce(p_note,'')))<5 then raise exception 'A rejection reason is required' using errcode='22023'; end if;
  if length(p_note)>4000 then raise exception 'Review note too long' using errcode='22023'; end if;
  if p_status='published' then
    if p_privacy_reviewed is distinct from true then raise exception 'Privacy review is required before publication' using errcode='22023'; end if;
    rid:='proposal-' || p_id::text;
    record_data:=proposal.data || jsonb_build_object('id',rid,'createdAt',now(),'kind',case when proposal.data->'geometry'->>'type'='Point' then 'punct' else 'zona' end,
      'status','validat','source','manual','publicationStatus','published','visibility',case when p_public then 'public' else 'restricted' end,
      'privacyReviewed',true,'publicGeometry',case when p_public and p_share_geometry then proposal.data->'geometry' else 'null'::jsonb end);
    insert into public.redi_records(collection,id,data) values('communities',rid,record_data);
  end if;
  update public.redi_proposals set status=p_status,updated_at=now(),review_note=nullif(trim(p_note),''),published_record_id=coalesce(rid,published_record_id) where id=p_id returning * into proposal;
  insert into public.redi_audit_events(actor_id,entity_type,entity_id,action,before_data,after_data) values(auth.uid(),'proposal',p_id::text,p_status,jsonb_build_object('status',p_expected),to_jsonb(proposal));
  return to_jsonb(proposal);
end; $$;

create or replace function public.redi_admin_overview() returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
  if public.redi_role()<>'administrator' then raise exception 'Administrator required' using errcode='42501'; end if;
  return jsonb_build_object(
    'members',coalesce((select jsonb_agg(jsonb_build_object('userId',u.id,'email',u.email,'role',coalesce(m.role,'public_viewer'),'active',coalesce(m.active,true),'scopes',coalesce(m.scopes,'[]'),'canReview',coalesce(m.can_review,false),'canExport',coalesce(m.can_export,false)) order by u.email) from auth.users u left join public.redi_memberships m on m.user_id=u.id),'[]'),
    'audit',coalesce((select jsonb_agg(to_jsonb(a)) from (select id,occurred_at,actor_id,entity_type,entity_id,action from public.redi_audit_events order by occurred_at desc limit 100) a),'[]'),
    'deleted',coalesce((select jsonb_agg(jsonb_build_object('id',id,'collection',collection,'name',data->>'name','deletedAt',deleted_at)) from public.redi_records where deleted_at is not null),'[]')
  );
end; $$;
create or replace function public.redi_set_member(p_user uuid,p_role text,p_scopes jsonb,p_active boolean default true,p_review boolean default false,p_export boolean default true)
returns void language plpgsql security definer set search_path='' as $$
declare before_row jsonb; scope jsonb; after_row jsonb;
begin
  if public.redi_role()<>'administrator' then raise exception 'Administrator required' using errcode='42501'; end if;
  if p_role not in ('public_viewer','authorized_viewer','gis_editor','administrator') or jsonb_typeof(p_scopes) is distinct from 'array' or jsonb_array_length(p_scopes)>100 then raise exception 'Invalid membership' using errcode='22023'; end if;
  for scope in select * from jsonb_array_elements(p_scopes) loop
    if jsonb_typeof(scope)<>'object' or coalesce(scope->>'country','') !~ '^(\*|[A-Z]{2})$' or exists(select 1 from jsonb_each(scope) where key<>all(array['country','region','county','municipality','communityId']) or jsonb_typeof(value)<>'string' or length(value#>>'{}')>200) then raise exception 'Invalid geographic scope' using errcode='22023'; end if;
  end loop;
  perform pg_advisory_xact_lock(270012);
  select to_jsonb(m) into before_row from public.redi_memberships m where user_id=p_user;
  if before_row->>'role'='administrator' and before_row->>'active'='true' and (p_role<>'administrator' or not p_active) and (select count(*) from public.redi_memberships where role='administrator' and active)<=1 then raise exception 'Cannot remove the final administrator' using errcode='22023'; end if;
  insert into public.redi_memberships(user_id,role,scopes,active,can_review,can_export) values(p_user,p_role,p_scopes,p_active,p_review,p_export)
  on conflict(user_id) do update set role=excluded.role,scopes=excluded.scopes,active=excluded.active,can_review=excluded.can_review,can_export=excluded.can_export,updated_at=now();
  select to_jsonb(m) into after_row from public.redi_memberships m where user_id=p_user;
  insert into public.redi_audit_events(actor_id,entity_type,entity_id,action,before_data,after_data) values(auth.uid(),'membership',p_user::text,'permissions_changed',before_row,after_row);
end; $$;

-- Source summaries may contain cross-country source sheets: expose them only for global grants.
create or replace function public.redi_workspace_summaries() returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
  if not public.redi_is_global() then return '[]'::jsonb; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id',id,'importedAt',imported_at) || report order by imported_at,id) from public.redi_summaries where coalesce(report->>'kind','')<>'boundary-import'),'[]');
end; $$;

create or replace function public.redi_import_summary(p_id text,p_report jsonb,p_original text) returns jsonb language plpgsql security definer set search_path='' as $$
declare stored public.redi_summaries%rowtype; inserted integer;
begin
  if public.redi_role() not in ('gis_editor','administrator') or not public.redi_is_global() then raise exception 'Global editor access required' using errcode='42501'; end if;
  if p_id is null or p_original is null or p_id !~ '^[0-9a-f]{64}$' or p_id<>encode(sha256(convert_to(p_original,'UTF8')),'hex') or p_id in ('0c6b1d680106bf4869048f91685f29adfb5fabf4616a91e147496826d214d29d','208aed3a51dd89b3cf44001af95e1b07732e0b562601b3d32a9a11a47edd4c8a') or p_report->>'kind'='boundary-import' or jsonb_typeof(p_report) is distinct from 'object' or octet_length(p_original)>5000000 then raise exception 'Invalid summary' using errcode='22023'; end if;
  insert into public.redi_summaries(id,report,original_csv) values(p_id,p_report,p_original) on conflict(id) do nothing;
  get diagnostics inserted=row_count;
  select * into stored from public.redi_summaries where id=p_id;
  return jsonb_build_object('report',stored.report || jsonb_build_object('id',stored.id,'importedAt',stored.imported_at),'duplicate',inserted=0);
end; $$;
create or replace function public.redi_summary_source(p_id text) returns text language plpgsql stable security definer set search_path='' as $$
begin
  if public.redi_role()<>'administrator' then raise exception 'Administrator required' using errcode='42501'; end if;
  return (select original_csv from public.redi_summaries where id=p_id);
end; $$;
create or replace function public.redi_audit_summary() returns trigger language plpgsql security definer set search_path='' as $$
begin
  if TG_OP='INSERT' then
    insert into public.redi_audit_events(actor_id,entity_type,entity_id,action,after_data) values(auth.uid(),'summary',NEW.id,'import',NEW.report);
  else
    insert into public.redi_audit_events(actor_id,entity_type,entity_id,action,before_data,after_data) values(auth.uid(),'summary',NEW.id,'update',OLD.report,NEW.report);
  end if;
  return null;
end; $$;
drop trigger if exists redi_summary_audit on public.redi_summaries;
create trigger redi_summary_audit after insert or update on public.redi_summaries for each row execute function public.redi_audit_summary();
revoke all on function public.redi_import_summary(text,jsonb,text),public.redi_summary_source(text),public.redi_audit_summary() from public,anon,authenticated;
grant execute on function public.redi_import_summary(text,jsonb,text),public.redi_summary_source(text) to authenticated;

-- Export uses an explicit allowlist; raw contacts, personal names, free text and extra columns never escape here.
create or replace function public.redi_export_data(p_collection text) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare fields text[];
begin
  if not public.redi_can_export() then raise exception 'Export permission required' using errcode='42501'; end if;
  fields:=case p_collection
    when 'communities' then array['id','name','kind','status','classification','country','region','county','locality','siruta','population','geometry','locationAccuracy','boundary']
    when 'entrepreneurs' then array['id','business','sector','country','region','county','locality','siruta','communityId','lat','lng','approx']
    when 'clients' then array['id','partner','country','region','county','locality','siruta','communityId','amount','year','lat','lng','approx']
    when 'localities' then array['id','siruta','name','country','county','lat','lng']
    else null end;
  if fields is null then raise exception 'Unknown collection' using errcode='22023'; end if;
  return coalesce((select jsonb_agg((select jsonb_object_agg(key,value) from jsonb_each(r.data) where key=any(fields))) from public.redi_records r where collection=p_collection and deleted_at is null and public.redi_in_scope(data) and (coalesce(data->>'visibility','restricted')<>'confidential' or public.redi_role()='administrator')),'[]');
end; $$;

create or replace function public.redi_record_history(p_type text,p_id text) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
  if public.redi_role()<>'administrator' then raise exception 'Administrator required' using errcode='42501'; end if;
  return coalesce((select jsonb_agg(to_jsonb(a)) from (select * from public.redi_audit_events where entity_type=p_type and entity_id=p_id order by occurred_at desc limit 100) a),'[]');
end; $$;
revoke all on function public.redi_record_history(text,text) from public,anon,authenticated;
grant execute on function public.redi_record_history(text,text) to authenticated;

-- First administrator: service-role-only, and only while no administrator exists.
create or replace function public.redi_bootstrap_admin(p_email text) returns uuid language plpgsql security definer set search_path='' as $$
declare uid uuid;
begin
  perform pg_advisory_xact_lock(270012);
  if exists(select 1 from public.redi_memberships where role='administrator') then raise exception 'An administrator already exists. Use Administration.' using errcode='22023'; end if;
  select id into uid from auth.users where lower(email)=lower(trim(p_email));
  if uid is null then raise exception 'Create the Supabase Auth user first' using errcode='22023'; end if;
  insert into public.redi_memberships(user_id,role,scopes,can_review,can_export) values(uid,'administrator','[]',true,true)
  on conflict(user_id) do update set role='administrator',active=true,can_review=true,can_export=true,updated_at=now();
  insert into public.redi_audit_events(actor_id,entity_type,entity_id,action) values(uid,'membership',uid::text,'administrator_bootstrap');
  return uid;
end; $$;
revoke all on function public.redi_bootstrap_admin(text) from public,anon,authenticated;
grant execute on function public.redi_bootstrap_admin(text) to service_role;

-- Default PUBLIC function execution is revoked, including helper functions.
revoke all on function public.redi_role(),public.redi_in_scope(jsonb),public.redi_is_global(),public.redi_can_export(),public.redi_can_review(),public.redi_valid_geometry(jsonb),public.redi_audit_record() from public,anon,authenticated;
revoke all on function public.redi_access_profile(),public.redi_workspace_data(),public.redi_workspace_summaries(),public.redi_submit_proposal(jsonb),public.redi_list_proposals(),public.redi_transition_proposal(uuid,text,text,text,boolean,boolean,boolean),public.redi_mutate_records(text,text,jsonb,text[],boolean),public.redi_admin_overview(),public.redi_set_member(uuid,text,jsonb,boolean,boolean,boolean),public.redi_export_data(text) from public,anon,authenticated;
grant execute on function public.redi_access_profile(),public.redi_workspace_data(),public.redi_submit_proposal(jsonb),public.redi_workspace_summaries() to anon,authenticated;
grant execute on function public.redi_list_proposals(),public.redi_transition_proposal(uuid,text,text,text,boolean,boolean,boolean),public.redi_mutate_records(text,text,jsonb,text[],boolean),public.redi_admin_overview(),public.redi_set_member(uuid,text,jsonb,boolean,boolean,boolean),public.redi_export_data(text) to authenticated;
notify pgrst,'reload schema';
commit;
