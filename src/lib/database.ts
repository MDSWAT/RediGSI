import "server-only";
import { createClient } from "@supabase/supabase-js";

export class DatabaseError extends Error {
  constructor(message: string) { super(message); this.name = "DatabaseError"; }
}

/** Server-only persistence client; never expose this key in NEXT_PUBLIC_* variables. */
export function database() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new DatabaseError("Stocarea Supabase nu este configurată. Setați NEXT_PUBLIC_SUPABASE_URL și SUPABASE_SECRET_KEY în mediul serverului.");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
}

export function storageError(error: { code?: string; message: string }): never {
  if (["PGRST202", "PGRST205", "42P01", "42883"].includes(error.code ?? "")) {
    throw new DatabaseError("Schema Supabase lipsește sau nu este actualizată. Rulați migrarea supabase/migrations/202611240001_database_storage.sql.");
  }
  if (["42501", "PGRST301", "PGRST302"].includes(error.code ?? "") || /api key|jwt|permission denied/i.test(error.message)) {
    throw new DatabaseError("Accesul la baza de date a fost refuzat. Verificați cheia serverului SUPABASE_SECRET_KEY și migrarea Supabase.");
  }
  throw new DatabaseError("Operația Supabase a eșuat. Datele nu au fost salvate local; verificați conexiunea și logurile bazei de date.");
}
