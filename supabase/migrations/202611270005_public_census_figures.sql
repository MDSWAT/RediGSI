begin;

-- Public census figures: the public projection now also carries population and the REDI census
-- columns (published municipal statistics). Observations/validation notes, contacts, notes and any
-- other imported column stay restricted.
create or replace function public.redi_public_record(d jsonb) returns jsonb language sql immutable set search_path='' as $$
 select jsonb_build_object('id',d->>'id','name',d->>'name','country',d->>'country','county',d->>'county','locality',d->>'locality','kind',d->>'kind','status',d->>'status','classification',d->>'classification','source',d->>'source','geometry',d->'publicGeometry',
  'population',case when jsonb_typeof(d->'population')='number' then d->'population' end,
  'extra',(select jsonb_object_agg(k,d->'extra'->>k) from unnest(array['Pop. totala','Romi recens.','Romi alte surse','Prag REDI','Status REDI','campanie REDI health']) k
           where jsonb_typeof(d->'extra')='object' and coalesce(d->'extra'->>k,'')<>''));
$$;

-- Already published records keep their frozen snapshot; only the newly public figures are added to it.
update public.redi_records set data=jsonb_set(data,'{publicRecord}',(data->'publicRecord')||jsonb_strip_nulls(jsonb_build_object(
   'population',public.redi_public_record(data)->'population','extra',public.redi_public_record(data)->'extra')))
where collection='communities' and data->>'visibility'='public' and data->>'publicationStatus'='published'
  and jsonb_typeof(data->'publicRecord')='object';

notify pgrst,'reload schema';
commit;
