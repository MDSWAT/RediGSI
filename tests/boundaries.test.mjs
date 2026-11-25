import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { booleanValid, area, intersect, featureCollection, polygon } from '@turf/turf';
const catalog=JSON.parse(fs.readFileSync(new URL('../src/data/catalog-2026.json',import.meta.url)));
const manifest=JSON.parse(fs.readFileSync(new URL('../src/data/catalog-boundaries-2026.json',import.meta.url)));
const compiled=ts.transpileModule(fs.readFileSync(new URL('../src/lib/boundaries.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const helpers={};vm.runInNewContext(compiled,{exports:helpers});
const shapes=new Map(manifest.boundaries.map(b=>[b.id,b]));

test('every supplied row has a real attributed polygon, with broader reference areas explicit',()=>{
 assert.equal(manifest.assignments.length,628);assert.equal(new Set(manifest.assignments.map(a=>a.id)).size,628);
 assert.equal(shapes.size,560);
 assert.deepEqual(['locality','parent','region'].map(scope=>manifest.assignments.filter(a=>a.scope===scope).length),[534,36,58]);
 for(const b of shapes.values()){
  assert.ok(['Polygon','MultiPolygon'].includes(b.geometry.type));assert.ok(area(b.geometry)>0);if (!booleanValid(b.geometry)) {
   // OGC-valid MultiPolygon parts may touch at a point; Turf rejects some such cases.
   assert.equal(b.geometry.type,'MultiPolygon');
   const parts=b.geometry.coordinates.map(coords=>polygon(coords));
   assert.ok(parts.every(part=>booleanValid(part)));
   for(let i=0;i<parts.length;i++)for(let j=i+1;j<parts.length;j++){const overlap=intersect(featureCollection([parts[i],parts[j]]));assert.ok(!overlap || area(overlap)<0.001,b.name+' overlapping components');}
  }
  assert.match(b.sourceURL,/^https:\/\//);assert.match(b.licenseURL,/^https:\/\//);assert.ok(b.year&&b.source&&b.license);
 }
 const upgraded=catalog.communities.map(record=>{const assignment=manifest.assignments.find(a=>a.id===record.id);const shape=shapes.get(assignment.boundaryId);assert.equal(shape.country,record.country);return helpers.boundaryUpgrade(record,record,shape,assignment);});
 assert.ok(upgraded.every(Boolean));assert.ok(upgraded.every(r=>r.locationAccuracy==='administrative'));
 assert.equal(helpers.groupBoundaryRecords(upgraded).length,560);
 assert.ok(Buffer.byteLength(JSON.stringify({communities:upgraded,entrepreneurs:[],clients:[],localities:[]}))<4_000_000,'Boundary-enriched response must fit the hosting payload limit');
 assert.equal(helpers.groupBoundaryRecords(upgraded.filter(r=>r.country==='TR')).length,3);
 assert.ok(upgraded.filter(r=>r.name==='Not specified').every(r=>r.boundary.scope==='region'&&r.boundary.referencePoint===null));
 assert.ok(upgraded.filter(r=>r.country==='RO').every(r=>r.boundary.scope==='locality'));
});

test('boundary upgrades retain edits and reject custom geometry or unrelated records',()=>{
 const original=catalog.communities[0],assignment=manifest.assignments.find(a=>a.id===original.id),shape=shapes.get(assignment.boundaryId);
 const edited={...original,name:'User name',notes:'User notes',status:'validat'};
 const result=helpers.boundaryUpgrade(edited,original,shape,assignment);
 assert.equal(result.name,'User name');assert.equal(result.notes,'User notes');assert.equal(result.status,'validat');
 assert.deepEqual(result.extra,original.extra);assert.equal(result.kind,'zona');assert.deepEqual(JSON.parse(JSON.stringify(result.boundary.referencePoint)),original.geometry.coordinates);
 assert.equal(helpers.boundaryUpgrade({...edited,geometry:shape.geometry},original,shape,assignment),null);
 assert.equal(helpers.boundaryUpgrade({...edited,source:'manual'},original,shape,assignment),null);
 assert.equal(helpers.boundaryUpgrade({...edited,country:'ZZ'},original,shape,assignment),null);
 assert.equal(helpers.boundaryUpgrade(result,original,shape,assignment),null);
 const differentlyOrdered={...edited,geometry:{coordinates:original.geometry.coordinates,type:'Point'}};
 assert.ok(helpers.boundaryUpgrade(differentlyOrdered,original,shape,assignment));
});


test('boundary provenance round-trips safely through GeoJSON and CSV metadata',()=>{
 const record=catalog.communities[0],assignment=manifest.assignments.find(a=>a.id===record.id);
 const boundary=helpers.boundaryUpgrade(record,record,shapes.get(assignment.boundaryId),assignment).boundary;
 assert.deepEqual(JSON.parse(JSON.stringify(helpers.importedBoundary(JSON.stringify(boundary)))),JSON.parse(JSON.stringify(boundary)));
 assert.deepEqual(JSON.parse(JSON.stringify(helpers.importedBoundary(boundary))),JSON.parse(JSON.stringify(boundary)));
 assert.equal(helpers.importedBoundary({...boundary,sourceURL:'javascript:alert(1)'}),undefined);
 assert.equal(helpers.importedBoundary({...boundary,referencePoint:[999,999]}),undefined);
 assert.equal(helpers.importedBoundary('{invalid'),undefined);
 assert.equal(helpers.importedBoundary({...boundary,scope:'surveyed-community'}),undefined);
});
