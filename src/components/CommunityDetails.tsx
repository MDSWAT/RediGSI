import type { Community } from "@/lib/types";

export default function CommunityDetails({ community: c }: { community: Community }) {
  return <section className="community-details" aria-label={`Detalii ${c.name}`}>
    {c.locationAccuracy && <p className="location-note">{c.geometry ? "Poziție orientativă: centrul localității sau al municipalității, din GeoNames. Nu delimitează comunitatea." : "Localizare neconfirmată. Înregistrarea este păstrată integral, fără un punct presupus pe hartă."}</p>}
    {c.population !== undefined && <p>Populație estimată: {c.population.toLocaleString("ro-RO")}</p>}
    {c.notes && <p>{c.notes}</p>}
    {!!c.extra && <dl>{Object.entries(c.extra).filter(([k]) => !k.startsWith("_")).map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v || "—"}</dd></div>)}</dl>}
    {c.extra?._sourceSheet && <p className="small muted">Sursă: {c.extra._sourceSheet}.html · rând {c.extra._sourceRow}. Cifrele din recensământ și estimările alternative nu se adună.</p>}
    {c.extra?._geonamesId && <a href={`https://www.geonames.org/${encodeURIComponent(c.extra._geonamesId)}`} target="_blank" rel="noreferrer">Verifică localizarea în GeoNames · CC BY 4.0</a>}
  </section>;
}
