import { createHash } from "node:crypto";
import { canEdit } from "@/lib/access";
import { geocodingCandidates, type GeocodingCandidate } from "@/lib/geocoding";
import {
  accessProfile,
  workspaceClient,
  readJSON,
  AccessError,
  rpcError,
  apiError,
  privateJSON,
} from "@/lib/workspaceServer";
export const dynamic = "force-dynamic";
const cache = new Map<
  string,
  { expires: number; results: GeocodingCandidate[] }
>();
function provider() {
  if (!process.env.REDI_GEOCODER_URL || !process.env.REDI_GEOCODER_USER_AGENT)
    return null;
  try {
    const url = new URL(process.env.REDI_GEOCODER_URL);
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.hostname === "nominatim.openstreetmap.org"
    )
      return null;
    return url;
  } catch {
    return null;
  }
}
export async function GET() {
  try {
    if (!canEdit(await accessProfile()))
      throw new AccessError("Căutarea adreselor necesită drepturi GIS.");
    const url = provider();
    return privateJSON({ enabled: !!url, host: url?.hostname ?? null });
  } catch (e) {
    return apiError(e);
  }
}
export async function POST(request: Request) {
  try {
    const access = await accessProfile();
    if (!canEdit(access))
      throw new AccessError("Căutarea adreselor necesită drepturi GIS.");
    const endpoint = provider();
    if (!endpoint)
      throw new AccessError(
        "Serviciul de geocodare al organizației nu este configurat. Coordonatele pot fi corectate manual.",
        503,
      );
    const body = await readJSON(request, 5000);
    if (
      body.consent !== true ||
      typeof body.query !== "string" ||
      body.query.trim().length < 3 ||
      body.query.length > 250 ||
      typeof body.country !== "string" ||
      !/^[A-Z]{2}$/.test(body.country)
    )
      throw new AccessError(
        "Introduceți o adresă și confirmați trimiterea căutării către serviciul configurat.",
        400,
      );
    if (typeof body.id !== "string")
      throw new AccessError("Selectați comunitatea înainte de căutare.", 400);
    const { data: area, error: areaError } = await (
      await workspaceClient()
    ).rpc("redi_geocode_target", { p_id: body.id });
    if (areaError) throw rpcError(areaError);
    if (area.country !== body.country)
      throw new AccessError("Țara căutării nu corespunde înregistrării.", 400);
    const key = createHash("sha256")
      .update(
        JSON.stringify([
          access.userId,
          area,
          endpoint.href,
          body.country,
          body.query.trim(),
        ]),
      )
      .digest("hex");
    const hit = cache.get(key);
    if (hit && hit.expires > Date.now())
      return privateJSON({ results: hit.results, cached: true });
    const { error } = await (
      await workspaceClient()
    ).rpc("redi_geocode_permit");
    if (error) throw rpcError(error);
    endpoint.searchParams.set("q", body.query.trim());
    endpoint.searchParams.set("format", "jsonv2");
    endpoint.searchParams.set("addressdetails", "1");
    endpoint.searchParams.set("limit", "5");
    endpoint.searchParams.set("countrycodes", body.country.toLowerCase());
    endpoint.searchParams.set("accept-language", "ro");
    const headers: Record<string, string> = {
      "User-Agent": process.env.REDI_GEOCODER_USER_AGENT!,
      Accept: "application/json",
    };
    if (process.env.REDI_GEOCODER_API_KEY)
      headers.Authorization = `Bearer ${process.env.REDI_GEOCODER_API_KEY}`;
    let results: GeocodingCandidate[];
    try {
      const response = await fetch(endpoint, {
        headers,
        cache: "no-store",
        redirect: "error",
        signal: AbortSignal.timeout(8000),
      });
      if (
        !response.ok ||
        Number(response.headers.get("content-length")) > 1_000_000
      )
        throw new Error();
      const text = await response.text();
      if (new TextEncoder().encode(text).length > 1_000_000) throw new Error();
      results = geocodingCandidates(
        JSON.parse(text),
        body.country,
        endpoint.hostname,
        area,
      );
    } catch {
      throw new AccessError(
        "Serviciul de geocodare nu a răspuns corect. Coordonatele introduse nu au fost modificate.",
        502,
      );
    }
    if (cache.size >= 256) cache.delete(cache.keys().next().value!);
    cache.set(key, { results, expires: Date.now() + 5 * 60_000 });
    return privateJSON({ results, cached: false });
  } catch (e) {
    const response = apiError(e);
    if (e instanceof AccessError && e.status === 429)
      response.headers.set("Retry-After", "1");
    return response;
  }
}
