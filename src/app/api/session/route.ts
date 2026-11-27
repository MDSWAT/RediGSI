import { accessProfile, apiError, privateJSON } from "@/lib/workspaceServer";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    return privateJSON(await accessProfile());
  } catch (e) {
    return apiError(e);
  }
}
