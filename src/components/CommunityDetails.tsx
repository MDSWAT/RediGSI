import { BOUNDARY_SCOPE_LABELS } from "@/lib/boundaries";
import { ACCURACY_LABELS } from "@/lib/geocoding";
import { center } from "@/lib/geo";
import type { Community } from "@/lib/types";

export default function CommunityDetails({
  community: c,
}: {
  community: Community;
}) {
  const point = c.geometry ? center(c.geometry) : null;
  return (
    <section className="community-details" aria-label={`Detalii ${c.name}`}>
      {c.boundary && (
        <div className="boundary-description">
          <b>
            {BOUNDARY_SCOPE_LABELS[c.boundary.scope]}: {c.boundary.name}
          </b>
          <p>
            Contur administrativ simplificat pentru afișare, nu granița
            comunității Roma.
            {c.boundary.scope !== "locality" &&
              " Acoperă o zonă mai mare decât localitatea sau cartierul din sursă."}
            {!c.boundary.referencePoint &&
              " Poziția exactă a localității rămâne neconfirmată."}
          </p>
          <p>
            {c.boundary.level} · an sursă: {c.boundary.year}
          </p>
          <p>{c.boundary.source}</p>
          <a href={c.boundary.sourceURL} target="_blank" rel="noreferrer">
            Datele conturului
          </a>
          {" · "}
          <a
            href={
              c.boundary.licenseURL.startsWith("https://")
                ? c.boundary.licenseURL
                : "https://www.geoboundaries.org/api.html"
            }
            target="_blank"
            rel="noreferrer"
          >
            {c.boundary.license}
          </a>
        </div>
      )}
      {!c.boundary && c.locationAccuracy && (
        <p className="location-note">
          {c.geometry
            ? "Poziție orientativă: centrul localității sau al municipalității, din GeoNames. Nu delimitează comunitatea."
            : "Localizare neconfirmată. Înregistrarea este păstrată integral, fără un punct presupus pe hartă."}
        </p>
      )}
      {c.geocoding && (
        <p className="location-note">
          Sugestie de geocodare aleasă manual:{" "}
          {ACCURACY_LABELS[c.geocoding.accuracy]} · {c.geocoding.source}.
        </p>
      )}
      {c.geometrySource === "manual_correction" && (
        <p className="location-note">
          Geometrie corectată manual. Precizia nu este confirmată automat;
          conturul original rămâne în istoric.
        </p>
      )}
      {c.classification && <p>Clasificare: {c.classification}</p>}
      {point && (
        <div className="btn-row">
          <a
            href={`https://www.google.com/maps/dir/?api=1&destination=${point.lat},${point.lng}`}
            target="_blank"
            rel="noreferrer"
          >
            Google Maps
          </a>
          <a
            href={`https://waze.com/ul?ll=${point.lat},${point.lng}&navigate=yes`}
            target="_blank"
            rel="noreferrer"
          >
            Waze
          </a>
        </div>
      )}
      {c.population !== undefined && (
        <p>Populație estimată: {c.population.toLocaleString("ro-RO")}</p>
      )}
      {c.notes && <p>{c.notes}</p>}
      {!!c.extra && (
        <dl>
          {Object.entries(c.extra)
            .filter(([k]) => !k.startsWith("_"))
            .map(([k, v]) => (
              <div key={k}>
                <dt>{k}</dt>
                <dd>{v || "—"}</dd>
              </div>
            ))}
        </dl>
      )}
      {c.extra?._sourceSheet && (
        <p className="small muted">
          Sursă: {c.extra._sourceSheet}.html · rând {c.extra._sourceRow}.
          Cifrele din recensământ și estimările alternative nu se adună.
        </p>
      )}
      {c.extra?._geonamesId && (
        <a
          href={`https://www.geonames.org/${encodeURIComponent(c.extra._geonamesId)}`}
          target="_blank"
          rel="noreferrer"
        >
          Verifică localizarea în GeoNames · CC BY 4.0
        </a>
      )}
    </section>
  );
}
