import type { CollectionName } from "./types";
import { norm } from "./geo";

export interface FieldDef {
  key: string;
  label: string;
  /** Column names (any language / spelling) that auto-map to this field. */
  aliases: string[];
  hint?: string;
}

const LOC: FieldDef[] = [
  {
    key: "siruta",
    label: "Cod SIRUTA",
    aliases: [
      "siruta",
      "cod siruta",
      "cod_siruta",
      "sirsup",
      "cod uat",
      "uat code",
    ],
  },
  {
    key: "locality",
    label: "Localitate",
    aliases: [
      "localitate",
      "localitatea",
      "localitati",
      "oras",
      "municipiu",
      "comuna",
      "uat",
      "locality",
      "city",
      "town",
      "village",
      "denloc",
    ],
  },
  {
    key: "county",
    label: "Județ",
    aliases: ["judet", "judetul", "jud", "county", "region", "regiune"],
  },
  {
    key: "country",
    label: "Țară",
    aliases: ["tara", "country", "cod tara", "country code"],
  },
  {
    key: "lat",
    label: "Latitudine",
    aliases: ["lat", "latitude", "latitudine", "y", "gps lat"],
  },
  {
    key: "lng",
    label: "Longitudine",
    aliases: [
      "lng",
      "lon",
      "long",
      "longitude",
      "longitudine",
      "x",
      "gps lon",
      "gps long",
    ],
  },
  {
    key: "coords",
    label: "Coordonate „lat, lng” (o coloană)",
    aliases: [
      "coordonate",
      "coordinates",
      "gps",
      "coord",
      "latlng",
      "lat lng",
      "lat long",
    ],
    hint: "ex. 44.4268, 26.1025",
  },
];

export const FIELDS: Record<CollectionName, FieldDef[]> = {
  communities: [
    {
      key: "name",
      label: "Nume comunitate",
      aliases: [
        "nume",
        "denumire",
        "comunitate",
        "nume comunitate",
        "community",
        "name",
        "titlu",
      ],
    },
    {
      key: "classification",
      label: "Clasificare comunitate",
      aliases: ["clasificare", "classification", "community classification"],
    },
    {
      key: "kind",
      label: "Tip (punct/stradă/cartier/zonă)",
      aliases: ["tip", "type", "tip comunitate", "kind"],
    },
    {
      key: "status",
      label: "Status (validată/propusă)",
      aliases: ["status", "stare", "validare", "validat", "validated"],
    },
    ...LOC,
    {
      key: "geometry",
      label: "Geometrie (WKT sau GeoJSON)",
      aliases: [
        "geometry",
        "geometrie",
        "geom",
        "the geom",
        "wkt",
        "shape",
        "geojson",
      ],
    },
    {
      key: "population",
      label: "Populație estimată",
      aliases: [
        "populatie",
        "nr persoane",
        "numar persoane",
        "population",
        "locuitori",
        "nr locuitori",
        "persoane",
      ],
    },
    {
      key: "notes",
      label: "Observații",
      aliases: [
        "observatii",
        "note",
        "notes",
        "descriere",
        "description",
        "comentarii",
        "detalii",
      ],
    },
  ],
  entrepreneurs: [
    {
      key: "name",
      label: "Nume antreprenor",
      aliases: [
        "nume",
        "nume prenume",
        "name",
        "antreprenor",
        "persoana",
        "persoana contact",
        "contact",
        "beneficiar",
      ],
    },
    {
      key: "business",
      label: "Firmă / afacere",
      aliases: [
        "firma",
        "afacere",
        "companie",
        "societate",
        "denumire firma",
        "business",
        "company",
        "pfa",
        "srl",
      ],
    },
    {
      key: "sector",
      label: "Domeniu / CAEN",
      aliases: [
        "domeniu",
        "sector",
        "activitate",
        "caen",
        "cod caen",
        "industry",
        "domeniu activitate",
      ],
    },
    {
      key: "phone",
      label: "Telefon",
      aliases: ["telefon", "tel", "phone", "mobil", "nr telefon"],
    },
    { key: "email", label: "Email", aliases: ["email", "e mail", "mail"] },
    {
      key: "address",
      label: "Adresă",
      aliases: ["adresa", "address", "strada", "str"],
    },
    ...LOC,
  ],
  clients: [
    {
      key: "partner",
      label: "Partener finanțator",
      aliases: [
        "partener",
        "partner",
        "finantator",
        "banca",
        "ifn",
        "institutie",
        "lender",
      ],
    },
    {
      key: "name",
      label: "Nume client",
      aliases: [
        "nume",
        "client",
        "nume client",
        "beneficiar",
        "name",
        "customer",
      ],
    },
    {
      key: "amount",
      label: "Sumă finanțată",
      aliases: [
        "suma",
        "valoare",
        "amount",
        "credit",
        "finantare",
        "suma finantata",
        "valoare credit",
        "loan",
      ],
    },
    {
      key: "currency",
      label: "Monedă (cod ISO)",
      aliases: ["moneda", "valuta", "currency", "currency code"],
    },
    {
      key: "year",
      label: "An / dată",
      aliases: ["an", "anul", "year", "data", "date", "data acordarii"],
    },
    ...LOC,
  ],
  localities: [
    {
      key: "siruta",
      label: "Cod SIRUTA",
      aliases: ["siruta", "cod siruta", "cod_siruta", "code"],
    },
    {
      key: "name",
      label: "Denumire localitate",
      aliases: ["denloc", "denumire", "localitate", "nume", "name"],
    },
    LOC[2],
    LOC[3],
    LOC[4],
    LOC[5],
    LOC[6],
  ],
};

/** Best-effort automatic column → field mapping. Returns { fieldKey: header }. */
export function guessMapping(
  collection: CollectionName,
  headers: string[],
): Record<string, string> {
  const mapping: Record<string, string> = {};
  const used = new Set<string>();
  const nh = headers.map((h) => ({ h, n: norm(h) }));
  const fields = FIELDS[collection];

  // Pass 1: exact alias match. Pass 2: all words of an alias appear as whole words in the header
  // ("Suma finantata" → suma, but "Status" ≠ "stat").
  const hasWords = (n: string, a: string) => {
    const words = new Set(n.split(" "));
    return a.length >= 3 && a.split(" ").every((w) => words.has(w));
  };
  for (const exact of [true, false]) {
    for (const f of fields) {
      if (mapping[f.key]) continue;
      const aliases = [f.key, ...f.aliases].map(norm);
      const hit = nh.find(
        ({ h, n }) =>
          !used.has(h) &&
          aliases.some((a) => (exact ? n === a : hasWords(n, a))),
      );
      if (hit) {
        mapping[f.key] = hit.h;
        used.add(hit.h);
      }
    }
  }
  return mapping;
}
