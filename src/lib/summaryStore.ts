import "server-only";
import { promises as fs } from "fs";
import path from "path";
import { createHash } from "crypto";
import { parseCountrySummary, type ImportedCountrySummary } from "./countrySummary";

interface StoredSummary extends ImportedCountrySummary { originalCSV: string }
const file = path.join(process.cwd(), "data", "summaries.json");
let queue: Promise<unknown> = Promise.resolve();

export async function readSummaries(): Promise<StoredSummary[]> {
  try { return JSON.parse(await fs.readFile(file, "utf8")); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return []; throw error; }
}

export function importSummary(originalCSV: string, sourceName: string) {
  const report = parseCountrySummary(originalCSV, sourceName);
  if (!report) throw new Error("Fișierul nu conține un sumar REDI recunoscut.");
  const id = createHash("sha256").update(originalCSV, "utf8").digest("hex");
  const run = queue.then(async () => {
    const reports = await readSummaries();
    const existing = reports.find((entry) => entry.id === id);
    if (existing) return { report: existing, duplicate: true };
    const entry: StoredSummary = { ...report, id, importedAt: new Date().toISOString(), originalCSV };
    reports.push(entry);
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(`${file}.tmp`, JSON.stringify(reports), "utf8");
    await fs.rename(`${file}.tmp`, file);
    return { report: entry, duplicate: false };
  });
  queue = run.catch(() => undefined);
  return run;
}
