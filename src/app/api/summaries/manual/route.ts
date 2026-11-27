import {
  accessProfile,
  apiError,
  AccessError,
  assertOrigin,
  readJSON,
} from "@/lib/workspaceServer";
import { canEdit, isAdmin } from "@/lib/access";
import { NextResponse } from "next/server";
import { manualSummaryCSV } from "@/lib/countrySummary";
import { importWorkspaceSummary } from "@/lib/workspaceSummary";

export async function POST(request: Request) {
  try {
    assertOrigin(request);
    const a = await accessProfile();
    if (
      !canEdit(a) ||
      (!isAdmin(a) &&
        !a.scopes.some((s) => s.country === "*" && Object.keys(s).length === 1))
    )
      throw new AccessError(
        "Sumarele complete necesită drepturi de editare globale.",
      );
  } catch (e) {
    return apiError(e);
  }
  let input;
  try {
    input = await readJSON(request, 64000);
  } catch (e) {
    return apiError(e);
  }
  if (!input || typeof input !== "object" || Array.isArray(input))
    return NextResponse.json(
      { error: "Completați datele sumarului." },
      { status: 400 },
    );
  try {
    const result = await importWorkspaceSummary(
      manualSummaryCSV(input),
      "Introducere manuală",
    );
    return NextResponse.json({
      id: result.report.id,
      duplicate: result.duplicate,
    });
  } catch (error) {
    if (error instanceof AccessError) return apiError(error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Sumarul nu a putut fi salvat.",
      },
      { status: 400 },
    );
  }
}
