import { NextResponse } from "next/server";
import { importSummary, readSummaries } from "@/lib/summaryStore";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const reports = await readSummaries();
  const source = new URL(request.url).searchParams.get("source");
  if (source) {
    const report = reports.find((entry) => entry.id === source);
    if (!report) return NextResponse.json({ error: "Sumarul nu a fost găsit." }, { status: 404 });
    return new Response(report.originalCSV, { headers: { "Content-Type": "text/csv;charset=utf-8", "Content-Disposition": "attachment; filename=\"REDI-sumar-original.csv\"" } });
  }
  return NextResponse.json(reports.map(({ originalCSV, ...report }) => { void originalCSV; return report; }));
}

export async function POST(request: Request) {
  const form = await request.formData().catch(() => null);
  const upload = form?.get("file");
  if (!(upload instanceof File) || !upload.name.toLowerCase().endsWith(".csv")) return NextResponse.json({ error: "Selectați un fișier CSV de sumar REDI." }, { status: 400 });
  if (upload.size > 5_000_000) return NextResponse.json({ error: "Fișierul depășește limita de 5 MB." }, { status: 413 });
  try {
    const { report, duplicate } = await importSummary(await upload.text(), upload.name);
    return NextResponse.json({ id: report.id, duplicate, countries: report.countries.length, localities: report.totals.localities });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Importul sumarului a eșuat." }, { status: 400 });
  }
}
