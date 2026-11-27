"use client";
import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  CircleMarker,
  Popup,
  Tooltip,
  useMap,
  useMapEvents,
} from "react-leaflet";
import type { ClusterProperties } from "supercluster";
import { createPointIndex, type ClusterPoint } from "@/lib/mapClusters";
interface Props<T extends ClusterPoint> {
  points: T[];
  enabled: boolean;
  color: string;
  radius?: number;
  pointColor?: (point: T) => string;
  label: (point: T) => string;
  popup: (point: T) => ReactNode;
  onSelect?: (point: T) => void;
}
function ClusterMembers<T extends ClusterPoint>({
  points,
  label,
  popup,
  onSelect,
}: {
  points: T[];
  label: (p: T) => string;
  popup: (p: T) => ReactNode;
  onSelect?: (p: T) => void;
}) {
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<T>();
  const limit = 20;
  return (
    <div className="cluster-members">
      {selected ? (
        <>
          <button onClick={() => setSelected(undefined)}>Înapoi la grup</button>
          {popup(selected)}
        </>
      ) : (
        <>
          <b>{points.length} înregistrări în grup</b>
          {points.slice(page * limit, (page + 1) * limit).map((p) => (
            <button
              key={p.id}
              onClick={() => {
                setSelected(p);
                onSelect?.(p);
              }}
            >
              {label(p)}
            </button>
          ))}
          {points.length > limit && (
            <div className="btn-row">
              <button disabled={!page} onClick={() => setPage((p) => p - 1)}>
                Înapoi
              </button>
              <span>
                {page + 1} / {Math.ceil(points.length / limit)}
              </span>
              <button
                disabled={(page + 1) * limit >= points.length}
                onClick={() => setPage((p) => p + 1)}
              >
                Înainte
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
export default function PointClusterLayer<T extends ClusterPoint>({
  points,
  enabled,
  color,
  radius = 5,
  pointColor,
  label,
  popup,
  onSelect,
}: Props<T>) {
  const map = useMap();
  const index = useMemo(() => createPointIndex(points), [points]);
  const [viewport, setViewport] = useState(() => ({
    zoom: map.getZoom(),
    bounds: map.getBounds(),
  }));
  useMapEvents({
    moveend: () =>
      setViewport({ zoom: map.getZoom(), bounds: map.getBounds() }),
    zoomend: () =>
      setViewport({ zoom: map.getZoom(), bounds: map.getBounds() }),
  });
  const byId = useMemo(() => new Map(points.map((p) => [p.id, p])), [points]);
  const nodes = enabled
    ? index.getClusters(
        [
          viewport.bounds.getWest(),
          viewport.bounds.getSouth(),
          viewport.bounds.getEast(),
          viewport.bounds.getNorth(),
        ],
        Math.floor(viewport.zoom),
      )
    : points.map((p) => ({
        type: "Feature" as const,
        geometry: { type: "Point" as const, coordinates: [p.lng, p.lat] },
        properties: { id: p.id },
      }));
  return (
    <>
      {nodes.map((node) => {
        const properties = node.properties;
        if ("cluster" in properties && properties.cluster) {
          const c = properties as ClusterProperties;
          const leaves = index
            .getLeaves(c.cluster_id, Infinity)
            .map((p) => byId.get(p.properties.id))
            .filter((p): p is T => !!p);
          return (
            <CircleMarker
              key={`cluster-${c.cluster_id}`}
              center={[
                node.geometry.coordinates[1],
                node.geometry.coordinates[0],
              ]}
              radius={Math.min(24, 14 + Math.log2(c.point_count) * 1.3)}
              pathOptions={{
                color: "#fff",
                weight: 2,
                fillColor: color,
                fillOpacity: 0.92,
              }}
              eventHandlers={{
                click: () => {
                  const zoom = Math.min(
                    map.getMaxZoom() ?? 19,
                    index.getClusterExpansionZoom(c.cluster_id),
                    19,
                  );
                  if (zoom > map.getZoom())
                    map.setView(
                      [
                        node.geometry.coordinates[1],
                        node.geometry.coordinates[0],
                      ],
                      zoom,
                    );
                },
              }}
            >
              <Tooltip
                permanent
                direction="center"
                className="cluster-count"
                opacity={1}
              >
                {c.point_count_abbreviated}
              </Tooltip>
              <Popup>
                <ClusterMembers
                  points={leaves}
                  label={label}
                  popup={popup}
                  onSelect={onSelect}
                />
              </Popup>
            </CircleMarker>
          );
        }
        const p = byId.get((properties as { id: string }).id);
        if (!p) return null;
        return (
          <CircleMarker
            key={p.id}
            center={[p.lat, p.lng]}
            radius={radius}
            pathOptions={{
              color: "#fff",
              weight: 1.5,
              fillColor: pointColor?.(p) ?? color,
              fillOpacity: 0.9,
            }}
            eventHandlers={{ click: () => onSelect?.(p) }}
          >
            <Popup>{popup(p)}</Popup>
          </CircleMarker>
        );
      })}
    </>
  );
}
