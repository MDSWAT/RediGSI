import Supercluster from "supercluster";
import type { Feature, Point } from "geojson";
export interface ClusterPoint {
  id: string;
  lat: number;
  lng: number;
}
export function createPointIndex(points: ClusterPoint[]) {
  const features: Feature<Point, { id: string }>[] = points
    .filter(
      (p) =>
        Number.isFinite(p.lat) &&
        Number.isFinite(p.lng) &&
        Math.abs(p.lat) <= 90 &&
        Math.abs(p.lng) <= 180,
    )
    .map((p) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [p.lng, p.lat] },
      properties: { id: p.id },
    }));
  return new Supercluster<{ id: string }>({
    radius: 48,
    maxZoom: 19,
    minPoints: 2,
  }).load(features);
}
