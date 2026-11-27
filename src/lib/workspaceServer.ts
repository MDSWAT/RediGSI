import "server-only";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { PUBLIC_ACCESS, type AccessProfile } from "./access";

export class AccessError extends Error {
  constructor(
    message: string,
    public status = 403,
  ) {
    super(message);
  }
}
export async function workspaceClient() {
  return createClient(await cookies());
}
export async function accessProfile(): Promise<AccessProfile> {
  const client = await workspaceClient();
  const {
    data: { user },
    error,
  } = await client.auth.getUser();
  if (!user) {
    if (error && error.name !== "AuthSessionMissingError")
      throw new AccessError(
        "Sesiunea nu poate fi verificată. Reautentificați-vă.",
        401,
      );
    return PUBLIC_ACCESS;
  }
  const { data, error: profileError } = await client.rpc("redi_access_profile");
  if (profileError) throw rpcError(profileError);
  return { ...data, userId: user.id, email: user.email ?? null };
}
export function rpcError(error: { code?: string; message: string }) {
  if (error.code === "42501")
    return new AccessError(
      "Nu aveți permisiunea necesară pentru această operație.",
    );
  if (error.code === "40001")
    return new AccessError(
      "Înregistrarea a fost modificată. Reîncărcați înainte de a continua.",
      409,
    );
  if (error.code === "P0002")
    return new AccessError("Înregistrarea nu a fost găsită.", 404);
  if (error.code === "P0001")
    return new AccessError(
      "Limita de propuneri a fost atinsă. Reîncercați mai târziu.",
      429,
    );
  if (error.code === "22023")
    return new AccessError(
      "Date sau tranziție invalide. Verificați câmpurile, teritoriul și acordul de publicare.",
      400,
    );
  return new AccessError(
    "Serviciul de date nu este disponibil. Verificați configurarea Supabase și migrarea de guvernanță.",
    503,
  );
}
export function apiError(error: unknown) {
  const response = NextResponse.json(
    {
      error:
        error instanceof AccessError
          ? error.message
          : "Serviciul nu este disponibil. Reîncercați.",
    },
    { status: error instanceof AccessError ? error.status : 503 },
  );
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
export function privateJSON(data: unknown, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
}
export function assertOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin)
    throw new AccessError("Originea cererii nu este permisă.");
}
export async function readJSON(
  request: Request,
  max = 1_000_000,
): Promise<Record<string, unknown>> {
  assertOrigin(request);
  if (Number(request.headers.get("content-length")) > max)
    throw new AccessError("Cererea este prea mare.", 413);
  const text = await request.text();
  if (new TextEncoder().encode(text).length > max)
    throw new AccessError("Cererea este prea mare.", 413);
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    throw new AccessError("JSON invalid.", 400);
  }
  if (!body || typeof body !== "object" || Array.isArray(body))
    throw new AccessError("Date invalide.", 400);
  return body;
}
