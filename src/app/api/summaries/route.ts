import {
  accessProfile,
  assertOrigin,
  workspaceClient,
  rpcError,
  apiError,
  AccessError,
  privateJSON,
} from "@/lib/workspaceServer";
import { canEdit, isAdmin } from "@/lib/access";
import { NextResponse } from "next/server";
import { importWorkspaceSummary } from "@/lib/workspaceSummary";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  try {
    const access = await accessProfile();
    const source = new URL(request.url).searchParams.get("source");
    if (source) {
      if (!isAdmin(access))
        throw new AccessError(
          "Descărcarea surselor originale este rezervată administratorilor.",
        );
      const { data: original, error: sourceError } = await (
        await workspaceClient()
      ).rpc("redi_summary_source", { p_id: source });
      if (sourceError) throw rpcError(sourceError);
      if (original === null)
        return NextResponse.json(
          { error: "Sumarul nu a fost găsit." },
          { status: 404 },
        );
      return new Response(original, {
        headers: {
          "Cache-Control": "private, no-store",
          "Content-Type": "text/csv;charset=utf-8",
          "Content-Disposition":
            'attachment; filename="REDI-sumar-original.csv"',
        },
      });
    }
    const { data, error } = await (
      await workspaceClient()
    ).rpc("redi_workspace_summaries");
    if (error) throw rpcError(error);
    return privateJSON(data);
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    assertOrigin(request);
    const a = await accessProfile();
    if (
      !canEdit(a) ||
      (!a.scopes.some(
        (s) => s.country === "*" && Object.keys(s).length === 1,
      ) &&
        !isAdmin(a))
    )
      throw new AccessError(
        "Importul sumarelor complete necesită drepturi de editare globale.",
      );
  } catch (e) {
    return apiError(e);
  }
  const form = await request.formData().catch(() => null);
  const upload = form?.get("file");
  if (!(upload instanceof File) || !upload.name.toLowerCase().endsWith(".csv"))
    return NextResponse.json(
      { error: "Selectați un fișier CSV de sumar REDI." },
      { status: 400 },
    );
  if (upload.size > 5_000_000)
    return NextResponse.json(
      { error: "Fișierul depășește limita de 5 MB." },
      { status: 413 },
    );
  try {
    const originalCSV = new TextDecoder("utf-8", { ignoreBOM: true }).decode(
      await upload.arrayBuffer(),
    );
    const { report, duplicate } = await importWorkspaceSummary(
      originalCSV,
      upload.name,
    );
    return NextResponse.json({
      id: report.id,
      duplicate,
      countries: report.countries.length,
      localities: report.totals.localities,
    });
  } catch (error) {
    if (error instanceof AccessError) return apiError(error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Importul sumarului a eșuat.",
      },
      { status: 400 },
    );
  }
}
