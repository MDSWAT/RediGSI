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
    fontSize: "22px"
    fontWeight: 500
    lineHeight: 1.3
    letterSpacing: "-.03em"
  title:
    fontFamily: "var(--font-host-grotesk), sans-serif"
    fontSize: "16px"
    fontWeight: 500
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
  reading:
    fontFamily: "var(--font-eb-garamond), serif"
    fontSize: "18px"
    fontWeight: 400
    lineHeight: 1.5
rounded:
  square: "0px"
spacing:
  compact: "4px"
  control: "8px"
  field: "12px"
  group: "16px"
  panel: "20px"
  dialog: "28px"
  tools: "14px"
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
    padding: "9px 2px"
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

Forest-green ground and surfaces frame a compact working atlas, with warm yellow marking actions, links and the active dataset. Host Grotesk gives headings and operational controls a precise voice; EB Garamond supports explanatory text and source material.

The interface owns the viewport: a persistent left menu, compact topbar and independently scrolling task tools leave the map or report as the main surface. Square forms and restrained depth preserve the field-guide identity while semantic dataset colors retain their established meanings.

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
- **State border:** selected filter edges and mixed-status administrative areas. The persistent navigation rail uses the forest ground; the rail token also supplies toast surfaces.

**The Yellow Emphasis Rule.** Use warm yellow for primary actions, links, identity and active navigation; keep reading surfaces green.

**The Geographic Continuity Rule.** Preserve map dataset colors independently of interface action colors.

## Typography

Both families are self-hosted through next/font with Latin and Latin Extended subsets and swap display. Keep root CSS variable references so components inherit the loaded fonts.

- **Title:** Host Grotesk product identity (16px, 500), reduced to (13px) on mobile. The compact shell has no display introduction.
- **Headlines:** panel headings use (22px, 500), with mobile tool headings at (21px). Summary headings use (28px), reduced to (22px) on mobile; dialog headings retain (23px).
- **UI and data:** body (14px), field text (13px), search (12px), labels (12px) and status badges (10px). Rail labels use (9px), (8px) at compact desktop width, and visible compact mobile labels (10px). Record names use weight (500). Counts and tables use tabular numerals.
- **Reading:** EB Garamond prose uses (18px, 1.5); panel descriptions use (16px, 1.35), boundary prose (17px), and source metadata values remain operational sans-serif text.

## Layout

The shell fills exactly (100dvh), with no outer padding, editorial introduction or footer. Desktop columns are a persistent left rail (76px), task panel (320px), and edge-to-edge main surface; the topbar is (56px). Both document and body keep overflow hidden. The task panel and report scroll internally, while wide tables use dedicated horizontal scrollers.

At (1100px) and below, the rail/panel become (68px/300px). At (900px), header coverage facts hide. At (760px), the rail remains visible at (56px) and the topbar reduces to (52px); the full remaining surface belongs to the map or report. Tools open as an overlaid left drawer, width min(320px, 100vw - 56px), beneath the topbar. At heights (600px) and below, rail spacing compresses and its signature hides so all six links fit.

Panels use internal gaps (14px) and side padding (20px). Country/status filters remain two columns with a (12px) gap; checkbox filters span both columns. Manual forms use two columns and collapse to one on mobile. Dialog widths are (540px) or (840px), with padding (28px), reduced to (20px) on mobile. Reports scroll inside the main surface; summary tables keep minimum width (660px). These dimensions describe the implemented operational shell.

## Elevation & Depth

Forest tonal layers and thin green borders provide most separation. The main workspace is flat with no glow. Black shadows lift floating map tools, the mobile tools drawer, toasts and dialogs. A translucent black modal backdrop isolates forms. Exact shadow values live in the sidecar.

**The Working Surface Rule.** Separate ordinary records with borders and tonal changes; reserve shadows for floating tools, tool drawers and dialogs.

## Shapes

Buttons, fields, navigation states, badges, records, report frames and dialogs have square corners. Circular map markers and legend dots retain their data meaning. Icons use an unfilled (24px) viewBox with (1.7px) strokes, rounded caps and joins; default rendered size is (20px). Menu and close symbols use the same stroke language.

## Components

### Buttons

Primary actions are yellow with black labels and a yellow border. Secondary actions use the green panel surface; destructive actions use pale rose text. Default minimum height is (38px), padding (8px 12px), weight (550) and line-height (1.4). The header action uses minimum height (34px). Hover adjusts surface and border; disabled opacity is (.55). Color transitions take (160ms); reduced motion removes them.

### Inputs / Fields

Fields use the panel surface, square corners and a (1px) control border. Labels sit above fields with a (6px) gap. Registry search has a visible label and inset stroke icon, height (42px), and left padding (40px). Selects reserve right padding (30px) for an inline SVG chevron. Checkboxes use the primary accent. Keyboard focus is an off-white outline (2px) offset (3px); the summary table region uses a (3px) outline.

### Navigation

Six icon-and-label dataset links stack in the persistent left rail. Muted labels turn yellow on the active panel surface; active hover retains yellow. Desktop items have minimum height (60px), reducing to (52px) on mobile and (44px) on short screens. Mobile displays compact visual labels while retaining the full accessible labels and aria-current state. The navigation itself remains visible.

A labeled topbar toggle controls the mobile tools drawer and exposes aria-expanded. A close button, backdrop and Escape dismiss the drawer; Escape returns focus to its toggle. While a native dialog is open, Escape acts on that dialog and leaves the underlying drawer open. Selecting a map record opens its details drawer.

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

Toolbars, layer controls, legends and popups inherit the forest panel and off-white text. The compact toolbar sits (12px) from the desktop edges, with (11px) labels and (9px 11px) padding; mobile uses (10px) offsets and labels with (8px 9px) padding. The legend is a native disclosure, collapsed by default. Expanded legend content wraps and scrolls within a maximum height min(260px, 45%) so it does not permanently cover the map. Imported catalog geometry uses attributed administrative polygons, with existing status colors. Mixed-status shapes reuse the state-border neutral; selection uses the established selected map color.

Long dashes (12 6) identify wider parent/regional references; short dashes (4 4) identify proposed locality outlines. Wider-reference styling takes precedence, and the legend explains both. Polygon stroke increases from (1.5px) to (3.5px) on selection; fill opacity is (.16) for locality/parent outlines, (.07) for regions and (.28) when selected. Point geometry retains selected radius (8px to 11px).

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
