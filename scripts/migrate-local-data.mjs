// One-time READ of legacy files. Production routes never import this script.
import { readFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY before migrating.");
const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
async function readLegacy(name, fallback) {
  try { return JSON.parse(await readFile(new URL(`../data/${name}`, import.meta.url), "utf8")); }
  catch (error) { if (error.code === "ENOENT") return fallback; throw error; }
}
const legacy = await readLegacy("db.json", {});
const summaries = await readLegacy("summaries.json", []);
const rows = ["communities", "entrepreneurs", "clients", "localities"].flatMap((collection) => (legacy[collection] ?? []).map((data) => {
  if (typeof data.id !== "string" || !data.id) throw new Error(`Missing id in ${collection}; migration stopped.`);
  return { collection, id: data.id, data, ...(data.createdAt ? { created_at: data.createdAt } : {}) };
}));
const reportRows = summaries.map(({ id, importedAt, originalCSV, ...report }) => {
  if (!/^[0-9a-f]{64}$/.test(id) || typeof originalCSV !== "string") throw new Error("Invalid legacy summary; migration stopped.");
  return { id, imported_at: importedAt, report, original_csv: originalCSV };
});
for (let offset = 0; offset < rows.length; offset += 500) {
  const { error } = await client.from("redi_records").upsert(rows.slice(offset, offset + 500), { onConflict: "collection,id", ignoreDuplicates: true });
  if (error) throw new Error(`Record migration failed (${error.code}). Check database migration and server key.`);
}
for (const row of reportRows) {
  const { error } = await client.from("redi_summaries").upsert(row, { onConflict: "id", ignoreDuplicates: true });
  if (error) throw new Error(`Summary migration failed (${error.code}). Check database migration and server key.`);
}
const { data, error } = await client.rpc("redi_read_data");
if (error) throw new Error(`Verification failed (${error.code}).`);
for (const row of rows) {
  if (!data[row.collection].some((item) => item.id === row.id)) throw new Error(`Missing migrated record in ${row.collection}.`);
}
for (const row of reportRows) {
  const { data: stored, error: readError } = await client.from("redi_summaries").select("original_csv").eq("id", row.id).single();
  if (readError || stored.original_csv !== row.original_csv) throw new Error("Original summary verification failed.");
}
console.log(`Verified ${rows.length} legacy records and ${reportRows.length} summaries in Supabase. Existing database IDs and local originals were preserved.`);
