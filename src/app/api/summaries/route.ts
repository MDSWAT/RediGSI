import { NextResponse } from "next/server";
import { importSummary, readSummaries, readSummarySource } from "@/lib/summaryStore";
import { DatabaseError } from "@/lib/database";
import { storageResponse } from "@/lib/storageResponse";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  try {
  const source = new URL(request.url).searchParams.get("source");
  if (source) {
    const original = await readSummarySource(source);
    if (original === null) return NextResponse.json({ error: "Sumarul nu a fost găsit." }, { status: 404 });
    return new Response(original, { headers: { "Content-Type": "text/csv;charset=utf-8", "Content-Disposition": "attachment; filename=\"REDI-sumar-original.csv\"" } });
  }
  return NextResponse.json(await readSummaries());
  } catch (error) { return storageResponse(error); }
}

export async function POST(request: Request) {
  const form = await request.formData().catch(() => null);
  const upload = form?.get("file");
  if (!(upload instanceof File) || !upload.name.toLowerCase().endsWith(".csv")) return NextResponse.json({ error: "Selectați un fișier CSV de sumar REDI." }, { status: 400 });
  if (upload.size > 5_000_000) return NextResponse.json({ error: "Fișierul depășește limita de 5 MB." }, { status: 413 });
  try {
    const originalCSV = new TextDecoder("utf-8", { ignoreBOM: true }).decode(await upload.arrayBuffer());
    const { report, duplicate } = await importSummary(originalCSV, upload.name);
    return NextResponse.json({ id: report.id, duplicate, countries: report.countries.length, localities: report.totals.localities });
  } catch (error) {
    if (error instanceof DatabaseError) return storageResponse(error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Importul sumarului a eșuat." }, { status: 400 });
  }
}
