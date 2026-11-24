begin;

-- Flexible JSONB preserves geometries and every extra imported column.
create table if not exists public.redi_records (
  collection text not null check (collection in ('communities', 'entrepreneurs', 'clients', 'localities')),
  id text not null,
  data jsonb not null check (
    jsonb_typeof(data) = 'object' and data ? 'id'
    and jsonb_typeof(data->'id') = 'string' and data->>'id' = id
  ),
  created_at timestamptz not null default now(),
  primary key (collection, id)
);

create table if not exists public.redi_summaries (
  id text primary key check (id ~ '^[0-9a-f]{64}$'),
  imported_at timestamptz not null default now(),
  report jsonb not null check (jsonb_typeof(report) = 'object'),
  original_csv text not null
);

alter table public.redi_records enable row level security;
alter table public.redi_summaries enable row level security;
-- Persistence is only exposed through the existing server API, never the browser key.
revoke all on public.redi_records, public.redi_summaries from public, anon, authenticated;
grant select, insert, update, delete on public.redi_records, public.redi_summaries to service_role;

-- JSON aggregation returns the complete dataset even above the Data API row cap.
create or replace function public.redi_read_data()
returns jsonb language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object(
    'communities', coalesce(jsonb_agg(data order by created_at, id) filter (where collection = 'communities'), '[]'::jsonb),
    'entrepreneurs', coalesce(jsonb_agg(data order by created_at, id) filter (where collection = 'entrepreneurs'), '[]'::jsonb),
    'clients', coalesce(jsonb_agg(data order by created_at, id) filter (where collection = 'clients'), '[]'::jsonb),
    'localities', coalesce(jsonb_agg(data order by created_at, id) filter (where collection = 'localities'), '[]'::jsonb)
  ) from public.redi_records;
$$;

-- Merge only the specified fields inside PostgreSQL, keeping other records intact.
create or replace function public.redi_update_records(p_collection text, p_items jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare result jsonb;
begin
  if p_collection not in ('communities', 'entrepreneurs', 'clients', 'localities') then
    raise exception 'Unknown collection' using errcode = '22023';
  end if;
  if jsonb_typeof(p_items) is distinct from 'array' then
    raise exception 'Expected a JSON array' using errcode = '22023';
  end if;
  with patches as (
    select distinct on (item->>'id') item
    from jsonb_array_elements(p_items) with ordinality as p(item, position)
    where jsonb_typeof(item) = 'object' and jsonb_typeof(item->'id') = 'string'
    order by item->>'id', position desc
  ), changed as (
    update public.redi_records as record
    set data = record.data || patches.item || jsonb_build_object('id', record.id)
    from patches
    where record.collection = p_collection and record.id = patches.item->>'id'
    returning record.data
  ) select coalesce(jsonb_agg(data), '[]'::jsonb) into result from changed;
  return result;
end;
$$;

create or replace function public.redi_delete_records(p_collection text, p_ids text[] default '{}', p_all boolean default false)
returns bigint language plpgsql security invoker set search_path = '' as $$
declare removed bigint;
begin
  if p_collection not in ('communities', 'entrepreneurs', 'clients', 'localities') then
    raise exception 'Unknown collection' using errcode = '22023';
  end if;
  delete from public.redi_records where collection = p_collection and (p_all or id = any(p_ids));
  get diagnostics removed = row_count;
  return removed;
end;
$$;

revoke all on function public.redi_read_data() from public, anon, authenticated;
revoke all on function public.redi_update_records(text, jsonb) from public, anon, authenticated;
revoke all on function public.redi_delete_records(text, text[], boolean) from public, anon, authenticated;
grant execute on function public.redi_read_data() to service_role;
grant execute on function public.redi_update_records(text, jsonb) to service_role;
grant execute on function public.redi_delete_records(text, text[], boolean) to service_role;

notify pgrst, 'reload schema';
commit;
