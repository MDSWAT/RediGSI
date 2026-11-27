import { createClient } from "@supabase/supabase-js";
import { getSupabaseConfig } from "@/utils/supabase/config";
import { WORKSPACE_PAGE_SIZE } from "@/lib/workspacePages";

export const dynamic = "force-dynamic";
const MAX_PAGE = 100;

/**
 * The anonymous map, served from the CDN one page at a time. Visitors share cached copies that are
 * refreshed at most every five minutes instead of each querying Supabase. No session is used, so
 * the cached bodies only ever hold the public projection.
 */
export async function GET(request: Request) {
  const page = Number(new URL(request.url).searchParams.get("page") ?? "0");
  if (!Number.isInteger(page) || page < 0 || page > MAX_PAGE)
    return Response.json({ error: "Pagină invalidă." }, { status: 400 });
  const { url, key } = getSupabaseConfig();
  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.rpc("redi_workspace_page", {
    p_offset: page * WORKSPACE_PAGE_SIZE,
    p_limit: WORKSPACE_PAGE_SIZE,
  });
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
