import * as XLSX from "xlsx";
import type { FeatureCollection, Geometry } from "geojson";
import type { Community, DB, Entrepreneur, PartnerClient } from "./types";
import type { OverlapRow } from "./overlap";
import { center, toWKT } from "./geo";

type Flat = Record<string, string | number | undefined>;

function download(filename: string, data: BlobPart, mime: string) {
  const url = URL.createObjectURL(new Blob([data], { type: mime }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const stamp = () => new Date().toISOString().slice(0, 10);

function withExtra<T extends { extra?: Record<string, string> }>(r: T, base: Flat): Flat {
  const out = { ...base };
  for (const [k, v] of Object.entries(r.extra ?? {})) if (!(k in out)) out[k] = v;
  return out;
}

export function communityRows(db: DB): Flat[] {
  return db.communities.map((c) => {
    const ctr = c.geometry ? center(c.geometry) : undefined;
    return withExtra(c, {
      id: c.id, nume: c.name, tip: c.kind, status: c.status, sursa: c.source,
      siruta: c.siruta, localitate: c.locality, judet: c.county, tara: c.country,
      lat: ctr ? +ctr.lat.toFixed(7) : undefined, lng: ctr ? +ctr.lng.toFixed(7) : undefined, tip_geometrie: c.geometry?.type,
      wkt: c.geometry ? toWKT(c.geometry) : undefined, precizie: c.locationAccuracy, contur: c.boundary?.name, nivel_contur: c.boundary?.scope, an_contur: c.boundary?.year, sursa_contur: c.boundary?.sourceURL, licenta_contur: c.boundary?.license, populatie: c.population, observatii: c.notes,
      contur_administrativ: c.boundary ? JSON.stringify(c.boundary) : undefined,
      antreprenori: db.entrepreneurs.filter((e) => e.communityId === c.id).length,
    });
  });
}

export function entrepreneurRows(db: DB): Flat[] {
  const byId = new Map(db.communities.map((c) => [c.id, c]));
  return db.entrepreneurs.map((e: Entrepreneur) => withExtra(e, {
    id: e.id, nume: e.name, firma: e.business, domeniu: e.sector, telefon: e.phone, email: e.email,
    adresa: e.address, siruta: e.siruta, localitate: e.locality, judet: e.county, tara: e.country,
    lat: e.lat, lng: e.lng, comunitate_id: e.communityId, comunitate: e.communityId ? byId.get(e.communityId)?.name : undefined,
  }));
}

export function clientRows(db: DB): Flat[] {
  return db.clients.map((c: PartnerClient) => withExtra(c, {
    id: c.id, partener: c.partner, nume: c.name, suma: c.amount, an: c.year,
    siruta: c.siruta, localitate: c.locality, judet: c.county, tara: c.country, lat: c.lat, lng: c.lng,
  }));
}

export function overlapRows(rows: OverlapRow[]): Flat[] {
  return rows.map((r) => ({
    zona: r.label, siruta: r.siruta, judet: r.county, tara: r.country,
    comunitati: r.communities, antreprenori: r.entrepreneurs, clienti_partener: r.clients,
    suma_finantata: r.amount, parteneri: r.partners.join("; "),
    suprapunere: r.communities > 0 && r.clients > 0 ? "DA" : "NU", lat: r.lat, lng: r.lng,
  }));
}

function columnsOf(rows: Flat[]) {
  const cols: string[] = [];
  const seen = new Set<string>();
  rows.forEach((r) => Object.keys(r).forEach((k) => { if (!seen.has(k)) { seen.add(k); cols.push(k); } }));
  return cols;
}

export function exportCSV(name: string, rows: Flat[]) {
  const cols = columnsOf(rows);
  const esc = (v: unknown) => {
    const s = v === undefined || v === null ? "" : String(v);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [cols.join(","), ...rows.map((r) => cols.map((c) => esc(r[c])).join(","))].join("\r\n");
  // BOM so Excel opens diacritics correctly
  download(`${name}_${stamp()}.csv`, "﻿" + csv, "text/csv;charset=utf-8");
}

export function exportXLSX(name: string, rows: Flat[]) {
  const ws = XLSX.utils.json_to_sheet(rows, { header: columnsOf(rows) });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, name.slice(0, 31));
  const out = XLSX.write(wb, { type: "array", bookType: "xlsx" });
  download(`${name}_${stamp()}.xlsx`, out, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
}

export function communityGeoJSON(communities: Community[]): FeatureCollection<Geometry | null> {
  const fc: FeatureCollection<Geometry | null> = {
    type: "FeatureCollection",
    features: communities.map((c) => ({
      type: "Feature",
      id: c.id,
      geometry: c.geometry,
      properties: {
        id: c.id, nume: c.name, tip: c.kind, status: c.status, sursa: c.source, siruta: c.siruta ?? null,
        localitate: c.locality ?? null, judet: c.county ?? null, tara: c.country,
        precizie: c.locationAccuracy ?? null, contur_administrativ: c.boundary ?? null, populatie: c.population ?? null, observatii: c.notes ?? null, ...(c.extra ?? {}),
      },
    })),
  };
  return fc;
}

export function exportCommunitiesGeoJSON(db: DB, communities: Community[] = db.communities) {
  download(`comunitati_${stamp()}.geojson`, JSON.stringify(communityGeoJSON(communities), null, 2), "application/geo+json");
}

export function exportPointsGeoJSON(name: string, rows: Flat[]) {
  const fc: FeatureCollection = {
    type: "FeatureCollection",
    features: rows
      .filter((r) => typeof r.lat === "number" && typeof r.lng === "number")
      .map((r) => ({ type: "Feature", geometry: { type: "Point", coordinates: [r.lng as number, r.lat as number] }, properties: r })),
  };
  download(`${name}_${stamp()}.geojson`, JSON.stringify(fc, null, 2), "application/geo+json");
}
