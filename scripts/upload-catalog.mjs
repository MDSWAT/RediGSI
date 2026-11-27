// Uploads the bundled REDI catalog (628 rows from the 11 HTML sheets) and its
// administrative boundary polygons to Supabase. Same logic and markers as
// src/lib/catalogSeed.ts + src/lib/boundaryImport.ts, so it is idempotent:
// existing records and user edits are never overwritten, deleted rows are not recreated.
//
//   node --env-file=.env.local scripts/upload-catalog.mjs [--dry-run]
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { sourceLoader } from "../tests/helpers/load-typescript.mjs";

const dryRun = process.argv.includes("--dry-run");
const json = (p) => JSON.parse(readFileSync(new URL(p, import.meta.url), "utf8"));
const catalog = json("../src/data/catalog-2026.json");
const manifest = json("../src/data/catalog-boundaries-2026.json");
const { boundaryUpgrade } = sourceLoader()(new URL("../src/lib/boundaries.ts", import.meta.url));
const { parseCountrySummary } = sourceLoader()(new URL("../src/lib/countrySummary.ts", import.meta.url));
const CATALOG_ID = createHash("sha256").update("redi-html-catalog-2026-v1").digest("hex");
const BOUNDARY_IMPORT_ID = createHash("sha256").update(manifest.version).digest("hex");
const shapes = new Map(manifest.boundaries.map((b) => [b.id, b]));
const original = new Map(catalog.communities.map((c) => [c.id, c]));

if (dryRun) {
  const upgraded = manifest.assignments.filter((a) => {
    const c = original.get(a.id), s = shapes.get(a.boundaryId);
    return c && s && boundaryUpgrade(c, c, s, a);
  });
  const scopes = {};
  for (const a of manifest.assignments) scopes[a.scope] = (scopes[a.scope] ?? 0) + 1;
  console.log(JSON.stringify({ records: catalog.communities.length, withPolygon: upgraded.length, scopes }));
  process.exit(0);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY in .env.local.");
const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const fail = (step, error) => { throw new Error(`${step}: ${error.code ?? ""} ${error.message}`); };

// 1. Catalog rows (skipped entirely once the marker exists, so deletions stay deleted).
const marker = await client.from("redi_summaries").select("id").eq("id", CATALOG_ID).maybeSingle();
if (marker.error) fail("catalog marker", marker.error);
if (!marker.data) {
  const report = parseCountrySummary(catalog.summaryCSV, "Registru REDI · 11 foi HTML");
  if (!report) throw new Error("Summary sheet not recognised.");
  for (let i = 0; i < catalog.communities.length; i += 200) {
    const rows = catalog.communities.slice(i, i + 200).map((data) => ({ collection: "communities", id: data.id, data }));
    const { error } = await client.from("redi_records").upsert(rows, { onConflict: "collection,id", ignoreDuplicates: true });
    if (error) fail("insert records", error);
  }
  const { error } = await client.from("redi_summaries").upsert({
    id: CATALOG_ID,
    original_csv: catalog.summaryCSV,
    report: { ...report, sourceSheets: catalog.sourceSheets, coverage: catalog.coverage,
      warnings: [...report.warnings, "Exporturile conțin 628 de rânduri detaliate din cele 4.580 de localități din sumar. România: 111 din 3.181; Moldova: 15 din 897. Rândurile absente nu au fost inventate."] },
  }, { onConflict: "id", ignoreDuplicates: true });
  if (error) fail("catalog summary", error);
  console.log(`Catalog: ${catalog.communities.length} records inserted (existing ones left untouched).`);
} else console.log("Catalog: already imported, records left as they are.");

// 2. Boundary polygons replace the reference point, only where the record is still unedited.
const done = await client.from("redi_summaries").select("id").eq("id", BOUNDARY_IMPORT_ID).maybeSingle();
if (done.error) fail("boundary marker", done.error);
if (done.data) console.log("Boundaries: already applied.");
else {
  const snapshot = await client.from("redi_records").select("id,data,updated_at").eq("collection", "communities").like("id", "redi-html-2026-%");
  if (snapshot.error) fail("read records", snapshot.error);
  const current = new Map(snapshot.data.map((r) => [r.id, r.data]));
  const versions = new Map(snapshot.data.map((r) => [r.id, r.updated_at]));
  let updated = 0;
  for (let offset = 0; offset < manifest.assignments.length; offset += 8) {
    await Promise.all(manifest.assignments.slice(offset, offset + 8).map(async (a) => {
      const record = current.get(a.id), initial = original.get(a.id), shape = shapes.get(a.boundaryId);
      if (!record || !initial || !shape) return;
      const next = boundaryUpgrade(record, initial, shape, a);
      if (!next) return;
      const { error, count } = await client.from("redi_records").update({ data: next, updated_at: new Date().toISOString() }, { count: "exact" })
        // updated_at as version check; comparing the JSON itself overflows the URL for polygons.
        .eq("collection", "communities").eq("id", record.id).eq("updated_at", versions.get(record.id));
      if (error) fail(`boundary ${record.id}`, error);
      updated += count ?? 0;
    }));
  }
  const { error } = await client.from("redi_summaries").upsert(
    { id: BOUNDARY_IMPORT_ID, original_csv: "", report: { kind: "boundary-import", version: manifest.version } },
    { onConflict: "id", ignoreDuplicates: true });
  if (error) fail("boundary summary", error);
  console.log(`Boundaries: ${updated} records now carry their administrative polygon.`);
}
