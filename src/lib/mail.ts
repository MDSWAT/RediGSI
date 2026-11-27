import "server-only";

/** Hostinger Mail API (Agentic Mail). The sender is the mailbox matching HOSTINGER_MAIL_FROM. */
const API = "https://api.mail.hostinger.com/api/v1";
let mailboxId: Promise<string> | undefined;

export class MailError extends Error {}

function token() {
  const value = process.env.HOSTINGER_MAIL_API_TOKEN;
  if (!value) throw new MailError("Trimiterea emailurilor nu este configurată (HOSTINGER_MAIL_API_TOKEN).");
  return value;
}

async function resolveMailbox(): Promise<string> {
  const from = process.env.HOSTINGER_MAIL_FROM?.toLowerCase();
  const response = await fetch(`${API}/me`, {
    headers: { Authorization: `Bearer ${token()}`, Accept: "application/json" },
    cache: "no-store",
  });
  if (!response.ok) throw new MailError(`Contul de email nu poate fi accesat (${response.status}).`);
  const body = (await response.json()) as { data?: { mailboxes?: { resourceId: string; address: string }[] } };
  const boxes = body.data?.mailboxes ?? [];
  const box = boxes.find((b) => b.address.toLowerCase() === from) ?? (from ? undefined : boxes[0]);
  if (!box) throw new MailError("Căsuța HOSTINGER_MAIL_FROM nu este accesibilă cu tokenul configurat.");
  return box.resourceId;
}

export async function sendMail(message: { to: string; subject: string; text: string; html: string }) {
  mailboxId ??= resolveMailbox().catch((error) => {
    mailboxId = undefined;
    throw error;
  });
  const response = await fetch(`${API}/mailboxes/${await mailboxId}/send`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token()}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      to: [message.to],
      displayName: process.env.HOSTINGER_MAIL_DISPLAY_NAME || "REDI GIS",
      subject: message.subject,
      text: message.text,
      html: message.html,
    }),
    cache: "no-store",
  });
  if (!response.ok) throw new MailError(`Emailul nu a putut fi trimis (${response.status}).`);
}

const escapeHTML = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export function codeEmail(code: string) {
  return {
    subject: `Codul tău de autentificare REDI GIS: ${code}`,
    text: `Codul tău de autentificare este ${code}.\n\nIntrodu-l în fereastra de autentificare. Codul expiră în curând și poate fi folosit o singură dată.\nDacă nu ai cerut acest cod, ignoră mesajul.`,
    html: `<div style="font-family:Arial,sans-serif;color:#202b33;max-width:480px">
<p>Codul tău de autentificare REDI GIS este:</p>
<p style="font-size:28px;font-weight:bold;letter-spacing:6px;color:#107c70">${escapeHTML(code)}</p>
<p>Introdu-l în fereastra de autentificare. Codul expiră în curând și poate fi folosit o singură dată.</p>
<p style="color:#64717d;font-size:12px">Dacă nu ai cerut acest cod, ignoră mesajul.</p></div>`,
  };
}

export function inviteEmail(origin: string) {
  const link = escapeHTML(origin);
  return {
    subject: "Ai primit acces la REDI GIS",
    text: `Un administrator ți-a creat acces la REDI GIS.\n\nDeschide ${origin}, apasă „Autentificare” și introdu această adresă de email. Vei primi un cod de autentificare.`,
    html: `<div style="font-family:Arial,sans-serif;color:#202b33;max-width:480px">
<p>Un administrator ți-a creat acces la <b>REDI GIS</b>.</p>
<p>Deschide <a href="${link}">${link}</a>, apasă „Autentificare” și introdu această adresă de email. Vei primi un cod de autentificare.</p></div>`,
  };
}
