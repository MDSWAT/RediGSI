"""Fetch attributed input layers for build-boundaries.mjs; never used by the app."""
import argparse,concurrent.futures,json,urllib.request,zipfile
from pathlib import Path
parser=argparse.ArgumentParser();parser.add_argument('--cache',default='../boundary-cache');args=parser.parse_args();cache=Path(args.cache);cache.mkdir(parents=True,exist_ok=True)
root=Path(__file__).resolve().parents[1]
levels={'ROU':['ADM1','ADM2'],'MDA':['ADM1'],'SRB':['ADM1','ADM2'],'BIH':['ADM2','ADM3'],'MNE':['ADM1'],'MKD':['ADM1','ADM2'],'XKX':['ADM2'],'TUR':['ADM1'],'ALB':['ADM1']}
def fetch(url,path):
 if not path.exists():
  req=urllib.request.Request(url,headers={'User-Agent':'RediGSI-boundary-import/1.0'})
  with urllib.request.urlopen(req,timeout=90) as response:path.write_bytes(response.read())
 return path
jobs=[]
for iso,selected in levels.items():
 path=fetch(f'https://www.geoboundaries.org/api/current/gbOpen/{iso}/ALL/',cache/f'{iso}-metadata.json')
 for layer in json.loads(path.read_text(encoding='utf8')):
  if layer['boundaryType'] in selected:jobs.append((layer['simplifiedGeometryGeoJSON'],cache/f'{iso}-{layer["boundaryType"]}.geojson'))
# Albania's current 61 municipalities are in the OCHA humanitarian release,
# licensed CC BY 3.0 IGO; gbOpen ADM2 instead contains the older districts.
p=fetch('https://www.geoboundaries.org/api/current/gbHumanitarian/ALB/ALL/',cache/'ALB-humanitarian-metadata.json')
layer=next(x for x in json.loads(p.read_text()) if x['boundaryType']=='ADM2');jobs.append((layer['simplifiedGeometryGeoJSON'],cache/'ALB-humanitarian-ADM2.geojson'))
with concurrent.futures.ThreadPoolExecutor(max_workers=6) as executor:
 for path in executor.map(lambda job:fetch(*job),jobs):print(path.name)
catalog=json.loads((root/'src/data/catalog-2026.json').read_text(encoding='utf8'));ids={r['extra'].get('_geonamesId') for r in catalog['communities']};aliases={}
for cc in ['RO','MD','RS','BA','ME','MK','XK','TR','AL']:
 p=fetch(f'https://download.geonames.org/export/dump/{cc}.zip',cache/f'geonames-{cc}.zip')
 with zipfile.ZipFile(p) as archive:
  for line in archive.read(cc+'.txt').decode().splitlines():
   row=line.split('\t')
   if row[0] in ids:aliases[row[0]]=[row[1],row[2],*row[3].split(',')]
(cache/'geonames-aliases.json').write_text(json.dumps(aliases,ensure_ascii=False),encoding='utf8')
print('Boundary inputs and gazetteer name aliases ready')
