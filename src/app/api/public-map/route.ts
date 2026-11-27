import { createClient } from "@supabase/supabase-js";
import { getSupabaseConfig } from "@/utils/supabase/config";

export const dynamic = "force-dynamic";

/**
 * The anonymous map, served from the CDN. Building the full public outline set takes the small
 * database most of an anonymous request's 3 s limit, so visitors share one cached copy that is
 * refreshed at most every five minutes instead of each querying Supabase. No session is used,
 * so the cached body only ever holds the public projection.
 */
export async function GET() {
  const { url, key } = getSupabaseConfig();
  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.rpc("redi_workspace_data");
  if (error)
    return Response.json(
      { error: "Harta publică nu a putut fi încărcată." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  return Response.json(data, {
    headers: {
      "Cache-Control": "public, max-age=60, s-maxage=300, stale-while-revalidate=86400",
    },
  });
}
