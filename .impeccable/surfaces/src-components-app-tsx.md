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

Mode remains Operate: inherit the dark system, established rail/header/index/map layout, Host Grotesk, square controls and restrained red workspace glow. The 11 supplied HTML exports contribute 628 detailed rows. The initial approximate-center display is superseded by the attributed administrative-area extension below; original source records and unresolved location flags remain intact. Summary totals describe broader source coverage and remain distinct from available detailed rows.

Staff narrow the catalog by country, four REDI statuses, health-campaign membership and missing location. The result count separates source records from distinct mapped shapes; the same filtered records feed the map. Selection retains map focus where geometry exists and expands all source fields in a semantic definition list, with provenance, accuracy notes and GeoNames verification links. Summary source sheets use native disclosures for original row text and references.

Deliberate status extension: pending validation uses violet map geometry and pale-violet badges; below-threshold records reuse the existing slate map color with pale-slate badges. All four statuses remain labeled in filters, badges and the wrapping map legend. These extend the dataset vocabulary without changing neutral interface actions.

Evidence checked: App.tsx, CommunityDetails.tsx, CountrySummaryView.tsx, MapView.tsx, appended catalog CSS, README import coverage, and the six desktop/mobile captures under .impeccable/review/catalog (overview, expanded details and summary/source view). The captures show the inherited dark composition and readable stacked source detail; native disclosure behavior is grounded in the component code.

## Administrative-area extension

Mode remains Operate; the dark visual system and existing color tokens are inherited. All 628 catalog rows now reference attributed administrative geometry: 534 rows use locality outlines, 36 use wider parent municipalities and 58 use regional references, grouped into 560 distinct shapes. The 111 Romanian source rows share 109 locality shapes because two source rows duplicate an area. These are simplified administrative references, not boundaries of Roma settlements; source years and administrative definitions vary. The 18 originally unresolved positions remain explicitly unconfirmed even where a regional reference is shown.

The map draws shared geometry once while retaining every source row. A shared-area popup offers independently labeled row choices, including status and source-row number. Selection focuses the outline and opens the corresponding metadata in the index. Scope badges and the boundary description distinguish locality outlines from parent/regional references, with level, year, source and license links. GeoJSON and CSV preserve boundary provenance on round-trip.

Long dashes (12 6) mean wider administrative reference; short dashes (4 4) mean proposed locality outline. The legend explains both patterns explicitly. Mixed-status areas reuse the existing state-border neutral; no new palette is introduced. Region fills are lighter than locality/parent fills, and selected outlines increase stroke and fill emphasis. Dark popup content remains readable through map-scoped Leaflet overrides; its row choices scroll rather than obscuring the workspace.

The Supabase compare-and-swap migration preserves user field edits, concurrent changes, deletions and custom geometry. Source coverage and licenses are documented in README.md and src/data/BOUNDARY_SOURCES.md. No fabricated neighborhood boundaries or point buffers are introduced.

Evidence checked: MapView.tsx grouping, status/scope styles and shared-area choices; App.tsx badges, counts and explicit dash legend; CommunityDetails.tsx provenance and location notes; boundary CSS and export/import provenance fields; source documentation; seven desktop/mobile captures under .impeccable/review/boundaries (overview, locality, region and shared-area popup). The captures show preserved dark composition, readable scope/source details and the long-versus-short dash legend.
