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
    const country = url.searchParams.get("country");
    return privateJSON(
      country
        ? data.filter((row: { country?: string }) => row.country === country)
        : data,
    );
  } catch (e) {
    return apiError(e);
  }
}
