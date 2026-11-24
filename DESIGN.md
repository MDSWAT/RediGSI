---
name: "Roma Community Map"
description: "A dark, precise workspace for community maps and source summaries."
colors:
  bg: "#0a0a0c"
  panel: "#121315"
  text: "#faf8f9"
  muted: "#d6d6d5"
  border: "#303036"
  primary: "#faf8f9"
  primary-text: "#fcfcfd"
  button-primary: "#16161a"
  button-primary-border: "#55555f"
  button-primary-hover: "#25252b"
  hover: "#222325"
  selected: "#232429"
  rail: "#0d0d10"
  accent: "#c8303a"
  danger: "#f4d9db"
  warn: "#e5e5e4"
  nav-active: "#24242b"
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
  control-border: "#6b6b75"
  state-border: "#9c9ca6"
  map-pending: "#755ca8"
  badge-pending: "#292334"
  badge-pending-text: "#e0d3f3"
  badge-below: "#242a33"
  badge-below-text: "#d9e1ea"
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
    backgroundColor: "{colors.button-primary}"
    textColor: "{colors.primary-text}"
    rounded: "{rounded.square}"
    padding: "8px 12px"
  button-primary-hover:
    backgroundColor: "{colors.button-primary-hover}"
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
    textColor: "{colors.text}"
    rounded: "{rounded.square}"
    padding: "10px 1px"
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

**Creative North Star: "Dark Fieldwork Atlas"**

Near-black surfaces, white typography and sharp neutral controls bring the supplied dark reference into the existing operating platform. Host Grotesk carries Romanian interface labels, geographic records and source summaries.

Thin neutral borders and tonal changes organize dense information. A restrained red glow sits behind the main working surface; geographic dataset colors retain their established meanings.

**Key Characteristics:**

- Near-black ground with distinct dark panels.
- Host Grotesk, white text and tabular counts.
- Square neutral controls with visible keyboard focus.
- Restrained red workspace glow and stable map semantics.

## Colors

The interface uses a near-black neutral palette. The frontmatter owns color values; the roles below explain their use.

### Primary
- **Soft white:** links, primary interface text and numeric emphasis. The CSS primary token is a foreground color, not a button background.
- **Graphite action surface:** primary buttons and floating map instruments, with a lighter hover tone and distinct border.
- **Restrained red:** the translucent glow behind the main working surface.

### Secondary
- **Geographic green / amber:** validated and proposed communities on the map; selected geometry keeps its established dark green.
- **Pending violet / below-threshold slate:** distinguish records awaiting validation and records below the REDI threshold. Below-threshold map points reuse the overlap-communities slate token.
- **Entrepreneur blue / partner terracotta:** distinct point datasets.
- **Overlap green / orange / slate:** communities with clients, clients only, and communities only.
- **Pale green / pale amber / pale violet / pale slate:** readable text over dark tinted badges for validated, proposed, pending-validation and below-threshold records.
- **Pale rose:** destructive action and error text; warning text is light neutral.

### Neutral
- **Near-black ground / dark panel / deeper rail:** application layers.
- **Soft white / light grey:** primary and secondary reading levels.
- **Graphite borders / hover / selection:** structural separation and state feedback.
- **Control border / active-state border:** stronger neutral edges distinguish fields and persistently selected controls.

**The Glow Boundary Rule.** Keep the red accent behind the main working surface; actions and navigation remain neutral.

**The Geographic Continuity Rule.** Preserve map dataset colors independently of neutral interface action colors.

## Typography

Use Host Grotesk through the root layout's font variable, with sans-serif fallback. Next.js self-hosts the Google font with Latin and Latin Extended subsets and swap display. Keep the variable reference so component previews inherit the loaded family.

- **Headline:** panel headings use the frontmatter headline role; mobile headings reduce to (24px).
- **Title:** product identity uses the title role; mobile size is (17px).
- **Body / label:** default text is (14px); secondary copy and form labels commonly use (12px).
- Record names use (14px, 650); statistics use (24px, 600). Counts, statistics and tables use tabular numerals.
- Summary headings use (23px), reducing to (21px) on mobile; summary values and prose use (13px), with observations at (12px).

## Layout

The existing GIS workspace keeps its navigation spine (88px), index (380px), header (84px) and flexible main surface. The index scrolls independently. Panel gaps are (16px) with desktop side padding (24px). The main surface is inset by (18px 24px 24px 18px) and carries the subtle glow.

At (1200px), the rail/index become (80px/350px). At (1000px), they become (76px/320px) and header counts disappear. At (760px), the map view stacks header (76px), sticky horizontal navigation (72px), map (46dvh), then index; main margins reduce to (12px). Summary mode places the index before the report and allows natural page scrolling. These are current workspace dimensions, not a fixed template for every future surface.

The summary uses a horizontally scrollable table with minimum width (660px), readable notes up to (75ch), and desktop padding (30px), reducing to (24px 20px) on mobile. Dialogs use widths (540px) or (840px), internal scrolling and padding (28px), reducing to (20px) on mobile.

Catalog filters keep country and status selects in two equal columns with a (12px) gap; checkbox filters span both columns. Expanded record details stay within the index and wrap long source content. Source-sheet disclosures remain in the summary reading flow.

## Elevation & Depth

Dark tonal layers and thin borders provide most separation. Black shadows lift map instruments, toasts and dialogs. A translucent black modal backdrop isolates forms. The main workspace has a restrained red shadow; exact values live in the sidecar.

**The Working Surface Rule.** Separate ordinary records with borders and tonal changes; reserve shadows for floating tools, dialogs and the main workspace glow.

## Shapes

Application buttons, inputs, navigation, badges, selected records, summary frames and dialogs use square corners. Circular map markers and legend dots retain their data meaning. Stroke icons use an unfilled (24px) viewBox, rounded caps and joins, and a (1.7px) stroke; their default rendered size is (20px).

## Components

### Buttons

Primary buttons use graphite with near-white text and a stronger neutral border. Secondary buttons use the dark panel surface; destructive variants use pale rose text. Minimum height is (38px), weight (550), line-height (1.4), and padding is (8px 12px). Hover changes background and border. Disabled buttons use opacity (.55). Color transitions take (160ms); reduced motion removes them.

### Inputs / Fields

Dark panel fields use the stronger control-border token at (1px), square corners and compact padding. Labels sit above controls with a (6px) gap. Search reserves left padding (40px) for a stroke icon and uses height (42px). Control focus is a white outline (2px) with offset (3px); the focusable summary table region uses a (3px) outline.

### Navigation

Icon-and-label buttons sit on the deeper rail. Default text is light grey; hover adds a dark neutral fill and white text. Active navigation uses a distinct graphite surface, white text and a persistent state-border outline (1px); inactive buttons reserve that border with transparency. Desktop items stack; mobile items share a horizontal row.

### Chips

Status badges use compact text (10px), square corners and dark green, amber, violet or slate tinted surfaces with pale matching text. The four textual labels retain meaning alongside their color. Segmented filters use a deeper ground; the selected segment gains the graphite action surface, a persistent state-border outline (1px) and a small black shadow. Inactive segments reserve transparent borders. Filter selection also uses aria-pressed.

### Cards / Containers

Data sections use bottom dividers and spacing. Selected list records gain the neutral selected surface. Record activation focuses matching map geometry and exposes actions. Summary tables use dark hover-tone headers, selected-tone totals, neutral borders and readable observation rows; notes remain flat.

### Catalog filters and source details

Country and four-status selects reuse the existing dark fields; health-campaign and unlocated-only filters use labeled checkboxes (16px) with the primary foreground as accent. The result count distinguishes listed records from mapped positions.

Selecting a record expands a semantic definition list below its header. Detail text uses (12px) with line-height (1.65); muted term labels use (11px). Values preserve line breaks, long text wraps, and rows use neutral bottom dividers with vertical padding (8px). Location notes distinguish approximate locality centers from unresolved records.

Original source sheets use native details/summary disclosures with keyboard focus inherited from the global controls. Summaries have vertical padding (12px); disclosed rows use (13px) text, line-height (1.7), neutral dividers and wrapping. Reference links stay readable in the normal document flow.

### Dialogs

Native modal dialogs contain square dark panels over a translucent black backdrop, support Escape and backdrop dismissal, and return focus to their opener. Actions align to the end and wrap as needed.

### Map instruments

Dark neutral toolbars, legends, layer controls and popups surround the geographic imagery. The layer-toggle icon is inline SVG. Community map colors cover all four REDI statuses, and the six-item dataset legend wraps. Proposed boundaries remain dashed (6 5); validated boundaries remain solid. Selected geometry increases line weight (4px to 6px) or point radius (8px to 11px). External OpenStreetMap and Esri tiles keep their attribution. No generated raster or exploration mockup ships with this system.

## Do's and Don'ts

### Do:

- Do use the Host Grotesk variable supplied by the root layout.
- Do keep controls square and actions neutral.
- Do keep keyboard focus visible and numeric columns tabular.
- Do preserve labeled map colors and Romanian diacritics.

### Don't:

- Don't apply the red glow as a primary-button fill.
- Don't replace the geographic status palette with interface neutrals.
- Don't introduce pale panels or rounded cards into the dark workspace.
- Don't animate controls when reduced motion is requested.
