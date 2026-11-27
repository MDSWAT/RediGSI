begin;
-- Coordinate validation also supports the existing road and multipart geometries.
create or replace function public.redi_geometry_valid(g jsonb) returns boolean language plpgsql immutable set search_path='' as $$
declare part jsonb; ring jsonb; coordinates jsonb; kind text;
begin
  if g is null or jsonb_typeof(g)<>'object' then return false; end if;
  kind:=g->>'type'; coordinates:=g->'coordinates';
  if kind='GeometryCollection' then
    if jsonb_typeof(g->'geometries') is distinct from 'array' or jsonb_array_length(g->'geometries')=0 then return false; end if;
    for part in select * from jsonb_array_elements(g->'geometries') loop if not public.redi_geometry_valid(part) then return false; end if; end loop;return true;
  end if;
  if jsonb_typeof(coordinates) is distinct from 'array' or jsonb_array_length(coordinates)=0 then return false; end if;
  if kind='Point' then
    return jsonb_array_length(coordinates) between 2 and 3 and jsonb_typeof(coordinates->0)='number' and jsonb_typeof(coordinates->1)='number'
      and (coordinates->>0)::numeric between -180 and 180 and (coordinates->>1)::numeric between -90 and 90
      and (jsonb_array_length(coordinates)=2 or jsonb_typeof(coordinates->2)='number');
  elsif kind in ('LineString','MultiPoint') then
    if kind='LineString' and jsonb_array_length(coordinates)<2 then return false; end if;
    for part in select * from jsonb_array_elements(coordinates) loop if not public.redi_geometry_valid(jsonb_build_object('type','Point','coordinates',part)) then return false; end if; end loop;return true;
  elsif kind='Polygon' then
    for ring in select * from jsonb_array_elements(coordinates) loop
      if jsonb_typeof(ring) is distinct from 'array' or jsonb_array_length(ring)<4 or ring->0 is distinct from ring->(jsonb_array_length(ring)-1) then return false; end if;
      if not public.redi_geometry_valid(jsonb_build_object('type','LineString','coordinates',ring)) then return false; end if;
    end loop;return true;
  elsif kind in ('MultiLineString','MultiPolygon') then
    for part in select * from jsonb_array_elements(coordinates) loop
      if not public.redi_geometry_valid(jsonb_build_object('type',case when kind='MultiPolygon' then 'Polygon' else 'LineString' end,'coordinates',part)) then return false; end if;
    end loop;return true;
  end if;
  return false;
exception when others then return false;
end; $$;

-- Require version-checked geometry writes even when callers invoke generic mutation RPCs.
create or replace function public.redi_guard_geometry_update() returns trigger language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() is not null and NEW.collection='communities' then
    if NEW.data->'geometry' is not null and NEW.data->'geometry'<>'null'::jsonb and not public.redi_geometry_valid(NEW.data->'geometry') then raise exception 'Invalid geometry' using errcode='22023'; end if;
    if TG_OP='UPDATE' and (NEW.data->'geometry' is distinct from OLD.data->'geometry' or NEW.data->'geometrySource' is distinct from OLD.data->'geometrySource' or NEW.data->'geometryUpdatedAt' is distinct from OLD.data->'geometryUpdatedAt' or NEW.data->'geocoding' is distinct from OLD.data->'geocoding') and current_setting('redi.geometry_editor',true) is distinct from 'on' then
      raise exception 'Use the version-checked geometry editor' using errcode='42501';
    end if;
  end if;
  return NEW;
end; $$;
drop trigger if exists redi_geometry_guard on public.redi_records;
create trigger redi_geometry_guard before insert or update on public.redi_records for each row execute function public.redi_guard_geometry_update();
revoke all on function public.redi_guard_geometry_update() from public,anon,authenticated;

create or replace function public.redi_update_geometry(p_id text,p_geometry jsonb,p_expected jsonb,p_geocoding jsonb default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare previous public.redi_records%rowtype; result jsonb; prior_guard text;
begin
  if public.redi_role() not in ('gis_editor','administrator') then raise exception 'GIS editor required' using errcode='42501'; end if;
  if p_id is null or not public.redi_geometry_valid(p_geometry) or octet_length(p_geometry::text)>1000000 then raise exception 'Invalid geometry' using errcode='22023'; end if;
  if p_geocoding is not null and (jsonb_typeof(p_geocoding) is distinct from 'object' or octet_length(p_geocoding::text)>2000 or jsonb_typeof(p_geocoding->'source') is distinct from 'string' or length(p_geocoding->>'source') not between 1 and 253 or coalesce(p_geocoding->>'accuracy','') not in ('address','street','locality','region','unknown') or jsonb_typeof(p_geocoding->'label') is distinct from 'string' or length(p_geocoding->>'label')>500 or exists(select 1 from jsonb_each(p_geocoding) where key<>all(array['source','accuracy','label']))) then raise exception 'Invalid geocoding metadata' using errcode='22023';end if;
  select * into previous from public.redi_records where collection='communities' and id=p_id and deleted_at is null for update;
  if not found then raise exception 'Record not found' using errcode='P0002'; end if;
  if not public.redi_in_scope(previous.data) or (previous.data->>'visibility'='confidential' and public.redi_role()<>'administrator') then raise exception 'Outside geographic scope' using errcode='42501'; end if;
  if coalesce(previous.data->'geometry','null'::jsonb) is distinct from coalesce(p_expected,'null'::jsonb) then raise exception 'Geometry changed. Reload before saving.' using errcode='40001'; end if;
  -- Keep the original in the version audit. A corrected shape must not claim to be an official boundary.
  -- publicGeometry is deliberately unchanged: editing never silently republishes precise locations.
  result:=(previous.data-'boundary'-'locationAccuracy'-'geocoding') || jsonb_build_object('geometry',p_geometry,'geometrySource','manual_correction','geometryUpdatedAt',now(),
    'kind',case p_geometry->>'type' when 'Point' then 'punct' when 'MultiPoint' then 'punct' when 'LineString' then 'strada' when 'MultiLineString' then 'strada' else 'zona' end);
  if p_geocoding is not null then result:=result||jsonb_build_object('geocoding',p_geocoding);end if;
  prior_guard:=current_setting('redi.geometry_editor',true);
  perform set_config('redi.geometry_editor','on',true);
  update public.redi_records set data=result,updated_at=now() where collection='communities' and id=p_id;
  perform set_config('redi.geometry_editor',coalesce(prior_guard,''),true);
  return result;
end; $$;
revoke all on function public.redi_geometry_valid(jsonb),public.redi_update_geometry(text,jsonb,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.redi_update_geometry(text,jsonb,jsonb,jsonb) to authenticated;
create or replace function public.redi_export_data(p_collection text) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare fields text[];
begin
  if not public.redi_can_export() then raise exception 'Export permission required' using errcode='42501'; end if;
  fields:=case p_collection
    when 'communities' then array['id','name','kind','status','classification','country','region','county','locality','siruta','population','geometry','locationAccuracy','boundary']
    when 'entrepreneurs' then array['id','business','sector','country','region','county','locality','siruta','communityId','lat','lng','approx']
    when 'clients' then array['id','partner','country','region','county','locality','siruta','communityId','amount','currency','year','lat','lng','approx']
    when 'localities' then array['id','siruta','name','country','county','lat','lng']
    else null end;
  if fields is null then raise exception 'Unknown collection' using errcode='22023'; end if;
  return coalesce((select jsonb_agg((select jsonb_object_agg(key,value) from jsonb_each(r.data) where key=any(fields))) from public.redi_records r where collection=p_collection and deleted_at is null and public.redi_in_scope(data) and (coalesce(data->>'visibility','restricted')<>'confidential' or public.redi_role()='administrator')),'[]');
end; $$;


notify pgrst,'reload schema';
commit;
