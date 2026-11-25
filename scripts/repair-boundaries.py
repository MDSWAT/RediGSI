"""Prepare topology-safe display geometry; no runtime application file storage."""
import json,sys
from pathlib import Path
from shapely.geometry import shape,mapping
from shapely import make_valid
from shapely.ops import unary_union
p=Path(sys.argv[1]);data=json.loads(p.read_text(encoding='utf8'))
def polygons(g):
 if g.geom_type=='Polygon':return [g]
 if hasattr(g,'geoms'):return [p for part in g.geoms for p in polygons(part)]
 return []
def rounded(x):
 if isinstance(x,(tuple,list)):return [rounded(v) for v in x]
 return round(x,6) if isinstance(x,float) else x
for boundary in data['boundaries']:
 g=make_valid(shape(boundary['geometry']));g=unary_union(polygons(g))
 scopes={a['scope'] for a in data['assignments'] if a['boundaryId']==boundary['id']}
 tolerance=0.0003 if 'locality' in scopes else 0.0005 if 'parent' in scopes else 0.002
 g=g.simplify(tolerance,preserve_topology=True)
 result=mapping(g);result['coordinates']=rounded(result['coordinates']);g=shape(result)
 if not g.is_valid:g=unary_union(polygons(make_valid(g)))
 if g.is_empty or g.geom_type not in ('Polygon','MultiPolygon') or not g.is_valid:raise ValueError(boundary['name'])
 boundary['geometry']=mapping(g)
 boundary['displayToleranceDegrees']=tolerance
p.write_text(json.dumps(data,ensure_ascii=False,separators=(',',':')),encoding='utf8')
print(f'Topology-checked {len(data["boundaries"])} administrative outlines')
