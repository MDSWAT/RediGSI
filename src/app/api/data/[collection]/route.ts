import { NextResponse } from "next/server";
import { isCollection, addRecords, updateRecords, deleteRecords, readDB } from "@/lib/db";
import { storageResponse } from "@/lib/storageResponse";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ collection: string }> };
const isObj = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

async function itemsFrom(req: Request): Promise<Record<string, unknown>[] | null> {
  const body = await req.json().catch(() => null);
  return isObj(body) && Array.isArray(body.items) && body.items.every(isObj) ? body.items : null;
}

export async function GET(_req: Request, { params }: Ctx) {
  const { collection } = await params;
  if (!isCollection(collection)) return NextResponse.json({ error: "unknown collection" }, { status: 404 });
  try { return NextResponse.json((await readDB())[collection]); }
  catch (error) { return storageResponse(error); }
}

export async function POST(req: Request, { params }: Ctx) {
  const { collection } = await params;
  if (!isCollection(collection)) return NextResponse.json({ error: "unknown collection" }, { status: 404 });
  const items = await itemsFrom(req);
  if (!items) return NextResponse.json({ error: "expected { items: object[] }" }, { status: 400 });
  try { return NextResponse.json({ items: await addRecords(collection, items) }); }
  catch (error) { return storageResponse(error); }
}

export async function PUT(req: Request, { params }: Ctx) {
  const { collection } = await params;
  if (!isCollection(collection)) return NextResponse.json({ error: "unknown collection" }, { status: 404 });
  const items = await itemsFrom(req);
  if (!items) return NextResponse.json({ error: "expected { items: object[] }" }, { status: 400 });
  try { return NextResponse.json({ items: await updateRecords(collection, items) }); }
  catch (error) { return storageResponse(error); }
}

export async function DELETE(req: Request, { params }: Ctx) {
  const { collection } = await params;
  if (!isCollection(collection)) return NextResponse.json({ error: "unknown collection" }, { status: 404 });
  const body = await req.json().catch(() => null);
  if (!isObj(body) || (body.all !== true && !(Array.isArray(body.ids) && body.ids.every((id) => typeof id === "string")))) {
    return NextResponse.json({ error: "expected { ids: string[] } or { all: true }" }, { status: 400 });
  }
  try { return NextResponse.json({ removed: await deleteRecords(collection, body.all === true ? "all" : body.ids as string[]) }); }
  catch (error) { return storageResponse(error); }
}
