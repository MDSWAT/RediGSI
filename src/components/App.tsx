"use client";
import type { GeocodingMetadata } from "@/lib/geocoding";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Geometry } from "geojson";
import { useStore } from "@/lib/useStore";
import type { CollectionName, Community, CommunityStatus } from "@/lib/types";
import {
  KIND_LABELS,
  SOURCE_LABELS,
  STATUS_LABELS,
} from "@/lib/types";
import { assignCommunity, boundsOf, norm, validLatLng } from "@/lib/geo";
import { computeOverlap, type OverlapLevel } from "@/lib/overlap";
import { exportCSV, exportXLSX, overlapRows } from "@/lib/export";
import type { DrawShape, Focus } from "./MapView";
import WorkspaceFilterPanel from "./WorkspaceFilterPanel";
import { filterWorkspace, type WorkspaceFilters } from "@/lib/workspaceFilters";
import PublicationDialog from "./PublicationDialog";
import CoordinateDialog from "./CoordinateDialog";
import type { GeometryEditRequest } from "./GeometryEditLayer";
import CommunityForm from "./CommunityForm";
import CommunityDetails from "./CommunityDetails";
import { BOUNDARY_SCOPE_LABELS, groupBoundaryRecords } from "@/lib/boundaries";
import ImportDialog from "./ImportDialog";
import Icon, { type IconName } from "./Icon";
import CountrySummaryView from "./CountrySummaryView";
import type { ImportedCountrySummary } from "@/lib/countrySummary";
import {
  PUBLIC_ACCESS,
  ROLE_LABELS,
  canEdit,
  canExport,
  isAdmin,
  visibleModules,
  type AccessProfile,
  type WorkspaceModule,
} from "@/lib/access";
import { createClient } from "@/utils/supabase/client";
import AuthDialog from "./AuthDialog";
import ProposalDialog, { type ProposalFields } from "./ProposalDialog";
import AnalyticsWorkspace from "./AnalyticsWorkspace";
import DataWorkspace from "./DataWorkspace";
import AdministrationWorkspace from "./AdministrationWorkspace";
import ManualEntryDialog, { type ManualTarget } from "./ManualEntryDialog";

const MapView = dynamic(() => import("./MapView"), {
  ssr: false,
  loading: () => <div className="map loading">Se încarcă harta…</div>,
});

type Tab =
  | "dashboard"
  | "administration"
  | "communities"
  | "entrepreneurs"
  | "clients"
  | "overlap"
  | "data"
  | "summary";
const MODULES: {
  id: WorkspaceModule;
  label: string;
  icon: IconName;
  tab: Tab;
}[] = [
  { id: "map", label: "Hartă", icon: "map", tab: "communities" },
  { id: "analytics", label: "Analiză", icon: "overlap", tab: "dashboard" },
  { id: "data", label: "Date", icon: "data", tab: "data" },
  {
    id: "administration",
    label: "Administrare",
    icon: "people",
    tab: "administration",
  },
];
const TABS: {
  id: Tab;
  label: string;
  short: string;
  icon: IconName;
  description: string;
}[] = [
  {
    id: "dashboard",
    label: "Analiză teritorială",
    short: "Analiză",
    icon: "overlap",
    description: "Indicatori calculați pentru teritoriile accesibile.",
  },
  {
    id: "administration",
    label: "Administrare",
    short: "Administrare",
    icon: "people",
    description: "Utilizatori, propuneri și istoric.",
  },
  {
    id: "communities",
    label: "Comunități",
    short: "Comunități",
    icon: "map",
    description: "Explorează și completează harta comunităților.",
  },
  {
    id: "summary",
    label: "Sumar REDI",
    short: "Sumar",
    icon: "data",
    description: "Cifrele pe țări, definițiile și observațiile din sursă.",
  },
  {
    id: "entrepreneurs",
    label: "Antreprenori",
    short: "Antreprenori",
    icon: "briefcase",
    description: "Conectează antreprenorii cu comunitățile lor.",
  },
  {
    id: "clients",
    label: "Clienți parteneri",
    short: "Parteneri",
    icon: "people",
    description: "Gestionează portofoliile partenerilor.",
  },
  {
    id: "overlap",
    label: "Suprapunere",
    short: "Analiză",
    icon: "overlap",
    description: "Compară acoperirea comunităților și a partenerilor.",
  },
  {
    id: "data",
    label: "Import / Export",
    short: "Date",
    icon: "data",
    description: "Adaugă, exportă și organizează datele hărții.",
  },
];
const LIST_LIMIT = 300;
let seq = 0;
const nextNonce = () => ++seq;

async function fetchSummaries(): Promise<ImportedCountrySummary[]> {
  const response = await fetch("/api/summaries");
  if (!response.ok)
    throw new Error("Sumarele nu au putut fi încărcate. Reîncercați.");
  return response.json();
}

export default function App({
  initialTab = "communities",
}: {
  initialTab?: "communities" | "summary";
}) {
  const [access, setAccess] = useState<AccessProfile>(PUBLIC_ACCESS);
  const [accessError, setAccessError] = useState("");
  const [authOpen, setAuthOpen] = useState(false);
  const [module, setModule] = useState<WorkspaceModule>(
    initialTab === "summary" ? "analytics" : "map",
  );
  const [proposalOpen, setProposalOpen] = useState(false);
  const [proposalDraft, setProposalDraft] = useState<ProposalFields>();
  const [proposalGeometry, setProposalGeometry] = useState<Geometry>();
  const [submissionDrawing, setSubmissionDrawing] = useState(false);
  const [clusterPoints, setClusterPoints] = useState(true);
  const [hatched, setHatched] = useState(false);
  const [geometryEditRequest, setGeometryEditRequest] =
    useState<GeometryEditRequest>();
  const [editedGeometry, setEditedGeometry] = useState<Geometry>();
  const [geometryBusy, setGeometryBusy] = useState(false);
  const [geometryError, setGeometryError] = useState("");
  const [publicationTarget, setPublicationTarget] = useState<Community>();
  const [coordinateTarget, setCoordinateTarget] = useState<Community>();
  const [previewGeometry, setPreviewGeometry] = useState<Geometry>();
  useEffect(() => {
    let alive = true;
    fetch("/api/session")
      .then(async (r) => {
        const body = await r.json();
        if (!r.ok) throw new Error(body.error);
        if (alive) setAccess(body);
      })
      .catch((e: Error) => {
        if (alive) setAccessError(e.message);
      });
    return () => {
      alive = false;
    };
  }, []);
  const store = useStore();
  const { db } = store;
  const refreshWorkspace = async () => {
    try {
      const r = await fetch("/api/session");
      const profile = await r.json();
      if (!r.ok) throw new Error(profile.error);
      setAccess(profile);
      setAccessError("");
      if (!visibleModules(profile).includes(module)) {
        setModule("map");
        setTab("communities");
      }
    } catch (e) {
      setAccess(PUBLIC_ACCESS);
      setAccessError((e as Error).message);
      setModule("map");
      setTab("communities");
    }
    await store.reload();
  };

  const [tab, setTab] = useState<Tab>(initialTab);
  const [panelOpen, setPanelOpen] = useState(false);
  useEffect(() => {
    if (!panelOpen) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !document.querySelector("dialog[open]")) {
        setPanelOpen(false);
        document.getElementById("panel-toggle")?.focus();
      }
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [panelOpen]);
  const [summaries, setSummaries] = useState<ImportedCountrySummary[]>([]);
  const [summaryId, setSummaryId] = useState<string>();
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [summariesLoading, setSummariesLoading] = useState(true);
  const reloadSummaries = useCallback(async () => {
    setSummariesLoading(true);
    try {
      setSummaries(await fetchSummaries());
      setSummaryError(null);
    } catch (error) {
      setSummaryError((error as Error).message);
    } finally {
      setSummariesLoading(false);
    }
  }, []);
  useEffect(() => {
    let alive = true;
    fetchSummaries()
      .then((reports) => {
        if (alive) setSummaries(reports);
      })
      .catch((error: Error) => {
        if (alive) setSummaryError(error.message);
      })
      .finally(() => {
        if (alive) setSummariesLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);
  const selectedSummary =
    summaries.find((report) => report.id === summaryId) ?? summaries.at(-1);
  const [selectedId, setSelectedId] = useState<string>();
  const [focus, setFocus] = useState<Focus>();
  const [drawRequest, setDrawRequest] = useState<{
    shape: DrawShape;
    nonce: number;
  }>();
  const [draft, setDraft] = useState<Geometry | null>(null);
  const [editing, setEditing] = useState<Community | null>(null);
  const [importTarget, setImportTarget] = useState<CollectionName | null>(null);
  const [manualTarget, setManualTarget] = useState<ManualTarget | null>(null);
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<"" | CommunityStatus>("");
  const [countryFilter, setCountry] = useState("");
  const [countyFilter, setCounty] = useState("");
  const [municipalityFilter, setMunicipality] = useState("");
  const [sectorFilter, setSector] = useState("");
  const [yearFilter, setYear] = useState("");
  const setCountryFilter = (country: string) => {
    setCountry(country);
    setCounty("");
    setMunicipality("");
  };
  const [unlocatedOnly, setUnlocatedOnly] = useState(false);
  const [healthOnly, setHealthOnly] = useState(false);
  const [level, setLevel] = useState<OverlapLevel>("locality");
  const [partner, setPartner] = useState("");
  const sharedFilters = useMemo<WorkspaceFilters>(
    () => ({
      country: countryFilter,
      county: countyFilter,
      municipality: municipalityFilter,
      sector: sectorFilter,
      partner,
      year: yearFilter,
    }),
    [
      countryFilter,
      countyFilter,
      municipalityFilter,
      sectorFilter,
      partner,
      yearFilter,
    ],
  );
  const updateSharedFilters = (f: WorkspaceFilters) => {
    setCountry(f.country);
    setCounty(f.county);
    setMunicipality(f.municipality);
    setSector(f.sector);
    setPartner(f.partner);
    setYear(f.year);
  };
  const filteredDB = useMemo(
    () => filterWorkspace(db, sharedFilters),
    [db, sharedFilters],
  );
  const [msg, setMsg] = useState<string | null>(null);

  const flash = (m: string) => {
    setMsg(m);
    setTimeout(() => setMsg(null), 4000);
  };
  const focusGeom = (g: Geometry | null, approximate = false) => {
    if (g)
      setFocus({
        bounds: boundsOf(g),
        zoom: approximate ? 12 : 17,
        nonce: nextNonce(),
      });
  };
  const focusPoint = (lat: number, lng: number) =>
    setFocus({ lat, lng, zoom: 16, nonce: nextNonce() });
  const draw = (shape: DrawShape) => {
    setDrawRequest({ shape, nonce: nextNonce() });
    setPanelOpen(false);
  };

  useEffect(() => {
    if (!submissionDrawing) return;
    const cancel = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSubmissionDrawing(false);
    };
    window.addEventListener("keydown", cancel);
    return () => window.removeEventListener("keydown", cancel);
  }, [submissionDrawing]);
  const leaveGeometryEditor = () => {
    if (
      geometryEditRequest &&
      editedGeometry &&
      !confirm("Renunțați la modificările geometriei care nu au fost salvate?")
    )
      return false;
    setGeometryEditRequest(undefined);
    setEditedGeometry(undefined);
    setGeometryError("");
    return true;
  };
  useEffect(() => {
    if (!editedGeometry) return;
    const before = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", before);
    return () => window.removeEventListener("beforeunload", before);
  }, [editedGeometry]);
  const persistGeometry = async (
    id: string,
    geometry: Geometry,
    expectedGeometry: Geometry | null,
    geocoding?: GeocodingMetadata,
  ) => {
    const r = await fetch("/api/geometry", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, geometry, expectedGeometry, geocoding }),
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error ?? "Poziția nu a fost salvată.");
    await store.reload();
  };
  const saveEditedGeometry = async () => {
    if (!geometryEditRequest || !editedGeometry) return;
    setGeometryBusy(true);
    setGeometryError("");
    try {
      await persistGeometry(
        geometryEditRequest.id,
        editedGeometry,
        geometryEditRequest.geometry,
      );
      setGeometryEditRequest(undefined);
      setEditedGeometry(undefined);
      flash(
        "Geometrie actualizată. Versiunea anterioară este păstrată în istoric.",
      );
    } catch (e) {
      setGeometryError((e as Error).message);
    } finally {
      setGeometryBusy(false);
    }
  };
  const communityById = useMemo(
    () => new Map(db.communities.map((c) => [c.id, c])),
    [db.communities],
  );
  const partners = useMemo(() => {
    const m = new Map<string, { n: number; amount: number }>();
    filteredDB.clients.forEach((c) => {
      const p = m.get(c.partner) ?? { n: 0, amount: 0 };
      p.n++;
      p.amount += c.amount ?? 0;
      m.set(c.partner, p);
    });
    return [...m.entries()].sort((a, b) => b[1].n - a[1].n);
  }, [filteredDB.clients]);

  const overlap = useMemo(
    () =>
      tab === "overlap"
        ? computeOverlap(filteredDB, level, partner || undefined)
        : undefined,
    [filteredDB, level, partner, tab],
  );

  const nq = norm(q);
  const communities = useMemo(
    () =>
      filteredDB.communities.filter(
        (c) =>
          (!statusFilter || c.status === statusFilter) &&
          (!countryFilter || c.country === countryFilter) &&
          (!unlocatedOnly ||
            !c.geometry ||
            (c.boundary && !c.boundary.referencePoint)) &&
          (!healthOnly ||
            c.extra?.["campanie REDI health"]?.toLowerCase() === "da") &&
          (!nq ||
            norm([c.name, c.locality, c.county, c.siruta].join(" ")).includes(
              nq,
            )),
      ),
    [
      filteredDB.communities,
      statusFilter,
      countryFilter,
      unlocatedOnly,
      healthOnly,
      nq,
    ],
  );
  const entrepreneurs = useMemo(
    () =>
      filteredDB.entrepreneurs.filter(
        (e) =>
          !nq ||
          norm(
            [e.name, e.business, e.sector, e.locality, e.county].join(" "),
          ).includes(nq),
      ),
    [filteredDB.entrepreneurs, nq],
  );

  const onCreateShape = useCallback(
    (g: Geometry) => {
      setDrawRequest(undefined);
      if (submissionDrawing) {
        setProposalGeometry(g);
        setProposalOpen(true);
        setSubmissionDrawing(false);
      } else if (canEdit(access)) setDraft(g);
    },
    [access, submissionDrawing],
  );
  const onSelectCommunity = useCallback((id: string) => {
    setSelectedId(id);
    setModule("map");
    setTab("communities");
    setPanelOpen(true);
  }, []);

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
      const relink = db.entrepreneurs
        .filter((e) => !e.communityId)
        .map((e) => ({ id: e.id, communityId: assignCommunity(e, all) }))
        .filter((e) => e.communityId);
      if (relink.length) await store.update("entrepreneurs", relink);
      flash(
        `Comunitate adăugată${relink.length ? ` · ${relink.length} antreprenori legați` : ""}.`,
      );
    }
  };

  const relinkAll = async () => {
    const changes = db.entrepreneurs
      .map((e) => ({
        id: e.id,
        communityId: assignCommunity(e, db.communities) ?? "",
      }))
      .filter(
        (u) =>
          u.communityId !==
          (db.entrepreneurs.find((e) => e.id === u.id)?.communityId ?? ""),
      );
    await store.update("entrepreneurs", changes);
    flash(`${changes.length} legături actualizate.`);
  };

  const removeCommunity = async (c: Community) => {
    if (
      !confirm(
        `Arhivați comunitatea „${c.name}”? Poate fi restaurată din Administrare.`,
      )
    )
      return;
    await store.remove("communities", [c.id]);
    const orphans = db.entrepreneurs
      .filter((e) => e.communityId === c.id)
      .map((e) => ({ id: e.id, communityId: "" }));
    if (orphans.length) await store.update("entrepreneurs", orphans);
    if (selectedId === c.id) setSelectedId(undefined);
  };

  const fitAll = () => {
    const pts: [number, number][] = [];
    (tab === "communities" ? communities : filteredDB.communities).forEach(
      (c) => {
        if (!c.geometry) return;
        const [[s, w], [n, e]] = boundsOf(c.geometry);
        pts.push([s, w], [n, e]);
      },
    );
    [...filteredDB.entrepreneurs, ...filteredDB.clients].forEach(
      (e) => validLatLng(e.lat, e.lng) && pts.push([e.lat!, e.lng!]),
    );
    if (!pts.length) {
      setFocus({
        bounds: [
          [43.6, 20.2],
          [48.3, 29.8],
        ],
        nonce: nextNonce(),
      });
      return;
    }
    const lats = pts.map((p) => p[0]);
    const lngs = pts.map((p) => p[1]);
    setFocus({
      bounds: [
        [Math.min(...lats), Math.min(...lngs)],
        [Math.max(...lats), Math.max(...lngs)],
      ],
      nonce: nextNonce(),
    });
  };

  const countries = [...new Set(db.communities.map((c) => c.country))].sort();
  const currentTab = TABS.find((t) => t.id === tab)!;
  const manualDefault: ManualTarget =
    tab === "summary"
      ? "summary"
      : tab === "entrepreneurs"
        ? "entrepreneurs"
        : tab === "clients"
          ? "clients"
          : "communities";

  return (
    <div
      className={`app${["dashboard", "data", "administration"].includes(tab) ? " wide-mode" : ""}${tab === "summary" ? " summary-mode" : ""}${panelOpen ? " is-panel-open" : ""}`}
    >
      <nav
        id="workspace-navigation"
        className="navigation"
        aria-label="Navigare principală"
      >
        <Link
          className="rail-brand"
          href="/"
          aria-label="Roma Community Map — acasă"
        >
          <span className="brand-mark">
            <Icon name="map" size={22} />
          </span>
          <span className="rail-wordmark">RediGSI</span>
        </Link>
        <div className="nav-items">
          {MODULES.filter((m) => visibleModules(access).includes(m.id)).map(
            (m) => (
              <button
                key={m.id}
                className={module === m.id ? "active" : ""}
                aria-current={module === m.id ? "page" : undefined}
                onClick={() => {
                  if (!leaveGeometryEditor()) return;
                  setModule(m.id);
                  setTab(m.tab);
                  setPanelOpen(false);
                }}
                title={m.label}
              >
                <Icon name={m.icon} size={20} />
                <span className="nav-label">{m.label}</span>
                <span className="nav-compact" aria-hidden="true">
                  {m.label === "Administrare" ? "Admin" : m.label}
                </span>
              </button>
            ),
          )}
        </div>
        <div className="rail-signature">
          <span className="workspace-avatar">{access.userId ? "R" : "P"}</span>
          <div>
            <b title={access.email ?? "Acces public"}>
              {access.email ?? "Acces public"}
            </b>
            <span>{ROLE_LABELS[access.role]}</span>
          </div>
        </div>
      </nav>
      <header className="workspace-header">
        <button
          id="panel-toggle"
          className="panel-toggle"
          aria-label={panelOpen ? "Închide panoul" : "Deschide panoul"}
          aria-expanded={panelOpen}
          aria-controls="workspace-panel"
          onClick={() => setPanelOpen(!panelOpen)}
        >
          <Icon name={panelOpen ? "close" : "menu"} />
        </button>
        <div className="brand">
          <span className="header-product">Roma Community Map</span>
          <span className="header-divider" aria-hidden="true">
            /
          </span>
          <h1>{currentTab.label}</h1>
        </div>
        <div className="header-facts" aria-label="Acoperirea registrului">
          <span>
            <b>{store.loading || store.error ? "—" : db.communities.length}</b>{" "}
            înregistrări
          </span>
          <span>
            <b>
              {store.loading || store.error
                ? "—"
                : groupBoundaryRecords(db.communities).length}
            </b>{" "}
            zone
          </span>
          <span>
            <b>{store.loading || store.error ? "—" : countries.length}</b> țări
          </span>
        </div>
        {canEdit(access) && (
          <button
            className="primary header-import"
            aria-label="Importă date"
            onClick={() => {
              setPanelOpen(false);
              setImportTarget(
                tab === "entrepreneurs"
                  ? "entrepreneurs"
                  : tab === "clients"
                    ? "clients"
                    : "communities",
              );
            }}
          >
            <Icon name="upload" size={16} />
            <span>Importă date</span>
          </button>
        )}
        <button
          className="header-auth"
          onClick={() => {
            if (access.userId) {
              void createClient()
                .auth.signOut()
                .then(() => window.location.reload());
            } else setAuthOpen(true);
          }}
        >
          {access.userId ? "Ieșire" : "Autentificare"}
        </button>
      </header>
      {panelOpen && !["dashboard", "data", "administration"].includes(tab) && (
        <button
          className="panel-backdrop"
          aria-label="Închide panoul de instrumente"
          onClick={() => setPanelOpen(false)}
        />
      )}

      <aside id="workspace-panel" aria-label={currentTab.label}>
        <div className="panel-heading">
          <h2>
            {currentTab.label}
            {tab === "communities" && (
              <span className="count">
                {store.error ? "—" : db.communities.length}
              </span>
            )}
          </h2>
          <p>{currentTab.description}</p>
          <button
            className="panel-close"
            aria-label="Închide instrumentele"
            onClick={() => setPanelOpen(false)}
          >
            <Icon name="close" size={18} />
          </button>
        </div>
        <div className="panel">
          {accessError && (
            <p className="error" role="alert">
              {accessError}
            </p>
          )}
          {module === "map" && (
            <div className="dataset-tabs" aria-label="Date pe hartă">
              {TABS.filter(
                (t) =>
                  [
                    "communities",
                    "entrepreneurs",
                    "clients",
                    "overlap",
                  ].includes(t.id) &&
                  (access.role !== "public_viewer" || t.id === "communities"),
              ).map((t) => (
                <button
                  key={t.id}
                  className={tab === t.id ? "active" : ""}
                  aria-pressed={tab === t.id}
                  onClick={() => {
                    if (leaveGeometryEditor()) setTab(t.id);
                  }}
                >
                  {t.short}
                </button>
              ))}
            </div>
          )}
          {module === "map" && (
            <button
              className="proposal-action"
              onClick={() => {
                setProposalDraft(undefined);
                setProposalGeometry(undefined);
                setProposalOpen(true);
              }}
            >
              <Icon name="plus" size={16} />
              Propune o comunitate
            </button>
          )}
          {module === "map" && (
            <WorkspaceFilterPanel
              db={db}
              filters={sharedFilters}
              onChange={updateSharedFilters}
            />
          )}
          {store.error && (
            <div className="error" role="alert">
              <b>Datele nu sunt disponibile</b>
              <p>Registrul nu a putut fi încărcat.</p>
              <button onClick={() => void store.reload()}>Reîncearcă</button>
              <details>
                <summary>Detalii tehnice</summary>
                <p>{store.error}</p>
              </details>
            </div>
          )}
          {store.loading && <p className="muted">Se încarcă datele…</p>}
          {canEdit(access) && (
            <button
              className="manual-action"
              onClick={() => setManualTarget(manualDefault)}
            >
              <Icon name="plus" size={17} />
              Adaugă manual
            </button>
          )}

          {tab === "summary" && (
            <>
              {canEdit(access) && (
                <button
                  className="primary"
                  onClick={() => setImportTarget("communities")}
                >
                  <Icon name="upload" size={16} />
                  Importă sumar CSV
                </button>
              )}
              <p className="muted small">
                Selectează fișierul REDI cu tabelul pe țări. Sumarul este
                recunoscut automat.
              </p>
              {summariesLoading && (
                <p role="status" className="muted small">
                  Se încarcă sumarele…
                </p>
              )}
              {summaryError && (
                <div className="error">
                  <p>{summaryError}</p>
                  <button onClick={reloadSummaries}>Reîncearcă</button>
                </div>
              )}
              <h3>Fișiere importate</h3>
              {!summaries.length && !summariesLoading && !summaryError && (
                <p className="muted small">Niciun sumar importat încă.</p>
              )}
              <ul className="list">
                {summaries.map((report) => (
                  <li
                    key={report.id}
                    className={
                      report.id === selectedSummary?.id ? "selected" : ""
                    }
                  >
                    <button
                      className="record-select"
                      aria-pressed={report.id === selectedSummary?.id}
                      onClick={() => setSummaryId(report.id)}
                    >
                      <b>
                        {report.countries.length} țări ·{" "}
                        {report.totals.localities.toLocaleString("ro-RO")}{" "}
                        localități
                      </b>
                      <span className="small muted summary-filename">
                        {report.sourceName}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
              <div className="card">
                <h3>Despre datele de pe hartă</h3>
                <p className="muted small">
                  Localitățile individuale pot fi adăugate pe hartă din foile
                  detaliate ale registrului, cu nume și coordonate sau coduri de
                  localitate. Sumarul păstrează doar totalurile pe țări.
                </p>
              </div>
            </>
          )}

          {tab === "communities" && (
            <>
              {canEdit(access) && (
                <details className="draw-tools">
                  <summary>
                    <Icon name="polygon" size={17} />
                    Desenează o comunitate
                    <Icon name="plus" size={15} />
                  </summary>
                  <div className="draw-grid">
                    <button onClick={() => draw("CircleMarker")}>
                      <Icon name="point" />
                      <span>Punct</span>
                    </button>
                    <button onClick={() => draw("Line")}>
                      <Icon name="line" />
                      <span>Stradă</span>
                    </button>
                    <button onClick={() => draw("Polygon")}>
                      <Icon name="polygon" />
                      <span>Cartier</span>
                    </button>
                    <button onClick={() => draw("Rectangle")}>
                      <Icon name="rectangle" />
                      <span>Zonă</span>
                    </button>
                  </div>
                  <details className="drawing-help">
                    <summary>Cum desenez o comunitate?</summary>
                    <p>
                      Stradă: click pe fiecare punct, apoi pe ultimul pentru a
                      termina. Cartier: închideți poligonul pe primul punct.
                      Apăsați Esc pentru a anula desenarea.
                    </p>
                  </details>
                </details>
              )}
              <label className="search-label" htmlFor="community-search">
                Caută în registru
              </label>
              <div className="search-field">
                <Icon name="search" size={18} />
                <input
                  id="community-search"
                  aria-label="Caută comunități"
                  placeholder="Nume, localitate sau SIRUTA"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                />
              </div>
              <div className="catalog-filters">
                <label>
                  Status REDI
                  <select
                    aria-label="Status REDI"
                    value={statusFilter}
                    onChange={(e) =>
                      setStatusFilter(e.target.value as CommunityStatus | "")
                    }
                  >
                    <option value="">Toate statusurile</option>
                    {Object.entries(STATUS_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="check-filter">
                  <input
                    type="checkbox"
                    checked={healthOnly}
                    onChange={(e) => setHealthOnly(e.target.checked)}
                  />
                  Campanie REDI health
                </label>
                <label className="check-filter">
                  <input
                    type="checkbox"
                    checked={unlocatedOnly}
                    onChange={(e) => setUnlocatedOnly(e.target.checked)}
                  />
                  Doar fără localizare
                </label>
              </div>
              {!!db.communities.length && (
                <p className="results-label">
                  {communities.length} înregistrări ·{" "}
                  {groupBoundaryRecords(communities).length} forme pe hartă
                </p>
              )}
              <ul className="list">
                {communities.map((c) => {
                  const n = db.entrepreneurs.filter(
                    (e) => e.communityId === c.id,
                  ).length;
                  return (
                    <li
                      key={c.id}
                      className={c.id === selectedId ? "selected" : ""}
                    >
                      <button
                        className="record-select"
                        aria-expanded={c.id === selectedId}
                        onClick={() => {
                          setSelectedId(c.id);
                          focusGeom(
                            c.geometry,
                            !!c.locationAccuracy && !c.boundary,
                          );
                        }}
                      >
                        <div className="li-main">
                          <b>{c.name}</b>
                          <span className={`badge ${c.status}`}>
                            {STATUS_LABELS[c.status]}
                          </span>
                          <span className="badge">
                            {c.boundary
                              ? BOUNDARY_SCOPE_LABELS[c.boundary.scope]
                              : KIND_LABELS[c.kind]}
                          </span>
                        </div>
                        <div className="muted small">
                          {[c.locality, c.county, c.country]
                            .filter(Boolean)
                            .join(", ") || "—"}
                          {c.siruta ? ` · SIRUTA ${c.siruta}` : ""} ·{" "}
                          {SOURCE_LABELS[c.source]}
                          {n ? ` · ${n} antreprenori` : ""}
                        </div>
                      </button>
                      {c.id === selectedId && (
                        <CommunityDetails community={c} />
                      )}
                      {c.id === selectedId && canEdit(access) && (
                        <div
                          className="li-actions"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button onClick={() => setEditing(c)}>
                            Editează detaliile
                          </button>
                          {c.geometry && (
                            <button
                              disabled={geometryBusy}
                              onClick={() => {
                                if (!leaveGeometryEditor()) return;
                                setDrawRequest(undefined);
                                setGeometryEditRequest({
                                  id: c.id,
                                  geometry: c.geometry!,
                                  nonce: nextNonce(),
                                });
                                setPanelOpen(false);
                                focusGeom(c.geometry);
                              }}
                            >
                              Editează geometria
                            </button>
                          )}
                          {(!c.geometry || c.geometry.type === "Point") && (
                            <button onClick={() => setCoordinateTarget(c)}>
                              Corectează GPS
                            </button>
                          )}
                          <button
                            onClick={() =>
                              store.update("communities", [
                                {
                                  id: c.id,
                                  status:
                                    c.status === "validat"
                                      ? "propus"
                                      : "validat",
                                },
                              ])
                            }
                          >
                            {c.status === "validat"
                              ? "Marchează propusă"
                              : "Validează"}
                          </button>
                          {isAdmin(access) && (
                            <button onClick={() => setPublicationTarget(c)}>
                              Revizuiește publicarea
                            </button>
                          )}
                          {isAdmin(access) && (
                            <button
                              className="danger"
                              onClick={() => removeCommunity(c)}
                            >
                              Arhivează
                            </button>
                          )}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>

              {!store.loading && !store.error && !db.communities.length && (
                <div className="empty">
                  <Icon name="map" size={36} />
                  <h3>
                    {canEdit(access)
                      ? "Harta începe cu o comunitate"
                      : "Nicio comunitate publicată"}
                  </h3>
                  <p>
                    {canEdit(access)
                      ? "Importă catalogul existent sau marchează prima comunitate direct pe hartă."
                      : "Comunitățile apar după verificare și aprobarea informațiilor pentru public."}
                  </p>
                  {canEdit(access) ? (
                    <button
                      className="primary"
                      onClick={() => setImportTarget("communities")}
                    >
                      <Icon name="upload" size={16} />
                      Importă catalogul
                    </button>
                  ) : (
                    <button onClick={() => setProposalOpen(true)}>
                      Trimite o propunere
                    </button>
                  )}
                  <span className="file-formats">
                    {canEdit(access)
                      ? "CSV, Excel sau GeoJSON"
                      : "Doar informațiile aprobate pentru public sunt vizibile fără autentificare."}
                  </span>
                </div>
              )}
              {!store.loading &&
                !!db.communities.length &&
                !communities.length && (
                  <div className="empty">
                    <Icon name="search" size={30} />
                    <h3>Nicio comunitate găsită</h3>
                    <p>Încearcă alt nume sau schimbă filtrul de status.</p>
                    <button
                      onClick={() => {
                        setQ("");
                        setStatusFilter("");
                        setCountryFilter("");
                        setUnlocatedOnly(false);
                        setHealthOnly(false);
                      }}
                    >
                      Resetează filtrele
                    </button>
                  </div>
                )}
            </>
          )}

          {tab === "entrepreneurs" && (
            <>
              {canEdit(access) && (
                <div className="btn-row">
                  <button
                    className="primary"
                    onClick={() => setImportTarget("entrepreneurs")}
                  >
                    Importă antreprenori
                  </button>
                  <button
                    onClick={relinkAll}
                    disabled={!db.entrepreneurs.length}
                  >
                    Recalculează comunitățile
                  </button>
                </div>
              )}
              <input
                aria-label="Caută antreprenori"
                placeholder="Caută nume, firmă sau localitate…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
              {!store.loading && !entrepreneurs.length && (
                <div className="empty">
                  <Icon name="briefcase" size={32} />
                  <h3>
                    {db.entrepreneurs.length
                      ? "Niciun rezultat"
                      : "Antreprenorii, pe aceeași hartă"}
                  </h3>
                  <p>
                    {db.entrepreneurs.length
                      ? "Încearcă un alt termen de căutare."
                      : "Importă lista pentru a vedea legăturile cu comunitățile."}
                  </p>
                </div>
              )}
              <ul className="list">
                {entrepreneurs.slice(0, LIST_LIMIT).map((e) => (
                  <li key={e.id}>
                    <button
                      className="record-select"
                      disabled={!validLatLng(e.lat, e.lng)}
                      onClick={() =>
                        validLatLng(e.lat, e.lng) && focusPoint(e.lat!, e.lng!)
                      }
                    >
                      <div className="li-main">
                        <b>{e.name}</b>
                        {e.business && (
                          <span className="muted">{e.business}</span>
                        )}
                      </div>
                      <div className="muted small">
                        {[e.sector, e.locality, e.county]
                          .filter(Boolean)
                          .join(" · ") || "—"}
                        {" · "}
                        {e.communityId
                          ? `comunitate: ${communityById.get(e.communityId)?.name ?? "?"}`
                          : "fără comunitate"}
                        {!validLatLng(e.lat, e.lng) && (
                          <span className="warn"> · fără coordonate</span>
                        )}
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
              {entrepreneurs.length > LIST_LIMIT && (
                <p className="muted small">
                  Se afișează primii {LIST_LIMIT} din {entrepreneurs.length}.
                </p>
              )}
            </>
          )}

          {tab === "clients" && (
            <>
              {canEdit(access) && (
                <button
                  className="primary"
                  onClick={() => setImportTarget("clients")}
                >
                  Importă listă de clienți ai unui partener
                </button>
              )}
              <h3>Parteneri</h3>
              {!partners.length && (
                <p className="muted">Niciun partener încă.</p>
              )}
              <ul className="list">
                {partners.map(([p, s]) => (
                  <li key={p}>
                    <div className="li-main">
                      <b>{p}</b>
                      <span className="muted">{s.n} clienți</span>
                    </div>
                    <div className="li-actions">
                      <button
                        onClick={() => {
                          setPartner(p);
                          setTab("overlap");
                        }}
                      >
                        Vezi suprapunerea
                      </button>
                      {isAdmin(access) && (
                        <button
                          className="danger"
                          onClick={async () => {
                            if (
                              !confirm(
                                `Ștergeți toți cei ${s.n} clienți ai partenerului „${p}”?`,
                              )
                            )
                              return;
                            await store.remove(
                              "clients",
                              db.clients
                                .filter((c) => c.partner === p)
                                .map((c) => c.id),
                            );
                          }}
                        >
                          Arhivează lista
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}

          {tab === "overlap" && overlap && (
            <>
              <div className="row">
                <label>
                  Nivel
                  <select
                    value={level}
                    onChange={(e) => setLevel(e.target.value as OverlapLevel)}
                  >
                    <option value="locality">Localitate (SIRUTA)</option>
                    <option value="county">Județ</option>
                    <option value="country">Țară</option>
                  </select>
                </label>
                <label>
                  Partener
                  <select
                    value={partner}
                    onChange={(e) => setPartner(e.target.value)}
                  >
                    <option value="">Toți partenerii</option>
                    {partners.map(([p]) => (
                      <option key={p}>{p}</option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="stats">
                <div>
                  <b>{overlap.summary.areasWithClientsAndCommunities}</b>
                  <span>
                    din {overlap.summary.areasWithClients} zone cu clienți au și
                    comunități
                  </span>
                </div>
                <div>
                  <b>{overlap.summary.clientsInCommunityAreas}</b>
                  <span>
                    din {overlap.summary.clientsTotal} clienți sunt în zone cu
                    comunități
                  </span>
                </div>
                <div>
                  <b>{overlap.summary.clientsInsideCommunityShapes}</b>
                  <span>clienți chiar în perimetrul unei comunități</span>
                </div>
                {overlap.summary.amountTotal > 0 &&
                  filteredDB.clients.every((c) => !!c.currency) &&
                  new Set(filteredDB.clients.map((c) => c.currency)).size ===
                    1 && (
                    <div>
                      <b>
                        {Math.round(
                          (100 * overlap.summary.amountInCommunityAreas) /
                            overlap.summary.amountTotal,
                        )}
                        %
                      </b>
                      <span>
                        din suma finanțată ajunge în zone cu comunități
                      </span>
                    </div>
                  )}
              </div>
              {overlap.summary.clientsWithoutLocation > 0 && (
                <p className="warn small">
                  {overlap.summary.clientsWithoutLocation} clienți nu au
                  localitate/județ și nu sunt incluși.
                </p>
              )}
              <div className="legend small">
                <span>
                  <i style={{ background: "#16a34a" }} /> clienți + comunități
                </span>
                <span>
                  <i style={{ background: "#ea580c" }} /> doar clienți
                </span>
                <span>
                  <i style={{ background: "#64748b" }} /> doar comunități
                </span>
              </div>
              {canExport(access) && (
                <div className="btn-row">
                  <button
                    onClick={() =>
                      exportCSV("suprapunere", overlapRows(overlap.rows))
                    }
                  >
                    Export CSV
                  </button>
                  <button
                    onClick={() =>
                      exportXLSX("suprapunere", overlapRows(overlap.rows))
                    }
                  >
                    Export Excel
                  </button>
                </div>
              )}
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Zonă</th>
                      <th title="Comunități">Com.</th>
                      <th title="Antreprenori">Antr.</th>
                      <th title="Clienți partener">Clienți</th>
                    </tr>
                  </thead>
                  <tbody>
                    {overlap.rows.slice(0, LIST_LIMIT).map((r) => (
                      <tr
                        key={r.key}
                        className={r.clients && r.communities ? "hit" : ""}
                        onClick={() =>
                          validLatLng(r.lat, r.lng) &&
                          setFocus({
                            lat: r.lat,
                            lng: r.lng,
                            zoom:
                              level === "locality"
                                ? 13
                                : level === "county"
                                  ? 9
                                  : 6,
                            nonce: nextNonce(),
                          })
                        }
                      >
                        <td>
                          {r.label}
                          {r.siruta && (
                            <span className="muted small"> · {r.siruta}</span>
                          )}
                        </td>
                        <td>{r.communities || ""}</td>
                        <td>{r.entrepreneurs || ""}</td>
                        <td>{r.clients || ""}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </aside>

      <main
        aria-label={module === "map" ? "Harta comunităților" : currentTab.label}
      >
        {tab === "dashboard" ? (
          <AnalyticsWorkspace
            db={db}
            filters={sharedFilters}
            onFiltersChange={updateSharedFilters}
            onExplore={(code) => {
              setQ("");
              setStatusFilter("");
              setHealthOnly(false);
              setUnlocatedOnly(false);
              setCountry(code);
              setModule("map");
              setTab("communities");
              setPanelOpen(true);
            }}
            onNetworkExplore={(kind, value) => {
              setQ("");
              setStatusFilter("");
              setUnlocatedOnly(false);
              setHealthOnly(false);
              if (kind === "entrepreneurs") setSector(value);
              else setPartner(value);
              setModule("map");
              setTab(kind);
              setPanelOpen(true);
            }}
            onSummary={
              access.role !== "public_viewer"
                ? () => setTab("summary")
                : undefined
            }
            loading={store.loading}
            error={store.error}
          />
        ) : tab === "data" ? (
          <DataWorkspace
            access={access}
            db={db}
            filters={sharedFilters}
            onFiltersChange={updateSharedFilters}
            onImport={setImportTarget}
            onManual={() => setManualTarget("communities")}
            onChanged={() => void refreshWorkspace()}
          />
        ) : tab === "administration" ? (
          <AdministrationWorkspace
            access={access}
            onChanged={() => void refreshWorkspace()}
            onExplore={(geometry) => {
              setPreviewGeometry(geometry);
              setModule("map");
              setTab("communities");
              focusGeom(geometry);
            }}
          />
        ) : tab === "summary" ? (
          <CountrySummaryView
            report={selectedSummary}
            canDownload={isAdmin(access)}
          />
        ) : (
          <>
            <div className="map-toolbar">
              <span>
                <Icon name="map" size={17} />
                Hartă ·{" "}
                {store.error
                  ? "—"
                  : groupBoundaryRecords(communities).length}{" "}
                forme
              </span>
              <div className="map-toolbar-actions">
                <button
                  aria-pressed={clusterPoints}
                  title="Grupează punctele apropiate"
                  onClick={() => setClusterPoints((v) => !v)}
                >
                  <Icon name="overlap" size={16} />
                  <span>Grupare</span>
                </button>
                <button
                  aria-pressed={hatched}
                  title="Hașurează contururile în culoarea statusului"
                  onClick={() => setHatched((v) => !v)}
                >
                  <Icon name="hatch" size={16} />
                  <span>Hașurare</span>
                </button>
                <button onClick={fitAll}>
                  <Icon name="fit" size={17} />
                  Vezi tot
                </button>
              </div>
            </div>
            {geometryEditRequest && (
              <div className="geometry-edit-toolbar">
                <b>Editare geometrie</b>
                <span>
                  Mută punctul sau vârfurile conturului. Salvarea este
                  explicită.
                </span>
                {geometryError && (
                  <p className="error" role="alert">
                    {geometryError}
                  </p>
                )}
                <div className="btn-row">
                  <button disabled={geometryBusy} onClick={leaveGeometryEditor}>
                    Anulează
                  </button>
                  <button
                    className="primary"
                    disabled={geometryBusy || !editedGeometry}
                    onClick={() => void saveEditedGeometry()}
                  >
                    {geometryBusy ? "Se salvează…" : "Salvează"}
                  </button>
                </div>
              </div>
            )}
            {submissionDrawing && (
              <div className="map-mode-notice" role="status">
                Desenează limita propusă · Esc pentru anulare
              </div>
            )}
            {previewGeometry && (
              <button
                className="clear-preview"
                onClick={() => setPreviewGeometry(undefined)}
              >
                Închide previzualizarea propunerii
              </button>
            )}
            <MapView
              clusterPoints={clusterPoints}
              hatched={hatched}
              editRequest={canEdit(access) ? geometryEditRequest : undefined}
              onGeometryChange={setEditedGeometry}
              canDraw={canEdit(access) || submissionDrawing}
              proposalMode={submissionDrawing}
              previewGeometry={previewGeometry}
              db={
                tab === "communities"
                  ? { ...filteredDB, communities }
                  : tab === "entrepreneurs"
                    ? { ...filteredDB, entrepreneurs }
                    : filteredDB
              }
              version={store.version}
              selectedId={selectedId}
              focus={focus}
              drawRequest={drawRequest}
              overlap={overlap?.rows}
              onCreateShape={onCreateShape}
              onSelectCommunity={onSelectCommunity}
            />
            <details className="map-key" aria-label="Legenda hărții">
              <summary>Legendă</summary>
              <div className="legend-items">
                <span className="boundary-legend-note">
                  Contur administrativ · linii lungi = zonă mai largă; scurte =
                  propusă
                </span>
                <span>
                  <i className="key-validated" />
                  Validate
                </span>
                <span>
                  <i className="key-proposed" />
                  Propuse
                </span>
                <span>
                  <i className="key-pending" />
                  De validat
                </span>
                <span>
                  <i className="key-below" />
                  Sub prag
                </span>
                <span>
                  <i className="key-mixed" />
                  Statusuri mixte
                </span>
                <span>
                  <i className="key-entrepreneur" />
                  Antreprenori
                </span>
                <span>
                  <i className="key-client" />
                  Clienți
                </span>
              </div>
            </details>
          </>
        )}
        {msg && (
          <div className="toast" role="status">
            {msg}
          </div>
        )}
      </main>

      {canEdit(access) && (draft || editing) && (
        <CommunityForm
          db={db}
          geometry={draft ?? undefined}
          existing={editing ?? undefined}
          onSave={saveCommunity}
          onCancel={() => {
            setDraft(null);
            setEditing(null);
          }}
        />
      )}
      {canEdit(access) && importTarget && (
        <ImportDialog
          key={importTarget}
          store={store}
          initialTarget={importTarget}
          onSummaryImported={async () => {
            await reloadSummaries();
            setSummaryId(undefined);
            setModule("analytics");
            setTab("summary");
          }}
          onClose={() => setImportTarget(null)}
        />
      )}
      {canEdit(access) && manualTarget && (
        <ManualEntryDialog
          key={manualTarget}
          store={store}
          initialTarget={manualTarget}
          onClose={() => setManualTarget(null)}
          onSaved={async (target) => {
            if (target === "summary") {
              await reloadSummaries();
              setSummaryId(undefined);
              setModule("analytics");
              setTab("summary");
            } else {
              setModule(target === "localities" ? "data" : "map");
              setTab(target === "localities" ? "data" : target);
              setQ("");
              setStatusFilter("");
              setCountryFilter("");
              setUnlocatedOnly(false);
              setHealthOnly(false);
            }
            flash("Înregistrare salvată în baza de date.");
          }}
        />
      )}
      {isAdmin(access) && publicationTarget && (
        <PublicationDialog
          community={publicationTarget}
          onClose={() => setPublicationTarget(undefined)}
          onSaved={() => void store.reload()}
        />
      )}
      {canEdit(access) && coordinateTarget && (
        <CoordinateDialog
          community={coordinateTarget}
          onClose={() => setCoordinateTarget(undefined)}
          onSave={(lat, lng, geocoding) =>
            persistGeometry(
              coordinateTarget.id,
              { type: "Point", coordinates: [lng, lat] },
              coordinateTarget.geometry,
              geocoding,
            )
          }
        />
      )}
      {authOpen && (
        <AuthDialog
          onClose={() => setAuthOpen(false)}
          onSuccess={() => window.location.reload()}
        />
      )}
      {proposalOpen && (
        <ProposalDialog
          initialValues={proposalDraft}
          geometry={proposalGeometry}
          onClose={() => setProposalOpen(false)}
          onDraw={(fields) => {
            setProposalDraft(fields);
            setProposalOpen(false);
            setSubmissionDrawing(true);
            setModule("map");
            setTab("communities");
            setPanelOpen(false);
            setDrawRequest({ shape: "Polygon", nonce: nextNonce() });
          }}
        />
      )}
    </div>
  );
}
