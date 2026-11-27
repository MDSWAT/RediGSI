// Publishes catalog communities whose geometry is an official administrative outline
// (geoBoundaries), so the outlines are visible without signing in. Mirrors
// redi_publish_community_assessed: public projection only (census figures; no notes,
// observations or other imported columns), privacy assessment stamped on every record, compare-and-swap per record,
// audit rows written by the redi_records trigger. High-risk records are skipped.
//
//   node --env-file=.env.local scripts/publish-boundaries.mjs [--dry-run]
import { createClient } from "@supabase/supabase-js";
import { sourceLoader } from "../tests/helpers/load-typescript.mjs";

const dryRun = process.argv.includes("--dry-run");
const { assessPublicationRisk } = sourceLoader()(new URL("../src/lib/privacyRisk.ts", import.meta.url));
const JUSTIFICATION =
  "Contur administrativ oficial (geoBoundaries) și date publice de recensământ; zona nu delimitează gospodării sau teritoriul comunității. Publicat la cererea proprietarului platformei.";
// Same shape as public.redi_public_record(d) in migration 0005.
const PUBLIC_EXTRA = ["Pop. totala", "Romi recens.", "Romi alte surse", "Prag REDI", "Status REDI", "campanie REDI health"];
const publicRecord = (d) => {
  const extra = Object.fromEntries(PUBLIC_EXTRA.filter((k) => d.extra?.[k]).map((k) => [k, String(d.extra[k])]));
  return {
    id: d.id ?? null, name: d.name ?? null, country: d.country ?? null, county: d.county ?? null,
    locality: d.locality ?? null, kind: d.kind ?? null, status: d.status ?? null,
    classification: d.classification ?? null, source: d.source ?? null, geometry: d.publicGeometry ?? null,
    population: typeof d.population === "number" ? d.population : null,
    extra: Object.keys(extra).length ? extra : null,
  };
};

const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const { data, error } = await client.from("redi_records").select("id,data,updated_at").eq("collection", "communities");
if (error) throw error;

const counts = { published: 0, alreadyPublic: 0, skippedHighRisk: 0, notAdministrative: 0, changedMeanwhile: 0 };
for (const { id, data: d, updated_at } of data) {
  if (d.visibility === "public" && d.publicationStatus === "published") { counts.alreadyPublic++; continue; }
  if (!d.boundary || d.locationAccuracy !== "administrative" || !d.geometry) { counts.notAdministrative++; continue; }
  const risk = assessPublicationRisk(d, { public: true, shareGeometry: true });
  if (risk.level === "high") { counts.skippedHighRisk++; continue; }
  const next = { ...d, publicationStatus: "published", visibility: "public", privacyReviewed: true, publicGeometry: d.geometry };
  next.publicRecord = publicRecord(next);
  next.privacyAssessment = {
    level: risk.level, factors: risk.factors.map((f) => f.code), justification: JUSTIFICATION,
    public: true, sharedGeometry: true, assessedBy: null, assessedAt: new Date().toISOString(), method: "bulk-administrative-outlines",
  };
  if (dryRun) { counts.published++; continue; }
  // updated_at is the version check: a concurrent edit makes this update match nothing.
  const result = await client.from("redi_records").update({ data: next, updated_at: new Date().toISOString() }, { count: "exact" })
    .eq("collection", "communities").eq("id", id).eq("updated_at", updated_at);
  if (result.error) throw result.error;
  if (result.count) counts.published++; else counts.changedMeanwhile++;
}
console.log(JSON.stringify({ dryRun, ...counts }));
