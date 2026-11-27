"use client";
import type { DB } from "@/lib/types";
import { COUNTRY_LABELS } from "@/lib/types";
import {
  EMPTY_FILTERS,
  FILTER_KEYS,
  type WorkspaceFilters,
} from "@/lib/workspaceFilters";
export default function WorkspaceFilterPanel({
  db,
  filters,
  onChange,
  expanded = false,
}: {
  db: DB;
  filters: WorkspaceFilters;
  onChange: (f: WorkspaceFilters) => void;
  expanded?: boolean;
}) {
  const all = [...db.communities, ...db.entrepreneurs, ...db.clients];
  const geo = all.filter(
    (r) => !filters.country || r.country === filters.country,
  );
  const unique = (values: (string | undefined)[]) =>
    [...new Set(values.filter((v): v is string => !!v))].sort((a, b) =>
      a.localeCompare(b, "ro"),
    );
  const values = {
    country: unique(all.map((r) => r.country)),
    county: unique(geo.map((r) => r.county)),
    municipality: unique(
      geo
        .filter((r) => !filters.county || r.county === filters.county)
        .map((r) => r.locality),
    ),
    sector: unique(db.entrepreneurs.map((r) => r.sector)),
    partner: unique(db.clients.map((r) => r.partner)),
    year: unique(db.clients.map((r) => r.year?.toString())).reverse(),
  };
  const names = {
    country: "Țară",
    county: "Județ / regiune",
    municipality: "Localitate",
    sector: "Domeniu de activitate",
    partner: "Partener",
    year: "An finanțare",
  };
  const visible = FILTER_KEYS.filter(
    (k) =>
      ["country", "county", "municipality"].includes(k) || values[k].length > 0,
  );
  const active = FILTER_KEYS.filter((k) => filters[k]).length;
  return (
    <details className="workspace-filters" open={expanded || undefined}>
      <summary>
        Filtre geografice și de date{active ? ` · ${active} active` : ""}
      </summary>
      <div className="workspace-filter-grid">
        {visible.map((k) => (
          <label key={k}>
            {names[k]}
            <select
              value={filters[k]}
              onChange={(e) => {
                const next = { ...filters, [k]: e.target.value };
                if (k === "country") {
                  next.county = "";
                  next.municipality = "";
                }
                if (k === "county") next.municipality = "";
                onChange(next);
              }}
            >
              <option value="">Toate</option>
              {values[k].map((v) => (
                <option key={v} value={v}>
                  {k === "country" ? (COUNTRY_LABELS[v] ?? v) : v}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>
      <p className="muted small">
        Anul și partenerul filtrează clienții; domeniul filtrează antreprenorii.
        Comunitățile respectă selecția geografică.
      </p>
      {active > 0 && (
        <button type="button" onClick={() => onChange({ ...EMPTY_FILTERS })}>
          Resetează filtrele comune
        </button>
      )}
    </details>
  );
}
