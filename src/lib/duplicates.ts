import type { CollectionName } from "./types";
type Candidate = Record<string, unknown>;
const normalize = (value: unknown) =>
  String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
function signature(collection: CollectionName, row: Candidate) {
  const extra = row.extra as Record<string, unknown> | undefined;
  if (extra?._sourceSheet && extra?._sourceRow)
    return JSON.stringify([
      collection,
      "source",
      extra._sourceSheet,
      extra._sourceRow,
    ]);
  if (collection === "localities")
    return row.siruta
      ? JSON.stringify([normalize(row.country), normalize(row.siruta)])
      : null;
  const name = normalize(row.name),
    business = normalize(row.business);
  if (!name && !business) return null;
  // Geometry alone is never identity: distinct source rows may intentionally share an area.
  const place = normalize(row.siruta) || normalize(row.locality);
  if (!place && !row.geometry && row.lat == null) return null;
  return JSON.stringify([
    normalize(row.country),
    normalize(row.county),
    place,
    name,
    business,
    normalize(row.partner),
    row.year ?? "",
    JSON.stringify(row.geometry ?? [row.lat ?? null, row.lng ?? null]),
  ]);
}
export function findProbableDuplicates(
  collection: CollectionName,
  items: object[],
  existing: object[],
): { index: number; against: "existing" | "file" }[] {
  const seen = new Map<string, "existing" | "file">();
  for (const row of existing) {
    const key = signature(collection, row as Candidate);
    if (key) seen.set(key, "existing");
  }
  const matches: { index: number; against: "existing" | "file" }[] = [];
  items.forEach((row, index) => {
    const key = signature(collection, row as Candidate);
    if (!key) return;
    const against = seen.get(key);
    if (against) matches.push({ index, against });
    else seen.set(key, "file");
  });
  return matches;
}
