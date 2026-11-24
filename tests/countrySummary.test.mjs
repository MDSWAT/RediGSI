import test from "node:test";
import assert from "node:assert/strict";
import { parseCountrySummary, manualSummaryCSV } from "../src/lib/countrySummary.ts";

const csv = [
  "Sumar demonstrativ,,,,,,,",
  '"Definiție, păstrată integral.",,,,,,,',
  "Tara,Romi - sursa principala*,Confirmate,Propuse,De validat,Sub prag,Localitati,Observatia esentiala",
  'Țara A,"1,000",2,1,0,3,6,Observația A',
  "Țara B,N/D,0,0,4,0,4,Populație indisponibilă",
  "TOTAL localitati,,2,1,4,3,10,",
  "Praguri din sursă.,,,,,,,",
].join("\r\n");

test("preserves original values and definitions, distinguishes unavailable population from zero", () => {
  const result = parseCountrySummary(csv, "synthetic.csv");
  assert.equal(result.countries.length, 2);
  assert.equal(result.countries[0].romaPopulation, 1000);
  assert.equal(result.countries[0].originalValues[1], "1,000");
  assert.equal(result.countries[1].romaPopulation, null);
  assert.equal(result.countries[1].confirmed, 0);
  assert.deepEqual(result.notes, ["Definiție, păstrată integral.", "Praguri din sursă."]);
  assert.deepEqual(result.totals, { confirmed: 2, proposed: 1, toValidate: 4, belowThreshold: 3, localities: 10 });
  assert.deepEqual(result.warnings, []);
});

test("reports inconsistent source totals without changing them", () => {
  const result = parseCountrySummary(csv.replace("TOTAL localitati,,2,1,4,3,10,", "TOTAL localitati,,2,1,4,3,11,"), "synthetic.csv");
  assert.equal(result.totals.localities, 11);
  assert.equal(result.warnings.length, 1);
});

test("rejects invalid counts, duplicate countries and absent totals", () => {
  assert.throws(() => parseCountrySummary(csv.replace(",2,1,0,3,6,", ",2.5,1,0,3,6,"), "synthetic.csv"), /numerică invalidă/);
  assert.throws(() => parseCountrySummary(csv.replace("Țara B", "Țara A"), "synthetic.csv"), /duplicate/);
  assert.throws(() => parseCountrySummary(csv.replace("TOTAL localitati", "Alt rând"), "synthetic.csv"), /TOTAL/);
});

test("leaves ordinary imports to the existing importer", () => {
  assert.equal(parseCountrySummary("nume,lat,lng\nTest,45,25", "points.csv"), null);
});

test("manual country entries preserve quoted notes, unknown population and derived totals", () => {
  const input = { country: "Țară de test", romaPopulation: "", confirmed: "2", proposed: "3", toValidate: "4", belowThreshold: "5", notes: 'O notă, cu "ghilimele"\nși două rânduri', sourceNote: "Sursă manuală" };
  const report = parseCountrySummary(manualSummaryCSV(input), "Introducere manuală");
  assert.equal(report.countries[0].romaPopulation, null);
  assert.equal(report.countries[0].notes, input.notes);
  assert.equal(report.totals.localities, 14);
  assert.equal(report.warnings.length, 0);
  assert.ok(report.notes.includes("Sursă: Sursă manuală"));
  assert.throws(() => manualSummaryCSV({ ...input, confirmed: "-1" }), /numerică invalidă/);
  assert.throws(() => manualSummaryCSV({ ...input, country: "" }), /țara/);
});
