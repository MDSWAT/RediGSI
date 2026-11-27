begin;

-- With the full workbook (4,500+ communities with outlines) one workspace response is larger than a
-- serverless response may be and slower than the anonymous statement limit. The workspace is now
-- also readable in pages; each page applies exactly the same access rules as redi_workspace_data.
create or replace function public.redi_workspace_page(p_offset integer, p_limit integer) returns jsonb language sql stable security definer set search_path='' as $$
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
  order by collection,created_at,id
  offset greatest(coalesce(p_offset,0),0) limit least(greatest(coalesce(p_limit,500),1),2000)
 ) select jsonb_build_object('communities',coalesce(jsonb_agg(data order by created_at,id) filter(where collection='communities'),'[]'::jsonb),'entrepreneurs',coalesce(jsonb_agg(data order by created_at,id) filter(where collection='entrepreneurs'),'[]'::jsonb),'clients',coalesce(jsonb_agg(data order by created_at,id) filter(where collection='clients'),'[]'::jsonb),'localities',coalesce(jsonb_agg(data order by created_at,id) filter(where collection='localities'),'[]'::jsonb),'count',count(*)) from visible;
$$;
revoke all on function public.redi_workspace_page(integer,integer) from public;
grant execute on function public.redi_workspace_page(integer,integer) to anon,authenticated;

notify pgrst,'reload schema';
commit;
