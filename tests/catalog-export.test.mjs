import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

test('GeoJSON preserves approximate positions, unresolved rows and source details', () => {
  const source = readFileSync(new URL('../src/lib/export.ts', import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const exports = {};
  vm.runInNewContext(compiled, { exports, require: () => ({}) });
  const records = [
    { id: 'approx', name: 'Centre', kind: 'punct', status: 'de_validat', source: 'catalog', country: 'TR', geometry: { type: 'Point', coordinates: [27, 38] }, locationAccuracy: 'locality', extra: { 'Romi recens.': '100', 'Romi alte surse': '250' } },
    { id: 'unknown', name: 'Not specified', kind: 'punct', status: 'de_validat', source: 'catalog', country: 'TR', geometry: null, locationAccuracy: 'unresolved' },
  ];
  records.push({id:'area',name:'Municipality',kind:'zona',status:'validat',source:'catalog',country:'RO',geometry:{type:'Polygon',coordinates:[[[25,45],[26,45],[26,46],[25,45]]]},locationAccuracy:'administrative',boundary:{id:'reference-area',name:'Reference municipality',scope:'parent',level:'ADM2',year:'2017',source:'geoBoundaries',sourceURL:'https://www.geoboundaries.org/',license:'CC BY 4.0',licenseURL:'https://creativecommons.org/licenses/by/4.0/',referencePoint:[25.5,45.5]}});
  const fc = JSON.parse(JSON.stringify(exports.communityGeoJSON(records)));
  assert.equal(fc.features.length, 3);
  assert.equal(fc.features[0].properties.precizie, 'locality');
  assert.equal(fc.features[0].properties['Romi recens.'], '100');
  assert.equal(fc.features[0].properties['Romi alte surse'], '250');
  assert.equal(fc.features[1].geometry, null);
  assert.equal(fc.features[1].properties.precizie, 'unresolved');
  assert.equal(fc.features[2].geometry.type, 'Polygon');
  assert.equal(fc.features[2].properties.precizie, 'administrative');
  assert.deepEqual(fc.features[2].properties.contur_administrativ, records[2].boundary);
});
