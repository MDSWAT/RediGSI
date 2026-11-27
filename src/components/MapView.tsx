"use client";
import PointClusterLayer from "./PointClusterLayer";
import GeometryEditLayer, {
  type GeometryEditRequest,
} from "./GeometryEditLayer";
import { useEffect, useMemo, useRef } from "react";
import {
  MapContainer,
  TileLayer,
  LayersControl,
  GeoJSON,
  CircleMarker,
  LayerGroup,
  Tooltip,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import type { Feature, FeatureCollection, Geometry } from "geojson";
import "leaflet/dist/leaflet.css";
import "@geoman-io/leaflet-geoman-free";
import "@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css";
import type { Community, DB } from "@/lib/types";
import {
  COUNTRY_LABELS,
  KIND_LABELS,
  SOURCE_LABELS,
  STATUS_LABELS,
} from "@/lib/types";
import type { OverlapRow } from "@/lib/overlap";
import { validLatLng } from "@/lib/geo";
import { groupBoundaryRecords, BOUNDARY_SCOPE_LABELS } from "@/lib/boundaries";
/** CARTO raster basemaps require a key since 2026; without one the Esri map stays the default. */
const CARTO_KEY = process.env.NEXT_PUBLIC_CARTO_BASEMAP_KEY ?? "";

export type DrawShape = "CircleMarker" | "Line" | "Polygon" | "Rectangle";
export type Focus = {
  bounds?: [[number, number], [number, number]];
  lat?: number;
  lng?: number;
  zoom?: number;
  nonce: number;
};

interface Props {
  canDraw?: boolean;
  clusterPoints?: boolean;
  /** Fill outlines with diagonal hatching in the status colour instead of a flat tint. */
  hatched?: boolean;
  editRequest?: GeometryEditRequest;
  onGeometryChange?: (geometry: Geometry) => void;
  proposalMode?: boolean;
  previewGeometry?: Geometry;
  db: DB;
  version: number;
  selectedId?: string;
  focus?: Focus;
  drawRequest?: { shape: DrawShape; nonce: number };
  overlap?: OverlapRow[];
  onCreateShape: (geometry: Geometry) => void;
  onSelectCommunity: (id: string) => void;
}

const esc = (s: unknown) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );

const COLORS = {
  validat: "#206457",
  propus: "#f07400",
  de_validat: "#755ca8",
  sub_prag: "#64748b",
  selected: "#193c34",
  mixed: "#9c9ca6",
  entrepreneur: "#397ca5",
  client: "#b85b43",
  both: "#16a34a",
  clientsOnly: "#ea580c",
  communitiesOnly: "#64748b",
};

function DrawControl({
  onCreate,
  request,
  proposalMode,
}: {
  onCreate: (g: Geometry) => void;
  request?: Props["drawRequest"];
  proposalMode?: boolean;
}) {
  const map = useMap();
  const cb = useRef(onCreate);
  useEffect(() => {
    cb.current = onCreate;
  }, [onCreate]);

  useEffect(() => {
    map.pm.addControls({
      position: "topleft",
      drawMarker: false,
      drawCircle: false,
      drawText: false,
      drawCircleMarker: true,
      drawPolyline: !proposalMode,
      drawPolygon: true,
      drawRectangle: true,
      editMode: false,
      dragMode: false,
      cutPolygon: false,
      removalMode: false,
      rotateMode: false,
    });
    try {
      map.pm.setLang("ro");
    } catch {
      /* language pack missing – keep English */
    }
    map.pm.setGlobalOptions({
      templineStyle: { color: COLORS.propus },
      hintlineStyle: { color: COLORS.propus, dashArray: "5,5" },
      pathOptions: { color: COLORS.propus },
    });

    const handler = (e: { layer: L.Layer }) => {
      const gj = (e.layer as L.Polyline).toGeoJSON() as Feature;
      map.removeLayer(e.layer);
      cb.current(gj.geometry);
    };
    map.on("pm:create", handler);
    return () => {
      map.off("pm:create", handler);
      map.pm.disableDraw();
      map.pm.removeControls();
    };
  }, [map, proposalMode]);

  useEffect(() => {
    if (request) map.pm.enableDraw(request.shape, { continueDrawing: false });
  }, [map, request]);

  return null;
}

function FocusControl({ focus }: { focus?: Focus }) {
  const map = useMap();
  useEffect(() => {
    if (!focus) return;
    if (focus.bounds)
      map.fitBounds(focus.bounds, {
        maxZoom: focus.zoom ?? 17,
        padding: [40, 40],
        animate: false,
      });
    else if (focus.lat !== undefined && focus.lng !== undefined)
      map.setView([focus.lat, focus.lng], focus.zoom ?? 15, { animate: false });
  }, [map, focus]);
  return null;
}

function DataExtent({ communities }: { communities: Community[] }) {
  const map = useMap();
  useEffect(() => {
    const features = communities
      .filter((c) => c.geometry)
      .map((c) => ({
        type: "Feature" as const,
        geometry: c.geometry!,
        properties: {},
      }));
    if (features.length)
      map.fitBounds(
        L.geoJSON({
          type: "FeatureCollection",
          features,
        } as FeatureCollection).getBounds(),
        { padding: [35, 35], maxZoom: 11, animate: false },
      );
  }, [map, communities]);
  return null;
}

const TOOLTIP_FIELDS = [
  "Pop. totala",
  "Romi recens.",
  "Romi alte surse",
  "Prag REDI",
  "Status REDI",
  "campanie REDI health",
  "Observatii / validare",
];
const row = (label: string, value: unknown) =>
  value === undefined || value === null || value === ""
    ? ""
    : `<div class="tt-row"><span>${esc(label)}</span><b>${esc(value)}</b></div>`;

/** Hover card: everything this viewer is allowed to see about the record(s) under the cursor. */
function communityTooltip(records: Community[], entrepreneurs: Map<string, number>) {
  const c = records[0];
  const place = [c.locality, c.county, COUNTRY_LABELS[c.country] ?? c.country]
    .filter((v, i, all) => v && all.indexOf(v) === i)
    .join(", ");
  const boundary = c.boundary
    ? `<div class="tt-note">${esc(BOUNDARY_SCOPE_LABELS[c.boundary.scope])}: ${esc(c.boundary.name)} · geoBoundaries ${esc(c.boundary.year)}. Limită administrativă, nu granița comunității.</div>`
    : "";
  if (records.length > 1)
    return `<div class="community-tt">
      <strong>${esc(c.boundary?.name ?? c.name)}</strong>
      <div class="tt-sub">${records.length} comunități în acest contur</div>
      <ul>${records
        .slice(0, 8)
        .map((r) => `<li><span class="tt-dot status-${esc(r.status)}"></span>${esc(r.name)} · ${esc(STATUS_LABELS[r.status])}${r.extra?.["Romi recens."] ? ` · ${esc(r.extra["Romi recens."])} romi` : ""}</li>`)
        .join("")}${records.length > 8 ? `<li>… și încă ${records.length - 8}</li>` : ""}</ul>
      ${boundary}
      <div class="tt-hint">Click pentru a alege o localitate.</div>
    </div>`;
  const extras = TOOLTIP_FIELDS.map((k) => row(k, c.extra?.[k])).join("");
  return `<div class="community-tt">
    <strong>${esc(c.name)}</strong>
    <div class="tt-sub"><span class="tt-dot status-${esc(c.status)}"></span>${esc(STATUS_LABELS[c.status])} · ${esc(KIND_LABELS[c.kind])}</div>
    ${place ? `<div class="tt-place">${esc(place)}</div>` : ""}
    ${row("Clasificare", c.classification)}
    ${row("SIRUTA", c.siruta)}
    ${row("Populație estimată", c.population)}
    ${extras}
    ${entrepreneurs.has(c.id) ? row("Antreprenori", entrepreneurs.get(c.id)) : ""}
    ${row("Sursă", SOURCE_LABELS[c.source])}
    ${c.extra?._sourceSheet ? row("Foaie sursă", `${c.extra._sourceSheet}${c.extra._sourceRow ? `, rând ${c.extra._sourceRow}` : ""}`) : ""}
    ${boundary}
  </div>`;
}

const HATCH_STATUSES = ["validat", "propus", "de_validat", "sub_prag", "selected", "mixed"] as const;
/** SVG patterns referenced as fill="url(#hatch-…)" by the outline layer (SVG renderer). */
function HatchPatterns() {
  return (
    <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true">
      <defs>
        {HATCH_STATUSES.map((status) => (
          <pattern
            key={status}
            id={`hatch-${status}`}
            width="8"
            height="8"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(45)"
          >
            <line x1="0" y1="0" x2="0" y2="8" stroke={COLORS[status]} strokeWidth="2.5" />
          </pattern>
        ))}
      </defs>
    </svg>
  );
}

function communityPopup(c: Community, entrepreneurs: number) {
  return `<div class="pop">
    <strong>${esc(c.name)}</strong>
    <div>${esc(KIND_LABELS[c.kind])} · ${esc(STATUS_LABELS[c.status])}</div>
    <div>${esc([c.locality, c.county, c.country].filter(Boolean).join(", "))}</div>
    ${c.siruta ? `<div>SIRUTA: ${esc(c.siruta)}</div>` : ""}
    ${c.population ? `<div>Populație estimată: ${esc(c.population)}</div>` : ""}
    <div>Antreprenori: ${entrepreneurs}</div>
    <div class="muted">Sursa: ${esc(SOURCE_LABELS[c.source])}</div>
    ${c.boundary ? `<div><b>${esc(BOUNDARY_SCOPE_LABELS[c.boundary.scope])}: ${esc(c.boundary.name)}</b></div><div class="muted">Limită administrativă · sursă ${esc(c.boundary.year)}. Nu reprezintă granița comunității Roma.</div>` : c.locationAccuracy ? '<div class="muted">Centre orientativ, nu limite ale comunității.</div>' : ""}
    ${[
      "Pop. totala",
      "Romi recens.",
      "Romi alte surse",
      "Prag REDI",
      "campanie REDI health",
    ]
      .filter((k) => c.extra?.[k])
      .map((k) => `<div>${esc(k)}: ${esc(c.extra![k])}</div>`)
      .join("")}
    <div class="muted">Toate detaliile sunt disponibile în panoul comunității.</div>
  </div>`;
}

export default function MapView(props: Props) {
  const { db, version, selectedId, overlap } = props;
  const hatched = props.hatched === true;
  const svgRenderer = useMemo(() => L.svg({ padding: 0.5 }), []);
  const rendererOptions: Pick<L.PathOptions, "renderer"> = hatched
    ? { renderer: svgRenderer }
    : {};
  const restFill = (region: boolean) =>
    hatched ? (region ? 0.35 : 0.6) : region ? 0.07 : 0.16;
  const onSelect = useRef(props.onSelectCommunity);
  useEffect(() => {
    onSelect.current = props.onSelectCommunity;
  }, [props.onSelectCommunity]);

  const entrepreneurCount = useMemo(() => {
    const m = new Map<string, number>();
    db.entrepreneurs.forEach(
      (e) =>
        e.communityId && m.set(e.communityId, (m.get(e.communityId) ?? 0) + 1),
    );
    return m;
  }, [db.entrepreneurs]);

  const communityFC = useMemo<FeatureCollection>(
    () => ({
      type: "FeatureCollection",
      features: groupBoundaryRecords(
        db.communities.filter((c) => c.geometry?.type !== "Point"),
      ).map((group) => ({
        type: "Feature",
        id: group[0].boundary?.id ?? group[0].id,
        geometry: group[0].geometry!,
        properties: { ids: group.map((c) => c.id) },
      })),
    }),
    [db.communities],
  );
  const byId = useMemo(
    () => new Map(db.communities.map((c) => [c.id, c])),
    [db.communities],
  );
  const communityName = (id?: string) => (id ? byId.get(id)?.name : undefined);

  const communityPoints = useMemo(
    () =>
      db.communities
        .filter((c) => c.geometry?.type === "Point")
        .map((c) => ({
          ...c,
          lat: (c.geometry as GeoJSON.Point).coordinates[1],
          lng: (c.geometry as GeoJSON.Point).coordinates[0],
        })),
    [db.communities],
  );
  const businessPoints = useMemo(
    () =>
      db.entrepreneurs
        .filter((e) => validLatLng(e.lat, e.lng))
        .map((e) => ({ ...e, lat: e.lat!, lng: e.lng! })),
    [db.entrepreneurs],
  );
  const clientPoints = useMemo(
    () =>
      db.clients
        .filter((c) => validLatLng(c.lat, c.lng))
        .map((c) => ({ ...c, lat: c.lat!, lng: c.lng! })),
    [db.clients],
  );
  const maxClients = Math.max(1, ...(overlap ?? []).map((r) => r.clients));

  return (
    <MapContainer
      center={[45.9432, 24.9668]}
      zoom={7}
      preferCanvas
      className="map"
      zoomControl
      maxZoom={19}
    >
      <HatchPatterns />
      <LayersControl position="topright">
        {CARTO_KEY && (
          <LayersControl.BaseLayer checked name="Hartă rutieră (CARTO Voyager)">
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
              url={`https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png?key=${encodeURIComponent(CARTO_KEY)}`}
              maxZoom={20}
            />
          </LayersControl.BaseLayer>
        )}
        <LayersControl.BaseLayer
          checked={!CARTO_KEY}
          name="Hartă deschisă (Esri)"
        >
          <LayerGroup>
            <TileLayer
              attribution="Tiles &copy; Esri &mdash; Esri, HERE, Garmin, OpenStreetMap contributors"
              url="https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}"
              maxNativeZoom={16}
              maxZoom={19}
            />
            <TileLayer
              url="https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Reference/MapServer/tile/{z}/{y}/{x}"
              maxNativeZoom={16}
              maxZoom={19}
            />
          </LayerGroup>
        </LayersControl.BaseLayer>
        <LayersControl.BaseLayer name="Hartă (OpenStreetMap)">
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            maxZoom={19}
          />
        </LayersControl.BaseLayer>
        <LayersControl.BaseLayer name="Satelit (Esri)">
          <TileLayer
            attribution="Tiles &copy; Esri"
            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
            maxZoom={19}
          />
        </LayersControl.BaseLayer>

        <LayersControl.Overlay checked name="Comunități">
          <LayerGroup>
            <PointClusterLayer
              points={communityPoints}
              enabled={props.clusterPoints !== false}
              color={COLORS.validat}
              radius={8}
              pointColor={(p) =>
                p.id === selectedId ? COLORS.selected : COLORS[p.status]
              }
              label={(p) => p.name}
              onSelect={(p) => onSelect.current(p.id)}
              popup={(p) => (
                <div
                  dangerouslySetInnerHTML={{
                    __html: communityPopup(p, entrepreneurCount.get(p.id) ?? 0),
                  }}
                />
              )}
            />
            <GeoJSON
              key={`c-${version}-${selectedId ?? ""}-${hatched ? "h" : "f"}-${db.communities.map((c) => c.id).join(",")}`}
              data={communityFC}
              // Hatch patterns need SVG; Leaflet passes GeoJSON options on to each polygon.
              {...rendererOptions}
              attribution='Contururi: <a href="https://www.geoboundaries.org/">geoBoundaries</a> · Localizări: <a href="https://www.geonames.org/">GeoNames CC BY 4.0</a>'
              style={(f) => {
                const records = (f?.properties?.ids ?? [])
                  .map((id: string) => byId.get(id))
                  .filter(Boolean) as Community[];
                const c =
                  records.find((c) => c.id === selectedId) ?? records[0];
                const sel = records.some((c) => c.id === selectedId);
                const mixed = new Set(records.map((c) => c.status)).size > 1;
                const tone = sel
                  ? "selected"
                  : mixed
                    ? "mixed"
                    : (c?.status ?? "validat");
                return {
                  color: COLORS[tone],
                  fillColor: hatched ? `url(#hatch-${tone})` : COLORS[tone],
                  weight: sel ? 3.5 : 1.5,
                  opacity: 0.95,
                  fillOpacity: sel
                    ? hatched
                      ? 0.9
                      : 0.28
                    : restFill(c?.boundary?.scope === "region"),
                  dashArray:
                    c?.boundary && c.boundary.scope !== "locality"
                      ? "12 6"
                      : c?.status === "propus"
                        ? "4 4"
                        : undefined,
                };
              }}
              pointToLayer={(f, latlng) => {
                const c = byId.get(f.properties?.ids?.[0]);
                const sel = c?.id === selectedId;
                return L.circleMarker(latlng, {
                  radius: sel ? 11 : 8,
                  weight: 2,
                  color: "#fff",
                  fillColor: sel
                    ? COLORS.selected
                    : COLORS[c?.status ?? "validat"],
                  fillOpacity: 0.9,
                });
              }}
              onEachFeature={(f, layer) => {
                const records = (f.properties?.ids ?? [])
                  .map((id: string) => byId.get(id))
                  .filter(Boolean) as Community[];
                const c = records[0];
                if (!c) return;
                const label = c.boundary?.name ?? c.name;
                layer.bindTooltip(communityTooltip(records, entrepreneurCount), {
                  sticky: true,
                  direction: "top",
                  offset: [0, -12],
                  opacity: 1,
                  className: "community-tooltip",
                });
                // Highlight the outline under the cursor; the selected one keeps its own style.
                if (
                  layer instanceof L.Path &&
                  !records.some((r) => r.id === selectedId)
                ) {
                  const rest = {
                    weight: 1.5,
                    fillOpacity: restFill(c.boundary?.scope === "region"),
                  };
                  layer.on("mouseover", () =>
                    layer.setStyle({ weight: 3, fillOpacity: hatched ? 0.9 : 0.3 }),
                  );
                  layer.on("mouseout", () => layer.setStyle(rest));
                }
                if (records.length === 1) {
                  layer.bindPopup(
                    communityPopup(c, entrepreneurCount.get(c.id) ?? 0),
                  );
                  layer.on("click", () => onSelect.current(c.id));
                } else {
                  const content = document.createElement("div");
                  content.className = "boundary-popup";
                  content.innerHTML = `<strong>${esc(label)}</strong>${c.boundary ? `<div>${esc(BOUNDARY_SCOPE_LABELS[c.boundary.scope])} · sursă ${esc(c.boundary.year)}</div><p>Nu reprezintă granița comunităților Roma.</p>` : ""}<p>Contur administrativ comun · ${records.length} înregistrări. Selectează o localitate pentru toate datele.</p><div class="boundary-choices">${records.map((r) => `<button type="button" data-community-id="${esc(r.id)}">${esc(r.name)}<span>${esc(STATUS_LABELS[r.status])}${r.extra?._sourceRow ? ` · rând ${esc(r.extra._sourceRow)}` : ""}</span></button>`).join("")}</div>`;
                  content.addEventListener("click", (event) => {
                    const button = (
                      event.target as HTMLElement
                    ).closest<HTMLButtonElement>("button[data-community-id]");
                    if (button?.dataset.communityId) {
                      event.stopPropagation();
                      onSelect.current(button.dataset.communityId);
                    }
                  });
                  layer.bindPopup(content, { maxWidth: 340 });
                }
              }}
            />
          </LayerGroup>
        </LayersControl.Overlay>

        <LayersControl.Overlay checked name="Antreprenori">
          <LayerGroup>
            <PointClusterLayer
              points={businessPoints}
              enabled={props.clusterPoints !== false}
              color={COLORS.entrepreneur}
              radius={6}
              label={(e) => e.business ?? e.name}
              popup={(e) => (
                <div className="pop">
                  <strong>{e.name}</strong>
                  {e.business && <div>{e.business}</div>}
                  {e.sector && <div>Domeniu: {e.sector}</div>}
                  {e.address && <div>{e.address}</div>}
                  <div>
                    {[e.locality, e.county, e.country]
                      .filter(Boolean)
                      .join(", ")}
                  </div>
                  {e.phone && <div>Tel: {e.phone}</div>}
                  {e.email && <div>{e.email}</div>}
                  <div className="muted">
                    Comunitate: {communityName(e.communityId) ?? "—"}
                  </div>
                  {e.extra &&
                    Object.entries(e.extra)
                      .slice(0, 8)
                      .map(([k, v]) => (
                        <div key={k} className="muted">
                          {k}: {v}
                        </div>
                      ))}
                </div>
              )}
            />
          </LayerGroup>
        </LayersControl.Overlay>

        <LayersControl.Overlay checked name="Clienți parteneri">
          <LayerGroup>
            <PointClusterLayer
              points={clientPoints}
              enabled={props.clusterPoints !== false}
              color={COLORS.client}
              radius={4}
              label={(c) => c.name}
              popup={(c) => (
                <div className="pop">
                  <strong>{c.name}</strong>
                  <div>Partener: {c.partner}</div>
                  {c.amount !== undefined && (
                    <div>Sumă: {c.amount.toLocaleString("ro-RO")}</div>
                  )}
                  {c.year && <div>An: {c.year}</div>}
                  <div>
                    {[c.locality, c.county, c.country]
                      .filter(Boolean)
                      .join(", ")}
                  </div>
                </div>
              )}
            />
          </LayerGroup>
        </LayersControl.Overlay>

        {overlap && (
          <LayersControl.Overlay checked name="Suprapunere (pe zone)">
            <LayerGroup>
              {overlap
                .filter(
                  (r) =>
                    validLatLng(r.lat, r.lng) &&
                    (r.clients > 0 || r.communities > 0),
                )
                .map((r) => {
                  const both = r.clients > 0 && r.communities > 0;
                  const color = both
                    ? COLORS.both
                    : r.clients > 0
                      ? COLORS.clientsOnly
                      : COLORS.communitiesOnly;
                  return (
                    <CircleMarker
                      key={r.key}
                      center={[r.lat!, r.lng!]}
                      radius={8 + 22 * Math.sqrt(r.clients / maxClients)}
                      pathOptions={{
                        color,
                        weight: 2,
                        fillColor: color,
                        fillOpacity: 0.3,
                      }}
                    >
                      <Tooltip>
                        {r.label}: {r.communities} comunități · {r.clients}{" "}
                        clienți
                      </Tooltip>
                    </CircleMarker>
                  );
                })}
            </LayerGroup>
          </LayersControl.Overlay>
        )}
      </LayersControl>

      {props.editRequest && props.onGeometryChange && (
        <GeometryEditLayer
          request={props.editRequest}
          onChange={props.onGeometryChange}
        />
      )}
      {props.previewGeometry && (
        <GeoJSON
          key={JSON.stringify(props.previewGeometry)}
          data={
            {
              type: "Feature",
              properties: {},
              geometry: props.previewGeometry,
            } as Feature
          }
          style={{
            color: "#755ca8",
            weight: 3,
            dashArray: "6 4",
            fillOpacity: 0.12,
          }}
        />
      )}
      {props.canDraw && !props.editRequest && (
        <DrawControl
          onCreate={props.onCreateShape}
          request={props.drawRequest}
          proposalMode={props.proposalMode}
        />
      )}
      <DataExtent communities={db.communities} />
      <FocusControl focus={props.focus} />
    </MapContainer>
  );
}
