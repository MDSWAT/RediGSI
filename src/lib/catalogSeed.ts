import "server-only";
import { createHash } from "crypto";
import catalog from "@/data/catalog-2026.json";
import { database, storageError } from "./database";
import { parseCountrySummary } from "./countrySummary";

// This bundled import is immutable input, not runtime file storage. All live
// records, edits and the completion marker live exclusively in Supabase.
export const CATALOG_ID = createHash("sha256").update("redi-html-catalog-2026-v1").digest("hex");
let pending: Promise<void> | undefined;

async function seed() {
  const client = database();
  const marker = await client.from("redi_summaries").select("id").eq("id", CATALOG_ID).maybeSingle();
  if (marker.error) storageError(marker.error);
  if (marker.data) return; // Never recreate intentionally deleted records.
  const report = parseCountrySummary(catalog.summaryCSV, "Registru REDI · 11 foi HTML");
  if (!report) throw new Error("Sumarul registrului nu a fost recunoscut.");
  // Stable source-row IDs make concurrent imports/retries safe and preserve edits.
  for (let i = 0; i < catalog.communities.length; i += 200) {
    const rows = catalog.communities.slice(i, i + 200).map((record) => ({ collection: "communities", id: record.id, data: record }));
    const { error } = await client.from("redi_records").upsert(rows, { onConflict: "collection,id", ignoreDuplicates: true });
    if (error) storageError(error);
  }
  const { error } = await client.from("redi_summaries").upsert({
    id: CATALOG_ID,
    original_csv: catalog.summaryCSV,
    report: { ...report, sourceSheets: catalog.sourceSheets, coverage: catalog.coverage,
      warnings: [...report.warnings, "Exporturile conțin 628 de rânduri detaliate din cele 4.580 de localități din sumar. România: 111 din 3.181; Moldova: 15 din 897. Rândurile absente nu au fost inventate.", "610 poziții orientative din GeoNames; 18 de înregistrări necesită confirmarea localizării. Punctele nu reprezintă limitele comunităților."] },
  }, { onConflict: "id", ignoreDuplicates: true });
  if (error) storageError(error);
}

export function ensureCatalog(): Promise<void> {
  return pending ??= seed().catch((error) => { pending = undefined; throw error; });
}
