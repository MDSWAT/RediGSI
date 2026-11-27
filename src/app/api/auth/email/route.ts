import { database } from "@/lib/database";
import { codeEmail, MailError, sendMail } from "@/lib/mail";
import { AccessError, apiError, privateJSON, readJSON } from "@/lib/workspaceServer";

export const dynamic = "force-dynamic";
const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/;
// Best-effort throttling per server instance; Supabase also rate-limits OTP generation per user.
const perEmail = new Map<string, number>();
const perIP = new Map<string, number[]>();
function throttle(email: string, ip: string) {
  const now = Date.now();
  for (const [k, at] of perEmail) if (now - at > 60_000) perEmail.delete(k);
  if (perEmail.has(email)) throw new AccessError("Așteaptă un minut înainte de a cere un cod nou.", 429);
  const hits = (perIP.get(ip) ?? []).filter((at) => now - at < 600_000);
  if (hits.length >= 10) throw new AccessError("Prea multe cereri. Încearcă din nou peste câteva minute.", 429);
  perEmail.set(email, now);
  perIP.set(ip, [...hits, now]);
}

async function findUser(email: string) {
  const admin = database().auth.admin;
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const user = data.users.find((u) => u.email?.toLowerCase() === email);
    if (user || data.users.length < 200) return user;
  }
  return undefined;
}

/**
 * Sends a one-time sign-in code by email (Hostinger). Codes are issued only to existing
 * accounts and to REDI_ADMIN_EMAIL, whose account is created and made the first
 * administrator on first use. The response never reveals whether an address has access.
 */
export async function POST(request: Request) {
  try {
    const body = await readJSON(request, 2_000);
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    if (!EMAIL.test(email)) throw new AccessError("Adresă de email invalidă.", 400);
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
    throttle(email, ip);
    const client = database();
    const adminEmail = process.env.REDI_ADMIN_EMAIL?.trim().toLowerCase();
    let user = await findUser(email);
    if (!user && email === adminEmail) {
      const created = await client.auth.admin.createUser({ email, email_confirm: true });
      if (created.error) throw created.error;
      user = created.data.user;
    }
    if (user && email === adminEmail) {
      // Succeeds only while no administrator exists; afterwards it is a harmless no-op.
      await client.rpc("redi_bootstrap_admin", { p_email: email });
    }
    if (user) {
      const link = await client.auth.admin.generateLink({ type: "magiclink", email });
      if (link.error) throw link.error;
      const code = link.data.properties?.email_otp;
      if (!code) throw new MailError("Codul nu a putut fi generat.");
      await sendMail({ to: email, ...codeEmail(code) });
    }
    return privateJSON({ sent: true });
  } catch (e) {
    if (e instanceof MailError) return privateJSON({ error: e.message }, 502);
    return apiError(e);
  }
}
