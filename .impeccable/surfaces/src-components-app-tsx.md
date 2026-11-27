---
version: 1
slug: "src-components-app-tsx"
primary_target: "src/components/App.tsx"
related_targets: ["src/app/globals.css", "src/app/layout.tsx", "src/components/MapView.tsx"]
---

# Linear-inspired light GIS workspace

Mode: Operate. The user explicitly requested a modern white SaaS redesign and chose a direction closer to Linear. This supersedes the forest/yellow visual identity and serif reading typography. The full-screen working layout and existing workflows remain the product foundation. This is a code-led implementation; no raster asset or exploratory landing composition is an approved spatial comp.

## Direction contract

THESIS: A focused white GIS workspace makes dataset navigation, tools and geographic evidence clear at a glance.
OWN-WORLD: White panels, cool gray navigation, ink text, restrained teal actions, Host Grotesk throughout, thin dividers and 8px controls. Preserve semantic dataset colors. DESIGN.md frontmatter owns the extracted tokens; globals.css remains the implementation source of truth.
STORY: Choose a dataset; search and filter source rows; inspect geometry and provenance; add, import, compare or export within the workspace.
FIRST VIEWPORT: Desktop uses a labeled 200px navigation, 336px internally scrolling tools, 64px header and dominant Esri World Light Gray map with its reference layer. OpenStreetMap and Esri satellite remain selectable. No intro, footer or document-level scroll. At 1200px navigation/tools become 176px/312px; at 1000px, 68px/310px. At 760px, persistent navigation and header are 56px; tools become a dismissible overlay drawer of width min(336px, 100vw - 56px).
FORM: Six navigation destinations retain labels and accessible names; compact navigation stacks icons above labels. Mobile provides short visible labels. A labeled toggle, close button, backdrop and Escape control tools; map selection exposes record details. Native dialog Escape leaves the underlying drawer intact. Drawing and legend use disclosures, with legend initially collapsed. Reports and tables scroll within their own regions.
FINISH: Independent finish review reports SHIP with no material fixes across the four supplied current captures. Populated data views require separate validation once Supabase configuration is available.

## Data and boundary requirements

Preserve all existing source rows and geometry, import/export and drawing behavior, SIRUTA matching, validation, overlap analysis, original source CSV text and server-confirmed Supabase/PostgreSQL storage. No invented records or runtime fallback data. Header counts derive from the actual database, with loading placeholders.

Shared administrative geometry draws once while popups retain every source row and row number. Long dashes (12 6) identify wider parent/regional references; short dashes (4 4) identify proposed locality outlines. Wider-reference styling takes precedence. Administrative references do not assert Roma settlement territories. Filters drive list and map together. Source fields, unresolved-location flags, scope, source year and licenses remain accessible. Preserve compare-and-swap upgrades, provenance round-trips and custom geometry.

## Implemented finish and evidence

The shell owns 100dvh and hides outer overflow. Tools, reports, long source text and wide tables scroll in dedicated regions. The mobile drawer begins at left 56px/top 56px and extends to the bottom. At height 600px and below, navigation spacing compresses and the signature hides. Focus outlines remain visible and reduced-motion preferences remove transitions.

Documentation was reconciled against current App.tsx, MapView.tsx, globals.css, layout.tsx, PRODUCT.md and .impeccable/direction.md. The current independent finish reviewer accepted four supplied captures and reported SHIP with no material fixes. The environment lacks Supabase configuration, so populated records, geometries and summary tables were not verified. Earlier forest/minimal screenshots document previous revisions and do not validate this redesign. This brief makes no populated-data or completed end-to-end validation claim.
