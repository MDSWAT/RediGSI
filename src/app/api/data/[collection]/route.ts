import { NextResponse } from "next/server";
import { isCollection, mutate, newId, readDB } from "@/lib/db";
import type { BaseRecord } from "@/lib/types";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ collection: string }> };

const isObj = (x: unknown): x is Record<string, unknown> =>
  typeof x === "object" && x !== null && !Array.isArray(x);

async function itemsFrom(req: Request): Promise<Record<string, unknown>[] | null> {
  const body = await req.json().catch(() => null);
  if (!isObj(body) || !Array.isArray(body.items) || !body.items.every(isObj)) return null;
  return body.items as Record<string, unknown>[];
}

export async function GET(_req: Request, { params }: Ctx) {
  const { collection } = await params;
  if (!isCollection(collection)) return NextResponse.json({ error: "unknown collection" }, { status: 404 });
  return NextResponse.json((await readDB())[collection]);
}

/** Add records: { items: [...] } */
export async function POST(req: Request, { params }: Ctx) {
  const { collection } = await params;
  if (!isCollection(collection)) return NextResponse.json({ error: "unknown collection" }, { status: 404 });
  const items = await itemsFrom(req);
  if (!items) return NextResponse.json({ error: "expected { items: object[] }" }, { status: 400 });

  const now = new Date().toISOString();
  const created = items.map((it) => ({ ...it, id: newId(), createdAt: now }));
  await mutate((db) => {
    (db[collection] as BaseRecord[]).push(...(created as unknown as BaseRecord[]));
  });
  return NextResponse.json({ items: created });
}

/** Bulk partial update by id: { items: [{ id, ...fields }] } */
export async function PUT(req: Request, { params }: Ctx) {
  const { collection } = await params;
  if (!isCollection(collection)) return NextResponse.json({ error: "unknown collection" }, { status: 404 });
  const items = await itemsFrom(req);
  if (!items) return NextResponse.json({ error: "expected { items: object[] }" }, { status: 400 });

  const patches = new Map(items.filter((i) => typeof i.id === "string").map((i) => [i.id as string, i]));
  const updated = await mutate((db) => {
    const list = db[collection] as BaseRecord[];
    const out: BaseRecord[] = [];
    list.forEach((rec, i) => {
      const p = patches.get(rec.id);
      if (p) {
        list[i] = { ...rec, ...p, id: rec.id };
        out.push(list[i]);
      }
    });
    return out;
  });
  return NextResponse.json({ items: updated });
}

/** Bulk delete: { ids: [...] } or { all: true } */
export async function DELETE(req: Request, { params }: Ctx) {
  const { collection } = await params;
  if (!isCollection(collection)) return NextResponse.json({ error: "unknown collection" }, { status: 404 });
  const body = await req.json().catch(() => null);
  if (!isObj(body)) return NextResponse.json({ error: "expected { ids } or { all: true }" }, { status: 400 });

  const removed = await mutate((db) => {
    const list = db[collection] as BaseRecord[];
    const before = list.length;
    if (body.all === true) {
      (db as unknown as Record<string, BaseRecord[]>)[collection] = [];
    } else if (Array.isArray(body.ids)) {
      const ids = new Set(body.ids as string[]);
      (db as unknown as Record<string, BaseRecord[]>)[collection] = list.filter((r) => !ids.has(r.id));
    }
    return before - (db[collection] as BaseRecord[]).length;
  });
  return NextResponse.json({ removed });
}
