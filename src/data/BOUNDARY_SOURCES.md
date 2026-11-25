# Administrative geometry sources

`catalog-boundaries-2026.json` contains attributed administrative outlines and record-to-area assignments, retrieved 2026-11-25. They are reference areas, not surveyed Roma community territories. Administrative definitions and source years vary by country and are retained per outline.

Geometry comes from [geoBoundaries](https://www.geoboundaries.org/api.html), using gbOpen except Albania municipality outlines, which use gbHumanitarian / OCHA (CC BY 3.0 IGO). The original publisher, source year, immutable geometry download URL, original license name and canonical license URL are included with each outline. Original licenses include Public Domain, CC BY 4.0, CC BY-SA 2.0 and ODbL 1.0. These licenses apply to the respective geometry data; they do not relicense the application code. Geometry adaptations remain subject to their upstream terms.

Preparation repairs invalid topology, keeps polygon holes and islands, and simplifies boundaries for display. Local outlines use a tolerance of 0.0003 degrees, parent municipalities 0.0005, and regional references 0.002; per-outline tolerances are recorded. Name matching also uses GeoNames aliases (CC BY 4.0, https://www.geonames.org/). No circles, buffers, or fabricated neighbourhood borders are generated.

Rebuild from repository root:

```powershell
python -m pip install -r scripts/requirements-boundaries.txt
python scripts/download-boundaries.py --cache ../boundary-cache
node scripts/build-boundaries.mjs ../boundary-cache
```

The cache is an offline preparation input, outside the application. Runtime writes go only to Supabase. The committed manifest is the reproducible release artifact; new upstream downloads may differ. Publish a new manifest version deliberately when replacing it.
