"use client";
import type { DB } from "@/lib/types";
import { COUNTRY_LABELS, STATUS_LABELS } from "@/lib/types";
import { groupBoundaryRecords } from "@/lib/boundaries";
export default function AnalyticsWorkspace({
  db,
  country,
  onCountry,
  onExplore,
  onSummary,
  loading,
  error,
}: {
  db: DB;
  country: string;
  onCountry: (value: string) => void;
  onExplore: (country: string) => void;
  onSummary?: () => void;
  loading: boolean;
  error: string | null;
}) {
  const communities = db.communities.filter(
    (c) => !country || c.country === country,
  );
  const countries = [...new Set(db.communities.map((c) => c.country))].sort();
  const rows = countries
    .filter((c) => !country || country === c)
    .map((code) => ({
      code,
      n: communities.filter((c) => c.country === code).length,
      unverified: communities.filter(
        (c) => c.country === code && c.status !== "validat",
      ).length,
    }));
  const max = Math.max(1, ...rows.map((r) => r.n));
  const businesses = db.entrepreneurs.filter(
    (e) => !country || e.country === country,
  );
  const clients = db.clients.filter((e) => !country || e.country === country);
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
      <div className="module-filter">
        <label>
          Teritoriu
          <select value={country} onChange={(e) => onCountry(e.target.value)}>
            <option value="">Toate țările accesibile</option>
            {countries.map((c) => (
              <option key={c} value={c}>
                {COUNTRY_LABELS[c] ?? c}
              </option>
            ))}
          </select>
        </label>
        <span className="muted small">
          Aceeași selecție se păstrează la deschiderea hărții.
        </span>
      </div>
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
