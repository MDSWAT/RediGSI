import type { FeatureCollection, Geometry } from "geojson";
/** Converts only already-authorized export rows, preserving unresolved records. */
export function recordsToGeoJSON(
  rows: Record<string, unknown>[],
): FeatureCollection<Geometry | null> {
  return {
    type: "FeatureCollection",
    features: rows.map((row) => {
      const { geometry, ...properties } = row;
      const lat = row.lat,
        lng = row.lng;
      const located =
        typeof lat === "number" &&
        Number.isFinite(lat) &&
        Math.abs(lat) <= 90 &&
        typeof lng === "number" &&
        Number.isFinite(lng) &&
        Math.abs(lng) <= 180;
      return {
        type: "Feature",
        properties,
        geometry: (geometry ??
          (located
            ? { type: "Point", coordinates: [lng, lat] }
            : null)) as Geometry | null,
      };
    }),
  };
}
