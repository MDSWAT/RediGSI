import "server-only";
import { createHash } from "crypto";
import source from "@/data/catalog-2026.json";
import manifestJSON from "@/data/catalog-boundaries-2026.json";
import { database, storageError } from "./database";
import { boundaryUpgrade, type BoundaryManifest } from "./boundaries";
import type { Community, DB } from "./types";
import { CATALOG_ID, ensureCatalog } from "./catalogSeed";

const manifest = manifestJSON as unknown as BoundaryManifest;
export const BOUNDARY_IMPORT_ID = createHash("sha256").update(manifest.version).digest("hex");
let pending: Promise<void> | undefined;

async function upgrade() {
  await ensureCatalog();
  const client = database();
  const marker = await client.from("redi_summaries").select("id").eq("id", BOUNDARY_IMPORT_ID).maybeSingle();
  if (marker.error) storageError(marker.error);
  if (marker.data) return;
  const snapshot = await client.rpc("redi_read_data");
  if (snapshot.error) storageError(snapshot.error);
  const current = new Map((snapshot.data as DB).communities.map(c => [c.id, c]));
  const original = new Map((source.communities as unknown as Community[]).map(c => [c.id, c]));
  const shapes = new Map(manifest.boundaries.map(b => [b.id, b]));
  for (let offset = 0; offset < manifest.assignments.length; offset += 8) {
    await Promise.all(manifest.assignments.slice(offset, offset + 8).map(async assignment => {
      const record = current.get(assignment.id), initial = original.get(assignment.id), shape = shapes.get(assignment.boundaryId);
      if (!record || !initial || !shape) return; // Do not recreate deleted records.
      const upgraded = boundaryUpgrade(record, initial, shape, assignment);
      if (!upgraded) return;
      // Compare-and-swap protects concurrent user edits while replacing the JSON document.
      const result = await client.from("redi_records").update({ data: upgraded }).eq("collection", "communities").eq("id", record.id).eq("data", JSON.stringify(record));
      if (result.error) storageError(result.error);
    }));
  }
  const summary = await client.from("redi_summaries").select("report").eq("id", CATALOG_ID).maybeSingle();
  if (summary.error) storageError(summary.error);
  if (summary.data) {
    const report = summary.data.report;
    const warnings = [...report.warnings.filter((note: string) => !note.startsWith("610 poziții") && !note.startsWith("Contururi administrative:")),
      "Contururi administrative: 534 localități, 36 municipalități de referință și 58 regiuni de referință. Surse geoBoundaries; anii și licențele diferă și sunt indicați pentru fiecare contur. Aceste zone nu delimitează populația Roma. Cele 18 localizări inițial neconfirmate au doar o regiune de referință."];
    const result = await client.from("redi_summaries").update({ report: { ...report, warnings } }).eq("id", CATALOG_ID);
    if (result.error) storageError(result.error);
  }
  const result = await client.from("redi_summaries").upsert({ id: BOUNDARY_IMPORT_ID, original_csv: "", report: { kind: "boundary-import", version: manifest.version } }, { onConflict: "id", ignoreDuplicates: true });
  if (result.error) storageError(result.error);
}

export function ensureBoundaries(): Promise<void> {
  return pending ??= upgrade().catch(error => { pending = undefined; throw error; });
}
