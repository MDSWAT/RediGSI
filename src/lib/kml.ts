import { kml } from "@tmcw/togeojson";
import type { FeatureCollection, Geometry } from "geojson";
/** Uses a caller-provided XML parser so browser and regression tests share conversion. */
export function parseKML(
  text: string,
  parser: Pick<DOMParser, "parseFromString">,
): FeatureCollection<Geometry | null> {
  if (text.length > 25_000_000)
    throw new Error("Fișierul depășește limita de 25 MB.");
  if (/<!DOCTYPE|<!ENTITY/i.test(text))
    throw new Error(
      "KML cu declarații DTD sau entități externe nu este acceptat.",
    );
  const doc = parser.parseFromString(text, "text/xml");
  if (
    doc.getElementsByTagName("parsererror").length ||
    doc.documentElement?.localName !== "kml"
  )
    throw new Error("Fișierul nu este un document KML valid.");
  return kml(doc);
}
