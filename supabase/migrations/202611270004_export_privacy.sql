begin;

-- Field-level export permissions. Sensitive fields are grouped; each member is granted groups explicitly.
-- Existing exporters keep every group they could already export (one-time backfill when the column is created);
-- members created afterwards start with base fields only.
do $$
begin
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='redi_memberships' and column_name='export_groups') then
    alter table public.redi_memberships add column export_groups text[] not null default '{}';
    update public.redi_memberships set export_groups=array['precise_location','financial','business_identity'] where can_export;
  end if;
end $$;

create or replace function public.redi_export_groups() returns text[] language sql stable security definer set search_path='' as $$
  select case when public.redi_role()='administrator' then array['precise_location','financial','business_identity']
    else coalesce((select export_groups from public.redi_memberships where user_id=auth.uid() and active and role<>'public_viewer'),'{}') end;
$$;

create or replace function public.redi_access_profile() returns jsonb language sql stable security definer set search_path='' as $$
  select jsonb_build_object('role',public.redi_role(),'scopes',coalesce((select scopes from public.redi_memberships where user_id=auth.uid() and active),'[]'::jsonb),
    'canReview',public.redi_can_review(),'canExport',public.redi_can_export(),'exportGroups',to_jsonb(public.redi_export_groups()));
$$;

create or replace function public.redi_export_data(p_collection text) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare fields text[]; groups text[];
begin
  if not public.redi_can_export() then raise exception 'Export permission required' using errcode='42501'; end if;
  groups:=public.redi_export_groups();
  fields:=case p_collection
    when 'communities' then array['id','name','kind','status','classification','country','region','county','locality','siruta','population','locationAccuracy']
      || case when 'precise_location'=any(groups) then array['geometry','boundary'] else '{}' end
    when 'entrepreneurs' then array['id','sector','country','region','county','locality','siruta','communityId','approx']
      || case when 'precise_location'=any(groups) then array['lat','lng'] else '{}' end
      || case when 'business_identity'=any(groups) then array['business'] else '{}' end
    when 'clients' then array['id','country','region','county','locality','siruta','communityId','year','approx']
      || case when 'precise_location'=any(groups) then array['lat','lng'] else '{}' end
      || case when 'financial'=any(groups) then array['amount','currency'] else '{}' end
      || case when 'business_identity'=any(groups) then array['partner'] else '{}' end
    when 'localities' then array['id','siruta','name','country','county','lat','lng']
    else null end;
  if fields is null then raise exception 'Unknown collection' using errcode='22023'; end if;
  return coalesce((select jsonb_agg((select jsonb_object_agg(key,value) from jsonb_each(r.data) where key=any(fields))) from public.redi_records r where collection=p_collection and deleted_at is null and public.redi_in_scope(data) and (coalesce(data->>'visibility','restricted')<>'confidential' or public.redi_role()='administrator')),'[]');
end; $$;

create or replace function public.redi_set_export_groups(p_user uuid,p_groups text[]) returns jsonb language plpgsql security definer set search_path='' as $$
declare before_groups text[]; clean text[];
begin
  if public.redi_role()<>'administrator' then raise exception 'Administrator required' using errcode='42501'; end if;
  if p_groups is null or exists(select 1 from unnest(p_groups) g where g<>all(array['precise_location','financial','business_identity'])) then raise exception 'Invalid export groups' using errcode='22023'; end if;
  select array_agg(distinct g order by g) into clean from unnest(p_groups) g;
  select export_groups into before_groups from public.redi_memberships where user_id=p_user for update;
  if not found then raise exception 'Membership not found' using errcode='P0002'; end if;
  update public.redi_memberships set export_groups=coalesce(clean,'{}'),updated_at=now() where user_id=p_user;
  insert into public.redi_audit_events(actor_id,entity_type,entity_id,action,before_data,after_data)
    values(auth.uid(),'membership',p_user::text,'export_fields_changed',jsonb_build_object('exportGroups',before_groups),jsonb_build_object('exportGroups',coalesce(clean,'{}')));
  return to_jsonb(coalesce(clean,'{}'));
end; $$;

create or replace function public.redi_export_groups_overview() returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
  if public.redi_role()<>'administrator' then raise exception 'Administrator required' using errcode='42501'; end if;
  return coalesce((select jsonb_object_agg(user_id::text,to_jsonb(export_groups)) from public.redi_memberships),'{}');
end; $$;

-- Privacy risk assessment is part of every publication. The database derives a minimum risk level from the
-- geometry being disclosed, so a client cannot under-report it, and requires a written justification whenever
-- a public release carries medium or high risk.
create or replace function public.redi_publication_guard() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if NEW.collection<>'communities' then return NEW;end if;
 if TG_OP='UPDATE' and auth.uid() is not null and current_setting('redi.publication_writer',true) is distinct from 'on' and
 exists(select 1 from unnest(array['publicRecord','publicGeometry','publicationStatus','visibility','privacyReviewed','privacyAssessment']) k where NEW.data->k is distinct from OLD.data->k) then raise exception 'Use the reviewed publication workflow' using errcode='42501';end if;
 -- Exact public geometry is only released through redi_publish_community_assessed (e.g. not straight from a proposal).
 if TG_OP='INSERT' and auth.uid() is not null and jsonb_typeof(NEW.data->'publicGeometry')='object' and not (NEW.data ? 'privacyAssessment') then
   raise exception 'Exact geometry requires the assessed publication workflow' using errcode='22023';end if;
 if TG_OP='INSERT' and NEW.data->>'visibility'='public' and NEW.data->>'publicationStatus'='published' and NEW.data->'privacyReviewed'='true'::jsonb then NEW.data:=NEW.data||jsonb_build_object('publicRecord',public.redi_public_record(NEW.data));end if;
 return NEW;
end; $$;

create or replace function public.redi_publish_community_assessed(p_id text,p_expected jsonb,p_public boolean,p_share_geometry boolean,p_assessment jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb; floor_level int:=0; claimed int; final_level int; justification text; previous_flag text; stamped jsonb;
begin
 if public.redi_role()<>'administrator' then raise exception 'Administrator required' using errcode='42501';end if;
 if jsonb_typeof(p_assessment) is distinct from 'object' or jsonb_typeof(p_assessment->'factors') is distinct from 'array'
   or coalesce(p_assessment->>'level','') not in ('low','medium','high') then raise exception 'Privacy assessment required' using errcode='22023';end if;
 claimed:=array_position(array['low','medium','high'],p_assessment->>'level')-1;
 if p_public and p_share_geometry then
   floor_level:=case when p_expected->'geometry'->>'type' in ('Point','MultiPoint','LineString','MultiLineString') or p_expected->>'kind' in ('punct','strada') then 2 else 1 end;
 end if;
 final_level:=greatest(claimed,floor_level);
 justification:=btrim(coalesce(p_assessment->>'justification',''));
 if length(justification)>2000 then raise exception 'Justification too long' using errcode='22023';end if;
 if p_public and final_level>0 and length(justification)<20 then raise exception 'Privacy justification required' using errcode='22023';end if;
 result:=public.redi_publish_community(p_id,p_expected,p_public,p_share_geometry,true);
 stamped:=jsonb_build_object('level',(array['low','medium','high'])[final_level+1],'factors',p_assessment->'factors','justification',nullif(justification,''),
   'public',p_public,'sharedGeometry',p_share_geometry,'assessedBy',auth.uid(),'assessedAt',clock_timestamp());
 previous_flag:=current_setting('redi.publication_writer',true);perform set_config('redi.publication_writer','on',true);
 update public.redi_records set data=data||jsonb_build_object('privacyAssessment',stamped) where collection='communities' and id=p_id returning data into result;
 perform set_config('redi.publication_writer',coalesce(previous_flag,''),true);
 insert into public.redi_audit_events(actor_id,entity_type,entity_id,action,after_data) values(auth.uid(),'communities',p_id,'privacy_assessed',stamped);
 return result;
end; $$;

revoke all on function public.redi_export_groups(),public.redi_set_export_groups(uuid,text[]),public.redi_export_groups_overview(),public.redi_publish_community_assessed(text,jsonb,boolean,boolean,jsonb) from public,anon,authenticated;
-- Publication must go through the assessed path; the unassessed RPC stays callable only internally.
revoke all on function public.redi_publish_community(text,jsonb,boolean,boolean,boolean) from public,anon,authenticated;
grant execute on function public.redi_set_export_groups(uuid,text[]),public.redi_export_groups_overview(),public.redi_publish_community_assessed(text,jsonb,boolean,boolean,jsonb) to authenticated;
notify pgrst,'reload schema';
commit;
