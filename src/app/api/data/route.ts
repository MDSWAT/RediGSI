import { NextResponse } from "next/server";
import { readDB } from "@/lib/db";
import { storageResponse } from "@/lib/storageResponse";

export const dynamic = "force-dynamic";

export async function GET() {
  try { return NextResponse.json(await readDB()); }
  catch (error) { return storageResponse(error); }
}
