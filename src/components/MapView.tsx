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
  validat: "#1d4ed8",
  propus: "#9333ea",
  selected: "#f59e0b",
  entrepreneur: "#059669",
  client: "#ea580c",
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
    if (focus.bounds) map.fitBounds(focus.bounds, { maxZoom: 17, padding: [40, 40] });
    else if (focus.lat !== undefined && focus.lng !== undefined) map.setView([focus.lat, focus.lng], focus.zoom ?? 15);
  }, [map, focus]);
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
    ${c.notes ? `<div class="muted">${esc(c.notes)}</div>` : ""}
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
    features: db.communities.map((c) => ({ type: "Feature", id: c.id, geometry: c.geometry, properties: { id: c.id } })),
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
            key={`c-${version}-${selectedId ?? ""}`}
            data={communityFC}
            style={(f) => {
              const c = byId.get(f?.properties?.id);
              const sel = c?.id === selectedId;
              const color = sel ? COLORS.selected : c?.status === "propus" ? COLORS.propus : COLORS.validat;
              return { color, weight: sel ? 6 : 4, opacity: 0.9, fillOpacity: 0.2, dashArray: c?.status === "propus" ? "6 5" : undefined };
            }}
            pointToLayer={(f, latlng) => {
              const c = byId.get(f.properties?.id);
              const sel = c?.id === selectedId;
              return L.circleMarker(latlng, {
                radius: sel ? 11 : 8, weight: 2, color: "#fff",
                fillColor: sel ? COLORS.selected : c?.status === "propus" ? COLORS.propus : COLORS.validat, fillOpacity: 0.9,
              });
            }}
            onEachFeature={(f, layer) => {
              const c = byId.get(f.properties?.id);
              if (!c) return;
              layer.bindPopup(communityPopup(c, entrepreneurCount.get(c.id) ?? 0));
              layer.bindTooltip(esc(c.name), { sticky: true });
              layer.on("click", () => onSelect.current(c.id));
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
      <FocusControl focus={props.focus} />
    </MapContainer>
  );
}
