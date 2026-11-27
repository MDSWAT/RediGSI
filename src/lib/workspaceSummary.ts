import "server-only";
import { createHash } from "crypto";
import {
  parseCountrySummary,
  type ImportedCountrySummary,
} from "./countrySummary";
import { AccessError, workspaceClient, rpcError } from "./workspaceServer";
export async function importWorkspaceSummary(
  originalCSV: string,
  sourceName: string,
): Promise<{ report: ImportedCountrySummary; duplicate: boolean }> {
  const report = parseCountrySummary(originalCSV, sourceName);
  if (!report)
    throw new AccessError("Fișierul nu conține un sumar REDI recunoscut.", 400);
  const id = createHash("sha256").update(originalCSV, "utf8").digest("hex");
  const { data, error } = await (
    await workspaceClient()
  ).rpc("redi_import_summary", {
    p_id: id,
    p_report: report,
    p_original: originalCSV,
  });
  if (error) throw rpcError(error);
  return data;
}
