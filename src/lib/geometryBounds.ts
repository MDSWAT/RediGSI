import type { Geometry } from "geojson";

export type GeometryBounds = [[number, number], [number, number]];
// Workspace geometries are immutable; repeated framing/grouping reuses their extents.
const boundsCache = new WeakMap<Geometry, GeometryBounds | null>();

export function geometryBounds(geometry: Geometry): GeometryBounds | null {
  if (boundsCache.has(geometry)) return boundsCache.get(geometry)!;
  let south = Infinity, west = Infinity, north = -Infinity, east = -Infinity;
  const extend = (bounds: GeometryBounds) => {
    south = Math.min(south, bounds[0][0]); west = Math.min(west, bounds[0][1]);
    north = Math.max(north, bounds[1][0]); east = Math.max(east, bounds[1][1]);
  };
  const walk = (coordinates: unknown): void => {
    if (!Array.isArray(coordinates)) return;
    if (typeof coordinates[0] === "number") {
      const [lng, lat] = coordinates;
      if (Number.isFinite(lng) && Number.isFinite(lat)) extend([[lat, lng], [lat, lng]]);
    } else coordinates.forEach(walk);
  };
  if (geometry.type === "GeometryCollection") {
    for (const child of geometry.geometries) {
      const bounds = geometryBounds(child);
      if (bounds) extend(bounds);
    }
  } else walk(geometry.coordinates);
  const bounds: GeometryBounds | null = Number.isFinite(south) ? [[south, west], [north, east]] : null;
  boundsCache.set(geometry, bounds);
  return bounds;
}
