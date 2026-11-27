import type { Community, AdministrativeBoundary } from "./types";
import type { Polygon, MultiPolygon, Geometry } from "geojson";
import { geometryBounds } from "./geometryBounds";

const shapeKeys = new WeakMap<Geometry, string>();
function shapeKey(geometry: Geometry) {
  let key = shapeKeys.get(geometry);
  if (!key) {
    key = `shape:${JSON.stringify(geometry)}`;
    shapeKeys.set(geometry, key);
  }
  return key;
}

export interface BoundaryShape extends Omit<AdministrativeBoundary, "scope" | "method" | "referencePoint"> {
  country: string;
  geometry: Polygon | MultiPolygon;
}
export interface BoundaryAssignment { id: string; boundaryId: string; scope: AdministrativeBoundary["scope"]; method: string }
export interface BoundaryManifest { version: string; boundaries: BoundaryShape[]; assignments: BoundaryAssignment[] }

export const BOUNDARY_SCOPE_LABELS = { locality: "Contur localitate", parent: "Municipalitate de referință", region: "Regiune de referință" };

/** Preserve administrative semantics when exported GeoJSON/CSV is imported again. */
export function importedBoundary(value: unknown): AdministrativeBoundary | undefined {
  try {
    const item = typeof value === "string" ? JSON.parse(value) : value;
    if (!item || typeof item !== "object" || !["locality", "parent", "region"].includes(item.scope)) return;
    if (!["id", "name", "level", "year", "source", "sourceURL", "license", "licenseURL", "method"].every(key => typeof item[key] === "string")) return;
    if (!/^https?:\/\//i.test(item.sourceURL) || !/^https?:\/\//i.test(item.licenseURL)) return;
    const point = item.referencePoint;
    if (point !== null && (!Array.isArray(point) || point.length !== 2 || !point.every(Number.isFinite) || Math.abs(point[0]) > 180 || Math.abs(point[1]) > 90)) return;
    return { id: item.id, name: item.name, level: item.level, year: item.year, source: item.source, sourceURL: item.sourceURL, license: item.license, licenseURL: item.licenseURL, method: item.method, scope: item.scope, referencePoint: point,
      ...(Number.isFinite(item.displayToleranceDegrees) ? { displayToleranceDegrees: item.displayToleranceDegrees } : {}) };
  } catch { return; }
}

function originalPointUnchanged(current: Geometry | null, original: Geometry | null): boolean {
  if (!current || !original) return current === null && original === null;
  return current.type === "Point" && original.type === "Point" &&
    current.coordinates.length === original.coordinates.length &&
    current.coordinates.every((coordinate, index) => coordinate === original.coordinates[index]);
}

/** Upgrade only untouched source geometry; preserve names, validation, notes and other edits. */
export function boundaryUpgrade(current: Community, original: Community, shape: BoundaryShape, assignment: BoundaryAssignment): Community | null {
  if (current.id !== original.id || assignment.id !== current.id || assignment.boundaryId !== shape.id || current.source !== "catalog" || current.boundary || current.country !== shape.country ||
    !originalPointUnchanged(current.geometry, original.geometry)) return null;
  const { geometry, id, name, level, year, source, sourceURL, license, licenseURL, displayToleranceDegrees } = shape;
  const metadata = { id, name, level, year, source, sourceURL, license, licenseURL, displayToleranceDegrees };
  return { ...current, kind: "zona", geometry, locationAccuracy: "administrative", boundary: {
    ...metadata, scope: assignment.scope, method: assignment.method,
    referencePoint: original.geometry?.type === "Point" ? original.geometry.coordinates.slice(0, 2) as [number, number] : null,
  } };
}

/** A shared administrative outline is drawn once; every source row stays selectable. */
export function groupBoundaryRecords(records: Community[]): Community[][] {
  const groups = new Map<string, Community[]>();
  for (const record of records) {
    if (!record.geometry) continue;
    // Public projections omit boundary metadata, so identical outlines are grouped by shape.
    const key = record.boundary?.id ?? (record.geometry.type === "Point" ? record.id : shapeKey(record.geometry));
    const group = groups.get(key) ?? [];
    group.push(record); groups.set(key, group);
  }
  const order = { region: 0, parent: 1, locality: 2 };
  // Larger areas first, so smaller outlines are drawn on top and stay hoverable.
  // Extents are computed once per outline, not on every comparison.
  const keyed = [...groups.values()].map((group) => ({ group, rank: group[0].boundary ? order[group[0].boundary.scope] : 3, size: extent(group[0].geometry) }));
  return keyed.sort((a, b) => a.rank - b.rank || b.size - a.size).map((k) => k.group);
}

function extent(geometry: Geometry | null): number {
  const bounds = geometry && geometryBounds(geometry);
  return bounds ? (bounds[1][1] - bounds[0][1]) * (bounds[1][0] - bounds[0][0]) : 0;
}
