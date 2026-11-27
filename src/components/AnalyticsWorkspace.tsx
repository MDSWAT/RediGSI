"use client";
import { intelligence } from "@/lib/intelligence";
import WorkspaceFilterPanel from "./WorkspaceFilterPanel";
import { filterWorkspace, type WorkspaceFilters } from "@/lib/workspaceFilters";
import type { DB } from "@/lib/types";
import { COUNTRY_LABELS, STATUS_LABELS } from "@/lib/types";
import { groupBoundaryRecords } from "@/lib/boundaries";
export default function AnalyticsWorkspace({
  db,
  filters,
  onFiltersChange,
  onExplore,
  onSummary,
  onNetworkExplore,
  loading,
  error,
}: {
  db: DB;
  filters: WorkspaceFilters;
  onFiltersChange: (value: WorkspaceFilters) => void;
  onExplore: (country: string) => void;
  onSummary?: () => void;
  onNetworkExplore?: (kind: "entrepreneurs" | "clients", value: string) => void;
  loading: boolean;
  error: string | null;
}) {
  const selected = filterWorkspace(db, filters);
  const { communities } = selected;
  const insight = intelligence(selected);
  const countries = [...new Set(communities.map((c) => c.country))].sort();
  const rows = countries.map((code) => ({
    code,
    n: communities.filter((c) => c.country === code).length,
    unverified: communities.filter(
      (c) => c.country === code && c.status !== "validat",
    ).length,
  }));
  const max = Math.max(1, ...rows.map((r) => r.n));
  const businesses = selected.entrepreneurs;
  const clients = selected.clients;
  return (
    <section className="module-workspace">
      <div className="module-title">
        <div>
          <h2>Analiză teritorială</h2>
          <p>
            Indicatori calculați din înregistrările pe care ai dreptul să le
            vezi.
          </p>
        </div>
        {onSummary && <button onClick={onSummary}>Sumare REDI și surse</button>}
      </div>
      <WorkspaceFilterPanel
        db={db}
        filters={filters}
        onChange={onFiltersChange}
        expanded
      />
      {error ? (
        <p className="error" role="alert">
          Indicatorii nu sunt disponibili până la restabilirea conexiunii cu
          baza de date.
        </p>
      ) : loading ? (
        <p role="status">Se încarcă indicatorii…</p>
      ) : (
        <>
          <dl className="metric-strip">
            <div>
              <dt>Comunități vizibile</dt>
              <dd>{communities.length.toLocaleString("ro-RO")}</dd>
            </div>
            <div>
              <dt>Zone distincte</dt>
              <dd>
                {groupBoundaryRecords(communities).length.toLocaleString(
                  "ro-RO",
                )}
              </dd>
            </div>
            <div>
              <dt>De verificat</dt>
              <dd>
                {communities
                  .filter((c) => c.status !== "validat")
                  .length.toLocaleString("ro-RO")}
              </dd>
            </div>
            <div>
              <dt>Fără geometrie</dt>
              <dd>
                {communities
                  .filter((c) => !c.geometry)
                  .length.toLocaleString("ro-RO")}
              </dd>
            </div>
          </dl>
          <div className="analytics-columns">
            <section>
              <h3>Acoperire pe țări</h3>
              {!rows.length ? (
                <p className="module-empty">
                  Nu există comunități publicate sau accesibile în selecție.
                </p>
              ) : (
                <div className="country-bars">
                  {rows.map((r) => (
                    <button
                      key={r.code}
                      onClick={() => onExplore(r.code)}
                      aria-label={`Vezi ${COUNTRY_LABELS[r.code] ?? r.code} pe hartă`}
                    >
                      <span>{COUNTRY_LABELS[r.code] ?? r.code}</span>
                      <span className="bar-track">
                        <span style={{ width: `${(r.n / max) * 100}%` }} />
                      </span>
                      <b>{r.n}</b>
                    </button>
                  ))}
                </div>
              )}
            </section>
            <section>
              <h3>Calitatea registrului</h3>
              <dl className="quality-list">
                {Object.entries(STATUS_LABELS).map(([code, label]) => (
                  <div key={code}>
                    <dt>
                      <span className={`badge ${code}`}>{label}</span>
                    </dt>
                    <dd>
                      {communities.filter((c) => c.status === code).length}
                    </dd>
                  </div>
                ))}
              </dl>
              <p className="muted small">
                Clasificarea REDI din sursă este separată de fluxul de aprobare
                a propunerilor.
              </p>
            </section>
          </div>
          <section className="territory-section">
            <h3>Comparație teritorială</h3>
            <div className="table-wrap">
              <table className="workspace-table">
                <thead>
                  <tr>
                    <th>Țară</th>
                    <th>Comunități</th>
                    <th>De verificat</th>
                    <th>Explorează</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.code}>
                      <th>{COUNTRY_LABELS[r.code] ?? r.code}</th>
                      <td>{r.n}</td>
                      <td>{r.unverified}</td>
                      <td>
                        <button onClick={() => onExplore(r.code)}>
                          Vezi pe hartă
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
          <section className="territory-section">
            <h3>Indicatori demografici disponibili</h3>
            <dl className="quality-list">
              <div>
                <dt>Înregistrări cu populație estimată</dt>
                <dd>
                  {insight.populationRecords} / {communities.length}
                </dd>
              </div>
              <div>
                <dt>Intervalul valorilor raportate</dt>
                <dd>
                  {insight.populationMin === null
                    ? "N/D"
                    : `${insight.populationMin.toLocaleString("ro-RO")} – ${insight.populationMax!.toLocaleString("ro-RO")}`}
                </dd>
              </div>
            </dl>
            <p className="muted small">
              Valorile surselor și contururile se pot suprapune. Nu sunt
              însumate într-o populație totală presupusă.
            </p>
          </section>
          {businesses.length > 0 && (
            <section className="territory-section">
              <h3>Acoperirea REDI în registru</h3>
              <p>
                {insight.linkedCommunities} din {communities.length} comunități
                au antreprenori asociați
                {insight.communityCoverage === null
                  ? ""
                  : ` (${(insight.communityCoverage * 100).toFixed(1)}%)`}
                .
              </p>
              <p className="muted small">
                Raport calculat pe registrul accesibil, nu pe întreaga piață
                potențială.
              </p>
              <div className="country-bars">
                {insight.sectors.map(([sector, n]) => (
                  <button
                    key={sector}
                    disabled={
                      !onNetworkExplore || sector === "Domeniu neprecizat"
                    }
                    onClick={() =>
                      onNetworkExplore?.(
                        "entrepreneurs",
                        sector === "Domeniu neprecizat" ? "" : sector,
                      )
                    }
                  >
                    <span>{sector}</span>
                    <span className="bar-track">
                      <span
                        style={{
                          width: `${(n / Math.max(1, businesses.length)) * 100}%`,
                        }}
                      />
                    </span>
                    <b>{n}</b>
                  </button>
                ))}
              </div>
            </section>
          )}
          {clients.length > 0 && (
            <section className="territory-section">
              <h3>Rețeaua partenerilor</h3>
              <div className="table-wrap">
                <table className="workspace-table">
                  <thead>
                    <tr>
                      <th>Partener</th>
                      <th>Clienți</th>
                      <th>Localități identificate</th>
                      <th>Fără localitate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {insight.partners.map((p) => (
                      <tr key={p.name}>
                        <th>
                          <button
                            onClick={() =>
                              onNetworkExplore?.("clients", p.name)
                            }
                          >
                            {p.name}
                          </button>
                        </th>
                        <td>{p.clients}</td>
                        <td>{p.localities.size}</td>
                        <td>{p.unlocated}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <h3 className="finance-heading">Sume raportate pe monedă</h3>
              {insight.finance.length ? (
                <dl className="quality-list">
                  {insight.finance.map((f) => (
                    <div key={f.currency}>
                      <dt>
                        {f.currency} · {f.records} înregistrări
                      </dt>
                      <dd>
                        {f.amount.toLocaleString("ro-RO", {
                          maximumFractionDigits: 2,
                        })}
                      </dd>
                    </div>
                  ))}
                </dl>
              ) : (
                <p className="muted small">
                  Nu există sume cu monedă identificată în selecție.
                </p>
              )}
              {insight.unknownCurrency > 0 && (
                <p className="muted small">
                  {insight.unknownCurrency} valori financiare au moneda
                  neprecizată și nu sunt însumate cu celelalte.
                </p>
              )}
            </section>
          )}
          {!!(businesses.length || clients.length) && (
            <section className="territory-section">
              <h3>Rețeaua accesibilă</h3>
              <p>
                {businesses.length} antreprenori · {clients.length} clienți ·{" "}
                {new Set(clients.map((c) => c.partner)).size} parteneri
              </p>
            </section>
          )}
        </>
      )}
    </section>
  );
}
