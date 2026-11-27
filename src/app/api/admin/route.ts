import { accessProfile } from "@/lib/workspaceServer";
import { isAdmin } from "@/lib/access";
import { ensureBoundaries } from "@/lib/boundaryImport";
import {
  workspaceClient,
  rpcError,
  apiError,
  privateJSON,
  readJSON,
  AccessError,
} from "@/lib/workspaceServer";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    if (!isAdmin(await accessProfile()))
      throw new AccessError("Operația necesită un administrator.");
    const url = new URL(request.url);
    const entity = url.searchParams.get("entity");
    const id = url.searchParams.get("id");
    if (entity && (!id || entity.length > 100 || id.length > 200))
      throw new AccessError("Referință invalidă.", 400);
    const { data, error } = await (
      await workspaceClient()
    ).rpc(
      entity ? "redi_record_history" : "redi_admin_overview",
      entity ? { p_type: entity, p_id: id } : {},
    );
    if (error) throw rpcError(error);
    return privateJSON(data);
  } catch (e) {
    return apiError(e);
  }
}
export async function POST(request: Request) {
  try {
    if (!isAdmin(await accessProfile()))
      throw new AccessError("Operația necesită un administrator.");
    const body = await readJSON(request, 50_000);
    if (body.action === "initialize_catalog") {
      if (!isAdmin(await accessProfile()))
        throw new AccessError("Operația necesită un administrator.");
      await ensureBoundaries();
      return privateJSON({ saved: true });
    }
    const client = await workspaceClient();
    if (body.action === "restore") {
      if (typeof body.id !== "string" || typeof body.collection !== "string")
        throw new AccessError("Înregistrare invalidă.", 400);
      const { data, error } = await client.rpc("redi_mutate_records", {
        p_collection: body.collection,
        p_operation: "restore",
        p_ids: [body.id],
      });
      if (error) throw rpcError(error);
      return privateJSON(data);
    }
    if (
      body.action !== "member" ||
      typeof body.userId !== "string" ||
      !Array.isArray(body.scopes)
    )
      throw new AccessError("Permisiuni invalide.", 400);
    const { error } = await client.rpc("redi_set_member", {
      p_user: body.userId,
      p_role: body.role,
      p_scopes: body.scopes,
      p_active: body.active === true,
      p_review: body.canReview === true,
      p_export: body.canExport === true,
    });
    if (error) throw rpcError(error);
    return privateJSON({ saved: true });
  } catch (e) {
    return apiError(e);
  }
}
