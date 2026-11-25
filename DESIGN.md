---
name: "Roma Community Map"
description: "A forest-green field guide to community maps and source evidence."
colors:
  bg: "#1b3a2e"
  panel: "#224134"
  text: "#fffeff"
  muted: "#e0e0df"
  border: "#345347"
  primary: "#fde68a"
  primary-text: "#040404"
  hover: "#2d5141"
  selected: "#315a47"
  rail: "#1b3a2e"
  accent: "#fde68a"
  danger: "#f4d9db"
  warn: "#efefee"
  nav-active: "#224134"
  badge-valid: "#232a27"
  badge-valid-text: "#cde6d5"
  badge-proposed: "#2a2721"
  badge-proposed-text: "#eee4d0"
  map-validated: "#206457"
  map-proposed: "#b07821"
  map-selected: "#193c34"
  entrepreneur: "#397ca5"
  client: "#b85b43"
  overlap-both: "#16a34a"
  overlap-clients: "#ea580c"
  overlap-communities: "#64748b"
  control-border: "#879e90"
  state-border: "#9c9ca6"
  map-pending: "#755ca8"
  badge-pending: "#292334"
  badge-pending-text: "#e0d3f3"
  badge-below: "#242a33"
  badge-below-text: "#d9e1ea"
  secondary: "#efefee"
  primary-hover: "#f9d96a"
typography:
  headline:
    fontFamily: "var(--font-host-grotesk), sans-serif"
    fontSize: "28px"
    fontWeight: 500
    lineHeight: 1.3
    letterSpacing: "-.03em"
  title:
    fontFamily: "var(--font-host-grotesk), sans-serif"
    fontSize: "19px"
    fontWeight: 650
    lineHeight: 1.4
    letterSpacing: "-.025em"
  body:
    fontFamily: "var(--font-host-grotesk), sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
  label:
    fontFamily: "var(--font-host-grotesk), sans-serif"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
  display:
    fontFamily: "var(--font-host-grotesk), sans-serif"
    fontSize: "clamp(44px, 4.65vw, 67px)"
    fontWeight: 500
    lineHeight: 1.05
    letterSpacing: "-.035em"
  reading:
    fontFamily: "var(--font-eb-garamond), serif"
    fontSize: "18px"
    fontWeight: 400
    lineHeight: 1.5
  intro-prose:
    fontFamily: "var(--font-eb-garamond), serif"
    fontSize: "21px"
    fontWeight: 400
    lineHeight: 1.35
rounded:
  square: "0px"
spacing:
  compact: "4px"
  control: "8px"
  field: "12px"
  group: "16px"
  panel: "24px"
  dialog: "28px"
components:
  button-secondary:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.text}"
    rounded: "{rounded.square}"
    padding: "8px 12px"
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-text}"
    rounded: "{rounded.square}"
    padding: "8px 12px"
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
  button-danger:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.danger}"
    rounded: "{rounded.square}"
    padding: "8px 12px"
  input:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.text}"
    rounded: "{rounded.square}"
    padding: "9px 11px"
  nav-active:
    backgroundColor: "{colors.nav-active}"
    textColor: "{colors.primary}"
    rounded: "{rounded.square}"
    padding: "10px 11px"
  badge-valid:
    backgroundColor: "{colors.badge-valid}"
    textColor: "{colors.badge-valid-text}"
    rounded: "{rounded.square}"
    padding: "2px 7px"
  badge-proposed:
    backgroundColor: "{colors.badge-proposed}"
    textColor: "{colors.badge-proposed-text}"
    rounded: "{rounded.square}"
    padding: "2px 7px"
  card:
    padding: "0 0 22px"
  dialog:
    backgroundColor: "{colors.panel}"
    rounded: "{rounded.square}"
    padding: "28px"
    width: "min(540px, 100%)"
  badge-pending:
    backgroundColor: "{colors.badge-pending}"
    textColor: "{colors.badge-pending-text}"
    rounded: "{rounded.square}"
    padding: "2px 7px"
  badge-below:
    backgroundColor: "{colors.badge-below}"
    textColor: "{colors.badge-below-text}"
    rounded: "{rounded.square}"
    padding: "2px 7px"
---
# Design System: Roma Community Map

## Overview

**Creative North Star: "Forest Field Guide"**

Forest-green ground and surfaces frame the working atlas, with warm yellow marking actions, links and the active dataset. Host Grotesk gives headings and operational controls a precise voice; EB Garamond makes explanatory text and source material comfortable to read.

The interface is flat, square and spacious around the map. A large two-line introduction and live coverage facts orient staff before the task index and geographic evidence. Semantic dataset colors retain their established meanings.

**Key Characteristics:**

- Forest-green layers and warm-yellow action emphasis.
- Host Grotesk display and UI paired with EB Garamond prose.
- Square controls and a dominant working map.
- Labeled status colors, scope dashes and visible source provenance.

## Colors

The frontmatter is the normative palette. Forest layers carry the workspace; yellow provides warm, focused emphasis.

### Primary
- **Warm yellow:** primary buttons, active navigation, brand icon, links and count emphasis. Black labels give filled actions clear contrast; primary hover uses the deeper yellow token.

### Secondary
- **Geographic green / amber / violet / slate:** validated, proposed, pending-validation and below-threshold geometry. Below-threshold geometry reuses the overlap-communities slate token.
- **Entrepreneur blue / partner terracotta:** point datasets; overlap green, orange and slate retain analysis meaning.
- **Pale green / amber / violet / slate on dark tints:** labeled status badges remain independent of brand yellow.
- **Pale rose:** destructive actions and errors.

### Neutral
- **Forest ground / raised forest panel:** page ground and operational surfaces, including forms, summaries and popups.
- **Off-white / soft grey / secondary white:** main text, muted labels and reading copy.
- **Green border / control border / hover / selection:** structural separation and clear state changes. Hover and selection are distinct tones.
- **State border:** selected filter edges and mixed-status administrative areas. The legacy rail token is used by toast surfaces; the page has horizontal navigation.

**The Yellow Emphasis Rule.** Use warm yellow for primary actions, links, identity and active navigation; keep reading surfaces green.

**The Geographic Continuity Rule.** Preserve map dataset colors independently of interface action colors.

## Typography

Both families are self-hosted through next/font with Latin and Latin Extended subsets and swap display. Keep their root CSS variable references so components inherit the loaded fonts.

- **Display:** Host Grotesk, medium weight, tight tracking and two lines in the introduction. The desktop clamp reaches about (67px) at (1440px); it becomes (46px) below (1200px), (40px) below (920px), then clamp(32px, 8.8vw, 42px) on mobile.
- **Headlines / title:** panel headings use (28px, 500); product identity uses (19px, 650), reducing to (16px) on mobile. Summary headings use (28px), reducing to (24px) on mobile.
- **UI and data:** Host Grotesk body (14px), field text (13px), search text (12px), labels (12px) and status badges (10px). Record names use weight (500). Counts and tables use tabular numerals.
- **Reading:** EB Garamond prose uses (18px, 1.5); introductory copy uses (21px, 1.35), reducing to (19px) at narrower widths. Panel descriptions use (18px, 1.35); boundary prose uses (17px). Source metadata values remain operational sans-serif text.
- **Coverage facts:** Host Grotesk values use (34px, 500), reducing to (30px) below (1200px) and (28px) on mobile. EB Garamond captions use (18px), reducing to (16px) below (920px).

## Layout

The desktop workspace has a horizontal product header with six dataset tabs and import action. Below it, the two-line introduction shares a row with three live coverage facts. A task index (350px) sits beside the dominant map or report, separated by (20px); there is a compact methodology footer. Desktop grid rows are (88px), (236px), minmax(470px, 1fr), and (44px). Page side padding is clamp(24px, 3vw, 48px). The index and main reading surface scroll independently where needed.

At (1600px) and wider, the index becomes (370px), the column gap (24px), and outer padding (56px). At (1200px) and below, the index becomes (320px), gap (16px), padding (24px), and navigation icons hide. At (920px) the import action becomes icon-only. These describe the implemented workspace, not a mandatory template for every screen.

At (760px), the page uses (16px) side padding, header (76px), compact introduction, map minmax(380px, 48dvh), source tools and footer. Dataset navigation moves into a labeled collapsible menu. Lists inside the mobile task panel have maximum height (640px) and contained scrolling. Summary mode places source tools before the report and allows natural page scrolling.

Panels keep a (16px) grouping gap and (24px) desktop side padding. Country/status filters use two columns with a (12px) gap; labeled checkboxes span both columns. Manual-entry forms use two columns and collapse to one on mobile. Dialog widths are (540px) or (840px), with padding (28px), reducing to (20px) on mobile. Summary tables keep minimum width (660px) inside a horizontal scroller; report padding is (28px), reducing to (24px 20px) on mobile.

## Elevation & Depth

Forest tonal layers and thin green borders provide most separation. The main workspace is flat with no glow. Black shadows lift floating map tools, the mobile menu, toasts and dialogs. A translucent black modal backdrop isolates forms. Exact shadow values live in the sidecar.

**The Working Surface Rule.** Separate ordinary records with borders and tonal changes; reserve shadows for floating tools, navigation overlays and dialogs.

## Shapes

Buttons, fields, navigation states, badges, records, report frames and dialogs have square corners. Circular map markers and legend dots retain their data meaning. Icons use an unfilled (24px) viewBox with (1.7px) strokes, rounded caps and joins; default rendered size is (20px). Menu and close symbols use the same stroke language.

## Components

### Buttons

Primary actions are yellow with black labels and a yellow border. Secondary actions use the green panel surface; destructive actions use pale rose text. Default minimum height is (38px), padding (8px 12px), weight (550) and line-height (1.4). The header action uses minimum height (42px). Hover adjusts surface and border; disabled opacity is (.55). Color transitions take (160ms); reduced motion removes them.

### Inputs / Fields

Fields use the panel surface, square corners and a (1px) control border. Labels sit above fields with a (6px) gap. Registry search has a visible label and inset stroke icon, height (42px), and left padding (40px). Selects reserve right padding (30px) for an inline SVG chevron. Checkboxes use the primary accent. Keyboard focus is an off-white outline (2px) offset (3px); the summary table region uses a (3px) outline.

### Navigation

Desktop dataset tabs are horizontal icon-and-label buttons with muted text; the active tab gains a panel fill and yellow text. Active hover keeps the yellow treatment. Tablet tabs hide icons. On mobile, the expanded menu is a two-column grid with labeled (44px) minimum-height items. Its toggle exposes aria-expanded; Escape closes the menu and returns focus to the toggle. Dataset selection also closes it.

### Chips

Status badges retain green, amber, violet and slate tinted surfaces with pale matching text, compact (10px) labels and square corners. Generic scope badges use the hover tone and secondary white. The four REDI status names remain explicit. Existing selected filter segments retain their state border and small shadow.

### Cards / Containers

Data sections use bottom dividers and spacing rather than floating cards. Selected records use the selected green tone. Record activation focuses the corresponding geometry and exposes its source details and actions. Summary headers use the hover tone and totals use the selected tone; numeric cells remain sans-serif while reading copy uses the serif family.

### Drawing and source details

Drawing tools start in a native disclosure so search stays easy to find. The summary has a plus icon that rotates (45deg) when open; the four tool buttons then appear. Country/status, health and unlocated filters drive the source list and map together. Result counts distinguish source rows from distinct shapes.

Selected records expand a semantic definition list. Detail text uses (13px), term labels (11px), preserved line breaks and neutral dividers. Boundary descriptions show administrative scope, source, year and license links, with serif explanatory text. Missing verified locations remain explicit even when a regional outline exists. Source sheets use native disclosures with (12px) summary padding; their reading rows use EB Garamond (18px, 1.5) and wrap long content.

### Dialogs

Native dialogs use square forest panels over a black translucent backdrop. They support Escape and backdrop dismissal and return focus to their opener. Form labels, values and actions stay in Host Grotesk; primary save actions use yellow. End-aligned actions wrap on narrow screens.

### Map instruments

Toolbars, layer controls, legends and popups inherit the forest panel and off-white text. Imported catalog geometry uses attributed administrative polygons, with existing status colors. Mixed-status shapes reuse the state-border neutral; selection uses the established selected map color.

Long dashes (12 6) identify wider parent/regional references; short dashes (4 4) identify proposed locality outlines. Wider-reference styling takes precedence, and the wrapping legend explains both. Polygon stroke increases from (1.5px) to (3.5px) on selection; fill opacity is (.16) for locality/parent outlines, (.07) for regions and (.28) when selected. Point geometry retains selected radius (8px to 11px).

Shared geometry is drawn once. Its popup lists all source rows as buttons with status and row labels, with maximum choice-list height (230px) and popup width (340px). Selecting a row expands its own details. Map-scoped popup styles override Leaflet defaults. Tile and geometry attribution remains visible. No generated raster or exploratory landing composition ships as part of this interface.

## Do's and Don'ts

### Do:

- Do use Host Grotesk for display, controls and data; use EB Garamond for reading text.
- Do pair yellow primary actions with their black label color.
- Do keep controls square, keyboard focus visible and numeric columns tabular.
- Do preserve labeled map colors and Romanian diacritics.
- Do show administrative scope, source year and license beside imported outlines.

### Don't:

- Don't add a decorative glow behind the workspace.
- Don't replace the geographic status palette with brand yellow.
- Don't turn source records into rounded floating cards.
- Don't animate controls when reduced motion is requested.
- Don't present administrative reference areas as Roma settlement boundaries.
