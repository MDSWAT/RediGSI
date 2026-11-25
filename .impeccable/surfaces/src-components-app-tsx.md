---
version: 1
slug: "src-components-app-tsx"
primary_target: "src/components/App.tsx"
related_targets: ["src/app/globals.css","src/app/layout.tsx"]
---

# Forest field-guide GIS workspace
Mode: Operate. The user supplied a green/yellow design prompt, then reiterated “i need the page design”. Apply that identity to the actual platform now, rather than stopping at previews or creating an unrelated marketing page. Earlier brand-sheet and opening mockups under .impeccable/mocks/forest-yellow are exploratory style references, not approved spatial comps. Seed key3b7fc210 belongs to that pinned-direction exploration; the latest instruction resolves execution directly on the working platform.

## Direction contract
THESIS: A calm forest-green atlas for finding communities and understanding their source data, with the working map occupying the main surface.
OWN-WORLD: Flat #1b3a2e ground, #224134 surfaces, #fde68a brand/action emphasis, off-white reading text, sharp controls. Host Grotesk medium display and operational typography; EB Garamond reading text. Data-status colors keep their meaning.
STORY: Staff navigate datasets, search/filter source rows, inspect administrative outlines and provenance, add records manually or by import, compare coverage and export data. Preserve all facts and data workflows.
FIRST VIEWPORT: Horizontal product/navigation header; editorial two-line headline and three live coverage facts; left task index and dominant full-height map. Mobile has a labeled collapsible navigation menu, compact introduction, map and a manageable scrollable source list. No pricing or testimonial claims.
FORM: User-pinned forest/yellow visual system. Selected tabs and primary actions are visibly differentiated; drawing tools use a disclosure to prioritize finding records. Existing record-selection, boundary grouping, source disclosures and dialogs remain operational. Escape closes mobile navigation and returns focus to its button.
FINISH: Desktop/mobile captures, measured text contrasts, keyboard and workflow verification, bounded finish review, and documentation of the final system.

## Data and boundary requirements
Preserve all 628 source rows and 560 shapes: 534 locality, 36 parent and 58 regional references. The 111 Romanian rows share 109 shapes because two source rows duplicate an area. All source fields, unresolved-location flags and licenses remain available. Long dashes 12 6 indicate wider references, short dashes 4 4 proposed outlines. Administrative references do not assert Roma-settlement territories.

Shared-area popups retain every source row and source-row number. Filters drive list and map together. Supabase storage, compare-and-swap boundary upgrades, import/export provenance and custom geometries are unchanged by this design task.

## Implemented finish and evidence

The final working GIS page uses the supplied forest/yellow identity directly. Ground and panels stay green; yellow primary actions have black labels, and selected records use the selected green tone. Actual CSS hover is #2d5141 and selection is #315a47. The prior neutral/red-glow world is replaced. The former rail becomes six horizontal header tabs; an editorial Host Grotesk introduction and live coverage facts lead into the task index and dominant map. EB Garamond handles prose. There are no new backend/data changes or marketing claims.

Drawing tools begin collapsed, search has a visible label, and selects use an inline chevron. The mobile navigation toggle exposes expanded state; Escape closes it and returns focus. Mobile map view places the map before source tools, while summary view keeps source selection before the report. Forms, details, summaries and popups inherit green surfaces and existing dataset semantics.

Evidence: final globals.css, layout.tsx, App.tsx and Icon.tsx; seven directly inspected captures in .impeccable/review/forest-platform (desktop/mobile overview, desktop details/manual, mobile menu/summary and tablet-summary-confirm). The independent finish review reports SHIP across its 17 captures; tablet-summary-confirm.png is the final tablet active-summary state. checks.json contains no recorded errors. contrast.json contains 27 text samples with minimum WCAG ratio 8.48 and minimum absolute APCA Lc 79.5 at the recorded sizes; these are sampled results, not a blanket compliance claim. detector.json records the deliberate palette replacement, while status-data colors remain stable.
