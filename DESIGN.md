---
name: "Roma Community Map"
description: "A light, focused SaaS workspace for community maps and source evidence."
colors:
  bg: "#f7f9fa"
  panel: "#ffffff"
  text: "#202b33"
  muted: "#64717d"
  border: "#e5e9ed"
  control-border: "#d5dce2"
  state-border: "#84939e"
  primary: "#107c70"
  primary-hover: "#096559"
  primary-text: "#ffffff"
  accent: "#107c70"
  danger: "#b33642"
  ok: "#17694f"
  warn: "#946118"
  hover: "#f1f5f6"
  selected: "#eaf5f1"
  rail: "#f7f9fa"
  nav-active: "#e5f0ec"
  nav-active-text: "#11695d"
  badge-valid: "#e3f3ea"
  badge-valid-text: "#256144"
  badge-proposed: "#fff3dc"
  badge-proposed-text: "#8a5d12"
  badge-pending: "#f0eafa"
  badge-pending-text: "#6d4b94"
  badge-below: "#edf1f5"
  badge-below-text: "#536579"
  map-validated: "#206457"
  map-proposed: "#b07821"
  map-pending: "#755ca8"
  map-below: "#64748b"
  map-selected: "#193c34"
  map-mixed: "#9c9ca6"
  entrepreneur: "#397ca5"
  client: "#b85b43"
  overlap-both: "#16a34a"
  overlap-clients: "#ea580c"
  overlap-communities: "#64748b"
typography:
  headline:
    fontFamily: "var(--font-host-grotesk), sans-serif"
    fontSize: "22px"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "-.03em"
  title:
    fontFamily: "var(--font-host-grotesk), sans-serif"
    fontSize: "14px"
    fontWeight: 600
    lineHeight: 1.4
  body:
    fontFamily: "var(--font-host-grotesk), sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "var(--font-host-grotesk), sans-serif"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: 1.5
rounded:
  control: "8px"
  badge: "4px"
  frame: "10px"
  dialog: "14px"
spacing:
  compact: "4px"
  control: "8px"
  field: "12px"
  group: "16px"
  panel: "22px"
  dialog: "28px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-text}"
    rounded: "{rounded.control}"
    padding: "8px 12px"
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
  button-secondary:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.text}"
    rounded: "{rounded.control}"
    padding: "8px 12px"
  button-danger:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.danger}"
    rounded: "{rounded.control}"
    padding: "8px 12px"
  input:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.text}"
    rounded: "{rounded.control}"
    padding: "9px 11px"
  nav-active:
    backgroundColor: "{colors.nav-active}"
    textColor: "{colors.nav-active-text}"
    rounded: "{rounded.control}"
    padding: "10px 12px"
  badge-valid:
    backgroundColor: "{colors.badge-valid}"
    textColor: "{colors.badge-valid-text}"
    rounded: "{rounded.badge}"
    padding: "2px 6px"
  card:
    padding: "0 0 22px"
  dialog:
    backgroundColor: "{colors.panel}"
    rounded: "{rounded.dialog}"
    padding: "28px"
    width: "min(540px, 100%)"
---
# Design System: Roma Community Map

## Overview

**Creative North Star: "The Focused GIS Workspace"**

White task surfaces, cool gray navigation and restrained teal actions form a compact GIS workspace inspired by Linear. Host Grotesk carries headings, controls, source prose and data in one clear sans-serif voice. The map remains the main working surface, with a light Esri basemap by default.

The interface owns the viewport: persistent navigation, a quiet header and independently scrolling tools frame the map or report. Thin dividers and gently rounded controls establish hierarchy; established dataset colors retain their geographic meaning.

**Key Characteristics:**

- White panels and cool gray navigation with restrained teal emphasis.
- One compact Host Grotesk typographic system.
- Gently rounded controls and a dominant light working map.
- Labeled dataset colors, scope dashes and visible source provenance.

## Colors

The frontmatter is normative. White and cool gray surfaces provide a quiet setting for teal actions and semantic geometry.

### Primary

- **Workspace teal:** primary buttons, brand mark, links, checked controls and keyboard focus. A deeper teal defines primary hover; filled actions use white labels.

### Secondary

- **Geographic green / amber / violet / slate:** validated, proposed, pending-validation and below-threshold geometry.
- **Entrepreneur blue / partner terracotta:** point datasets. Green, orange and slate retain overlap-analysis meanings.
- **Light green / amber / violet / slate tints:** status badges use dark matching labels and always retain explicit status text.
- **Rose / success green / ochre:** errors and destructive actions, success and warnings.

### Neutral

- **White panel / cool gray ground:** tools, header, forms and dialogs sit on white; the navigation rail and search background use cool gray.
- **Ink / muted slate:** primary reading and secondary labels. Quiet dividers separate sections; stronger control borders identify fields.
- **Pale green selection:** selected records and report totals. Active navigation uses its own green-tinted surface and dark teal text.
- **Map selection / mixed-status neutral:** independent geometry tokens remain distinct from selected interface rows. Mixed geometry uses its incumbent map neutral; the legend uses the interface state-border neutral.

**The Geographic Continuity Rule.** Preserve semantic map colors independently of interface action colors.

## Typography

Host Grotesk is the sole family, loaded through next/font with Latin and Latin Extended subsets and swap display. Retain the root font variable. There is no serif or separate display family.

- **Headlines:** task headings use the headline token; summary headings use (26px), dialog headings (23px), with summary and tool headings reduced to (22px) and (21px) on mobile.
- **Title:** the header dataset name uses the title token; the rail wordmark is (20px, 650). Mobile header text becomes (13px).
- **Body:** the root body uses (14px, 1.5). Source prose is operational sans-serif (13px), with line-height (1.7) in source sheets and contextual reading regions.
- **Labels and data:** fields use (13px), navigation (13px, 500), search and metadata (12px), small labels (11px), badges (10px). Record names use (13px, 600). Counts and numeric tables use tabular numerals.

## Layout

The shell fills (100dvh), hides document overflow and has no outer padding or footer. Desktop uses navigation (200px), tools (336px), and the remaining width for the map/report. The white header is (64px) tall and spans tools and map. Tools and reports scroll internally; wide tables have dedicated horizontal scrollers.

At (1200px) and below, navigation/tools become (176px/312px); the header product label and divider hide. At (1000px), navigation becomes an icon-and-label rail (68px), tools (310px), the wordmark and workspace signature copy hide, and navigation stacks its icons over labels. At (760px), navigation/header become (56px/56px), header facts hide and import becomes icon-only. The map or report owns the remaining surface. Tools open in a left drawer at (56px, 56px), width min(336px, 100vw - 56px), extending to the bottom. The backdrop leaves navigation accessible. At height (600px) and below, rail spacing compresses and its signature hides.

Task padding is (22px), reducing to (20px) below the first breakpoint, with (16px) panel gaps. Country/status filters remain two columns with (12px) gaps. Manual forms use two columns and collapse on mobile. Reports use (32px) padding, reduced to (24px 16px) on mobile. Summary tables retain minimum width (660px). Dialog widths are (540px) or (840px), with (28px) padding reduced to (20px) on mobile.

## Elevation & Depth

White surfaces, cool gray tones and thin borders provide ordinary separation. A subtle cool shadow lifts floating map tools and popups. Drawers and dialogs use stronger directional or ambient shadows; dialogs sit over a translucent slate backdrop. Exact depth tokens live in the sidecar.

**The Working Surface Rule.** Separate ordinary records with borders and tonal changes; reserve shadows for floating map instruments, drawers and dialogs.

## Shapes

Controls, navigation states, selection surfaces and map instruments use gently curved corners (8px). Status badges use (4px), summary frames and popups (10px), and dialogs (14px). Circular markers and legend dots retain geographic meaning. The brand mark has (9px) corners on desktop and (8px) on mobile. Stroke icons retain rounded caps and joins; navigation icons render at (18px).

## Components

### Buttons

Primary actions use teal, white labels and a matching border. Secondary actions use white with a control border; destructive actions use rose text. Defaults are minimum height (38px), padding (8px 12px), weight (550), line-height (1.4). Header import uses minimum height (35px). Hover changes surfaces/borders; disabled opacity is (.55). State transitions take (160ms), removed under reduced motion. Manual-add uses a dashed border and pale surface.

### Inputs / Fields

White fields use a (1px) control border and control radius. Labels sit above with a (6px) gap. Registry search has a visible label, inset icon, cool gray fill and height (40px). Selects reserve (29px) on the right for a chevron. Checkboxes use teal. Focus is a teal outline (2px), offset (3px), including the horizontally scrolling summary table region.

### Navigation

Six dataset controls sit in persistent left navigation. Desktop rows pair an icon and label; active rows use pale green, dark teal text and a small trailing dot. At compact widths they stack; mobile uses short visible labels with full accessible names and aria-current retained. The bottom workspace signature anchors the rail when space permits.

A labeled toggle exposes aria-expanded for mobile tools. Close, backdrop and Escape dismiss the drawer; Escape returns focus to the toggle. When a native dialog is open, Escape acts on the dialog without closing the underlying drawer. Selecting map records exposes their details.

### Chips

Explicit status labels use compact dark text on light semantic tints. Generic badges use neutral gray. Filter segments sit in a cool gray rounded container; the active segment is white with teal text and a quiet border. Counts remain tabular.

### Cards / Containers

Source sections are flat and separated by dividers. Selected records use a pale green rounded selection surface. Summary tables sit in a bordered rounded frame with gray headers and pale green totals. Empty states use compact centered sans-serif copy and a clear relevant action. Errors use rose text on a pale rose surface; backend failures remain visible rather than becoming fabricated data.

### Drawing and source details

Drawing tools use a native disclosure; its plus rotates (45deg) when expanded. Four drawing buttons appear below. Country/status, health and unlocated filters drive list and map together. Counts distinguish source rows and shapes. Selected records expose semantic definition lists, preserved line breaks, source sheets and license links. Unverified locations stay explicit even when a wider reference outline exists.

### Dialogs

Native dialogs use white rounded surfaces over a slate backdrop, support Escape/backdrop dismissal and return focus to the opener. Actions align to the end and wrap on small screens. Form and reading text share Host Grotesk.

### Map instruments

The Esri World Light Gray base with its reference layer is the default map; OpenStreetMap and Esri satellite remain selectable. White toolbars, layer controls, legend and popups use ink text and subtle shadows. Desktop toolbars sit (16px) from the edges, reduced to (12px) on mobile. The legend is a native disclosure, initially collapsed, with maximum expanded height min(260px, 45%). Attribution remains visible.

Imported catalog geometry keeps status colors. Long dashes (12 6) indicate wider parent/regional references; short dashes (4 4) indicate proposed locality outlines, with wider-reference styling taking precedence. Selection increases polygon stroke (1.5px to 3.5px) and fill opacity to (.28); ordinary fill is (.16), regional fill (.07). Community point radius changes (8px to 11px) on selection. Shared geometry draws once; popups expose all source rows as buttons in a choice list with maximum height (230px), preserving each row's details.

## Do's and Don'ts

### Do:

- Do use Host Grotesk for headings, controls, data and source prose.
- Do pair teal primary actions with white labels and retain visible keyboard focus.
- Do preserve labeled map colors, Romanian diacritics and tabular numeric columns.
- Do show administrative scope, source year and license beside imported outlines.
- Do keep task panels, reports and wide tables scrolling inside the viewport.

### Don't:

- Don't restore the superseded forest/yellow identity or serif reading typography.
- Don't replace dataset colors with the interface accent.
- Don't add a landing introduction, footer or decorative glow to the working shell.
- Don't animate controls when reduced motion is requested.
- Don't present administrative reference areas as Roma settlement boundaries.
