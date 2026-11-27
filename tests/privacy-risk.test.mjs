import test from "node:test";
import assert from "node:assert/strict";
import { sourceLoader } from "./helpers/load-typescript.mjs";
const { assessPublicationRisk } = sourceLoader()(
  new URL("../src/lib/privacyRisk.ts", import.meta.url),
);
const base = { kind: "zona", status: "validat", geometry: null };
const square = (d) => ({
  type: "Polygon",
  coordinates: [[[23, 46], [23 + d, 46], [23 + d, 46 + d], [23, 46 + d], [23, 46]]],
});
test("restricted or geometry-free publication needs no justification", () => {
  assert.equal(assessPublicationRisk(base, { public: false, shareGeometry: false }).level, "low");
  const open = assessPublicationRisk(base, { public: true, shareGeometry: false });
  assert.equal(open.level, "low");
  assert.equal(open.needsJustification, false);
});
test("exact points and small polygons are high risk; large polygons medium", () => {
  const point = { ...base, kind: "punct", geometry: { type: "Point", coordinates: [23, 46] } };
  const p = assessPublicationRisk(point, { public: true, shareGeometry: true });
  assert.equal(p.level, "high");
  assert.ok(p.needsJustification);
  assert.equal(
    assessPublicationRisk({ ...base, geometry: square(0.001) }, { public: true, shareGeometry: true }).level,
    "high",
  );
  assert.equal(
    assessPublicationRisk({ ...base, geometry: square(0.1) }, { public: true, shareGeometry: true }).level,
    "medium",
  );
});
test("small population and unvalidated data raise the risk of a public release", () => {
  const r = assessPublicationRisk(
    { ...base, population: 40, status: "propus" },
    { public: true, shareGeometry: false },
  );
  assert.equal(r.level, "medium");
  assert.equal(r.factors.map((f) => f.code).sort().join(","), "small_population,unvalidated");
});
