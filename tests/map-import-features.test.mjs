import test from "node:test";
import assert from "node:assert/strict";
import { DOMParser } from "@xmldom/xmldom";
import { sourceLoader } from "./helpers/load-typescript.mjs";
const load = sourceLoader({ DOMParser });
const { parseKML } = load(new URL("../src/lib/kml.ts", import.meta.url));
const { parseFile, buildRecords } = load(
  new URL("../src/lib/importer.ts", import.meta.url),
);
const { findProbableDuplicates } = load(
  new URL("../src/lib/duplicates.ts", import.meta.url),
);
const { createPointIndex } = load(
  new URL("../src/lib/mapClusters.ts", import.meta.url),
);
const { importBatches } = load(
  new URL("../src/lib/importBatches.ts", import.meta.url),
);
const clean = (value) => JSON.parse(JSON.stringify(value));
const kml = `<?xml version="1.0"?><kml xmlns="http://www.opengis.net/kml/2.2"><Document><Placemark><name>Punct sursă</name><ExtendedData><Data name="country"><value>RO</value></Data></ExtendedData><Point><coordinates>23,46,100</coordinates></Point></Placemark><Placemark><name>Fără localizare</name><description>Text original</description></Placemark><Placemark><name>Arie</name><Polygon><outerBoundaryIs><LinearRing><coordinates>23,46 24,46 24,47 23,46</coordinates></LinearRing></outerBoundaryIs></Polygon></Placemark></Document></kml>`;
test("KML imports points, polygons, original properties and unlocated placemarks without inventing coordinates", async () => {
  const fc = parseKML(kml, new DOMParser());
  assert.equal(fc.features.length, 3);
  assert.deepEqual(clean(fc.features[0].geometry.coordinates), [23, 46, 100]);
  assert.equal(fc.features[1].geometry, null);
  assert.equal(fc.features[2].geometry.type, "Polygon");
  const parsed = await parseFile(new File([kml], "source.kml"));
  assert.equal(parsed.rows.length, 3);
  const result = buildRecords(
    "communities",
    parsed,
    { name: "name", country: "country", notes: "description" },
    {
      defaultCountry: "RO",
      defaultStatus: "propus",
      source: "import",
      partner: "",
    },
    { communities: [], entrepreneurs: [], clients: [], localities: [] },
  );
  assert.equal(result.items.length, 3);
  assert.equal(result.items[1].geometry, null);
  assert.equal(result.items[1].locationAccuracy, "unresolved");
  assert.equal(result.items[1].notes, "Text original");
  assert.equal(
    JSON.parse(result.items[1].extra._importOriginal).description,
    "Text original",
  );
});
test("KML rejects external declarations, wrong document roots and oversized files", async () => {
  assert.throws(
    () =>
      parseKML(
        '<!DOCTYPE kml [<!ENTITY secret SYSTEM "file:///private">]><kml/>',
        new DOMParser(),
      ),
    /DTD/,
  );
  assert.throws(() => parseKML("<html/>", new DOMParser()), /KML valid/);
  await assert.rejects(
    parseFile({ name: "large.kml", size: 25_000_001 }),
    /25 MB/,
  );
});
test("probable duplicate detection never collapses distinct rows sharing an administrative area", () => {
  const geom = { type: "Point", coordinates: [23, 46] };
  const a = {
    name: "Comunitate A",
    country: "RO",
    locality: "Cluj",
    geometry: geom,
  };
  const b = { ...a, name: "Comunitate B" };
  assert.deepEqual(
    clean(findProbableDuplicates("communities", [a, b, { ...a }], [])),
    [{ index: 2, against: "file" }],
  );
  const sourceA = {
    ...a,
    extra: { _sourceSheet: "Romania", _sourceRow: "10" },
  };
  const sourceB = {
    ...a,
    extra: { _sourceSheet: "Romania", _sourceRow: "11" },
  };
  assert.equal(
    findProbableDuplicates("communities", [sourceA, sourceB], []).length,
    0,
  );
  assert.equal(
    findProbableDuplicates(
      "communities",
      [{ ...sourceA, name: "Updated source name" }],
      [sourceA],
    )[0].against,
    "existing",
  );
});
test("cluster counts retain every valid point at coincident coordinates and wrapped map bounds", () => {
  const points = [
    { id: "a", lat: 46, lng: 23 },
    { id: "b", lat: 46, lng: 23 },
    { id: "c", lat: 46, lng: 23 },
    { id: "invalid", lat: 999, lng: 0 },
  ];
  const index = createPointIndex(points);
  const cluster = index.getClusters([-180, -85, 180, 85], 7)[0];
  assert.equal(cluster.properties.point_count, 3);
  assert.deepEqual(
    index
      .getLeaves(cluster.properties.cluster_id, Infinity)
      .map((p) => p.properties.id)
      .sort(),
    ["a", "b", "c"],
  );
  const wrapped = createPointIndex([
    { id: "west", lat: 0, lng: 179.9 },
    { id: "east", lat: 0, lng: -179.9 },
  ]).getClusters([170, -10, -170, 10], 3);
  assert.equal(
    wrapped.reduce((n, f) => n + (f.properties.point_count ?? 1), 0),
    2,
  );
  assert.equal(index.getClusters([0, 0, 1, 1], 7).length, 0);
});
test("import batching respects UTF-8 byte and row limits and retains every supplied record", () => {
  const rows = Array.from({ length: 9 }, (_, id) => ({
    id,
    note: "șț😊".repeat(10),
  }));
  const batches = importBatches(rows, 250, 2);
  assert.deepEqual(clean(batches.flat()), rows);
  assert.ok(
    batches.every(
      (b) =>
        b.length <= 2 &&
        new TextEncoder().encode(JSON.stringify({ items: b })).length <= 250,
    ),
  );
  assert.throws(
    () => importBatches([{ note: "a".repeat(990001) }]),
    /dimensiune/,
  );
});

const { intelligence } = load(
  new URL("../src/lib/intelligence.ts", import.meta.url),
);
const { geocodingCandidates } = load(
  new URL("../src/lib/geocoding.ts", import.meta.url),
);
test("financial analytics never combines currencies or assumes a currency for legacy values", () => {
  const result = intelligence({
    communities: [
      { id: "c", population: 10 },
      { id: "duplicate-reference", population: 20 },
    ],
    entrepreneurs: [{ id: "e", communityId: "c", sector: "Retail" }],
    clients: [
      {
        partner: "P",
        country: "RO",
        locality: "Cluj",
        amount: 100,
        currency: "RON",
      },
      {
        partner: "P",
        country: "RO",
        locality: "Cluj",
        amount: 5,
        currency: "EUR",
      },
      { partner: "P", country: "RO", amount: 999 },
    ],
    localities: [],
  });
  assert.equal(result.finance.length, 2);
  assert.equal(result.finance.find((f) => f.currency === "RON").amount, 100);
  assert.equal(result.finance.find((f) => f.currency === "EUR").amount, 5);
  assert.equal(result.unknownCurrency, 1);
  assert.equal(result.populationMin, 10);
  assert.equal(result.populationMax, 20);
  assert.equal(result.communityCoverage, 0.5);
});
test("geocoding suggestions reject missing/invalid coordinates and locations outside the editable administrative area", () => {
  const base = {
    lat: "46",
    lon: "23",
    display_name: "Synthetic address",
    addresstype: "road",
    address: {
      country_code: "ro",
      county: "Județul Cluj",
      city: "Cluj-Napoca",
    },
  };
  assert.equal(
    geocodingCandidates([base], "RO", "geocoder.example", {
      county: "Cluj",
      locality: "Cluj-Napoca",
    })[0].accuracy,
    "street",
  );
  assert.equal(
    geocodingCandidates(
      [
        { ...base, lat: "" },
        { ...base, lat: "999" },
        { ...base, address: { country_code: "md" } },
      ],
      "RO",
      "geocoder.example",
    ).length,
    0,
  );
  assert.equal(
    geocodingCandidates([base], "RO", "geocoder.example", { county: "Alba" })
      .length,
    0,
  );
});
