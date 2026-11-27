import { accessProfile } from "@/lib/workspaceServer";
import { canReview } from "@/lib/access";
import {
  workspaceClient,
  rpcError,
  apiError,
  privateJSON,
  readJSON,
  AccessError,
} from "@/lib/workspaceServer";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    if (!canReview(await accessProfile()))
      throw new AccessError("Dreptul de revizuire este necesar.");
    const { data, error } = await (
      await workspaceClient()
    ).rpc("redi_list_proposals");
    if (error) throw rpcError(error);
    return privateJSON(data);
  } catch (e) {
    return apiError(e);
  }
}
export async function POST(request: Request) {
  try {
    const body = await readJSON(request, 64_000);
    if (body.website)
      throw new AccessError("Propunerea nu a fost acceptată.", 400);
    const { data, error } = await (
      await workspaceClient()
    ).rpc("redi_submit_proposal", { p_data: body });
    if (error) throw rpcError(error);
    return privateJSON(data, 201);
  } catch (e) {
    return apiError(e);
  }
}
export async function PATCH(request: Request) {
  try {
    if (!canReview(await accessProfile()))
      throw new AccessError("Dreptul de revizuire este necesar.");
    const body = await readJSON(request, 10_000);
    if (
      typeof body.id !== "string" ||
      typeof body.status !== "string" ||
      typeof body.expected !== "string"
    )
      throw new AccessError("Propunere invalidă.", 400);
    const { data, error } = await (
      await workspaceClient()
    ).rpc("redi_transition_proposal", {
      p_id: body.id,
      p_status: body.status,
      p_expected: body.expected,
      p_note: body.note ?? "",
      p_public: body.public === true,
      p_share_geometry: body.shareGeometry === true,
      p_privacy_reviewed: body.privacyReviewed === true,
    });
    if (error) throw rpcError(error);
    return privateJSON(data);
  } catch (e) {
    return apiError(e);
  }
}
