import { canEdit } from "@/lib/access";
import {
  accessProfile,
  workspaceClient,
  readJSON,
  AccessError,
  rpcError,
  apiError,
  privateJSON,
} from "@/lib/workspaceServer";
export async function PATCH(request: Request) {
  try {
    if (!canEdit(await accessProfile()))
      throw new AccessError("Editarea geometriilor necesită drepturi GIS.");
    const body = await readJSON(request, 3_000_000);
    if (
      typeof body.id !== "string" ||
      !Object.hasOwn(body, "expectedGeometry") ||
      !body.geometry
    )
      throw new AccessError("Geometrie sau versiune lipsă.", 400);
    const { data, error } = await (
      await workspaceClient()
    ).rpc("redi_update_geometry", {
      p_id: body.id,
      p_geometry: body.geometry,
      p_expected: body.expectedGeometry,
      p_geocoding: body.geocoding ?? null,
    });
    if (error) throw rpcError(error);
    return privateJSON(data);
  } catch (e) {
    return apiError(e);
  }
}
