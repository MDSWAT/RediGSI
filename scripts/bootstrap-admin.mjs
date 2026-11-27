import { createClient } from "@supabase/supabase-js";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key =
  process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const email = process.env.REDI_ADMIN_EMAIL;
if (!url || !key || !email)
  throw new Error(
    "Set NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY and REDI_ADMIN_EMAIL locally before running this command.",
  );
const client = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const { error } = await client.rpc("redi_bootstrap_admin", { p_email: email });
if (error)
  throw new Error(
    `Bootstrap failed (${error.code}). Apply the governance migration, ensure the Auth user exists, and check whether an administrator has already been assigned.`,
  );
console.log(
  "Initial administrator configured. Sign in to manage subsequent users and geographic permissions.",
);
