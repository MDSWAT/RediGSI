import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
const compiled = ts.transpileModule(
  readFileSync(
    new URL("../src/lib/exportFeatures.ts", import.meta.url),
    "utf8",
  ),
  { compilerOptions: { module: ts.ModuleKind.CommonJS } },
).outputText;
const exports = {};
vm.runInNewContext(compiled, { exports });
test("authorized GeoJSON export retains every row, preserves geometry and does not invent missing locations", () => {
  const rows = [
    {
      id: "polygon",
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [23, 46],
            [24, 46],
            [24, 47],
            [23, 46],
          ],
        ],
      },
      country: "RO",
    },
    { id: "point", lat: 46, lng: 23 },
    { id: "unresolved", geometry: null, locationAccuracy: "unresolved" },
    { id: "invalid", lat: 999, lng: 23 },
  ];
  const snapshot = JSON.stringify(rows);
  const fc = JSON.parse(JSON.stringify(exports.recordsToGeoJSON(rows)));
  assert.equal(fc.features.length, 4);
  assert.deepEqual(fc.features[0].geometry, rows[0].geometry);
  assert.deepEqual(fc.features[1].geometry, {
    type: "Point",
    coordinates: [23, 46],
  });
  assert.equal(fc.features[2].geometry, null);
  assert.equal(fc.features[2].properties.locationAccuracy, "unresolved");
  assert.equal(fc.features[3].geometry, null);
  assert.equal(JSON.stringify(rows), snapshot);
});
