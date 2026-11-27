import {
  workspaceClient,
  rpcError,
  apiError,
  privateJSON,
} from "@/lib/workspaceServer";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    const { data, error } = await (
      await workspaceClient()
    ).rpc("redi_workspace_data");
    if (error) throw rpcError(error);
    return privateJSON(data);
  } catch (e) {
    return apiError(e);
  }
}
