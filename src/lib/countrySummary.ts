import Papa from "papaparse";

export const COUNT_FIELDS = ["confirmed", "proposed", "toValidate", "belowThreshold", "localities"] as const;
export type CountField = typeof COUNT_FIELDS[number];
export type SummaryCounts = Record<CountField, number>;
export interface CountrySummaryRow extends SummaryCounts {
  country: string;
  romaPopulation: number | null;
  notes: string;
  originalValues: string[];
}
export interface CountrySummary {
  sourceSheets?: { sheet: string; rows: { sourceRow: number | null; cells: { text: string; links: string[]; colspan: number }[] }[] }[];
  coverage?: Record<string, number>;
  title: string;
  sourceName: string;
  headers: string[];
  countries: CountrySummaryRow[];
  totals: SummaryCounts;
  totalOriginalValues: string[];
  notes: string[];
  warnings: string[];
}
export interface ImportedCountrySummary extends CountrySummary {
  id: string;
  importedAt: string;
}

/** A manual country entry uses the same validated, source-preserving report format. */
export function manualSummaryCSV(input: Record<string, unknown>): string {
  const text = (key: string) => typeof input[key] === "string" || typeof input[key] === "number" ? String(input[key]).trim() : "";
  const country = text("country");
  if (!country) throw new Error("Completați țara.");
  const categories = ["confirmed", "proposed", "toValidate", "belowThreshold"].map((key) => count(text(key), key));
  const localities = categories.reduce((sum, value) => sum + value, 0);
  if (!Number.isSafeInteger(localities)) throw new Error("Totalul localităților este prea mare.");
  const population = text("romaPopulation") ? String(count(text("romaPopulation"), "populație Roma")) : "N/D";
  return Papa.unparse([
    ["REDI | Sumar introdus manual", "", "", "", "", "", "", ""],
    ["Date introduse manual; sumarele importate rămân nemodificate.", "", "", "", "", "", "", ""],
    ["Tara", "Romi - sursa principala*", "Confirmate", "Propuse", "De validat", "Sub prag", "Localitati", "Observatia esentiala"],
    [country, population, ...categories.map(String), String(localities), text("notes")],
    ["TOTAL localitati", "", ...categories.map(String), String(localities), ""],
    ...(text("sourceNote") ? [[`Sursă: ${text("sourceNote")}`, "", "", "", "", "", "", ""]] : []),
  ]);
}

const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
const expected = ["tara", "romi - sursa principala*", "confirmate", "propuse", "de validat", "sub prag", "localitati", "observatia esentiala"];

function count(value: string, label: string): number {
  if (!/^(?:\d+|\d{1,3}(?:,\d{3})+)$/.test(value.trim())) throw new Error(`Valoare numerică invalidă: ${label}.`);
  const result = Number(value.replaceAll(",", ""));
  if (!Number.isSafeInteger(result)) throw new Error(`Valoare numerică prea mare: ${label}.`);
  return result;
}

/** Recognises the REDI summary table below its title and explanatory preamble. */
export function parseCountrySummary(csv: string, sourceName: string): CountrySummary | null {
  const result = Papa.parse<string[]>(csv.replace(/^\uFEFF/, ""), { skipEmptyLines: false });
  const rows = result.data;
  const headerIndex = rows.findIndex((row) => expected.every((header, i) => normalize(row[i] ?? "") === header));
  if (headerIndex < 0) return null;
  if (result.errors.length) throw new Error("CSV invalid: verificați ghilimelele și delimitatorii.");
  const totalIndex = rows.findIndex((row, i) => i > headerIndex && normalize(row[0] ?? "") === "total localitati");
  if (totalIndex < 0) throw new Error("Lipsește rândul TOTAL localitati.");
  const parseCounts = (row: string[], label: string): SummaryCounts => Object.fromEntries(
    COUNT_FIELDS.map((key, i) => [key, count(row[i + 2] ?? "", `${label}, ${rows[headerIndex][i + 2]}`)]),
  ) as SummaryCounts;
  const countries = rows.slice(headerIndex + 1, totalIndex).filter((row) => row.some((cell) => cell.trim())).map((row) => {
    if (row.length !== expected.length || !row[0]?.trim()) throw new Error("Rând de țară incomplet în sumar.");
    return {
      country: row[0], romaPopulation: /^(?:N\/D|N\/A|)$/i.test(row[1].trim()) ? null : count(row[1], row[0]),
      ...parseCounts(row, row[0]), notes: row[7], originalValues: row,
    };
  });
  if (!countries.length) throw new Error("Sumarul nu conține țări.");
  if (new Set(countries.map((row) => normalize(row.country))).size !== countries.length) throw new Error("Sumarul conține țări duplicate.");
  const totals = parseCounts(rows[totalIndex], "TOTAL");
  const warnings: string[] = [];
  for (const key of COUNT_FIELDS) {
    const actual = countries.reduce((sum, row) => sum + row[key], 0);
    if (actual !== totals[key]) warnings.push(`${rows[headerIndex][COUNT_FIELDS.indexOf(key) + 2]}: totalul declarat ${totals[key]} diferă de suma pe țări ${actual}.`);
  }
  for (const row of countries) {
    if (row.confirmed + row.proposed + row.toValidate + row.belowThreshold !== row.localities) warnings.push(`${row.country}: categoriile nu însumează numărul de localități.`);
  }
  return {
    title: rows[0][0], sourceName, headers: rows[headerIndex], countries, totals,
    totalOriginalValues: rows[totalIndex], warnings,
    notes: rows.filter((_, i) => (i > 0 && i < headerIndex) || i > totalIndex).filter((row) => row.some((cell) => cell.trim())).map((row) => row.filter((cell) => cell.trim()).join(" · ")),
  };
}
