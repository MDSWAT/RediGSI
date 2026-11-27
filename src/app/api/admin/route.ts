import { accessProfile } from "@/lib/workspaceServer";
import { EXPORT_GROUPS, isAdmin, type ExportGroup } from "@/lib/access";
import { database } from "@/lib/database";
import { inviteEmail, MailError, sendMail } from "@/lib/mail";
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
    const client = await workspaceClient();
    const { data, error } = await client.rpc(
      entity ? "redi_record_history" : "redi_admin_overview",
      entity ? { p_type: entity, p_id: id } : {},
    );
    if (error) throw rpcError(error);
    if (entity) return privateJSON(data);
    const groups = await client.rpc("redi_export_groups_overview");
    if (groups.error) throw rpcError(groups.error);
    const byUser = (groups.data ?? {}) as Record<string, string[]>;
    return privateJSON({
      ...data,
      members: (data.members ?? []).map((m: { userId: string }) => ({
        ...m,
        exportGroups: byUser[m.userId] ?? [],
      })),
    });
  } catch (e) {
    return apiError(e);
  }
}
export async function POST(request: Request) {
  try {
    if (!isAdmin(await accessProfile()))
      throw new AccessError("Operația necesită un administrator.");
    const body = await readJSON(request, 50_000);
    const client = await workspaceClient();
    if (body.action === "invite") {
      const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
      if (!/^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/.test(email))
        throw new AccessError("Adresă de email invalidă.", 400);
      // New accounts start as public viewers; the administrator then assigns role and territories.
      const created = await database().auth.admin.createUser({ email, email_confirm: true });
      if (created.error && !/already been registered|already exists/i.test(created.error.message))
        throw new AccessError("Contul nu a putut fi creat.", 400);
      try {
        await sendMail({ to: email, ...inviteEmail(new URL(request.url).origin) });
      } catch (e) {
        if (e instanceof MailError)
          return privateJSON({ saved: true, warning: `Cont creat, dar emailul de invitație nu a plecat: ${e.message}` });
        throw e;
      }
      return privateJSON({ saved: true });
    }
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
    if (Array.isArray(body.exportGroups)) {
      const groups = body.exportGroups.filter(
        (g: unknown): g is ExportGroup =>
          typeof g === "string" && (EXPORT_GROUPS as string[]).includes(g),
      );
      const saved = await client.rpc("redi_set_export_groups", {
        p_user: body.userId,
        p_groups: body.canExport === true ? groups : [],
      });
      if (saved.error) throw rpcError(saved.error);
    }
    return privateJSON({ saved: true });
  } catch (e) {
    return apiError(e);
  }
}
