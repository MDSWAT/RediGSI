begin;

-- Signed-in workspaces timed out (statement timeout) once every community carried a full outline:
-- each record held the polygon three times (geometry, publicGeometry, publicRecord.geometry) and the
-- role was re-read several times per row. The workspace now resolves the caller once and omits the
-- publication copies, which only the server-side publication flow reads.
create or replace function public.redi_workspace_data() returns jsonb language sql stable security definer set search_path='' as $$
 with me as (select public.redi_role() as role),
 visible as (
  select r.collection,r.created_at,r.id,
   case when me.role<>'public_viewer' and (me.role='administrator' or public.redi_in_scope(r.data))
         and (coalesce(r.data->>'visibility','restricted')<>'confidential' or me.role='administrator')
     then r.data-'publicRecord'-'publicGeometry'
     else public.redi_public_record((r.data->'publicRecord')||jsonb_build_object('publicGeometry',r.data->'publicRecord'->'geometry')) end as data
  from public.redi_records r cross join me
  where r.deleted_at is null and (
   (me.role<>'public_viewer' and (me.role='administrator' or public.redi_in_scope(r.data))
     and (coalesce(r.data->>'visibility','restricted')<>'confidential' or me.role='administrator'))
   or (r.collection='communities' and r.data->>'visibility'='public' and r.data->>'publicationStatus'='published'
       and r.data->'privacyReviewed'='true'::jsonb and jsonb_typeof(r.data->'publicRecord')='object')
  )
 ) select jsonb_build_object('communities',coalesce(jsonb_agg(data order by created_at,id) filter(where collection='communities'),'[]'::jsonb),'entrepreneurs',coalesce(jsonb_agg(data order by created_at,id) filter(where collection='entrepreneurs'),'[]'::jsonb),'clients',coalesce(jsonb_agg(data order by created_at,id) filter(where collection='clients'),'[]'::jsonb),'localities',coalesce(jsonb_agg(data order by created_at,id) filter(where collection='localities'),'[]'::jsonb)) from visible;
$$;
revoke all on function public.redi_workspace_data() from public;
grant execute on function public.redi_workspace_data() to anon,authenticated;

-- The publication version check compares against the record the workspace delivered, so it must
-- ignore the publication copies the workspace no longer sends.
create or replace function public.redi_publish_community(p_id text,p_expected jsonb,p_public boolean,p_share_geometry boolean,p_privacy_reviewed boolean)
returns jsonb language plpgsql security definer set search_path='' as $$
declare previous public.redi_records%rowtype; result jsonb; previous_flag text;
begin
 if public.redi_role()<>'administrator' then raise exception 'Administrator required' using errcode='42501';end if;
 if p_privacy_reviewed is distinct from true or p_public is null or p_share_geometry is null then raise exception 'Explicit privacy review required' using errcode='22023';end if;
 select * into previous from public.redi_records where collection='communities' and id=p_id and deleted_at is null for update;
 if not found then raise exception 'Record not found' using errcode='P0002';end if;
 if previous.data-'publicRecord'-'publicGeometry' is distinct from p_expected-'publicRecord'-'publicGeometry' then raise exception 'Record changed. Review the current version.' using errcode='40001';end if;
 if p_share_geometry and (not p_public or not public.redi_geometry_valid(previous.data->'geometry')) then raise exception 'Invalid public geometry' using errcode='22023';end if;
 result:=previous.data||jsonb_build_object('publicationStatus','published','visibility',case when p_public then 'public' else 'restricted' end,'privacyReviewed',true,'publicGeometry',case when p_public and p_share_geometry then previous.data->'geometry' else 'null'::jsonb end);
 result:=result||jsonb_build_object('publicRecord',case when p_public then public.redi_public_record(result) else 'null'::jsonb end);
 previous_flag:=current_setting('redi.publication_writer',true);perform set_config('redi.publication_writer','on',true);
 update public.redi_records set data=result,updated_at=clock_timestamp() where collection='communities' and id=p_id;
 perform set_config('redi.publication_writer',coalesce(previous_flag,''),true);
 insert into public.redi_audit_events(actor_id,entity_type,entity_id,action,before_data,after_data) values(auth.uid(),'communities',p_id,'publication_reviewed',previous.data,result);
 return result;
end; $$;
revoke all on function public.redi_publish_community(text,jsonb,boolean,boolean,boolean) from public,anon,authenticated;

notify pgrst,'reload schema';
commit;
