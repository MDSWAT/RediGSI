import * as turf from "@turf/turf";
import type { Geometry, Position } from "geojson";
import type { Community, DB, Located } from "./types";

/* ---------------------------------------------------------------- text */

/** Lower-case, strip diacritics (ș ş ț ţ ă â î) and administrative prefixes. */
export function norm(s?: string | null): string {
  return (s ?? "")
    .toString()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\b(municipiul|mun|orasul|oras|comuna|com|satul|sat|judetul|jud)\b\.?/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** SIRUTA codes are numeric: keep digits, drop leading zeros so "054975" == "54975". */
export function normSiruta(s?: unknown): string | undefined {
  if (s === undefined || s === null) return undefined;
  const d = String(s).replace(/\D/g, "").replace(/^0+/, "");
  return d || undefined;
}

const COUNTRY_ALIASES: Record<string, string> = {
  romania: "RO", ro: "RO", rou: "RO",
  moldova: "MD", "republica moldova": "MD", md: "MD",
  bulgaria: "BG", bg: "BG",
  ungaria: "HU", hungary: "HU", hu: "HU",
  serbia: "RS", rs: "RS",
  ucraina: "UA", ukraine: "UA", ua: "UA",
  slovacia: "SK", slovakia: "SK", sk: "SK",
  cehia: "CZ", czechia: "CZ", "czech republic": "CZ", cz: "CZ",
  macedonia: "MK", "macedonia de nord": "MK", "north macedonia": "MK", mk: "MK",
  albania: "AL", al: "AL",
  kosovo: "XK", xk: "XK",
  grecia: "GR", greece: "GR", gr: "GR",
  turcia: "TR", turkey: "TR", tr: "TR",
};

export function normCountry(s: unknown, fallback = "RO"): string {
  const n = norm(String(s ?? ""));
  if (!n) return fallback;
  return COUNTRY_ALIASES[n] ?? (n.length === 2 ? n.toUpperCase() : String(s).trim());
}

/** Accepts "44.43", "44,43", " 44.43 " → number. */
export function parseNum(v: unknown): number | undefined {
  if (v === undefined || v === null || v === "") return undefined;
  if (typeof v === "number") return Number.isFinite(v) ? v : undefined;
  let s = String(v).trim().replace(/\s/g, "");
  if (s.includes(",") && !s.includes(".")) s = s.replace(",", ".");
  else s = s.replace(/,/g, "");
  const n = Number(s);
  return Number.isFinite(n) ? n : undefined;
}

/** "44.4268, 26.1025" or "44.4268 26.1025" (lat, lng) → [lat, lng]. */
export function parseLatLngPair(v: unknown): [number, number] | undefined {
  if (!v) return undefined;
  const m = String(v).match(/(-?\d+(?:[.,]\d+)?)\s*[,; ]\s*(-?\d+(?:[.,]\d+)?)/);
  if (!m) return undefined;
  const a = parseNum(m[1]);
  const b = parseNum(m[2]);
  return a !== undefined && b !== undefined ? [a, b] : undefined;
}

export const validLatLng = (lat?: number, lng?: number) =>
  lat !== undefined && lng !== undefined && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 && !(lat === 0 && lng === 0);

/* ---------------------------------------------------------------- geometry */

export function center(g: Geometry): { lat: number; lng: number } {
  if (g.type === "Point") return { lng: g.coordinates[0], lat: g.coordinates[1] };
  const c = turf.centroid(g as turf.AllGeoJSON).geometry.coordinates;
  return { lng: c[0], lat: c[1] };
}

/** Leaflet-style bounds [[south, west], [north, east]]. */
export function boundsOf(g: Geometry): [[number, number], [number, number]] {
  const [w, s, e, n] = turf.bbox(g as turf.AllGeoJSON);
  return [[s, w], [n, e]];
}

const fmt = (p: Position) => `${+p[0].toFixed(7)} ${+p[1].toFixed(7)}`;
const ring = (r: Position[]) => `(${r.map(fmt).join(", ")})`;

export function toWKT(g: Geometry): string {
  switch (g.type) {
    case "Point": return `POINT (${fmt(g.coordinates)})`;
    case "MultiPoint": return `MULTIPOINT (${g.coordinates.map((p) => `(${fmt(p)})`).join(", ")})`;
    case "LineString": return `LINESTRING ${ring(g.coordinates)}`;
    case "MultiLineString": return `MULTILINESTRING (${g.coordinates.map(ring).join(", ")})`;
    case "Polygon": return `POLYGON (${g.coordinates.map(ring).join(", ")})`;
    case "MultiPolygon": return `MULTIPOLYGON (${g.coordinates.map((p) => `(${p.map(ring).join(", ")})`).join(", ")})`;
    case "GeometryCollection": return `GEOMETRYCOLLECTION (${g.geometries.map(toWKT).join(", ")})`;
  }
}

const NUM = String.raw`-?\d+(?:\.\d+)?(?:[eE][-+]?\d+)?`;

/** Parses WKT (POINT/LINESTRING/POLYGON and MULTI*) or a GeoJSON geometry/feature string. */
export function parseGeometry(v: unknown): Geometry | undefined {
  if (!v) return undefined;
  if (typeof v === "object") {
    const o = v as { type?: string; geometry?: Geometry };
    return o.type === "Feature" ? o.geometry : (v as Geometry);
  }
  const s = String(v).trim();
  if (s.startsWith("{")) {
    try { return parseGeometry(JSON.parse(s)); } catch { return undefined; }
  }
  const m = s.replace(/\s+/g, " ").replace(/^SRID=\d+;/i, "").match(/^(MULTIPOLYGON|POLYGON|MULTILINESTRING|LINESTRING|MULTIPOINT|POINT)\s*(?:ZM|Z|M)?\s*(\(.*\))$/i);
  if (!m) return undefined;
  const type = m[1].toUpperCase();
  try {
    const json = m[2]
      .replace(new RegExp(`(${NUM})\\s+(${NUM})(?:\\s+${NUM})*`, "g"), "[$1,$2]")
      .replace(/\(/g, "[")
      .replace(/\)/g, "]");
    const c = JSON.parse(json);
    switch (type) {
      case "POINT": return { type: "Point", coordinates: c[0] };
      case "MULTIPOINT": return { type: "MultiPoint", coordinates: c.map((p: unknown) => (Array.isArray((p as unknown[])[0]) ? (p as Position[])[0] : p)) };
      case "LINESTRING": return { type: "LineString", coordinates: c };
      case "MULTILINESTRING": return { type: "MultiLineString", coordinates: c };
      case "POLYGON": return { type: "Polygon", coordinates: c };
      case "MULTIPOLYGON": return { type: "MultiPolygon", coordinates: c };
    }
  } catch {
    return undefined;
  }
}

export function kindForGeometry(g: Geometry): Community["kind"] {
  if (g.type === "Point" || g.type === "MultiPoint") return "punct";
  if (g.type === "LineString" || g.type === "MultiLineString") return "strada";
  return "cartier";
}

/* ---------------------------------------------------------------- localities */

export interface LocRef {
  siruta?: string;
  name?: string;
  county?: string;
  country: string;
  lat: number;
  lng: number;
}

export interface LocalityIndex {
  bySiruta: Map<string, LocRef>;
  byName: Map<string, LocRef[]>;
  all: LocRef[];
}

/**
 * Index of every known (locality → coordinates) pair. The SIRUTA reference list wins;
 * communities and already-placed records fill the gaps.
 */
export function buildLocalityIndex(db: Partial<DB>): LocalityIndex {
  const bySiruta = new Map<string, LocRef>();
  const byName = new Map<string, LocRef[]>();
  const all: LocRef[] = [];

  const add = (r: LocRef) => {
    const sir = normSiruta(r.siruta);
    if (sir) {
      if (bySiruta.has(sir)) return;
      bySiruta.set(sir, r);
    }
    const key = norm(r.name);
    if (key) {
      const arr = byName.get(key) ?? [];
      arr.push(r);
      byName.set(key, arr);
    }
    all.push(r);
  };

  for (const l of db.localities ?? []) add({ ...l });
  for (const c of db.communities ?? []) {
    if (!c.geometry || (!c.siruta && !c.locality)) continue;
    add({ siruta: c.siruta, name: c.locality, county: c.county, country: c.country, ...center(c.geometry) });
  }
  for (const r of [...(db.entrepreneurs ?? []), ...(db.clients ?? [])]) {
    if ((r.siruta || r.locality) && validLatLng(r.lat, r.lng))
      add({ siruta: r.siruta, name: r.locality, county: r.county, country: r.country, lat: r.lat!, lng: r.lng! });
  }
  return { bySiruta, byName, all };
}

export function lookupLocality(idx: LocalityIndex, q: Partial<Located>): LocRef | undefined {
  const sir = normSiruta(q.siruta);
  if (sir && idx.bySiruta.has(sir)) return idx.bySiruta.get(sir);
  const cands = idx.byName.get(norm(q.locality));
  if (!cands?.length) return undefined;
  const country = q.country ?? "RO";
  const sameCountry = cands.filter((c) => c.country === country);
  if (q.county) {
    const cty = norm(q.county);
    const hit = sameCountry.find((c) => norm(c.county) === cty);
    if (hit) return hit;
  }
  // Ambiguous names (many villages share a name) – only accept a unique match.
  const unique = new Set(sameCountry.map((c) => normSiruta(c.siruta) ?? `${norm(c.county)}`));
  return unique.size === 1 ? sameCountry[0] : undefined;
}

export function nearestLocality(idx: LocalityIndex, lat: number, lng: number, maxKm = 15): LocRef | undefined {
  let best: LocRef | undefined;
  let bestD = Infinity;
  const p = turf.point([lng, lat]);
  for (const l of idx.all) {
    if (!l.name && !l.siruta) continue;
    const d = turf.distance(p, turf.point([l.lng, l.lat]));
    if (d < bestD) { bestD = d; best = l; }
  }
  return bestD <= maxKm ? best : undefined;
}

/** Fill in missing SIRUTA / locality / county / coordinates from what's known. */
export function enrich<T extends Located>(rec: T, idx: LocalityIndex): T & { _placedAtLocality?: boolean } {
  const out: T & { _placedAtLocality?: boolean } = { ...rec, siruta: normSiruta(rec.siruta) };
  const ref = lookupLocality(idx, out);
  if (ref) {
    out.siruta ??= normSiruta(ref.siruta);
    out.locality ??= ref.name;
    out.county ??= ref.county;
    if (!validLatLng(out.lat, out.lng)) {
      out.lat = ref.lat;
      out.lng = ref.lng;
      out._placedAtLocality = true;
    }
  } else if (validLatLng(out.lat, out.lng) && !out.locality && !out.siruta) {
    const near = nearestLocality(idx, out.lat!, out.lng!, 5);
    if (near) {
      out.siruta = normSiruta(near.siruta);
      out.locality = near.name;
      out.county ??= near.county;
    }
  }
  return out;
}

/* ---------------------------------------------------------------- spatial join */

const LINE_KM = 0.3;
const POINT_KM = 0.5;

/** Community that contains the point (polygon) or lies within a few hundred metres (street / point). */
export function communityAt(lat: number, lng: number, communities: Community[]): Community | undefined {
  const pt = turf.point([lng, lat]);
  let best: Community | undefined;
  let bestD = Infinity;
  for (const c of communities) {
    const g = c.geometry;
    if (!g || c.locationAccuracy) continue;
    if (g.type === "Polygon" || g.type === "MultiPolygon") {
      if (turf.booleanPointInPolygon(pt, g)) return c;
      continue;
    }
    let d = Infinity;
    if (g.type === "LineString") d = turf.pointToLineDistance(pt, g) / (LINE_KM / POINT_KM);
    else if (g.type === "MultiLineString")
      d = Math.min(...g.coordinates.map((l) => turf.pointToLineDistance(pt, turf.lineString(l)))) / (LINE_KM / POINT_KM);
    else if (g.type === "Point") d = turf.distance(pt, g);
    else if (g.type === "MultiPoint") d = Math.min(...g.coordinates.map((p) => turf.distance(pt, turf.point(p))));
    if (d < bestD) { bestD = d; best = c; }
  }
  return bestD <= POINT_KM ? best : undefined;
}

/** Assign an entrepreneur to a community: spatially first, then by SIRUTA when only one community is in that locality. */
export function assignCommunity(rec: Located, communities: Community[]): string | undefined {
  if (validLatLng(rec.lat, rec.lng) && !rec.approx) {
    const hit = communityAt(rec.lat!, rec.lng!, communities);
    if (hit) return hit.id;
  }
  const sir = normSiruta(rec.siruta);
  if (sir) {
    const same = communities.filter((c) => normSiruta(c.siruta) === sir);
    if (same.length === 1) return same[0].id;
  }
  return undefined;
}
