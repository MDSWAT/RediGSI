import "server-only";
import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { COLLECTIONS, type CollectionName, type DB } from "./types";

/**
 * Minimal JSON-file store. Good enough for a prototype / a small team;
 * swap for Postgres + PostGIS when the data grows.
 */
const FILE = path.join(process.cwd(), "data", "db.json");

const empty = (): DB => ({ communities: [], entrepreneurs: [], clients: [], localities: [] });

export async function readDB(): Promise<DB> {
  try {
    const raw = await fs.readFile(FILE, "utf8");
    return { ...empty(), ...JSON.parse(raw) };
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return empty();
    throw e;
  }
}

async function writeDB(db: DB) {
  await fs.mkdir(path.dirname(FILE), { recursive: true });
  const tmp = `${FILE}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(db), "utf8");
  await fs.rename(tmp, FILE);
}

let queue: Promise<unknown> = Promise.resolve();

/** Serialises read-modify-write cycles so concurrent requests don't clobber each other. */
export function mutate<T>(fn: (db: DB) => T): Promise<T> {
  const run = queue.then(async () => {
    const db = await readDB();
    const result = fn(db);
    await writeDB(db);
    return result;
  });
  queue = run.catch(() => undefined);
  return run;
}

export function isCollection(x: string): x is CollectionName {
  return (COLLECTIONS as string[]).includes(x);
}

export const newId = () => randomUUID();
