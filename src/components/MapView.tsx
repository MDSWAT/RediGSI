"use client";
import { useEffect, useMemo, useRef } from "react";
import { MapContainer, TileLayer, LayersControl, GeoJSON, CircleMarker, Popup, LayerGroup, Tooltip, useMap } from "react-leaflet";
import L from "leaflet";
import type { Feature, FeatureCollection, Geometry } from "geojson";
import "leaflet/dist/leaflet.css";
import "@geoman-io/leaflet-geoman-free";
import "@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css";
import type { Community, DB } from "@/lib/types";
import { KIND_LABELS, SOURCE_LABELS, STATUS_LABELS } from "@/lib/types";
import type { OverlapRow } from "@/lib/overlap";
import { validLatLng } from "@/lib/geo";
import { groupBoundaryRecords, BOUNDARY_SCOPE_LABELS } from "@/lib/boundaries";

export type DrawShape = "CircleMarker" | "Line" | "Polygon" | "Rectangle";
export type Focus = { bounds?: [[number, number], [number, number]]; lat?: number; lng?: number; zoom?: number; nonce: number };

interface Props {
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
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

const COLORS = {
  validat: "#206457",
  propus: "#b07821",
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

function DrawControl({ onCreate, request }: { onCreate: (g: Geometry) => void; request?: Props["drawRequest"] }) {
  const map = useMap();
  const cb = useRef(onCreate);
  useEffect(() => { cb.current = onCreate; }, [onCreate]);

  useEffect(() => {
    map.pm.addControls({
      position: "topleft",
      drawMarker: false, drawCircle: false, drawText: false,
      drawCircleMarker: true, drawPolyline: true, drawPolygon: true, drawRectangle: true,
      editMode: false, dragMode: false, cutPolygon: false, removalMode: false, rotateMode: false,
    });
    try { map.pm.setLang("ro"); } catch { /* language pack missing – keep English */ }
    map.pm.setGlobalOptions({ templineStyle: { color: COLORS.propus }, hintlineStyle: { color: COLORS.propus, dashArray: "5,5" }, pathOptions: { color: COLORS.propus } });

    const handler = (e: { layer: L.Layer }) => {
      const gj = (e.layer as L.Polyline).toGeoJSON() as Feature;
      map.removeLayer(e.layer);
      cb.current(gj.geometry);
    };
    map.on("pm:create", handler);
    return () => {
      map.off("pm:create", handler);
      map.pm.removeControls();
    };
  }, [map]);

  useEffect(() => {
    if (request) map.pm.enableDraw(request.shape, { continueDrawing: false });
  }, [map, request]);

  return null;
}

function FocusControl({ focus }: { focus?: Focus }) {
  const map = useMap();
  useEffect(() => {
    if (!focus) return;
    if (focus.bounds) map.fitBounds(focus.bounds, { maxZoom: focus.zoom ?? 17, padding: [40, 40], animate: false });
    else if (focus.lat !== undefined && focus.lng !== undefined) map.setView([focus.lat, focus.lng], focus.zoom ?? 15, { animate: false });
  }, [map, focus]);
  return null;
}

function DataExtent({ communities }: { communities: Community[] }) {
  const map = useMap();
  useEffect(() => {
    const features = communities.filter((c) => c.geometry).map((c) => ({ type: "Feature" as const, geometry: c.geometry!, properties: {} }));
    if (features.length) map.fitBounds(L.geoJSON({ type: "FeatureCollection", features } as FeatureCollection).getBounds(), { padding: [35, 35], maxZoom: 11, animate: false });
  }, [map, communities]);
  return null;
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
    ${["Pop. totala", "Romi recens.", "Romi alte surse", "Prag REDI", "campanie REDI health"].filter((k) => c.extra?.[k]).map((k) => `<div>${esc(k)}: ${esc(c.extra![k])}</div>`).join("")}
    <div class="muted">Toate detaliile sunt disponibile în panoul comunității.</div>
  </div>`;
}

export default function MapView(props: Props) {
  const { db, version, selectedId, overlap } = props;
  const onSelect = useRef(props.onSelectCommunity);
  useEffect(() => { onSelect.current = props.onSelectCommunity; }, [props.onSelectCommunity]);

  const entrepreneurCount = useMemo(() => {
    const m = new Map<string, number>();
    db.entrepreneurs.forEach((e) => e.communityId && m.set(e.communityId, (m.get(e.communityId) ?? 0) + 1));
    return m;
  }, [db.entrepreneurs]);

  const communityFC = useMemo<FeatureCollection>(() => ({
    type: "FeatureCollection",
    features: groupBoundaryRecords(db.communities).map((group) => ({ type: "Feature", id: group[0].boundary?.id ?? group[0].id, geometry: group[0].geometry!, properties: { ids: group.map(c => c.id) } })),
  }), [db.communities]);
  const byId = useMemo(() => new Map(db.communities.map((c) => [c.id, c])), [db.communities]);
  const communityName = (id?: string) => (id ? byId.get(id)?.name : undefined);

  const maxClients = Math.max(1, ...(overlap ?? []).map((r) => r.clients));

  return (
    <MapContainer center={[45.9432, 24.9668]} zoom={7} preferCanvas className="map" zoomControl>
      <LayersControl position="topright">
        <LayersControl.BaseLayer checked name="Hartă (OpenStreetMap)">
          <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" maxZoom={19} />
        </LayersControl.BaseLayer>
        <LayersControl.BaseLayer name="Satelit (Esri)">
          <TileLayer attribution="Tiles &copy; Esri" url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" maxZoom={19} />
        </LayersControl.BaseLayer>

        <LayersControl.Overlay checked name="Comunități">
          <GeoJSON
            key={`c-${version}-${selectedId ?? ""}-${db.communities.map((c) => c.id).join(",")}`}
            data={communityFC}
            attribution='Contururi: <a href="https://www.geoboundaries.org/">geoBoundaries</a> · Localizări: <a href="https://www.geonames.org/">GeoNames CC BY 4.0</a>'
            style={(f) => {
              const records = (f?.properties?.ids ?? []).map((id: string) => byId.get(id)).filter(Boolean) as Community[];
              const c = records.find(c => c.id === selectedId) ?? records[0];
              const sel = records.some(c => c.id === selectedId);
              const mixed = new Set(records.map(c => c.status)).size > 1;
              const color = sel ? COLORS.selected : mixed ? COLORS.mixed : COLORS[c?.status ?? "validat"];
              return { color, weight: sel ? 3.5 : 1.5, opacity: 0.95, fillOpacity: sel ? 0.28 : c?.boundary?.scope === "region" ? 0.07 : 0.16, dashArray: c?.boundary && c.boundary.scope !== "locality" ? "12 6" : c?.status === "propus" ? "4 4" : undefined };
            }}
            pointToLayer={(f, latlng) => {
              const c = byId.get(f.properties?.ids?.[0]);
              const sel = c?.id === selectedId;
              return L.circleMarker(latlng, {
                radius: sel ? 11 : 8, weight: 2, color: "#fff",
                fillColor: sel ? COLORS.selected : COLORS[c?.status ?? "validat"], fillOpacity: 0.9,
              });
            }}
            onEachFeature={(f, layer) => {
              const records = (f.properties?.ids ?? []).map((id: string) => byId.get(id)).filter(Boolean) as Community[];
              const c = records[0];
              if (!c) return;
              const label = c.boundary?.name ?? c.name;
              layer.bindTooltip(esc(`${label}${records.length > 1 ? ` · ${records.length} înregistrări` : ""}`), { sticky: true });
              if (records.length === 1) {
                layer.bindPopup(communityPopup(c, entrepreneurCount.get(c.id) ?? 0));
                layer.on("click", () => onSelect.current(c.id));
              } else {
                const content = document.createElement("div");
                content.className = "boundary-popup";
                content.innerHTML = `<strong>${esc(label)}</strong>${c.boundary ? `<div>${esc(BOUNDARY_SCOPE_LABELS[c.boundary.scope])} · sursă ${esc(c.boundary.year)}</div><p>Nu reprezintă granița comunităților Roma.</p>` : ""}<p>Contur administrativ comun · ${records.length} înregistrări. Selectează o localitate pentru toate datele.</p><div class="boundary-choices">${records.map(r => `<button type="button" data-community-id="${esc(r.id)}">${esc(r.name)}<span>${esc(STATUS_LABELS[r.status])}${r.extra?._sourceRow ? ` · rând ${esc(r.extra._sourceRow)}` : ""}</span></button>`).join("")}</div>`;
                content.addEventListener("click", event => {
                  const button = (event.target as HTMLElement).closest<HTMLButtonElement>("button[data-community-id]");
                  if (button?.dataset.communityId) { event.stopPropagation(); onSelect.current(button.dataset.communityId); }
                });
                layer.bindPopup(content, { maxWidth: 340 });
              }
            }}
          />
        </LayersControl.Overlay>

        <LayersControl.Overlay checked name="Antreprenori">
          <LayerGroup>
            {db.entrepreneurs.filter((e) => validLatLng(e.lat, e.lng)).map((e) => (
              <CircleMarker key={e.id} center={[e.lat!, e.lng!]} radius={6} pathOptions={{ color: "#fff", weight: 1.5, fillColor: COLORS.entrepreneur, fillOpacity: 0.95 }}>
                <Popup>
                  <div className="pop">
                    <strong>{e.name}</strong>
                    {e.business && <div>{e.business}</div>}
                    {e.sector && <div>Domeniu: {e.sector}</div>}
                    {e.address && <div>{e.address}</div>}
                    <div>{[e.locality, e.county, e.country].filter(Boolean).join(", ")}</div>
                    {e.phone && <div>Tel: {e.phone}</div>}
                    {e.email && <div>{e.email}</div>}
                    <div className="muted">Comunitate: {communityName(e.communityId) ?? "—"}</div>
                    {e.extra && Object.entries(e.extra).slice(0, 8).map(([k, v]) => <div key={k} className="muted">{k}: {v}</div>)}
                  </div>
                </Popup>
              </CircleMarker>
            ))}
          </LayerGroup>
        </LayersControl.Overlay>

        <LayersControl.Overlay checked name="Clienți parteneri">
          <LayerGroup>
            {db.clients.filter((c) => validLatLng(c.lat, c.lng)).map((c) => (
              <CircleMarker key={c.id} center={[c.lat!, c.lng!]} radius={4} pathOptions={{ color: COLORS.client, weight: 1, fillColor: COLORS.client, fillOpacity: 0.6 }}>
                <Popup>
                  <div className="pop">
                    <strong>{c.name}</strong>
                    <div>Partener: {c.partner}</div>
                    {c.amount !== undefined && <div>Sumă: {c.amount.toLocaleString("ro-RO")}</div>}
                    {c.year && <div>An: {c.year}</div>}
                    <div>{[c.locality, c.county, c.country].filter(Boolean).join(", ")}</div>
                  </div>
                </Popup>
              </CircleMarker>
            ))}
          </LayerGroup>
        </LayersControl.Overlay>

        {overlap && (
          <LayersControl.Overlay checked name="Suprapunere (pe zone)">
            <LayerGroup>
              {overlap.filter((r) => validLatLng(r.lat, r.lng) && (r.clients > 0 || r.communities > 0)).map((r) => {
                const both = r.clients > 0 && r.communities > 0;
                const color = both ? COLORS.both : r.clients > 0 ? COLORS.clientsOnly : COLORS.communitiesOnly;
                return (
                  <CircleMarker key={r.key} center={[r.lat!, r.lng!]} radius={8 + 22 * Math.sqrt(r.clients / maxClients)}
                    pathOptions={{ color, weight: 2, fillColor: color, fillOpacity: 0.3 }}>
                    <Tooltip>{r.label}: {r.communities} comunități · {r.clients} clienți</Tooltip>
                  </CircleMarker>
                );
              })}
            </LayerGroup>
          </LayersControl.Overlay>
        )}
      </LayersControl>

      <DrawControl onCreate={props.onCreateShape} request={props.drawRequest} />
      <DataExtent communities={db.communities} />
      <FocusControl focus={props.focus} />
    </MapContainer>
  );
}
