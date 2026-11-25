import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { booleanPointInPolygon, point, area, centroid, distance } from '@turf/turf';
const cache=process.argv[2] || '../boundary-cache';
const catalog=JSON.parse(fs.readFileSync('src/data/catalog-2026.json','utf8'));
const countries={RO:'ROU',MD:'MDA',RS:'SRB',BA:'BIH',ME:'MNE',MK:'MKD',XK:'XKX',TR:'TUR',AL:'ALB'};
const localLevel={RO:'ADM2',RS:'ADM2',BA:'ADM3',ME:'ADM1',MK:'ADM2',XK:'ADM2',AL:'ADM2'};
const regionalLevel={RO:'ADM1',MD:'ADM1',RS:'ADM1',BA:'ADM2',ME:'ADM1',MK:'ADM1',XK:'ADM2',TR:'ADM1',AL:'ADM1'};
function norm(s='') { return s.replace(/ı/g,'i').replace(/đ/g,'dj').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\([^)]*\)/g,' ').replace(/\b(municipiul|orasul|municipality|municipally|municipal|of|city|comuna|commune|opstina|opshtina|qarku|qark|bashkia|district|region|canton|kanton|raionul|oblast|county|province)\b/g,' ').replace(/[^a-z0-9]+/g,' ').trim(); }
const aliases=JSON.parse(fs.readFileSync(path.join(cache,'geonames-aliases.json'),'utf8'));
const licenseURL = text => /3.0.*IGO/.test(text) ? 'https://creativecommons.org/licenses/by/3.0/igo/' : /Public Domain/.test(text) ? 'https://creativecommons.org/publicdomain/mark/1.0/' : /ShareAlike 2.0/.test(text) ? 'https://creativecommons.org/licenses/by-sa/2.0/' : /Database License/.test(text) ? 'https://opendatacommons.org/licenses/odbl/1-0/' : 'https://creativecommons.org/licenses/by/4.0/';
const loaded=new Map();
function layer(country,level) {
 const key=country+'-'+level;if(loaded.has(key))return loaded.get(key);
 const iso=countries[country];const humanitarian=country==='AL'&&level==='ADM2';
 const file=path.join(cache,`${iso}-${humanitarian?'humanitarian-':''}${level}.geojson`);
 if(!fs.existsSync(file))return [];
 const metadata=JSON.parse(fs.readFileSync(path.join(cache,iso+(humanitarian?'-humanitarian':'')+'-metadata.json'),'utf8')).find(m=>m.boundaryType===level);
 const data=JSON.parse(fs.readFileSync(file,'utf8')).features.map(f=>({
   id:`gb-${iso}-${level}-${f.properties.shapeID}`,name:f.properties.shapeName,country,level,year:metadata.boundaryYearRepresented,
   source:`geoBoundaries / ${metadata.boundarySource}`,sourceURL:metadata.simplifiedGeometryGeoJSON,license:metadata.boundaryLicense || 'CC BY 4.0',licenseURL:licenseURL(metadata.boundaryLicense || ''),geometry:f.geometry,
 })); loaded.set(key,data);return data;
}
function contains(boundary,coords) { try{return !!coords && booleanPointInPolygon(point(coords),boundary.geometry);}catch{return false;} }
const assignments=[],used=new Map(),unmatched=[];
for(const r of catalog.communities){
 const coords=r.geometry?.type==='Point'?r.geometry.coordinates:null;
 const names=[r.name,r.extra['Localizare GeoNames'],...(aliases[r.extra._geonamesId] || [])].filter(Boolean).map(norm);let candidates=localLevel[r.country]?layer(r.country,localLevel[r.country]):[];
 if(r.country==='BA')candidates=candidates.filter(b=>!['republika srpska','federation of bosnia and herzegovina'].includes(norm(b.name)));
 if(r.country==='AL'&&r.name==='Has')names.unshift('krume');
 let selected;
 for(const name of names){ const exact=candidates.filter(b=>norm(b.name)===name); selected=exact.find(b=>contains(b,coords)) || (exact.length===1 && (!coords || distance(point(coords),centroid(exact[0].geometry))<45) ? exact[0] : undefined); if(selected)break; }
 let scope='locality',method='name-and-location';
 if(!selected){
  // Municipal sub-units may share the parent city boundary; never infer a neighbourhood outline.
  const inside=candidates.filter(b=>contains(b,coords));
  if(['RS','MK','XK','BA','ME'].includes(r.country)&&inside.length===1){selected=inside[0];scope='parent';method='containing-municipality';}
 }
 if(!selected){
  candidates=layer(r.country,regionalLevel[r.country]);const region=norm(r.county);let named=candidates.filter(b=>norm(b.name)===region);
  if(!named.length)named=candidates.filter(b=>region.includes(norm(b.name))&&norm(b.name).length>3);
  selected=named.find(b=>contains(b,coords)) || (named.length===1?named[0]:undefined) || candidates.filter(b=>contains(b,coords)).sort((a,b)=>area(a.geometry)-area(b.geometry))[0];
  scope='region';method=selected&&named.includes(selected)?'source-region':'containing-region';
 }
 if(!selected){unmatched.push({id:r.id,country:r.country,name:r.name,region:r.county});continue;}
 used.set(selected.id,selected);assignments.push({id:r.id,boundaryId:selected.id,scope,method});
}
const result={version:'administrative-boundaries-2026-v1',retrievedAt:'2026-11-25',boundaries:[...used.values()],assignments,unmatched};
fs.writeFileSync('src/data/catalog-boundaries-2026.json',JSON.stringify(result));
execFileSync('python',['scripts/repair-boundaries.py','src/data/catalog-boundaries-2026.json'],{stdio:'inherit'});
console.log(JSON.stringify({areas:used.size,assignments:assignments.length,locality:assignments.filter(a=>a.scope==='locality').length,parent:assignments.filter(a=>a.scope==='parent').length,region:assignments.filter(a=>a.scope==='region').length,unmatched,byCountry:Object.fromEntries(Object.keys(countries).map(c=>[c,Object.fromEntries(['locality','parent','region'].map(s=>[s,assignments.filter(a=>a.scope===s&&catalog.communities.find(r=>r.id===a.id).country===c).length]))]))},null,2));
