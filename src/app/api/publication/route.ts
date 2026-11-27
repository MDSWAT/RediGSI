import { isAdmin } from "@/lib/access";
import { assessPublicationRisk, MIN_JUSTIFICATION } from "@/lib/privacyRisk";
import type { Community } from "@/lib/types";
import {
  accessProfile,
  workspaceClient,
  readJSON,
  AccessError,
  rpcError,
  apiError,
  privateJSON,
} from "@/lib/workspaceServer";
export async function POST(request: Request) {
  try {
    if (!isAdmin(await accessProfile()))
      throw new AccessError("Publicarea necesită un administrator.");
    const body = await readJSON(request, 1_100_000);
    if (
      typeof body.id !== "string" ||
      !body.expected ||
      typeof body.expected !== "object"
    )
      throw new AccessError("Versiune lipsă.", 400);
    if (body.privacyReviewed !== true)
      throw new AccessError("Confirmați evaluarea de confidențialitate.", 400);
    const options = {
      public: body.public === true,
      shareGeometry: body.shareGeometry === true,
    };
    // Recomputed on the server from the exact version being published; the client's view is not trusted.
    const risk = assessPublicationRisk(body.expected as Community, options);
    const justification =
      typeof body.justification === "string" ? body.justification.trim() : "";
    if (risk.needsJustification && justification.length < MIN_JUSTIFICATION)
      throw new AccessError(
        `Riscul este ${risk.level === "high" ? "ridicat" : "mediu"}: descrieți motivul publicării (minim ${MIN_JUSTIFICATION} caractere).`,
        400,
      );
    const { data, error } = await (
      await workspaceClient()
    ).rpc("redi_publish_community_assessed", {
      p_id: body.id,
      p_expected: body.expected,
      p_public: options.public,
      p_share_geometry: options.shareGeometry,
      p_assessment: {
        level: risk.level,
        factors: risk.factors.map((f) => f.code),
        justification,
      },
    });
    if (error) {
      if (error.code === "22023" && /justification/i.test(error.message))
        throw new AccessError(
          `Geometria exactă necesită o justificare (minim ${MIN_JUSTIFICATION} caractere).`,
          400,
        );
      throw rpcError(error);
    }
    return privateJSON(data);
  } catch (e) {
    return apiError(e);
  }
}
