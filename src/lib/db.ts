import "server-only";
import { randomUUID } from "crypto";
import { COLLECTIONS, type CollectionName, type DB, type BaseRecord } from "./types";
import { database, DatabaseError, storageError } from "./database";
import { ensureCatalog } from "./catalogSeed";

export async function readDB(): Promise<DB> {
  await ensureCatalog();
  // One database snapshot, with no PostgREST 1,000-row truncation.
  const { data, error } = await database().rpc("redi_read_data");
  if (error) storageError(error);
  if (!data || !COLLECTIONS.every((name) => Array.isArray(data[name]))) throw new DatabaseError("Răspuns invalid din baza de date Supabase.");
  return data as DB;
}

export async function addRecords(collection: CollectionName, items: Record<string, unknown>[]) {
  if (!items.length) return [];
  const now = new Date().toISOString();
  const created = items.map((item) => ({ ...item, id: randomUUID(), createdAt: now }));
  const { error } = await database().from("redi_records").insert(created.map((item) => ({ collection, id: item.id, data: item })));
  if (error) storageError(error);
  return created;
}

export async function updateRecords(collection: CollectionName, items: Record<string, unknown>[]): Promise<BaseRecord[]> {
  if (!items.length) return [];
  const { data, error } = await database().rpc("redi_update_records", { p_collection: collection, p_items: items });
  if (error) storageError(error);
  return data as BaseRecord[];
}

export async function deleteRecords(collection: CollectionName, ids: string[] | "all"): Promise<number> {
  if (Array.isArray(ids) && !ids.length) return 0;
  const { data, error } = await database().rpc("redi_delete_records", { p_collection: collection, p_ids: ids === "all" ? [] : ids, p_all: ids === "all" });
  if (error) storageError(error);
  return data as number;
}

export function isCollection(value: string): value is CollectionName {
  return (COLLECTIONS as string[]).includes(value);
}
