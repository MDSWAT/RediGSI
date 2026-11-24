import type { DB, Located } from "./types";
import { center, communityAt, norm, normSiruta, validLatLng } from "./geo";

export type OverlapLevel = "locality" | "county" | "country";

export interface OverlapRow {
  key: string;
  label: string;
  siruta?: string;
  county?: string;
  country: string;
  lat?: number;
  lng?: number;
  communities: number;
  entrepreneurs: number;
  clients: number;
  amount: number;
  partners: string[];
}

export interface OverlapResult {
  rows: OverlapRow[];
  summary: {
    areasWithClients: number;
    areasWithClientsAndCommunities: number;
    clientsTotal: number;
    clientsInCommunityAreas: number;
    clientsInsideCommunityShapes: number;
    clientsWithoutLocation: number;
    amountInCommunityAreas: number;
    amountTotal: number;
  };
}

interface Loc extends Partial<Located> { country: string }

function keyOf(level: OverlapLevel, r: Loc): { key: string; label: string } | undefined {
  if (level === "country") return { key: r.country, label: r.country };
  if (level === "county") {
    if (!r.county) return undefined;
    return { key: `${r.country}|${norm(r.county)}`, label: `${r.county} (${r.country})` };
  }
  const sir = normSiruta(r.siruta);
  if (sir) return { key: `s:${sir}`, label: r.locality ?? `SIRUTA ${sir}` };
  if (!r.locality) return undefined;
  return { key: `n:${r.country}|${norm(r.county)}|${norm(r.locality)}`, label: r.locality };
}

/**
 * Aggregates communities, entrepreneurs and partner clients per locality / county / country.
 * Localities are matched by SIRUTA first, then by normalised name + county + country.
 */
export function computeOverlap(db: DB, level: OverlapLevel, partner?: string): OverlapResult {
  const rows = new Map<string, OverlapRow & { _pts: [number, number][] }>();

  const touch = (r: Loc, pt?: { lat: number; lng: number }) => {
    const k = keyOf(level, r);
    if (!k) return undefined;
    let row = rows.get(k.key);
    if (!row) {
      row = {
        key: k.key, label: k.label, siruta: level === "locality" ? normSiruta(r.siruta) : undefined,
        county: level !== "country" ? r.county : undefined, country: r.country,
        communities: 0, entrepreneurs: 0, clients: 0, amount: 0, partners: [], _pts: [],
      };
      rows.set(k.key, row);
    }
    if (row.label.startsWith("SIRUTA") && r.locality) row.label = r.locality;
    row.county ??= level !== "country" ? r.county : undefined;
    if (pt && validLatLng(pt.lat, pt.lng)) row._pts.push([pt.lat, pt.lng]);
    return row;
  };

  for (const c of db.communities) {
    const row = touch(c, center(c.geometry));
    if (row) row.communities++;
  }
  for (const e of db.entrepreneurs) {
    const row = touch(e, validLatLng(e.lat, e.lng) ? { lat: e.lat!, lng: e.lng! } : undefined);
    if (row) row.entrepreneurs++;
  }

  const clients = partner ? db.clients.filter((c) => c.partner === partner) : db.clients;
  let clientsWithoutLocation = 0;
  let clientsInsideCommunityShapes = 0;
  for (const c of clients) {
    const row = touch(c, validLatLng(c.lat, c.lng) ? { lat: c.lat!, lng: c.lng! } : undefined);
    if (!row) { clientsWithoutLocation++; continue; }
    row.clients++;
    row.amount += c.amount ?? 0;
    if (!row.partners.includes(c.partner)) row.partners.push(c.partner);
    if (!c.approx && validLatLng(c.lat, c.lng) && communityAt(c.lat!, c.lng!, db.communities)) clientsInsideCommunityShapes++;
  }

  const out: OverlapRow[] = [...rows.values()].map(({ _pts, ...r }) => {
    if (_pts.length) {
      // Locality: first point is good enough. County / country: mean of points.
      if (level === "locality") [r.lat, r.lng] = _pts[0];
      else {
        r.lat = _pts.reduce((s, p) => s + p[0], 0) / _pts.length;
        r.lng = _pts.reduce((s, p) => s + p[1], 0) / _pts.length;
      }
    }
    return r;
  });
  out.sort((a, b) => b.clients - a.clients || b.communities - a.communities || a.label.localeCompare(b.label, "ro"));

  const withClients = out.filter((r) => r.clients > 0);
  const both = withClients.filter((r) => r.communities > 0);
  return {
    rows: out,
    summary: {
      areasWithClients: withClients.length,
      areasWithClientsAndCommunities: both.length,
      clientsTotal: clients.length,
      clientsInCommunityAreas: both.reduce((s, r) => s + r.clients, 0),
      clientsInsideCommunityShapes,
      clientsWithoutLocation,
      amountInCommunityAreas: both.reduce((s, r) => s + r.amount, 0),
      amountTotal: withClients.reduce((s, r) => s + r.amount, 0),
    },
  };
}
