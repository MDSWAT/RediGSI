export type GeocodingAccuracy =
  "address" | "street" | "locality" | "region" | "unknown";
export interface GeocodingMetadata {
  source: string;
  accuracy: GeocodingAccuracy;
  label: string;
}
export interface GeocodingCandidate extends GeocodingMetadata {
  lat: number;
  lng: number;
}
export const ACCURACY_LABELS: Record<GeocodingAccuracy, string> = {
  address: "Adresă sugerată",
  street: "Stradă (poziție orientativă)",
  locality: "Centru de localitate",
  region: "Zonă administrativă",
  unknown: "Precizie neconfirmată",
};
export function geocodingCandidates(
  input: unknown,
  country: string,
  source: string,
  area?: { county?: string | null; locality?: string | null },
): GeocodingCandidate[] {
  if (!Array.isArray(input)) return [];
  return input.slice(0, 5).flatMap((row) => {
    if (
      !row ||
      typeof row !== "object" ||
      typeof row.display_name !== "string" ||
      String(row.address?.country_code ?? "").toUpperCase() !== country
    )
      return [];
    const norm = (v: unknown) =>
      String(v ?? "")
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/\b(municipiul|mun|judetul|judet|comuna|orasul|satul)\b/g, "")
        .replace(/[^a-z0-9]+/g, " ")
        .trim();
    if (
      area?.county &&
      ![row.address?.county, row.address?.state, row.address?.region].some(
        (v) => norm(v) === norm(area.county),
      )
    )
      return [];
    if (
      area?.locality &&
      ![
        row.address?.city,
        row.address?.town,
        row.address?.village,
        row.address?.municipality,
        row.address?.hamlet,
      ].some((v) => norm(v) === norm(area.locality))
    )
      return [];
    if (
      ![row.lat, row.lon].every(
        (v) =>
          (typeof v === "number" || typeof v === "string") &&
          String(v).trim() !== "",
      )
    )
      return [];
    const lat = Number(row.lat),
      lng = Number(row.lon);
    if (
      row.lat == null ||
      row.lon == null ||
      !Number.isFinite(lat) ||
      !Number.isFinite(lng) ||
      Math.abs(lat) > 90 ||
      Math.abs(lng) > 180
    )
      return [];
    const type = String(row.addresstype ?? row.type ?? "");
    const accuracy: GeocodingAccuracy = [
      "house",
      "building",
      "amenity",
    ].includes(type)
      ? "address"
      : ["road", "street", "pedestrian", "residential"].includes(type)
        ? "street"
        : [
              "city",
              "town",
              "village",
              "hamlet",
              "suburb",
              "neighbourhood",
            ].includes(type)
          ? "locality"
          : ["county", "state", "region", "country"].includes(type)
            ? "region"
            : "unknown";
    return [
      { lat, lng, source, label: row.display_name.slice(0, 500), accuracy },
    ];
  });
}
