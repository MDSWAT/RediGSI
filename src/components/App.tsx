"use client";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Geometry } from "geojson";
import { useStore } from "@/lib/useStore";
import type { CollectionName, Community } from "@/lib/types";
import { COLLECTION_LABELS, KIND_LABELS, SOURCE_LABELS } from "@/lib/types";
import { assignCommunity, boundsOf, norm, validLatLng } from "@/lib/geo";
import { computeOverlap, type OverlapLevel } from "@/lib/overlap";
import {
  clientRows, communityRows, entrepreneurRows, exportCSV, exportCommunitiesGeoJSON, exportPointsGeoJSON, exportXLSX, overlapRows,
} from "@/lib/export";
import type { DrawShape, Focus } from "./MapView";
import CommunityForm from "./CommunityForm";
import ImportDialog from "./ImportDialog";
import Icon, { type IconName } from "./Icon";
import CountrySummaryView from "./CountrySummaryView";
import type { ImportedCountrySummary } from "@/lib/countrySummary";
import ManualEntryDialog, { type ManualTarget } from "./ManualEntryDialog";

const MapView = dynamic(() => import("./MapView"), { ssr: false, loading: () => <div className="map loading">Se încarcă harta…</div> });

type Tab = "communities" | "entrepreneurs" | "clients" | "overlap" | "data" | "summary";
const TABS: { id: Tab; label: string; short: string; icon: IconName; description: string }[] = [
  { id: "communities", label: "Comunități", short: "Comunități", icon: "map", description: "Explorează și completează harta comunităților." },
  { id: "summary", label: "Sumar REDI", short: "Sumar", icon: "data", description: "Cifrele pe țări, definițiile și observațiile din sursă." },
  { id: "entrepreneurs", label: "Antreprenori", short: "Antreprenori", icon: "briefcase", description: "Conectează antreprenorii cu comunitățile lor." },
  { id: "clients", label: "Clienți parteneri", short: "Parteneri", icon: "people", description: "Gestionează portofoliile partenerilor." },
  { id: "overlap", label: "Suprapunere", short: "Analiză", icon: "overlap", description: "Compară acoperirea comunităților și a partenerilor." },
  { id: "data", label: "Import / Export", short: "Date", icon: "data", description: "Adaugă, exportă și organizează datele hărții." },
];
const LIST_LIMIT = 300;
let seq = 0;
const nextNonce = () => ++seq;

async function fetchSummaries(): Promise<ImportedCountrySummary[]> {
  const response = await fetch("/api/summaries");
  if (!response.ok) throw new Error("Sumarele nu au putut fi încărcate. Reîncercați.");
  return response.json();
}

export default function App({ initialTab = "communities" }: { initialTab?: "communities" | "summary" }) {
  const store = useStore();
  const { db } = store;
  const [tab, setTab] = useState<Tab>(initialTab);
  const [summaries, setSummaries] = useState<ImportedCountrySummary[]>([]);
  const [summaryId, setSummaryId] = useState<string>();
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [summariesLoading, setSummariesLoading] = useState(true);
  const reloadSummaries = useCallback(async () => {
    setSummariesLoading(true);
    try {
      setSummaries(await fetchSummaries());
      setSummaryError(null);
    } catch (error) { setSummaryError((error as Error).message); }
    finally { setSummariesLoading(false); }
  }, []);
  useEffect(() => {
    let alive = true;
    fetchSummaries().then((reports) => { if (alive) setSummaries(reports); })
      .catch((error: Error) => { if (alive) setSummaryError(error.message); })
      .finally(() => { if (alive) setSummariesLoading(false); });
    return () => { alive = false; };
  }, []);
  const selectedSummary = summaries.find((report) => report.id === summaryId) ?? summaries.at(-1);
  const [selectedId, setSelectedId] = useState<string>();
  const [focus, setFocus] = useState<Focus>();
  const [drawRequest, setDrawRequest] = useState<{ shape: DrawShape; nonce: number }>();
  const [draft, setDraft] = useState<Geometry | null>(null);
  const [editing, setEditing] = useState<Community | null>(null);
  const [importTarget, setImportTarget] = useState<CollectionName | null>(null);
  const [manualTarget, setManualTarget] = useState<ManualTarget | null>(null);
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<"" | "validat" | "propus">("");
  const [level, setLevel] = useState<OverlapLevel>("locality");
  const [partner, setPartner] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  const flash = (m: string) => { setMsg(m); setTimeout(() => setMsg(null), 4000); };
  const focusGeom = (g: Geometry) => setFocus({ bounds: boundsOf(g), nonce: nextNonce() });
  const focusPoint = (lat: number, lng: number) => setFocus({ lat, lng, zoom: 16, nonce: nextNonce() });
  const draw = (shape: DrawShape) => {
    setDrawRequest({ shape, nonce: nextNonce() });
    if (window.matchMedia("(max-width: 760px)").matches) {
      document.querySelector("main")?.scrollIntoView({ block: "start", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
    }
  };

  const communityById = useMemo(() => new Map(db.communities.map((c) => [c.id, c])), [db.communities]);
  const partners = useMemo(() => {
    const m = new Map<string, { n: number; amount: number }>();
    db.clients.forEach((c) => {
      const p = m.get(c.partner) ?? { n: 0, amount: 0 };
      p.n++; p.amount += c.amount ?? 0;
      m.set(c.partner, p);
    });
    return [...m.entries()].sort((a, b) => b[1].n - a[1].n);
  }, [db.clients]);

  const overlap = useMemo(() => (tab === "overlap" ? computeOverlap(db, level, partner || undefined) : undefined), [db, level, partner, tab]);

  const nq = norm(q);
  const communities = useMemo(() => db.communities.filter((c) =>
    (!statusFilter || c.status === statusFilter) &&
    (!nq || norm([c.name, c.locality, c.county, c.siruta].join(" ")).includes(nq)),
  ), [db.communities, statusFilter, nq]);
  const entrepreneurs = useMemo(() => db.entrepreneurs.filter((e) =>
    !nq || norm([e.name, e.business, e.sector, e.locality, e.county].join(" ")).includes(nq),
  ), [db.entrepreneurs, nq]);

  const onCreateShape = useCallback((g: Geometry) => setDraft(g), []);
  const onSelectCommunity = useCallback((id: string) => { setSelectedId(id); setTab("communities"); }, []);

  const saveCommunity = async (c: Omit<Community, "id">) => {
    if (editing) {
      await store.update("communities", [{ ...c, id: editing.id }]);
      setEditing(null);
      flash("Comunitate actualizată.");
    } else {
      const [created] = await store.add("communities", [c]);
      setDraft(null);
      setSelectedId(created.id);
      // Link already-imported entrepreneurs that fall inside the new shape.
      const all = [...db.communities, created as Community];
      const relink = db.entrepreneurs.filter((e) => !e.communityId).map((e) => ({ id: e.id, communityId: assignCommunity(e, all) })).filter((e) => e.communityId);
      if (relink.length) await store.update("entrepreneurs", relink);
      flash(`Comunitate adăugată${relink.length ? ` · ${relink.length} antreprenori legați` : ""}.`);
    }
  };

  const relinkAll = async () => {
    const changes = db.entrepreneurs
      .map((e) => ({ id: e.id, communityId: assignCommunity(e, db.communities) ?? "" }))
      .filter((u) => u.communityId !== (db.entrepreneurs.find((e) => e.id === u.id)?.communityId ?? ""));
    await store.update("entrepreneurs", changes);
    flash(`${changes.length} legături actualizate.`);
  };

  const removeCommunity = async (c: Community) => {
    if (!confirm(`Ștergeți comunitatea „${c.name}”?`)) return;
    await store.remove("communities", [c.id]);
    const orphans = db.entrepreneurs.filter((e) => e.communityId === c.id).map((e) => ({ id: e.id, communityId: "" }));
    if (orphans.length) await store.update("entrepreneurs", orphans);
    if (selectedId === c.id) setSelectedId(undefined);
  };

  const clearCollection = async (c: CollectionName) => {
    if (!confirm(`Ștergeți TOATE înregistrările din „${COLLECTION_LABELS[c]}”? Acțiunea nu poate fi anulată.`)) return;
    await store.remove(c, "all");
  };

  const fitAll = () => {
    const pts: [number, number][] = [];
    db.communities.forEach((c) => { const [[s, w], [n, e]] = boundsOf(c.geometry); pts.push([s, w], [n, e]); });
    db.entrepreneurs.forEach((e) => validLatLng(e.lat, e.lng) && pts.push([e.lat!, e.lng!]));
    if (!pts.length) { setFocus({ bounds: [[43.6, 20.2], [48.3, 29.8]], nonce: nextNonce() }); return; }
    const lats = pts.map((p) => p[0]); const lngs = pts.map((p) => p[1]);
    setFocus({ bounds: [[Math.min(...lats), Math.min(...lngs)], [Math.max(...lats), Math.max(...lngs)]], nonce: nextNonce() });
  };

  const validated = db.communities.filter((c) => c.status === "validat").length;
  const currentTab = TABS.find((t) => t.id === tab)!;
  const manualDefault: ManualTarget = tab === "summary" ? "summary" : tab === "entrepreneurs" ? "entrepreneurs" : tab === "clients" ? "clients" : "communities";

  return (
    <div className={`app${tab === "summary" ? " summary-mode" : ""}`}>
      <nav className="navigation" aria-label="Navigare principală">
        <Link className="rail-brand" href="/" aria-label="Roma Community Map — acasă"><Icon name="map" size={27} /></Link>
        <div className="nav-items">
          {TABS.map((t) => <button key={t.id} className={tab === t.id ? "active" : ""} aria-current={tab === t.id ? "page" : undefined} onClick={() => setTab(t.id)} title={t.label}><Icon name={t.icon} size={22} /><span>{t.short}</span></button>)}
        </div>
        <span className="rail-signature">RediGSI</span>
      </nav>
      <header>
        <div className="brand">
          <div>
            <h1>Roma Community Map</h1>
            <p className="muted small">Comunități conectate. Perspective comune.</p>
          </div>
        </div>
        <div className="header-summary" aria-label="Rezumat date"><span><b>{db.communities.length}</b> comunități</span><span><b>{db.entrepreneurs.length}</b> antreprenori</span><span><b>{db.clients.length}</b> clienți</span></div>
        <button className="primary header-import" aria-label="Importă date" onClick={() => setImportTarget(tab === "entrepreneurs" ? "entrepreneurs" : tab === "clients" ? "clients" : "communities")}><Icon name="upload" size={17} /><span>Importă date</span></button>
      </header>

      <aside aria-label={currentTab.label}>
        <div className="panel-heading"><h2>{currentTab.label}{tab === "communities" && <span className="count">{db.communities.length}</span>}</h2><p>{currentTab.description}</p></div>
        <div className="panel">
          {store.error && <p className="error">{store.error}</p>}
          {store.loading && <p className="muted">Se încarcă datele…</p>}
          <button className="manual-action" onClick={() => setManualTarget(manualDefault)}><Icon name="plus" size={17} />Adaugă manual</button>

          {tab === "summary" && <>
            <button className="primary" onClick={() => setImportTarget("communities")}><Icon name="upload" size={16} />Importă sumar CSV</button>
            <p className="muted small">Selectează fișierul REDI cu tabelul pe țări. Sumarul este recunoscut automat.</p>
            {summariesLoading && <p role="status" className="muted small">Se încarcă sumarele…</p>}
            {summaryError && <div className="error"><p>{summaryError}</p><button onClick={reloadSummaries}>Reîncearcă</button></div>}
            <h3>Fișiere importate</h3>
            {!summaries.length && !summariesLoading && !summaryError && <p className="muted small">Niciun sumar importat încă.</p>}
            <ul className="list">{summaries.map((report) => <li key={report.id} className={report.id === selectedSummary?.id ? "selected" : ""}><button className="record-select" aria-pressed={report.id === selectedSummary?.id} onClick={() => setSummaryId(report.id)}><b>{report.countries.length} țări · {report.totals.localities.toLocaleString("ro-RO")} localități</b><span className="small muted summary-filename">{report.sourceName}</span></button></li>)}</ul>
            <div className="card"><h3>Despre datele de pe hartă</h3><p className="muted small">Localitățile individuale pot fi adăugate pe hartă din foile detaliate ale registrului, cu nume și coordonate sau coduri de localitate. Sumarul păstrează doar totalurile pe țări.</p></div>
          </>}

          {tab === "communities" && (
            <>
              <div className="draw-tools">
                <h3>Adaugă pe hartă</h3>
                <div className="draw-grid">
                  <button onClick={() => draw("CircleMarker")}><Icon name="point" /><span>Punct</span></button>
                  <button onClick={() => draw("Line")}><Icon name="line" /><span>Stradă</span></button>
                  <button onClick={() => draw("Polygon")}><Icon name="polygon" /><span>Cartier</span></button>
                  <button onClick={() => draw("Rectangle")}><Icon name="rectangle" /><span>Zonă</span></button>
                </div>
                <details className="drawing-help"><summary>Cum desenez o comunitate?</summary><p>Stradă: click pe fiecare punct, apoi pe ultimul pentru a termina. Cartier: închideți poligonul pe primul punct. Apăsați Esc pentru a anula desenarea.</p></details>
              </div>
              <div className="search-field"><Icon name="search" size={18} /><input aria-label="Caută comunități" placeholder="Nume, localitate sau SIRUTA" value={q} onChange={(e) => setQ(e.target.value)} /></div>
              <div className="status-filters" role="group" aria-label="Filtrează după status">
                {([['', 'Toate', db.communities.length], ['validat', 'Validate', validated], ['propus', 'Propuse', db.communities.length - validated]] as const).map(([value, label, count]) => <button key={value} aria-pressed={statusFilter === value} className={statusFilter === value ? "active" : ""} onClick={() => setStatusFilter(value)}>{label}<span>{count}</span></button>)}
              </div>
              {!!db.communities.length && <p className="results-label">{communities.length} comunități găsite</p>}
              <ul className="list">
                {communities.slice(0, LIST_LIMIT).map((c) => {
                  const n = db.entrepreneurs.filter((e) => e.communityId === c.id).length;
                  return (
                    <li key={c.id} className={c.id === selectedId ? "selected" : ""}>
                      <button className="record-select" aria-expanded={c.id === selectedId} onClick={() => { setSelectedId(c.id); focusGeom(c.geometry); }}>
                      <div className="li-main">
                        <b>{c.name}</b>
                        <span className={`badge ${c.status}`}>{c.status === "validat" ? "validată" : "propusă"}</span>
                        <span className="badge">{KIND_LABELS[c.kind]}</span>
                      </div>
                      <div className="muted small">
                        {[c.locality, c.county, c.country].filter(Boolean).join(", ") || "—"}{c.siruta ? ` · SIRUTA ${c.siruta}` : ""} · {SOURCE_LABELS[c.source]}{n ? ` · ${n} antreprenori` : ""}
                      </div>
                      </button>
                      {c.id === selectedId && (
                        <div className="li-actions" onClick={(e) => e.stopPropagation()}>
                          <button onClick={() => setEditing(c)}>Editează</button>
                          <button onClick={() => store.update("communities", [{ id: c.id, status: c.status === "validat" ? "propus" : "validat" }])}>
                            {c.status === "validat" ? "Marchează propusă" : "Validează"}
                          </button>
                          <button className="danger" onClick={() => removeCommunity(c)}>Șterge</button>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
              {communities.length > LIST_LIMIT && <p className="muted small">Se afișează primele {LIST_LIMIT} din {communities.length}. Restrângeți căutarea.</p>}
              {!store.loading && !db.communities.length && (
                <div className="empty">
                  <Icon name="map" size={36} />
                  <h3>Harta începe cu o comunitate</h3>
                  <p>Importă catalogul existent sau marchează prima comunitate direct pe hartă.</p>
                  <button className="primary" onClick={() => setImportTarget("communities")}><Icon name="upload" size={16} />Importă catalogul</button>
                  <span className="file-formats">CSV, Excel sau GeoJSON</span>
                </div>
              )}
              {!store.loading && !!db.communities.length && !communities.length && <div className="empty"><Icon name="search" size={30} /><h3>Nicio comunitate găsită</h3><p>Încearcă alt nume sau schimbă filtrul de status.</p><button onClick={() => { setQ(""); setStatusFilter(""); }}>Resetează filtrele</button></div>}
            </>
          )}

          {tab === "entrepreneurs" && (
            <>
              <div className="btn-row">
                <button className="primary" onClick={() => setImportTarget("entrepreneurs")}>Importă antreprenori</button>
                <button onClick={relinkAll} disabled={!db.entrepreneurs.length}>Recalculează comunitățile</button>
              </div>
              <input aria-label="Caută antreprenori" placeholder="Caută nume, firmă sau localitate…" value={q} onChange={(e) => setQ(e.target.value)} />
              {!store.loading && !entrepreneurs.length && <div className="empty"><Icon name="briefcase" size={32} /><h3>{db.entrepreneurs.length ? "Niciun rezultat" : "Antreprenorii, pe aceeași hartă"}</h3><p>{db.entrepreneurs.length ? "Încearcă un alt termen de căutare." : "Importă lista pentru a vedea legăturile cu comunitățile."}</p></div>}
              <ul className="list">
                {entrepreneurs.slice(0, LIST_LIMIT).map((e) => (
                  <li key={e.id}><button className="record-select" disabled={!validLatLng(e.lat, e.lng)} onClick={() => validLatLng(e.lat, e.lng) && focusPoint(e.lat!, e.lng!)}>
                    <div className="li-main"><b>{e.name}</b>{e.business && <span className="muted">{e.business}</span>}</div>
                    <div className="muted small">
                      {[e.sector, e.locality, e.county].filter(Boolean).join(" · ") || "—"}
                      {" · "}{e.communityId ? `comunitate: ${communityById.get(e.communityId)?.name ?? "?"}` : "fără comunitate"}
                      {!validLatLng(e.lat, e.lng) && <span className="warn"> · fără coordonate</span>}
                    </div>
                  </button></li>
                ))}
              </ul>
              {entrepreneurs.length > LIST_LIMIT && <p className="muted small">Se afișează primii {LIST_LIMIT} din {entrepreneurs.length}.</p>}
            </>
          )}

          {tab === "clients" && (
            <>
              <button className="primary" onClick={() => setImportTarget("clients")}>Importă listă de clienți ai unui partener</button>
              <h3>Parteneri</h3>
              {!partners.length && <p className="muted">Niciun partener încă.</p>}
              <ul className="list">
                {partners.map(([p, s]) => (
                  <li key={p}>
                    <div className="li-main"><b>{p}</b><span className="muted">{s.n} clienți{s.amount ? ` · ${s.amount.toLocaleString("ro-RO")}` : ""}</span></div>
                    <div className="li-actions">
                      <button onClick={() => { setPartner(p); setTab("overlap"); }}>Vezi suprapunerea</button>
                      <button className="danger" onClick={async () => {
                        if (!confirm(`Ștergeți toți cei ${s.n} clienți ai partenerului „${p}”?`)) return;
                        await store.remove("clients", db.clients.filter((c) => c.partner === p).map((c) => c.id));
                      }}>Șterge lista</button>
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}

          {tab === "overlap" && overlap && (
            <>
              <div className="row">
                <label>Nivel
                  <select value={level} onChange={(e) => setLevel(e.target.value as OverlapLevel)}>
                    <option value="locality">Localitate (SIRUTA)</option><option value="county">Județ</option><option value="country">Țară</option>
                  </select>
                </label>
                <label>Partener
                  <select value={partner} onChange={(e) => setPartner(e.target.value)}>
                    <option value="">Toți partenerii</option>
                    {partners.map(([p]) => <option key={p}>{p}</option>)}
                  </select>
                </label>
              </div>
              <div className="stats">
                <div><b>{overlap.summary.areasWithClientsAndCommunities}</b><span>din {overlap.summary.areasWithClients} zone cu clienți au și comunități</span></div>
                <div><b>{overlap.summary.clientsInCommunityAreas}</b><span>din {overlap.summary.clientsTotal} clienți sunt în zone cu comunități</span></div>
                <div><b>{overlap.summary.clientsInsideCommunityShapes}</b><span>clienți chiar în perimetrul unei comunități</span></div>
                {overlap.summary.amountTotal > 0 && (
                  <div><b>{Math.round((100 * overlap.summary.amountInCommunityAreas) / overlap.summary.amountTotal)}%</b><span>din suma finanțată ajunge în zone cu comunități</span></div>
                )}
              </div>
              {overlap.summary.clientsWithoutLocation > 0 && <p className="warn small">{overlap.summary.clientsWithoutLocation} clienți nu au localitate/județ și nu sunt incluși.</p>}
              <div className="legend small">
                <span><i style={{ background: "#16a34a" }} /> clienți + comunități</span>
                <span><i style={{ background: "#ea580c" }} /> doar clienți</span>
                <span><i style={{ background: "#64748b" }} /> doar comunități</span>
              </div>
              <div className="btn-row">
                <button onClick={() => exportCSV("suprapunere", overlapRows(overlap.rows))}>Export CSV</button>
                <button onClick={() => exportXLSX("suprapunere", overlapRows(overlap.rows))}>Export Excel</button>
              </div>
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Zonă</th><th title="Comunități">Com.</th><th title="Antreprenori">Antr.</th><th title="Clienți partener">Clienți</th></tr></thead>
                  <tbody>
                    {overlap.rows.slice(0, LIST_LIMIT).map((r) => (
                      <tr key={r.key} className={r.clients && r.communities ? "hit" : ""} onClick={() => validLatLng(r.lat, r.lng) && setFocus({ lat: r.lat, lng: r.lng, zoom: level === "locality" ? 13 : level === "county" ? 9 : 6, nonce: nextNonce() })}>
                        <td>{r.label}{r.siruta && <span className="muted small"> · {r.siruta}</span>}</td>
                        <td>{r.communities || ""}</td><td>{r.entrepreneurs || ""}</td><td>{r.clients || ""}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {tab === "data" && (
            <>
              <div className="card">
                <b>Import</b>
                <div className="btn-grid">
                  {(Object.keys(COLLECTION_LABELS) as CollectionName[]).map((c) => (
                    <button key={c} onClick={() => setImportTarget(c)}>{COLLECTION_LABELS[c]}</button>
                  ))}
                </div>
                <p className="muted small">
                  Fișiere exemplu (date fictive): <a href="/samples/comunitati_catalog_exemplu.csv" download>catalog</a> ·{" "}
                  <a href="/samples/antreprenori_exemplu.csv" download>antreprenori</a> ·{" "}
                  <a href="/samples/clienti_partener_exemplu.csv" download>clienți partener</a> ·{" "}
                  <a href="/samples/localitati_siruta_exemplu.csv" download>nomenclator</a>
                </p>
                <p className="muted small">Nomenclator SIRUTA: {db.localities.length} localități încărcate. Importați-l înaintea listelor care au doar localitatea sau codul SIRUTA.</p>
              </div>

              <div className="card">
                <b>Export comunități</b> <span className="muted small">(coordonate, SIRUTA, WKT – pentru import în alte baze de date / QGIS)</span>
                <div className="btn-grid">
                  <button onClick={() => exportCommunitiesGeoJSON(db)}>GeoJSON</button>
                  <button onClick={() => exportCSV("comunitati", communityRows(db))}>CSV</button>
                  <button onClick={() => exportXLSX("comunitati", communityRows(db))}>Excel</button>
                  <button onClick={() => exportCommunitiesGeoJSON(db, db.communities.filter((c) => c.status === "validat"))}>Doar validate (GeoJSON)</button>
                </div>
              </div>
              <div className="card">
                <b>Export antreprenori</b>
                <div className="btn-grid">
                  <button onClick={() => exportCSV("antreprenori", entrepreneurRows(db))}>CSV</button>
                  <button onClick={() => exportXLSX("antreprenori", entrepreneurRows(db))}>Excel</button>
                  <button onClick={() => exportPointsGeoJSON("antreprenori", entrepreneurRows(db))}>GeoJSON</button>
                </div>
              </div>
              <div className="card">
                <b>Export clienți parteneri</b>
                <div className="btn-grid">
                  <button onClick={() => exportCSV("clienti_parteneri", clientRows(db))}>CSV</button>
                  <button onClick={() => exportXLSX("clienti_parteneri", clientRows(db))}>Excel</button>
                </div>
              </div>

              <details className="card">
                <summary>Ștergere date</summary>
                <div className="btn-grid">
                  {(Object.keys(COLLECTION_LABELS) as CollectionName[]).map((c) => (
                    <button key={c} className="danger" onClick={() => clearCollection(c)}>Șterge {COLLECTION_LABELS[c].toLowerCase()}</button>
                  ))}
                </div>
              </details>
            </>
          )}
        </div>
      </aside>

      <main aria-label={tab === "summary" ? "Sumar pe țări" : "Harta comunităților"}>
        {tab === "summary" ? <CountrySummaryView report={selectedSummary} /> : <>
        <div className="map-toolbar"><span><Icon name="map" size={17} />Hartă interactivă</span><button onClick={fitAll}><Icon name="fit" size={17} />Vezi tot</button></div>
        <MapView
          db={db}
          version={store.version}
          selectedId={selectedId}
          focus={focus}
          drawRequest={drawRequest}
          overlap={overlap?.rows}
          onCreateShape={onCreateShape}
          onSelectCommunity={onSelectCommunity}
        />
        <div className="map-key" aria-label="Legenda hărții"><span><i className="key-validated" />Validate</span><span><i className="key-proposed" />Propuse</span><span><i className="key-entrepreneur" />Antreprenori</span><span><i className="key-client" />Clienți</span></div>
        </>}
        {msg && <div className="toast" role="status">{msg}</div>}
      </main>

      {(draft || editing) && (
        <CommunityForm
          db={db}
          geometry={draft ?? undefined}
          existing={editing ?? undefined}
          onSave={saveCommunity}
          onCancel={() => { setDraft(null); setEditing(null); }}
        />
      )}
      {importTarget && <ImportDialog key={importTarget} store={store} initialTarget={importTarget} onSummaryImported={async () => { await reloadSummaries(); setSummaryId(undefined); setTab("summary"); }} onClose={() => setImportTarget(null)} />}
      {manualTarget && <ManualEntryDialog key={manualTarget} store={store} initialTarget={manualTarget} onClose={() => setManualTarget(null)} onSaved={async (target) => {
        if (target === "summary") { await reloadSummaries(); setSummaryId(undefined); setTab("summary"); }
        else { setTab(target === "localities" ? "data" : target); setQ(""); setStatusFilter(""); }
        flash("Înregistrare salvată în baza de date.");
      }} />}
    </div>
  );
}
