/** Keep each request below the API body limit, including Unicode payloads. */
export function importBatches<T>(
  items: T[],
  maxBytes = 8_000_000,
  maxItems = 2000,
): T[][] {
  const batches: T[][] = [];
  let batch: T[] = [];
  let bytes = 12;
  for (const item of items) {
    const size = new TextEncoder().encode(JSON.stringify(item)).length + 1;
    if (size > 990_000 || size + 12 > maxBytes)
      throw new Error(
        "O înregistrare depășește limita de dimensiune a importului.",
      );
    if (batch.length && (bytes + size > maxBytes || batch.length >= maxItems)) {
      batches.push(batch);
      batch = [];
      bytes = 12;
    }
    batch.push(item);
    bytes += size;
  }
  if (batch.length) batches.push(batch);
  return batches;
}
