import {
  filterRows,
  FILTER_KEYS,
  type WorkspaceFilters,
} from "@/lib/workspaceFilters";
import { accessProfile } from "@/lib/workspaceServer";
import { canExport } from "@/lib/access";
import { isCollection } from "@/lib/db";
import {
  workspaceClient,
  rpcError,
  apiError,
  privateJSON,
  AccessError,
} from "@/lib/workspaceServer";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    if (!canExport(await accessProfile()))
      throw new AccessError("Nu aveți drept de export.");
    const url = new URL(request.url);
    const collection = url.searchParams.get("collection") ?? "";
    if (!isCollection(collection))
      throw new AccessError("Colecție necunoscută.", 400);
    const { data, error } = await (
      await workspaceClient()
    ).rpc("redi_export_data", { p_collection: collection });
    if (error) throw rpcError(error);
    const filters = Object.fromEntries(
      FILTER_KEYS.map((key) => [key, url.searchParams.get(key) ?? ""]),
    ) as unknown as WorkspaceFilters;
    if (Object.values(filters).some((v) => v.length > 200))
      throw new AccessError("Filtru prea lung.", 400);
    return privateJSON(filterRows(collection, data, filters));
  } catch (e) {
    return apiError(e);
  }
}
