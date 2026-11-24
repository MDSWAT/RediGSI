import { NextResponse } from "next/server";
import { readDB } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(await readDB());
}
