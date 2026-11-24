import type { Geometry } from "geojson";

export type CollectionName = "communities" | "entrepreneurs" | "clients" | "localities";
export const COLLECTIONS: CollectionName[] = ["communities", "entrepreneurs", "clients", "localities"];

export const COLLECTION_LABELS: Record<CollectionName, string> = {
  communities: "Comunități",
  entrepreneurs: "Antreprenori",
  clients: "Clienți finanțați de parteneri",
  localities: "Nomenclator localități (SIRUTA)",
};

export interface BaseRecord {
  id: string;
  createdAt?: string;
  /** Columns from imported files that are not mapped to a known field. */
  extra?: Record<string, string>;
}

/** Fields shared by everything that can be placed in a locality. */
export interface Located {
  siruta?: string;
  locality?: string;
  county?: string;
  country: string;
  lat?: number;
  lng?: number;
  /** Coordinates are the locality centre, not the exact address. */
  approx?: boolean;
}

export type CommunityKind = "punct" | "strada" | "cartier" | "zona";
export type CommunityStatus = "validat" | "propus" | "de_validat" | "sub_prag";
export type CommunitySource = "catalog" | "manual" | "import";

export interface Community extends BaseRecord {
  name: string;
  kind: CommunityKind;
  status: CommunityStatus;
  source: CommunitySource;
  geometry: Geometry | null;
  /** Gazetteer reference; never a surveyed community boundary. */
  locationAccuracy?: "locality" | "municipality" | "unresolved";
  siruta?: string;
  locality?: string;
  county?: string;
  country: string;
  population?: number;
  notes?: string;
}

export interface Entrepreneur extends BaseRecord, Located {
  name: string;
  business?: string;
  sector?: string;
  phone?: string;
  email?: string;
  address?: string;
  /** Community the entrepreneur falls inside / next to (computed). */
  communityId?: string;
}

export interface PartnerClient extends BaseRecord, Located {
  partner: string;
  name: string;
  amount?: number;
  year?: string;
}

export interface Locality extends BaseRecord {
  siruta: string;
  name: string;
  county?: string;
  country: string;
  lat: number;
  lng: number;
}

export interface DB {
  communities: Community[];
  entrepreneurs: Entrepreneur[];
  clients: PartnerClient[];
  localities: Locality[];
}

export type RecordOf<C extends CollectionName> = DB[C][number];

export const KIND_LABELS: Record<CommunityKind, string> = {
  punct: "Punct",
  strada: "Stradă",
  cartier: "Cartier",
  zona: "Zonă",
};

export const STATUS_LABELS: Record<CommunityStatus, string> = {
  validat: "Validată",
  propus: "Propusă (nevalidată)",
  de_validat: "De validat",
  sub_prag: "Sub prag",
};

export const COUNTRY_LABELS: Record<string, string> = { RO: "România", MD: "Moldova", AL: "Albania", BA: "Bosnia și Herțegovina", XK: "Kosovo", MK: "Macedonia de Nord", ME: "Muntenegru", RS: "Serbia", TR: "Turcia" };

export const SOURCE_LABELS: Record<CommunitySource, string> = {
  catalog: "Catalog",
  manual: "Adăugată pe hartă",
  import: "Import",
};
