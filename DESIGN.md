---
name: Roma Community Map
description: A precise daylight atlas for community and partner data.
colors:
  primary: "#206457"
  primary-hover: "#174d42"
  primary-text: "#fff"
  bg: "#f3f5f3"
  panel: "#ffffff"
  text: "#233d37"
  muted: "#687773"
  border: "#e0e6e2"
  hover: "#f0f5f2"
  selected: "#e9f3ed"
  rail: "#193c34"
  accent: "#b07821"
  danger: "#b23d38"
  warn: "#92601a"
  entrepreneur: "#397ca5"
  client: "#b85b43"
  overlap-both: "#16a34a"
  overlap-clients: "#ea580c"
  overlap-communities: "#64748b"
  focus: "#83bba7"
  nav-active: "#d9ebdf"
  badge-valid: "#e3f0e8"
  badge-proposed: "#fbefda"
typography:
  headline:
    fontFamily: "'Segoe UI', system-ui, sans-serif"
    fontSize: "25px"
    fontWeight: 650
    lineHeight: 1.3
    letterSpacing: "-.03em"
  title:
    fontFamily: "'Segoe UI', system-ui, sans-serif"
    fontSize: "19px"
    fontWeight: 650
    lineHeight: 1.4
    letterSpacing: "-.025em"
  body:
    fontFamily: "'Segoe UI', system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
  label:
    fontFamily: "'Segoe UI', system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
rounded:
  badge: "5px"
  control: "8px"
  nav: "10px"
  panel: "12px"
  dialog: "16px"
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
    rounded: "{rounded.control}"
    padding: "8px 12px"
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-text}"
    rounded: "{rounded.control}"
    padding: "8px 12px"
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
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
    textColor: "{colors.rail}"
    rounded: "{rounded.nav}"
    padding: "10px 1px"
  badge-valid:
    backgroundColor: "{colors.badge-valid}"
    textColor: "{colors.primary}"
    rounded: "{rounded.badge}"
    padding: "2px 7px"
  badge-proposed:
    backgroundColor: "{colors.badge-proposed}"
    textColor: "{colors.warn}"
    rounded: "{rounded.badge}"
    padding: "2px 7px"
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

**Creative North Star: "Fieldwork Atlas"**

Restrained mineral whites, forest navigation and petrol-green actions frame a readable daytime workspace. System typography and precise stroke icons give Romanian records and geographic evidence priority.

The fieldwork atlas direction uses calm tonal surfaces for dense work. Borders separate records; shadows lift tools over the map and isolate dialogs.

**Key Characteristics:**
- Mineral white surfaces with a forest navigation spine.
- Compact, readable system typography and tabular counts.
- Petrol actions and stable geographic status colors.
- Precise stroke icons and restrained depth.

## Colors

The palette pairs mineral neutrals with forest and petrol greens. Frontmatter is the normative token list; the roles below explain usage.

### Primary
- **Petrol green:** primary actions and validated communities; its deeper hover shade confirms pointer interaction.
- **Forest:** persistent navigation, selected map geometry and toast surfaces.

### Secondary
- **Survey amber:** proposed communities and unfinished boundaries, with a darker warning tone for text.
- **Entrepreneur blue / partner terracotta:** separate point datasets.
- **Overlap green / orange / slate:** communities with clients, clients only, and communities only in analysis.
- **Brick red:** destructive action text and error messages.

### Neutral
- **Mineral background / paper panel:** application ground and working surfaces.
- **Forest ink / muted grey-green:** primary and secondary text.
- **Pale border / hover wash / selected wash:** separation, hover feedback and selected records.
- **Sage focus / navigation active / status washes:** keyboard focus, active routes and readable badges.

**The Status Continuity Rule.** Keep community status colors consistent across badges, legends and map geometry.

## Typography

Use Segoe UI with system-ui and sans-serif fallbacks throughout. No display or decorative font is implemented. Hierarchy comes from size, moderate weight and restrained negative tracking.

- **Headline:** panel heading; the mobile size is (24px).
- **Title:** product identity; the mobile size is (17px).
- **Body:** default records and form text; secondary copy commonly uses (12px).
- **Label:** form labels; compact navigation, badges and helper text use (9–12px) according to context.
- Record names use (14px, 650); statistics use (24px, 600). Counts and tables use tabular numerals.

## Layout

The implemented map workspace fills the viewport with a fixed navigation spine (88px), index (380px), header (84px) and flexible map. The index scrolls independently; panels use grouped gaps (16px) and desktop side padding (24px).

At (1200px) the rail/index become (80px/350px). At (1000px) they become (76px/320px) and header counts disappear. At (760px), the page stacks a header (76px), sticky horizontal navigation (72px), map (46dvh), then the index; the page scrolls naturally. These dimensions describe this workspace, not a required template for every future screen.

Forms wrap paired fields when space is tight. Dialogs use a standard width (540px), wide width (840px), and internal vertical scrolling. Mobile dialog padding reduces to (20px).

## Elevation & Depth

Most surfaces are flat and separated by tonal shifts or thin borders. Floating map tools use a light structural shadow; dialogs use the strongest shadow over a translucent forest backdrop. Toasts use an intermediate lift. Exact shadow values live in the sidecar.

**The Working Surface Rule.** Use borders and tonal layering for records; reserve lift for controls above the map and modal content.

## Shapes

Controls have gently curved corners; tool groups are softer and dialogs are rounder. Compact badges use the smallest radius. Navigation uses its own middle radius; on mobile it reduces to (7px). Circular legend dots and map markers communicate point data. Icons use a (24px) viewBox, unfilled paths, rounded caps and joins, and a (1.7px) stroke; default rendered size is (20px).

## Components

### Buttons

Primary buttons use petrol with white text; secondary buttons use paper with a thin border. Destructive buttons retain the secondary surface and use brick text. Minimum height is (38px), weight (550), and line-height (1.4). Hover changes the background and border; primary hover darkens. Disabled controls use opacity (.55). State transitions take (160ms); reduced motion disables them.

### Inputs / Fields

White bordered fields use the control radius and compact padding. Labels sit above controls with a (6px) gap. The search field includes an inset stroke icon and reserves left padding (40px), with height (42px). Keyboard focus uses a sage outline (3px) offset by (3px).

### Navigation

Icon-and-label buttons sit on forest. Default labels are muted sage; hover lightens the text and adds a forest tint. Active navigation uses a pale sage surface with forest text. Desktop items stack vertically; mobile items share one horizontal row.

### Chips

Status badges use compact type (10px), small rounded corners, green validated washes and amber proposed washes. Dataset filters form a segmented strip; the active segment is white with a small shadow. Selected filter state is also exposed with aria-pressed.

### Cards / Containers

Data sections use a bottom divider and bottom padding rather than a standalone raised card. Selected list records gain the selected wash and control radius. Record activation focuses the matching map geometry and exposes record actions.

### Dialogs

A native modal dialog contains the paper form surface, uses forest backdrop tint, supports Escape and backdrop dismissal, and returns focus to its opener. Actions align to the end and wrap when needed.

### Map instruments

White map toolbar and legend surfaces float above external map tiles. Proposed boundaries are dashed (6 5); validated boundaries are solid. Selected geometry increases line weight (4px to 6px) or point radius (8px to 11px). Map tiles remain external OpenStreetMap / Esri content with their existing attribution; no new shipping raster assets belong to this system.

## Do's and Don'ts

### Do:
- Do use labeled status colors consistently in lists, legends and map geometry.
- Do keep keyboard focus visible on controls and record selection.
- Do use tabular numerals for counts, statistics and tables.
- Do preserve Romanian diacritics and readable compact labels.

### Don't:
- Don't turn ordinary record sections into floating shadow cards.
- Don't use the proposed-community amber as a general action accent.
- Don't add decorative raster imagery to the working map interface.
- Don't animate controls when reduced motion is requested.
