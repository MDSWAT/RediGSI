---
version: 1
slug: "src-components-app-tsx"
primary_target: "src/components/App.tsx"
related_targets: ["src/app/globals.css","src/app/layout.tsx"]
---

# Minimal full-screen GIS workspace

Mode: Operate. The user's latest request is a minimal layout that fits one page, places the menu on the left and uses the full screen. This code-led layout correction supersedes the editorial introduction, horizontal menu, footer and outer padding. Forest/yellow identity, both fonts and all data workflows remain. Exploratory brand/landing images are not approved spatial comps.

## Direction contract

THESIS: A viewport-owned forest atlas keeps the left menu always available and gives the map or report the remaining screen.
OWN-WORLD: Forest ground #1b3a2e, panel #224134, yellow #fde68a primary emphasis and off-white text. Host Grotesk for UI; EB Garamond for source prose. Square shapes, flat surfaces and existing status colors.
STORY: Choose a dataset; search and filter source rows; inspect geometry and provenance; add, import, compare or export without leaving the workspace.
FIRST VIEWPORT: Desktop has a 76px left rail, compact 56px topbar, 320px internally scrolling task panel and edge-to-edge main surface. No intro, footer or document-level scroll. At 1100px the rail/panel become 68px/300px. Mobile retains a 56px rail and 52px topbar, with a tools drawer over the full-height map/report.
FORM: All six rail links remain visible, including on short screens. Mobile visual labels are compact while original accessible names remain. A labeled toggle, close button, backdrop and Escape control the tools drawer; map selection opens record details. Native dialog Escape leaves the underlying drawer intact. Drawing and legend use disclosures, with the legend initially collapsed.
FINISH: Independent SHIP review, six-viewport exact-fit checks, desktop/mobile workflow captures and current design-system documentation.

## Data and boundary requirements

Preserve all 628 source rows and 560 shapes: 534 locality, 36 parent and 58 regional references. The 111 Romanian rows share 109 shapes because two source rows duplicate an area. Long dashes (12 6) indicate wider references; short dashes (4 4) indicate proposed locality outlines. Administrative references do not assert Roma-settlement territories.

Shared-area popups retain every row and source-row number. Filters drive list and map together. Source fields, unresolved-location flags and licenses remain accessible in scrolling details. Supabase storage, compare-and-swap upgrades, provenance round-trips and custom geometry are unchanged.

## Implemented finish and evidence

The shell owns exactly 100dvh; html/body and the app hide outer overflow. Tools, reports, long source text and wide tables scroll in their dedicated regions. On mobile the drawer begins at left 56px/top 52px and extends to the bottom; the map stays behind it. At height 600px and below, rail spacing compresses and its signature hides.

Evidence checked: final App.tsx drawer/legend markup and Escape guard; globals.css grid, breakpoints, overflow, typography and toolbar rules; PRODUCT.md; six directly inspected captures under .impeccable/review/minimal (desktop, mobile, small-mobile-drawer, short, desktop-summary and mobile-details). checks.json records six viewport layouts with exact document/app fit, navFits true, no intro/footer and no recorded errors. The independent minimal_finish_reviewer reports SHIP with no material fixes across the 15 named layout/workflow captures. This revision preserves palette and font primitives; it replaces the obsolete display-intro role and horizontal navigation preview.
