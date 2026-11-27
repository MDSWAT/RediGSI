import { accessProfile } from "@/lib/workspaceServer";
import { canEdit, isAdmin } from "@/lib/access";
import { isCollection } from "@/lib/db";
import {
  workspaceClient,
  rpcError,
  apiError,
  privateJSON,
  readJSON,
  AccessError,
} from "@/lib/workspaceServer";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
type Ctx = { params: Promise<{ collection: string }> };
export async function GET(_req: Request, { params }: Ctx) {
  try {
    const { collection } = await params;
    if (!isCollection(collection))
      throw new AccessError("Colecție necunoscută.", 404);
    const { data, error } = await (
      await workspaceClient()
    ).rpc("redi_workspace_data");
    if (error) throw rpcError(error);
    return privateJSON(data[collection]);
  } catch (e) {
    return apiError(e);
  }
}
async function mutate(request: Request, ctx: Ctx, operation: string) {
  try {
    const { collection } = await ctx.params;
    if (!isCollection(collection))
      throw new AccessError("Colecție necunoscută.", 404);
    const access = await accessProfile();
    if (!canEdit(access) || (operation === "delete" && !isAdmin(access)))
      throw new AccessError(
        "Nu aveți drept de modificare pentru această operație.",
      );
    const body = await readJSON(request, 10_000_000);
    if (
      ["create", "update"].includes(operation) &&
      (!Array.isArray(body.items) ||
        body.items.length > 2000 ||
        !body.items.every(
          (i) => i && typeof i === "object" && !Array.isArray(i),
        ))
    )
      throw new AccessError("Lista de înregistrări este invalidă.", 400);
    if (
      operation === "delete" &&
      body.all !== true &&
      (!Array.isArray(body.ids) ||
        !body.ids.every((id) => typeof id === "string"))
    )
      throw new AccessError("Selectați înregistrările de șters.", 400);
    const { data, error } = await (
      await workspaceClient()
    ).rpc("redi_mutate_records", {
      p_collection: collection,
      p_operation: operation,
      p_items: body.items ?? [],
      p_ids: body.ids ?? [],
      p_all: body.all === true,
    });
    if (error) throw rpcError(error);
    return privateJSON(operation === "delete" ? data : { items: data });
  } catch (e) {
    return apiError(e);
  }
}
export const POST = (request: Request, ctx: Ctx) =>
  mutate(request, ctx, "create");
export const PUT = (request: Request, ctx: Ctx) =>
  mutate(request, ctx, "update");
export const DELETE = (request: Request, ctx: Ctx) =>
  mutate(request, ctx, "delete");
