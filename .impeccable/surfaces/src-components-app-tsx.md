---
version: 1
slug: "src-components-app-tsx"
primary_target: "src/components/App.tsx"
related_targets: ["src/app/globals.css", "src/app/layout.tsx", "src/components/MapView.tsx", "src/components/AnalyticsWorkspace.tsx", "src/components/DataWorkspace.tsx", "src/components/AdministrationWorkspace.tsx", "src/components/AuthDialog.tsx", "src/components/ProposalDialog.tsx"]
---

# Linear-inspired light GIS workspace

Mode: Operate. The user explicitly requested a modern white SaaS redesign and chose a direction closer to Linear. This supersedes the forest/yellow visual identity and serif reading typography. The full-screen working layout and existing workflows remain the product foundation. This is a code-led implementation; no raster asset or exploratory landing composition is an approved spatial comp.

## Direction contract

THESIS: A focused white GIS workspace makes dataset navigation, tools and geographic evidence clear at a glance.
OWN-WORLD: White panels, cool gray navigation, ink text, restrained teal actions, Host Grotesk throughout, thin dividers and 8px controls. Preserve semantic dataset colors. DESIGN.md frontmatter owns the extracted tokens; globals.css remains the implementation source of truth.
STORY: Choose a permission-aware module; explore map datasets and provenance, inspect territory metrics, manage accessible data or review proposals and stewardship history. Public proposals remain separate from the registry until approval and publication.
FIRST VIEWPORT: Desktop uses a labeled 200px navigation, 336px internally scrolling tools, 64px header and dominant Esri World Light Gray map with its reference layer. OpenStreetMap and Esri satellite remain selectable. No intro, footer or document-level scroll. At 1200px navigation/tools become 176px/312px; at 1000px, 68px/310px. At 760px, persistent navigation and header are 56px; tools become a dismissible overlay drawer of width min(336px, 100vw - 56px).
FORM: Four modules (Hartă, Analiză, Date, Administrare) follow effective permissions; public sees the first two. Map datasets become panel subfilters. Destinations retain labels and accessible names; compact navigation stacks icons above labels. Mobile provides short visible labels. A labeled toggle, close button, backdrop and Escape control tools; map selection exposes record details. Native dialog Escape leaves the underlying drawer intact. Drawing and legend use disclosures, with legend initially collapsed. Reports and tables scroll within their own regions. Analytics, Data and Administration use the full main surface without a map aside/toggle. Wide content has 32px vertical padding and clamp(20px, 3vw, 48px) horizontal padding; at 760px it becomes 24px 18px. KPI values are 32px (28px mobile), module titles 26px (22px mobile); module columns and scope fields stack on mobile.
FINISH: Governance review passes after correcting the growing search label, hidden map filters affecting Analytics and null-geometry export omission. Targeted regressions pass. Evidence is limited to the six public desktop/mobile Map, Analytics and proposal captures under .impeccable/review/governance.

## Data and boundary requirements

Preserve all existing source rows and geometry, import/export and drawing behavior, SIRUTA matching, validation, overlap analysis, original source CSV text and server-confirmed Supabase/PostgreSQL storage. No invented records or runtime fallback data. Header counts derive from the actual database, with loading placeholders.

Shared administrative geometry draws once while popups retain every source row and row number. Long dashes (12 6) identify wider parent/regional references; short dashes (4 4) identify proposed locality outlines. Wider-reference styling takes precedence. Administrative references do not assert Roma settlement territories. Filters drive list and map together. Source fields, unresolved-location flags, scope, source year and licenses remain accessible. Preserve compare-and-swap upgrades, provenance round-trips and custom geometry.

## Implemented finish and evidence

The shell owns 100dvh and hides outer overflow. Tools, reports, long source text and wide tables scroll in dedicated regions. The mobile drawer begins at left 56px/top 56px and extends to the bottom. At height 600px and below, navigation spacing compresses and the signature hides. Focus outlines remain visible and reduced-motion preferences remove transitions.

Documentation was reconciled against the current shell, module/dialog components, globals.css, PRODUCT.md, README phase scope and direction contract. Public evidence consists of desktop-map.jpg, mobile-map.jpg, desktop-analytics.jpg, mobile-analytics.jpg, desktop-proposal.jpg and mobile-proposal.jpg under .impeccable/review/governance. These captures support only their public states, not populated metrics or privileged workflows.

Implemented source patterns include login with busy/error feedback; public proposal fields, consent, draw-and-return draft preservation and server-confirmed receipt; four baseline territory KPIs, country bars and quality/comparison tables; permission-aware import/export; proposal review and separate privacy/public/geometry publication choices; existing-user role and geographic grants; audit/version inspection and recoverable deletion. Native dialogs share the established radii and focus behavior. On mobile the proposal and administrative forms stack.

Analytics uses accessible records plus country only; opening Map from a country resets search/status/health/location filters. Exports preserve accessible records without geometry. Existing boundary provenance and source rows remain authoritative.

The remote Supabase governance migration and initial administrator setup have not been applied in this session. Privileged UI, populated live data and complete operational workflows are not visually certified. Local PostgreSQL/PGlite and targeted regression checks support implementation behavior, not deployment or independent security/GDPR certification. Later-phase clustering, direct geometry editing, geocoding, KML and advanced analytics remain outside this release.
