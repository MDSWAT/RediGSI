import { NextResponse } from "next/server";
import { manualSummaryCSV } from "@/lib/countrySummary";
import { importSummary } from "@/lib/summaryStore";
import { DatabaseError } from "@/lib/database";
import { storageResponse } from "@/lib/storageResponse";

export async function POST(request: Request) {
  const input = await request.json().catch(() => null);
  if (!input || typeof input !== "object" || Array.isArray(input)) return NextResponse.json({ error: "Completați datele sumarului." }, { status: 400 });
  try {
    const result = await importSummary(manualSummaryCSV(input), "Introducere manuală");
    return NextResponse.json({ id: result.report.id, duplicate: result.duplicate });
  } catch (error) {
    if (error instanceof DatabaseError) return storageResponse(error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Sumarul nu a putut fi salvat." }, { status: 400 });
  }
}
