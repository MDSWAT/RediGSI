begin;

-- Anonymous visitors have a 3 s statement limit. Building the public projection on every request
-- re-read each large outline document many times and could exceed it. The projection is now stored
-- next to the record (recomputed by Postgres whenever data changes) and the workspace reads each
-- document at most once.
alter table public.redi_records add column if not exists public_view jsonb generated always as (
  case when collection='communities' and data->>'visibility'='public' and data->>'publicationStatus'='published'
        and data->'privacyReviewed'='true'::jsonb and jsonb_typeof(data->'publicRecord')='object'
    then public.redi_public_record(jsonb_set(data->'publicRecord','{publicGeometry}',coalesce(data->'publicRecord'->'geometry','null'::jsonb))) end
) stored;

create or replace function public.redi_workspace_data() returns jsonb language sql stable security definer set search_path='' as $$
 with me as (select public.redi_role() as role),
 rows as (
  select r.collection,r.created_at,r.id,r.public_view,
   case when me.role='administrator' then r.data-'publicRecord'-'publicGeometry'
        when me.role='public_viewer' then null
        when coalesce(r.data->>'visibility','restricted')<>'confidential' and public.redi_in_scope(r.data) then r.data-'publicRecord'-'publicGeometry'
   end as private_data
  from public.redi_records r cross join me
  where r.deleted_at is null and (me.role<>'public_viewer' or r.public_view is not null)
 ), visible as (
  select collection,created_at,id,coalesce(private_data,public_view) as data from rows
  where private_data is not null or public_view is not null
 ) select jsonb_build_object('communities',coalesce(jsonb_agg(data order by created_at,id) filter(where collection='communities'),'[]'::jsonb),'entrepreneurs',coalesce(jsonb_agg(data order by created_at,id) filter(where collection='entrepreneurs'),'[]'::jsonb),'clients',coalesce(jsonb_agg(data order by created_at,id) filter(where collection='clients'),'[]'::jsonb),'localities',coalesce(jsonb_agg(data order by created_at,id) filter(where collection='localities'),'[]'::jsonb)) from visible;
$$;
revoke all on function public.redi_workspace_data() from public;
grant execute on function public.redi_workspace_data() to anon,authenticated;

notify pgrst,'reload schema';
commit;
