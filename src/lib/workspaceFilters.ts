import type { CollectionName, DB } from "./types";
export const FILTER_KEYS = [
  "country",
  "county",
  "municipality",
  "sector",
  "partner",
  "year",
] as const;
export interface WorkspaceFilters {
  country: string;
  county: string;
  municipality: string;
  sector: string;
  partner: string;
  year: string;
}
export const EMPTY_FILTERS: WorkspaceFilters = {
  country: "",
  county: "",
  municipality: "",
  sector: "",
  partner: "",
  year: "",
};
const text = (v: unknown) =>
  String(v ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
export function filterRows<T extends object>(
  collection: CollectionName,
  rows: T[],
  filters: WorkspaceFilters,
): T[] {
  return rows.filter((value) => {
    const row = value as Record<string, unknown>;
    return (
      (!filters.country || text(row.country) === text(filters.country)) &&
      (!filters.county || text(row.county) === text(filters.county)) &&
      (!filters.municipality ||
        text(collection === "localities" ? row.name : row.locality) ===
          text(filters.municipality)) &&
      (collection !== "entrepreneurs" ||
        !filters.sector ||
        text(row.sector) === text(filters.sector)) &&
      (collection !== "clients" ||
        ((!filters.partner || text(row.partner) === text(filters.partner)) &&
          (!filters.year || String(row.year ?? "") === filters.year)))
    );
  });
}
export function filterWorkspace(db: DB, filters: WorkspaceFilters): DB {
  return {
    communities: filterRows("communities", db.communities, filters),
    entrepreneurs: filterRows("entrepreneurs", db.entrepreneurs, filters),
    clients: filterRows("clients", db.clients, filters),
    localities: filterRows("localities", db.localities, filters),
  };
}
