import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseConfig } from "./config";

/** Refresh auth without restricting the existing public map and data routes. */
export async function updateSession(request: NextRequest) {
  const { url, key } = getSupabaseConfig();
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        const response = NextResponse.next({ request });

        // Keep prior writes if the auth client updates cookies more than once.
        supabaseResponse.cookies.getAll().forEach((cookie) => response.cookies.set(cookie));
        for (const name of ["cache-control", "expires", "pragma"]) {
          const value = supabaseResponse.headers.get(name);
          if (value) response.headers.set(name, value);
        }
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        Object.entries(headers).forEach(([name, value]) => response.headers.set(name, value));
        supabaseResponse = response;
      },
    },
  });

  // This performs token verification and refresh; creating a client alone does not.
  await supabase.auth.getClaims();
  return supabaseResponse;
}
