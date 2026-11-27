import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
import ts from "typescript";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
const require = createRequire(import.meta.url);
const compiled = ts.transpileModule(
  readFileSync(
    new URL("../src/components/AnalyticsWorkspace.tsx", import.meta.url),
    "utf8",
  ),
  {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      jsx: ts.JsxEmit.ReactJSX,
    },
  },
).outputText;
const exports = {};
vm.runInNewContext(compiled, {
  exports,
  require: (id) =>
    id === "@/lib/types"
      ? {
          COUNTRY_LABELS: { RO: "România", MD: "Moldova" },
          STATUS_LABELS: { validat: "Validată", propus: "Propusă" },
        }
      : id === "@/lib/boundaries"
        ? { groupBoundaryRecords: (rows) => rows.filter((r) => r.geometry) }
        : require(id),
});
test("territorial analytics ignores hidden map-local filters and applies the visible country to all entity counts", () => {
  const db = {
    communities: [
      { id: "a", country: "RO", status: "validat", geometry: null },
      { id: "b", country: "RO", status: "propus", geometry: null },
      { id: "c", country: "MD", status: "propus", geometry: null },
    ],
    entrepreneurs: [
      { id: "e1", country: "RO" },
      { id: "e2", country: "MD" },
    ],
    clients: [{ id: "c1", country: "RO", partner: "Synthetic" }],
    localities: [],
  };
  const html = renderToStaticMarkup(
    createElement(exports.default, {
      db,
      communities: [],
      country: "RO",
      onCountry: () => {},
      onExplore: () => {},
      loading: false,
      error: null,
    }),
  );
  assert.match(html, /Comunități vizibile<\/dt><dd>2<\/dd>/);
  assert.match(html, /De verificat<\/dt><dd>1<\/dd>/);
  assert.match(html, /1 antreprenori · 1 clienți · 1 parteneri/);
  assert.doesNotMatch(html, /Comunități vizibile<\/dt><dd>0/);
});
