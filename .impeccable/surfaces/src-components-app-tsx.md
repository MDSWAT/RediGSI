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
