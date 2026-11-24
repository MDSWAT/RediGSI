import "server-only";
import { createHash } from "crypto";
import { parseCountrySummary, type CountrySummary, type ImportedCountrySummary } from "./countrySummary";
import { database, storageError } from "./database";
import { ensureCatalog } from "./catalogSeed";

interface SummaryRow { id: string; imported_at: string; report: CountrySummary }
const reportOf = (row: SummaryRow): ImportedCountrySummary => ({ ...row.report, id: row.id, importedAt: row.imported_at });

export async function readSummaries(): Promise<ImportedCountrySummary[]> {
  await ensureCatalog();
  const result: ImportedCountrySummary[] = [];
  const client = database();
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await client.from("redi_summaries").select("id,imported_at,report").order("imported_at").order("id").range(offset, offset + 499);
    if (error) storageError(error);
    const rows = data as SummaryRow[];
    result.push(...rows.map(reportOf));
    if (rows.length < 500) return result;
  }
}

export async function readSummarySource(id: string): Promise<string | null> {
  const { data, error } = await database().from("redi_summaries").select("original_csv").eq("id", id).maybeSingle();
  if (error) storageError(error);
  return data?.original_csv ?? null;
}

export async function importSummary(originalCSV: string, sourceName: string) {
  const report = parseCountrySummary(originalCSV, sourceName);
  if (!report) throw new Error("Fișierul nu conține un sumar REDI recunoscut.");
  const id = createHash("sha256").update(originalCSV, "utf8").digest("hex");
  const client = database();
  const { data, error } = await client.from("redi_summaries").insert({ id, report, original_csv: originalCSV }).select("id,imported_at,report").single();
  // A unique database key handles simultaneous imports across serverless instances.
  if (error?.code === "23505") {
    const existing = await client.from("redi_summaries").select("id,imported_at,report").eq("id", id).single();
    if (existing.error) storageError(existing.error);
    return { report: reportOf(existing.data as SummaryRow), duplicate: true };
  }
  if (error) storageError(error);
  return { report: reportOf(data as SummaryRow), duplicate: false };
}
