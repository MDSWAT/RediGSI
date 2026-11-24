import Papa from "papaparse";
import * as XLSX from "xlsx";
import type { Geometry } from "geojson";
import type { CollectionName, Community, CommunityStatus, CommunitySource, DB, Entrepreneur, Locality, PartnerClient } from "./types";

import {
  assignCommunity, buildLocalityIndex, center, enrich, kindForGeometry, norm, normCountry, normSiruta,
  parseGeometry, parseLatLngPair, parseNum, validLatLng,
} from "./geo";

export type Row = Record<string, unknown>;

export interface ParsedFile {
  name: string;
  headers: string[];
  rows: Row[];
  /** Present for GeoJSON input: one geometry per row. */
  geometries?: (Geometry | null)[];
  sheets?: string[];
  sheet?: string;
}

export async function parseFile(file: File, sheet?: string): Promise<ParsedFile> {
  const lower = file.name.toLowerCase();

  if (lower.endsWith(".geojson") || lower.endsWith(".json")) {
    const json = JSON.parse(await file.text());
    const features: { properties?: Row; geometry?: Geometry | null }[] =
      json.type === "FeatureCollection" ? json.features : json.type === "Feature" ? [json] : Array.isArray(json) ? json.map((p: Row) => ({ properties: p })) : [];
    const rows = features.map((f) => ({ ...(f.properties ?? {}) }));
    return { name: file.name, headers: headersOf(rows), rows, geometries: features.map((f) => f.geometry ?? null) };
  }

  if (lower.endsWith(".xlsx") || lower.endsWith(".xls") || lower.endsWith(".ods")) {
    const wb = XLSX.read(await file.arrayBuffer(), { type: "array" });
    const name = sheet && wb.SheetNames.includes(sheet) ? sheet : wb.SheetNames[0];
    const rows = XLSX.utils.sheet_to_json<Row>(wb.Sheets[name], { defval: "", raw: false });
    return { name: file.name, headers: headersOf(rows), rows, sheets: wb.SheetNames, sheet: name };
  }

  // CSV / TXT (delimiter auto-detected: , ; tab)
  const text = await file.text();
  const res = Papa.parse<Row>(text, { header: true, skipEmptyLines: "greedy", transformHeader: (h) => h.trim() });
  return { name: file.name, headers: res.meta.fields ?? headersOf(res.data), rows: res.data };
}

function headersOf(rows: Row[]): string[] {
  const set = new Set<string>();
  rows.slice(0, 200).forEach((r) => Object.keys(r).forEach((k) => set.add(k)));
  return [...set];
}

export interface ImportOptions {
  defaultCountry: string;
  /** communities */
  defaultStatus: CommunityStatus;
  source: CommunitySource;
  /** clients: used when no partner column is mapped */
  partner: string;
}

export interface BuildResult<T> {
  items: T[];
  skipped: { row: number; reason: string }[];
  placedAtLocality: number;
  matchedCommunity: number;
}

const str = (v: unknown) => {
  if (v === undefined || v === null) return undefined;
  const s = String(v).trim();
  return s === "" ? undefined : s;
};

/**
 * Turn raw rows into typed records using the column mapping, then
 * enrich them (SIRUTA ↔ locality ↔ coordinates) against everything already in the DB.
 */
export function buildRecords(
  collection: CollectionName,
  file: ParsedFile,
  mapping: Record<string, string>,
  opts: ImportOptions,
  db: DB,
): BuildResult<Community | Entrepreneur | PartnerClient | Locality> {
  const mapped = new Set(Object.values(mapping).filter(Boolean));
  const idx = buildLocalityIndex(db);
  const skipped: BuildResult<unknown>["skipped"] = [];
  const items: (Community | Entrepreneur | PartnerClient | Locality)[] = [];
  let placedAtLocality = 0;
  let matchedCommunity = 0;

  file.rows.forEach((row, i) => {
    const get = (k: string) => (mapping[k] ? row[mapping[k]] : undefined);
    const extra: Record<string, string> = {};
    for (const [k, v] of Object.entries(row)) if (!mapped.has(k) && str(v) !== undefined) extra[k] = String(v);

    let lat = parseNum(get("lat"));
    let lng = parseNum(get("lng"));
    const pair = parseLatLngPair(get("coords"));
    if (!validLatLng(lat, lng) && pair) [lat, lng] = pair;
    const fileGeom = file.geometries?.[i] ?? undefined;
    if (!validLatLng(lat, lng) && fileGeom) ({ lat, lng } = center(fileGeom));

    const base = {
      siruta: normSiruta(get("siruta")),
      locality: str(get("locality")),
      county: str(get("county")),
      country: normCountry(get("country"), opts.defaultCountry),
      lat: validLatLng(lat, lng) ? lat : undefined,
      lng: validLatLng(lat, lng) ? lng : undefined,
    };
    const extraOrUndef = Object.keys(extra).length ? extra : undefined;

    if (collection === "localities") {
      const name = str(get("name"));
      const siruta = base.siruta;
      if (!siruta || !name || base.lat === undefined) {
        skipped.push({ row: i + 2, reason: "lipsește SIRUTA, denumirea sau coordonatele" });
        return;
      }
      items.push({ id: "", siruta, name, county: base.county, country: base.country, lat: base.lat, lng: base.lng!, extra: extraOrUndef });
      return;
    }

    const e = enrich(base, idx);
    const approx = !!e._placedAtLocality;
    delete e._placedAtLocality;

    if (collection === "communities") {
      let geometry = parseGeometry(get("geometry")) ?? fileGeom;
      if (!geometry && validLatLng(e.lat, e.lng)) geometry = { type: "Point", coordinates: [e.lng!, e.lat!] };
      if (!geometry) {
        skipped.push({ row: i + 2, reason: "fără coordonate și localitate necunoscută (importați întâi nomenclatorul SIRUTA)" });
        return;
      }
      if (approx && !parseGeometry(get("geometry")) && !fileGeom) placedAtLocality++;
      const kindTxt = norm(str(get("kind")));
      const statusTxt = norm(str(get("status")));
      items.push({
        id: "",
        name: str(get("name")) ?? e.locality ?? `Comunitate ${i + 1}`,
        kind: kindTxt.includes("strad") ? "strada" : kindTxt.includes("cartier") ? "cartier" : kindTxt.includes("zon") ? "zona" : kindTxt.includes("punct") ? "punct" : kindForGeometry(geometry),
        status: statusTxt.includes("sub prag") || statusTxt === "sub_prag" ? "sub_prag"
          : statusTxt.includes("de validat") || statusTxt === "de_validat" ? "de_validat"
          : statusTxt.includes("prop") || statusTxt.includes("nevalid") || statusTxt === "nu" ? "propus"
          : statusTxt.includes("confirm") || statusTxt.includes("valid") || statusTxt === "da" ? "validat" : opts.defaultStatus,
        source: opts.source,
        geometry,
        siruta: e.siruta,
        locality: e.locality,
        county: e.county,
        country: e.country,
        population: parseNum(get("population")),
        notes: [str(get("notes")), approx ? "Poziționată la centrul localității" : undefined].filter(Boolean).join(" · ") || undefined,
        extra: extraOrUndef,
      });
      return;
    }

    const name = str(get("name"));
    if (!name && !(collection === "entrepreneurs" && str(get("business")))) {
      skipped.push({ row: i + 2, reason: "lipsește numele" });
      return;
    }
    if (approx) placedAtLocality++;

    if (collection === "entrepreneurs") {
      const rec: Entrepreneur = {
        id: "",
        name: name ?? str(get("business"))!,
        business: str(get("business")),
        sector: str(get("sector")),
        phone: str(get("phone")),
        email: str(get("email")),
        address: str(get("address")),
        ...e,
        approx: approx || undefined,
        extra: extraOrUndef,
      };
      rec.communityId = assignCommunity(rec, db.communities);
      if (rec.communityId) matchedCommunity++;
      items.push(rec);
      return;
    }

    // clients
    items.push({
      id: "",
      partner: str(get("partner")) ?? (opts.partner.trim() || "Partener"),
      name: name!,
      amount: parseNum(get("amount")),
      year: str(get("year")),
      ...e,
      approx: approx || undefined,
      extra: extraOrUndef,
    });
  });

  return { items, skipped, placedAtLocality, matchedCommunity };
}
