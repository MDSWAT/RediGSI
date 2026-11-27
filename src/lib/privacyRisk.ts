import { area } from "@turf/turf";
import type { Community } from "./types";

export type RiskLevel = "low" | "medium" | "high";
export interface RiskFactor {
  code: string;
  level: RiskLevel;
  label: string;
}
export interface PublicationRisk {
  level: RiskLevel;
  factors: RiskFactor[];
  /** A written justification is required before release. */
  needsJustification: boolean;
}
export const RISK_LABELS: Record<RiskLevel, string> = {
  low: "Risc scăzut",
  medium: "Risc mediu",
  high: "Risc ridicat",
};
const RANK: Record<RiskLevel, number> = { low: 0, medium: 1, high: 2 };
/** Below this area an exact polygon can single out a handful of households. */
const SMALL_AREA_M2 = 500_000;
const SMALL_POPULATION = 200;

/**
 * Evaluates the re-identification risk of publishing a community record.
 * The database applies the same geometry floor independently, so this is
 * guidance for the reviewer, not the only control.
 */
export function assessPublicationRisk(
  community: Pick<
    Community,
    "geometry" | "kind" | "population" | "status" | "locationAccuracy"
  >,
  options: { public: boolean; shareGeometry: boolean },
): PublicationRisk {
  const factors: RiskFactor[] = [];
  const add = (code: string, level: RiskLevel, label: string) =>
    factors.push({ code, level, label });
  if (options.public && options.shareGeometry && community.geometry) {
    const type = community.geometry.type;
    if (type === "Point" || type === "MultiPoint")
      add(
        "exact_point",
        "high",
        "Punct exact: poate indica gospodării individuale.",
      );
    else if (type === "LineString" || type === "MultiLineString")
      add("exact_street", "high", "Traseu exact de stradă publicat.");
    else {
      const m2 = area({ type: "Feature", properties: {}, geometry: community.geometry });
      if (m2 < SMALL_AREA_M2)
        add(
          "small_polygon",
          "high",
          `Poligon mic (${(m2 / 10_000).toFixed(1)} ha): zona e ușor de identificat.`,
        );
      else add("exact_polygon", "medium", "Contur exact al comunității publicat.");
    }
    if (community.kind === "punct" || community.kind === "strada")
      add("fine_kind", "high", "Tip de comunitate cu localizare foarte fină.");
  }
  if (options.public) {
    if (
      typeof community.population === "number" &&
      community.population > 0 &&
      community.population < SMALL_POPULATION
    )
      add(
        "small_population",
        "medium",
        `Populație mică (${community.population}): persoanele pot fi identificate.`,
      );
    if (community.status !== "validat")
      add("unvalidated", "medium", "Informațiile nu sunt încă validate în teren.");
  }
  const level = factors.reduce<RiskLevel>(
    (max, f) => (RANK[f.level] > RANK[max] ? f.level : max),
    "low",
  );
  return { level, factors, needsJustification: options.public && level !== "low" };
}
export const MIN_JUSTIFICATION = 20;
