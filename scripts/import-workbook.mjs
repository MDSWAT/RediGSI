// Adds the Romania and Moldova rows of the REDI workbook (.xlsm) that are not yet in Supabase.
// Romanian localities get their official UAT outline (geoBoundaries ROU ADM2, county-checked);
// Moldovan villages get their GeoNames reference point (village centre, not the community's
// location). Rows already present (same sheet and row) are never touched. Records are published
// with the same public projection and privacy assessment as scripts/publish-boundaries.mjs.
//
//   node --env-file=.env.local scripts/import-workbook.mjs <workbook.xlsm> [--dry-run]
//     --boundaries ../boundary-cache   (download-boundaries.py output)
//     --geonames ../geodata-cache      (GeoNames MD.zip + admin1CodesASCII.txt)
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { createClient } from "@supabase/supabase-js";
import { booleanPointInPolygon, pointOnFeature, simplify, truncate, centroid, distance } from "@turf/turf";
import { sourceLoader } from "../tests/helpers/load-typescript.mjs";

const require = createRequire(import.meta.url);
const XLSX = require("xlsx");
const args = process.argv.slice(2);
const option = (name, fallback) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : fallback; };
const workbookPath = args.find((a) => a.endsWith(".xlsm") || a.endsWith(".xlsx"));
const dryRun = args.includes("--dry-run");
const boundaryCache = option("--boundaries", "../boundary-cache");
const geonamesCache = option("--geonames", "../geodata-cache");
if (!workbookPath) throw new Error("Usage: import-workbook.mjs <workbook.xlsm> [--dry-run]");

const { assessPublicationRisk } = sourceLoader()(new URL("../src/lib/privacyRisk.ts", import.meta.url));
const OUTLINE_TOLERANCE = 0.0015; // ~150 m; keeps 3,000+ outlines light enough for the public map.
const STATUS = { CONFIRMATA: "validat", PROPUSA: "propus", "DE VALIDAT": "de_validat", "SUB PRAG": "sub_prag" };
const HEADERS = ["Regiune", "Localitate", "Pop. totala", "Romi recens.", "Romi alte surse", "Prag REDI", "Status REDI", "Observatii / validare", "campanie REDI health"];
const PUBLIC_EXTRA = ["Pop. totala", "Romi recens.", "Romi alte surse", "Prag REDI", "Status REDI", "campanie REDI health"];
const OUTLINE_JUSTIFICATION =
  "Contur administrativ oficial (geoBoundaries) și date publice de recensământ; zona nu delimitează gospodării sau teritoriul comunității. Publicat la cererea proprietarului platformei.";
const POINT_JUSTIFICATION =
  "Punct de referință GeoNames al localității (centrul satului), nu locația comunității sau a gospodăriilor; date publice de recensământ. Publicat la cererea proprietarului platformei.";

const norm = (s = "") => String(s).replace(/ı/g, "i").normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase()
  .replace(/\b(MUNICIPIUL|MUNICIPIU|ORAS|ORASUL|COMUNA|OR|S|COM|RAIONUL|MUNICIPALITY|UTA)\b\.?/g, " ")
  .replace(/[^A-Z0-9]+/g, " ").trim();
const compact = (s) => norm(s).replace(/ /g, "");
const cell = (v) => (typeof v === "number" ? v.toLocaleString("en-US") : String(v ?? "").trim());
const readGeoJSON = (file) => JSON.parse(fs.readFileSync(path.join(boundaryCache, file), "utf8"));
const contains = (geometry, coords) => { try { return booleanPointInPolygon(coords, geometry); } catch { return false; } };

// ---------- existing records ----------
const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const existing = new Set();
for (let from = 0; ; from += 1000) {
  const { data, error } = await client.from("redi_records").select("data->extra").eq("collection", "communities").range(from, from + 999);
  if (error) throw error;
  data.forEach((r) => existing.add(`${r.extra?._sourceSheet}#${r.extra?._sourceRow}`));
  if (data.length < 1000) break;
}

// ---------- workbook ----------
const workbook = XLSX.readFile(workbookPath);
function sheetRows(sheet) {
  const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheet], { header: 1, defval: "" });
  const context = cell(rows[1]?.[0]);
  return rows.flatMap((r, i) => (STATUS[cell(r[6])] && !existing.has(`${sheet}#${i + 1}`)
    ? [{ sheet, row: String(i + 1), context, extra: Object.fromEntries(HEADERS.map((h, c) => [h, cell(r[c])]).filter(([h, v]) => h !== "campanie REDI health" || v)) }]
    : []));
}

// ---------- Romania: UAT outlines grouped per county ----------
const roMeta = JSON.parse(fs.readFileSync(path.join(boundaryCache, "ROU-metadata.json"), "utf8"));
const metaOf = (meta, level) => meta.find((m) => m.boundaryType === level);
const counties = readGeoJSON("ROU-ADM1.geojson").features.map((f) => ({ key: norm(f.properties.shapeName), feature: f }));
const uats = new Map(); // county -> name -> features[]
const uatsByName = new Map(); // name -> features[] nationally, for outlines whose inner point falls across a county line
for (const f of readGeoJSON("ROU-ADM2.geojson").features) {
  const at = pointOnFeature(f).geometry.coordinates;
  f.properties.at = at;
  for (const key of new Set([norm(f.properties.shapeName), compact(f.properties.shapeName)])) uatsByName.set(key, [...(uatsByName.get(key) ?? []), f]);
  const county = counties.find((c) => contains(c.feature.geometry, at));
  if (!county) continue;
  const byName = uats.get(county.key) ?? new Map();
  for (const key of new Set([norm(f.properties.shapeName), compact(f.properties.shapeName)])) byName.set(key, [...(byName.get(key) ?? []), f]);
  uats.set(county.key, byName);
}
const merge = (features) => features.length === 1 ? features[0].geometry : {
  type: "MultiPolygon",
  coordinates: features.flatMap((f) => (f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates)),
};
const display = (geometry) => truncate(simplify(geometry, { tolerance: OUTLINE_TOLERANCE, highQuality: false }), { precision: 5 });
const boundaryOf = (meta, level, features, scope, method) => {
  const m = metaOf(meta, level);
  const c = centroid(merge(features)).geometry.coordinates;
  return {
    id: `gb-${m.boundaryISO}-${level}-${features[0].properties.shapeID}`, name: features[0].properties.shapeName, year: m.boundaryYearRepresented,
    level, scope, method, source: `geoBoundaries / ${m.boundarySource}`, license: m.boundaryLicense, sourceURL: m.simplifiedGeometryGeoJSON,
    licenseURL: /IGO/.test(m.boundaryLicense) ? "https://creativecommons.org/licenses/by/3.0/igo/" : "https://creativecommons.org/licenses/by/4.0/",
    referencePoint: c.map((n) => Math.round(n * 1e5) / 1e5), displayToleranceDegrees: OUTLINE_TOLERANCE,
  };
};
function locateRomania(row) {
  const county = norm(row.extra.Regiune);
  const countyFeature = counties.find((c) => c.key === county)?.feature;
  const names = uats.get(county);
  const name = row.extra.Localitate;
  if (county === "BUCURESTI" && countyFeature) // the capital is one municipality drawn as six sectors
    return { geometry: display(countyFeature.geometry), boundary: boundaryOf(roMeta, "ADM1", [countyFeature], "locality", "capital-municipality") };
  const found = names?.get(norm(name)) ?? names?.get(compact(name));
  if (found) return { geometry: display(merge(found)), boundary: boundaryOf(roMeta, "ADM2", found, "locality", "name-within-county") };
  const nearby = countyFeature && nearest(uatsByName.get(norm(name)) ?? uatsByName.get(compact(name)) ?? [], (f) => f.properties.at, centroid(countyFeature).geometry.coordinates, 60);
  if (nearby) return { geometry: display(nearby.geometry), boundary: boundaryOf(roMeta, "ADM2", [nearby], "locality", "name-near-county") };
  if (countyFeature) return { geometry: display(countyFeature.geometry), boundary: boundaryOf(roMeta, "ADM1", [countyFeature], "region", "source-region"), unmatched: true };
  return { unmatched: true };
}

/** The candidate closest to the expected area, if within maxKm of it. */
function nearest(candidates, at, target, maxKm) {
  const ranked = candidates.map((c) => ({ c, km: distance(at(c), target) })).sort((a, b) => a.km - b.km);
  return ranked[0] && ranked[0].km <= maxKm ? ranked[0].c : undefined;
}

// ---------- Moldova: GeoNames village points ----------
const admin1 = new Map(fs.readFileSync(path.join(geonamesCache, "admin1CodesASCII.txt"), "utf8").split(/\r?\n/)
  .filter((l) => l.startsWith("MD.")).map((l) => { const [code, name, ascii] = l.split("\t"); return [code.slice(3), norm(ascii || name)]; }));
const zip = path.join(geonamesCache, "MD.zip");
const archive = XLSX.CFB.read(fs.readFileSync(zip), { type: "buffer" });
const gazetteer = Buffer.from(XLSX.CFB.find(archive, "MD.txt").content).toString("utf8").split(/\r?\n/).map((l) => l.split("\t"))
  .filter((x) => x[6] === "P").map((x) => ({
    id: x[0], name: x[1], lat: Number(x[4]), lng: Number(x[5]), code: x[7], population: Number(x[14] || 0),
    region: admin1.get(x[10]) ?? "", names: new Set([x[1], x[2], ...x[3].split(",")].filter(Boolean).map(compact)),
  }));
const mdMeta = JSON.parse(fs.readFileSync(path.join(boundaryCache, "MDA-metadata.json"), "utf8"));
const raions = readGeoJSON("MDA-ADM1.geojson").features.map((f) => ({ key: compact(f.properties.shapeName), feature: f }));
const regionKey = (r) => compact(r).replace(/GAGAUZIA|GAGAUZ.*/, "GAGAUZIA").replace(/MUNICIPALITY$/, "");
function locateMoldova(row) {
  const region = regionKey(row.extra.Regiune);
  const name = compact(row.extra.Localitate);
  const raion = raions.find((r) => regionKey(r.key) === region || regionKey(r.key).startsWith(region) || region.startsWith(regionKey(r.key)))?.feature;
  const inRegion = (g) => (raion ? contains(raion.geometry, [g.lng, g.lat]) : regionKey(g.region).startsWith(region));
  const candidates = gazetteer.filter((g) => g.names.has(name) && inRegion(g))
    .sort((a, b) => Number(b.code.startsWith("PPLA")) - Number(a.code.startsWith("PPLA")) || b.population - a.population);
  if (candidates.length) {
    const g = candidates[0];
    return { geometry: { type: "Point", coordinates: [g.lng, g.lat] }, geonames: g, ambiguous: candidates.length > 1 };
  }
  const near = raion && nearest(gazetteer.filter((g) => g.names.has(name)), (g) => [g.lng, g.lat], centroid(raion).geometry.coordinates, 40);
  if (near) return { geometry: { type: "Point", coordinates: [near.lng, near.lat] }, geonames: near };
  if (raion) return { geometry: display(raion.geometry), boundary: boundaryOf(mdMeta, "ADM1", [raion], "region", "source-region"), unmatched: true };
  return { unmatched: true };
}

// ---------- build records ----------
const publicRecord = (d) => {
  const extra = Object.fromEntries(PUBLIC_EXTRA.filter((k) => d.extra?.[k]).map((k) => [k, String(d.extra[k])]));
  return {
    id: d.id, name: d.name ?? null, country: d.country ?? null, county: d.county ?? null, locality: d.locality ?? null,
    kind: d.kind ?? null, status: d.status ?? null, classification: null, source: d.source ?? null, geometry: d.publicGeometry ?? null,
    population: null, extra: Object.keys(extra).length ? extra : null,
  };
};
const report = { Romania: { rows: 0, outlines: 0, countyFallback: 0, noLocation: 0 }, Moldova: { rows: 0, points: 0, ambiguousNames: 0, raionFallback: 0, noLocation: 0 } };
const unmatched = [];
const records = [];
for (const [sheet, country, locate] of [["Romania", "RO", locateRomania], ["Moldova", "MD", locateMoldova]]) {
  for (const row of sheetRows(sheet)) {
    const r = report[sheet]; r.rows++;
    const place = locate(row);
    const id = `redi-xlsm-2026-${createHash("sha256").update(`${sheet}#${row.row}`).digest("hex").slice(0, 24)}`;
    const extra = { ...row.extra, _sourceSheet: sheet, _sourceRow: row.row, "Context sursă": row.context };
    if (place.geonames) Object.assign(extra, { _geonamesId: place.geonames.id, "Localizare GeoNames": place.geonames.name, "Tip localizare": place.geonames.code });
    const d = {
      id, name: row.extra.Localitate, locality: row.extra.Localitate, county: row.extra.Regiune, country,
      kind: place.geometry?.type === "Point" ? "punct" : "zona", status: STATUS[row.extra["Status REDI"]], source: "catalog",
      geometry: place.geometry ?? null, extra,
      ...(place.boundary ? { boundary: place.boundary, locationAccuracy: "administrative" } : place.geometry ? { locationAccuracy: "locality" } : { locationAccuracy: "unresolved" }),
    };
    if (place.unmatched) { unmatched.push(`${sheet} r${row.row}: ${row.extra.Regiune} / ${row.extra.Localitate}`); }
    if (sheet === "Romania") place.unmatched ? (place.geometry ? r.countyFallback++ : r.noLocation++) : r.outlines++;
    else if (place.geonames) { r.points++; if (place.ambiguous) r.ambiguousNames++; } else place.geometry ? r.raionFallback++ : r.noLocation++;
    if (d.geometry) {
      const risk = assessPublicationRisk(d, { public: true, shareGeometry: true });
      Object.assign(d, { visibility: "public", publicationStatus: "published", privacyReviewed: true, publicGeometry: d.geometry });
      d.publicRecord = publicRecord(d);
      d.privacyAssessment = {
        level: risk.level, factors: risk.factors.map((f) => f.code), justification: d.kind === "punct" ? POINT_JUSTIFICATION : OUTLINE_JUSTIFICATION,
        public: true, sharedGeometry: true, assessedBy: null, assessedAt: new Date().toISOString(), method: "bulk-workbook-import",
      };
    } else Object.assign(d, { visibility: "restricted", publicationStatus: "draft" });
    records.push({ collection: "communities", id, data: d });
  }
}
console.log(JSON.stringify(report, null, 1));
console.log(`unmatched (${unmatched.length}):\n  ${unmatched.slice(0, 60).join("\n  ")}`);
console.log(`payload ${(JSON.stringify(records).length / 1e6).toFixed(2)} MB for ${records.length} records`);
if (dryRun) process.exit(0);

// Stable ids make a rerun after an interruption safe: existing ids are left untouched.
for (let i = 0; i < records.length; i += 200) {
  const { error } = await client.from("redi_records").upsert(records.slice(i, i + 200), { onConflict: "collection,id", ignoreDuplicates: true });
  if (error) throw error;
  process.stdout.write(`\rinserted ${Math.min(i + 200, records.length)}/${records.length}`);
}
console.log("\ndone");
