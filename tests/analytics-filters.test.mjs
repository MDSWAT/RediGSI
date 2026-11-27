import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { sourceLoader } from "./helpers/load-typescript.mjs";
const load = sourceLoader();
const Component = load(
  new URL("../src/components/AnalyticsWorkspace.tsx", import.meta.url),
).default;
const { EMPTY_FILTERS, filterWorkspace, filterRows } = load(
  new URL("../src/lib/workspaceFilters.ts", import.meta.url),
);
const db = {
  communities: [
    {
      id: "a",
      country: "RO",
      county: "Cluj",
      locality: "Cluj-Napoca",
      status: "validat",
      geometry: null,
    },
    {
      id: "b",
      country: "RO",
      county: "Alba",
      locality: "Aiud",
      status: "propus",
      geometry: null,
    },
    { id: "c", country: "MD", status: "propus", geometry: null },
  ],
  entrepreneurs: [
    { id: "e1", country: "RO", county: "Cluj", sector: "Retail" },
    { id: "e2", country: "MD", sector: "Services" },
  ],
  clients: [
    {
      id: "c1",
      country: "RO",
      county: "Cluj",
      partner: "Synthetic",
      year: 2026,
    },
  ],
  localities: [],
};
test("territorial analytics ignores hidden map search while all visible filters select the same data", () => {
  const filters = { ...EMPTY_FILTERS, country: "RO" };
  const html = renderToStaticMarkup(
    createElement(Component, {
      db,
      communities: [],
      filters,
      onFiltersChange: () => {},
      onExplore: () => {},
      loading: false,
      error: null,
    }),
  );
  assert.match(html, /Comunități vizibile<\/dt><dd>2<\/dd>/);
  assert.match(html, /De verificat<\/dt><dd>1<\/dd>/);
  assert.match(html, /1 antreprenori · 1 clienți · 1 parteneri/);
});
test("map, analytics and authorized export share geography and entity filters without widening input access", () => {
  const filters = {
    ...EMPTY_FILTERS,
    country: "RO",
    county: "Cluj",
    sector: "Retail",
    partner: "Synthetic",
    year: "2026",
  };
  const selected = filterWorkspace(db, filters);
  assert.equal(selected.communities.length, 1);
  assert.equal(selected.entrepreneurs.length, 1);
  assert.equal(selected.clients.length, 1);
  assert.deepEqual(
    JSON.parse(JSON.stringify(filterRows("clients", db.clients, filters))),
    db.clients,
  );
  assert.equal(
    filterRows("clients", db.clients, { ...filters, year: "2025" }).length,
    0,
  );
  assert.equal(
    filterRows("communities", db.communities, {
      ...filters,
      municipality: "Aiud",
    }).length,
    0,
  );
  assert.equal(
    filterRows("communities", [db.communities[2]], filters).length,
    0,
  );
});
