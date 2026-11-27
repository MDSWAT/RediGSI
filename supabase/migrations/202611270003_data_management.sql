begin;
create table if not exists public.redi_classifications (
 id uuid primary key default gen_random_uuid(), name text not null check(length(trim(name)) between 2 and 100),
 description text not null default '' check(length(description)<=1000),active boolean not null default true,updated_at timestamptz not null default now()
);
create unique index if not exists redi_classification_name on public.redi_classifications(lower(name));
alter table public.redi_classifications enable row level security;
revoke all on public.redi_classifications from public,anon,authenticated;
grant all on public.redi_classifications to service_role;
create or replace function public.redi_classification_list() returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(case when public.redi_role()='administrator' then to_jsonb(c) else jsonb_build_object('id',c.id,'name',c.name,'active',c.active) end order by name),'[]') from public.redi_classifications c where active or public.redi_role()='administrator';
$$;
create or replace function public.redi_classification_save(p_id uuid,p_name text,p_description text,p_active boolean,p_expected timestamptz default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare previous public.redi_classifications%rowtype; saved public.redi_classifications%rowtype;
begin
 if public.redi_role()<>'administrator' then raise exception 'Administrator required' using errcode='42501';end if;
 if p_name is null or length(trim(p_name)) not between 2 and 100 or length(coalesce(p_description,''))>1000 or p_active is null then raise exception 'Invalid classification' using errcode='22023';end if;
 if p_id is not null then
  select * into previous from public.redi_classifications where id=p_id for update;
  if not found then raise exception 'Classification not found' using errcode='P0002';end if;
  if previous.updated_at is distinct from p_expected then raise exception 'Classification changed' using errcode='40001';end if;
  update public.redi_classifications set name=trim(p_name),description=coalesce(p_description,''),active=p_active,updated_at=clock_timestamp() where id=p_id returning * into saved;
 else insert into public.redi_classifications(name,description,active) values(trim(p_name),coalesce(p_description,''),p_active) returning * into saved;
 end if;
 insert into public.redi_audit_events(actor_id,entity_type,entity_id,action,before_data,after_data) values(auth.uid(),'classification',saved.id::text,'classification_saved',case when p_id is null then null else to_jsonb(previous) end,to_jsonb(saved));
 return to_jsonb(saved);
end; $$;
revoke all on function public.redi_classification_list(),public.redi_classification_save(uuid,text,text,boolean,timestamptz) from public,anon,authenticated;
grant execute on function public.redi_classification_list() to anon,authenticated;
grant execute on function public.redi_classification_save(uuid,text,text,boolean,timestamptz) to authenticated;

-- Shared provider request budget; no raw queries or personal details are stored here.
create table if not exists public.redi_geocoder_budget (id boolean primary key default true check(id),last_request_at timestamptz not null);
alter table public.redi_geocoder_budget enable row level security;
revoke all on public.redi_geocoder_budget from public,anon,authenticated;
grant all on public.redi_geocoder_budget to service_role;
create or replace function public.redi_geocode_permit() returns void language plpgsql security definer set search_path='' as $$
begin
 if public.redi_role() not in ('gis_editor','administrator') then raise exception 'GIS editor required' using errcode='42501';end if;
 perform pg_advisory_xact_lock(270013);
 if exists(select 1 from public.redi_geocoder_budget where last_request_at>clock_timestamp()-interval '1 second') then raise exception 'Geocoder request limit' using errcode='P0001';end if;
 insert into public.redi_geocoder_budget(id,last_request_at) values(true,clock_timestamp()) on conflict(id) do update set last_request_at=excluded.last_request_at;
end; $$;
revoke all on function public.redi_geocode_permit() from public,anon,authenticated;
grant execute on function public.redi_geocode_permit() to authenticated;
-- Public information is a reviewed snapshot, never a live projection of editor changes.
create or replace function public.redi_public_record(d jsonb) returns jsonb language sql immutable set search_path='' as $$
 select jsonb_build_object('id',d->>'id','name',d->>'name','country',d->>'country','county',d->>'county','locality',d->>'locality','kind',d->>'kind','status',d->>'status','classification',d->>'classification','source',d->>'source','geometry',d->'publicGeometry');
$$;
-- Freeze only information already explicitly approved/public; no restricted record becomes public.
update public.redi_records set data=data||jsonb_build_object('publicRecord',public.redi_public_record(data))
where collection='communities' and data->>'visibility'='public' and data->>'publicationStatus'='published' and data->'privacyReviewed'='true'::jsonb and not (data ? 'publicRecord');
create or replace function public.redi_publication_guard() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if NEW.collection<>'communities' then return NEW;end if;
 if TG_OP='UPDATE' and auth.uid() is not null and current_setting('redi.publication_writer',true) is distinct from 'on' and
 exists(select 1 from unnest(array['publicRecord','publicGeometry','publicationStatus','visibility','privacyReviewed']) k where NEW.data->k is distinct from OLD.data->k) then raise exception 'Use the reviewed publication workflow' using errcode='42501';end if;
 if TG_OP='INSERT' and NEW.data->>'visibility'='public' and NEW.data->>'publicationStatus'='published' and NEW.data->'privacyReviewed'='true'::jsonb then NEW.data:=NEW.data||jsonb_build_object('publicRecord',public.redi_public_record(NEW.data));end if;
 return NEW;
end; $$;
drop trigger if exists redi_publication_guard on public.redi_records;
create trigger redi_publication_guard before insert or update on public.redi_records for each row execute function public.redi_publication_guard();
create or replace function public.redi_publish_community(p_id text,p_expected jsonb,p_public boolean,p_share_geometry boolean,p_privacy_reviewed boolean)
returns jsonb language plpgsql security definer set search_path='' as $$
declare previous public.redi_records%rowtype; result jsonb; previous_flag text;
begin
 if public.redi_role()<>'administrator' then raise exception 'Administrator required' using errcode='42501';end if;
 if p_privacy_reviewed is distinct from true or p_public is null or p_share_geometry is null then raise exception 'Explicit privacy review required' using errcode='22023';end if;
 select * into previous from public.redi_records where collection='communities' and id=p_id and deleted_at is null for update;
 if not found then raise exception 'Record not found' using errcode='P0002';end if;
 if previous.data is distinct from p_expected then raise exception 'Record changed. Review the current version.' using errcode='40001';end if;
 if p_share_geometry and (not p_public or not public.redi_geometry_valid(previous.data->'geometry')) then raise exception 'Invalid public geometry' using errcode='22023';end if;
 result:=previous.data||jsonb_build_object('publicationStatus','published','visibility',case when p_public then 'public' else 'restricted' end,'privacyReviewed',true,'publicGeometry',case when p_public and p_share_geometry then previous.data->'geometry' else 'null'::jsonb end);
 result:=result||jsonb_build_object('publicRecord',case when p_public then public.redi_public_record(result) else 'null'::jsonb end);
 previous_flag:=current_setting('redi.publication_writer',true);perform set_config('redi.publication_writer','on',true);
 update public.redi_records set data=result,updated_at=clock_timestamp() where collection='communities' and id=p_id;
 perform set_config('redi.publication_writer',coalesce(previous_flag,''),true);
 insert into public.redi_audit_events(actor_id,entity_type,entity_id,action,before_data,after_data) values(auth.uid(),'communities',p_id,'publication_reviewed',previous.data,result);
 return result;
end; $$;
create or replace function public.redi_workspace_data() returns jsonb language sql stable security definer set search_path='' as $$
 with visible as (
 select collection,created_at,id,case when public.redi_role()<>'public_viewer' and public.redi_in_scope(data) and (coalesce(data->>'visibility','restricted')<>'confidential' or public.redi_role()='administrator') then data else public.redi_public_record((data->'publicRecord')||jsonb_build_object('publicGeometry',data->'publicRecord'->'geometry')) end as data
 from public.redi_records where deleted_at is null and (
  (public.redi_role()<>'public_viewer' and public.redi_in_scope(data) and (coalesce(data->>'visibility','restricted')<>'confidential' or public.redi_role()='administrator'))
  or (collection='communities' and data->>'visibility'='public' and data->>'publicationStatus'='published' and data->'privacyReviewed'='true'::jsonb and jsonb_typeof(data->'publicRecord')='object')
 )
 ) select jsonb_build_object('communities',coalesce(jsonb_agg(data order by created_at,id) filter(where collection='communities'),'[]'::jsonb),'entrepreneurs',coalesce(jsonb_agg(data order by created_at,id) filter(where collection='entrepreneurs'),'[]'::jsonb),'clients',coalesce(jsonb_agg(data order by created_at,id) filter(where collection='clients'),'[]'::jsonb),'localities',coalesce(jsonb_agg(data order by created_at,id) filter(where collection='localities'),'[]'::jsonb)) from visible;
$$;
-- A geocoder lookup must be tied to a record the editor can actually modify.
create or replace function public.redi_geocode_target(p_id text) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare d jsonb;
begin
 if public.redi_role() not in ('gis_editor','administrator') then raise exception 'GIS editor required' using errcode='42501';end if;
 select data into d from public.redi_records where collection='communities' and id=p_id and deleted_at is null;
 if not found then raise exception 'Record not found' using errcode='P0002';end if;
 if not public.redi_in_scope(d) or (d->>'visibility'='confidential' and public.redi_role()<>'administrator') then raise exception 'Outside geographic scope' using errcode='42501';end if;
 return jsonb_build_object('country',d->>'country','county',d->>'county','locality',d->>'locality');
end; $$;
revoke all on function public.redi_public_record(jsonb),public.redi_publication_guard(),public.redi_publish_community(text,jsonb,boolean,boolean,boolean),public.redi_geocode_target(text) from public,anon,authenticated;
grant execute on function public.redi_publish_community(text,jsonb,boolean,boolean,boolean),public.redi_geocode_target(text) to authenticated;
notify pgrst,'reload schema';
commit;
