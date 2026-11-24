---
version: 1
slug: "src-components-app-tsx"
primary_target: "src/components/App.tsx"
related_targets: ["src/app/globals.css","src/app/layout.tsx"]
---

# Existing platform: dark visual restyle
Mode: Operate. User clarified that the supplied landing-page design was an aesthetic reference for the existing platform, not a request for another landing page. Implement directly on current map and summary views; preserve all data, copy and workflows. Earlier landing mockups are unapproved exploration, not build authority.

## Direction contract
THESIS: Apply the reference's dark neutral visual language to the actual GIS workspace while keeping its established operating layout.
OWN-WORLD: #0a0a0c ground, #121315 panels, neutral #16161a square controls, #faf8f9 type, Host Grotesk throughout. Sharp corners and restrained depth. #c8303a appears only as a subtle glow behind the main working surface; real map and dataset status colors retain their meaning.
STORY: Staff choose a dataset, find or draw communities, compare partner coverage and read imported source summaries. Every existing action remains in its familiar position.
FIRST VIEWPORT: Persistent rail, 84px header, task index and dominant map; dark controls float above the geographic imagery. The main workspace is inset within a faint red glow. Summary view replaces the map with readable dark tables and source notes. Mobile keeps the existing responsive workflow.
FORM: User-pinned similarity to the supplied dark design; no landing-page sections, pricing, logos or testimonial claims are added. Signature interaction remains record selection focusing its map geometry, with keyboard and drawing handoffs preserved.
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Catalog extension

Mode remains Operate: inherit the dark system, established rail/header/index/map layout, Host Grotesk, square controls and restrained red workspace glow. The 11 supplied HTML exports contribute 628 detailed rows: 610 have approximate GeoNames locality/municipality centers; 18 unresolved records remain available without assumed map points. Summary totals describe broader source coverage and remain distinct from available detailed rows.

Staff narrow the catalog by country, four REDI statuses, health-campaign membership and missing location. The result count separates records from map positions; the same filtered records feed the map. Selection retains map focus where geometry exists and expands all source fields in a semantic definition list, with provenance, accuracy notes and GeoNames verification links. Summary source sheets use native disclosures for original row text and references.

Deliberate status extension: pending validation uses violet map points and pale-violet badges; below-threshold records reuse the existing slate map color with pale-slate badges. All four statuses remain labeled in filters, badges and the wrapping map legend. These extend the dataset vocabulary without changing neutral interface actions.

Evidence checked: App.tsx, CommunityDetails.tsx, CountrySummaryView.tsx, MapView.tsx, appended catalog CSS, README import coverage, and the six desktop/mobile captures under .impeccable/review/catalog (overview, expanded details and summary/source view). The captures show the inherited dark composition and readable stacked source detail; native disclosure behavior is grounded in the component code.
