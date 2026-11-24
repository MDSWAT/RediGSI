import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseCountrySummary } from '../src/lib/countrySummary.ts';
const catalog = JSON.parse(readFileSync(new URL('../src/data/catalog-2026.json', import.meta.url)));

test('catalog retains every supplied source row and all original cells without combining estimates', () => {
  assert.equal(catalog.communities.length, 628);
  assert.equal(new Set(catalog.communities.map(r => r.id)).size, 628);
  const statuses = { CONFIRMATA: 'validat', PROPUSA: 'propus', 'DE VALIDAT': 'de_validat', 'SUB PRAG': 'sub_prag' };
  for (const sheet of catalog.sourceSheets.filter(s => !['Sumar', 'Surse noi'].includes(s.sheet))) {
    const headers = sheet.rows.find(r => r.sourceRow === 5).cells;
    const rows = sheet.rows.filter(r => r.sourceRow > 5 && r.cells[1]?.text);
    assert.equal(rows.length, catalog.coverage[sheet.sheet]);
    for (const row of rows) {
      const record = catalog.communities.find(r => r.extra._sourceSheet === sheet.sheet && r.extra._sourceRow === String(row.sourceRow));
      assert.ok(record);
      row.cells.forEach((cell, i) => assert.equal(record.extra[headers[i].text || `Coloana ${i + 1}`], cell.text));
      assert.equal(record.status, statuses[row.cells[6].text]);
      assert.equal(record.population, undefined); // Neither census nor alternative is silently selected/summed.
      if (record.geometry) {
        assert.equal(record.geometry.type, 'Point');
        const [lng, lat] = record.geometry.coordinates;
        assert.ok(Number.isFinite(lng) && Number.isFinite(lat) && lng > 13 && lng < 45 && lat > 35 && lat < 49);
        assert.ok(record.extra._geonamesId);
      } else assert.equal(record.locationAccuracy, 'unresolved');
    }
  }
  assert.equal(catalog.communities.filter(r => r.geometry).length, 610);
  const unknown = catalog.communities.filter(r => r.name === 'Not specified');
  assert.equal(unknown.length, 6);
  assert.ok(unknown.every(r => r.geometry === null));
  const summary = parseCountrySummary(catalog.summaryCSV, 'Sumar.html');
  assert.equal(summary.totals.localities, 4580);
  assert.equal(catalog.coverage.Romania, 111);
  assert.equal(catalog.coverage.Moldova, 15);
  assert.ok(catalog.sourceSheets.find(s => s.sheet === 'Surse noi').rows.length > 20);
});
