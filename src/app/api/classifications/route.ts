import { isAdmin } from "@/lib/access";
import {
  accessProfile,
  workspaceClient,
  readJSON,
  rpcError,
  AccessError,
  apiError,
  privateJSON,
} from "@/lib/workspaceServer";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    const { data, error } = await (
      await workspaceClient()
    ).rpc("redi_classification_list");
    if (error) throw rpcError(error);
    return privateJSON(data);
  } catch (e) {
    return apiError(e);
  }
}
export async function POST(request: Request) {
  try {
    if (!isAdmin(await accessProfile()))
      throw new AccessError("Nomenclatorul este gestionat de administrator.");
    const body = await readJSON(request, 10000);
    const { data, error } = await (
      await workspaceClient()
    ).rpc("redi_classification_save", {
      p_id: body.id ?? null,
      p_name: body.name,
      p_description: body.description ?? "",
      p_active: body.active === true,
      p_expected: body.expected ?? null,
    });
    if (error) throw rpcError(error);
    return privateJSON(data);
  } catch (e) {
    return apiError(e);
  }
}
