import test from "node:test";
import assert from "node:assert/strict";
import { sourceLoader } from "./helpers/load-typescript.mjs";

const load = sourceLoader();
const { loadAllPages, WORKSPACE_PAGE_SIZE } = load(new URL("../src/lib/workspacePages.ts", import.meta.url));
const { geometryBounds } = load(new URL("../src/lib/geometryBounds.ts", import.meta.url));
const clean = (value) => JSON.parse(JSON.stringify(value));

test("small workspaces need only one request", async () => {
  const offsets = [];
  const result = await loadAllPages(async (offset) => {
    offsets.push(offset);
    return { communities: [{ id: "one" }], count: 1 };
  });
  assert.deepEqual(offsets, [0]);
  assert.deepEqual(clean(result.communities), [{ id: "one" }]);
});

test("first page is usable before remaining pages finish; snapshots stay immutable and ordered", async () => {
  const rows = Array.from({ length: WORKSPACE_PAGE_SIZE * 8 + 3 }, (_, i) => ({ id: String(i) }));
  let unblock;
  const gate = new Promise((resolve) => { unblock = resolve; });
  const snapshots = [];
  let active = 0, peak = 0;
  const loading = loadAllPages(async (offset) => {
    active++;
    peak = Math.max(peak, active);
    if (offset) await gate;
    const communities = rows.slice(offset, offset + WORKSPACE_PAGE_SIZE);
    active--;
    return { communities, count: communities.length };
  }, (snapshot) => snapshots.push(snapshot));
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(snapshots.length, 1);
  assert.equal(snapshots[0].communities.length, WORKSPACE_PAGE_SIZE);
  unblock();
  const result = await loading;
  assert.deepEqual(clean(result.communities), rows);
  assert.equal(snapshots[0].communities.length, WORKSPACE_PAGE_SIZE);
  assert.notEqual(snapshots[0].communities, snapshots[1].communities);
  assert.ok(peak <= 6, "background loading has bounded concurrency");
});

test("failed background pages cannot be mistaken for a complete workspace", async () => {
  await assert.rejects(loadAllPages(async (offset) => {
    if (offset) throw new Error("data unavailable");
    return { count: WORKSPACE_PAGE_SIZE, communities: [{ id: "first" }] };
  }), /data unavailable/);
});

test("bounds handle nested collections, altitude, empty geometry and reuse immutable extents", () => {
  const geometry = { type: "GeometryCollection", geometries: [
    { type: "Point", coordinates: [25, 45, 100] },
    { type: "MultiPolygon", coordinates: [[[[20, 40], [30, 40], [30, 50], [20, 40]]]] },
  ] };
  const result = geometryBounds(geometry);
  assert.deepEqual(clean(result), [[40, 20], [50, 30]]);
  assert.equal(geometryBounds(geometry), result);
  assert.equal(geometryBounds({ type: "GeometryCollection", geometries: [] }), null);
});
