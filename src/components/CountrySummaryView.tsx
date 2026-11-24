"use client";
import { Fragment } from "react";
import type { ImportedCountrySummary } from "@/lib/countrySummary";

const format = (value: number) => value.toLocaleString("ro-RO");

export default function CountrySummaryView({ report }: { report?: ImportedCountrySummary }) {
  if (!report) return <div className="summary-workspace"><h2>Sumare pe țări</h2><p className="muted">Importă un sumar REDI din panoul alăturat pentru a vedea toate cifrele și observațiile.</p></div>;
  return (
    <article className="summary-workspace">
      <div className="summary-title"><div><h2>{report.title}</h2><p>{report.countries.length} țări · {format(report.totals.localities)} localități în sursă</p></div><a href={`/api/summaries?source=${report.id}`} download>Descarcă CSV original</a></div>
      <p className="summary-context">Date agregate pe țări. Fișierul nu conține numele, coordonatele sau înregistrările individuale ale localităților.</p>
      <div className="summary-table-scroll" role="region" aria-label="Cifre și observații pe țări" tabIndex={0}>
        <table className="summary-table">
          <caption>Cifrele și observațiile din fișierul importat</caption>
          <thead><tr>{report.headers.slice(0, 7).map((header) => <th key={header} scope="col">{header}</th>)}</tr></thead>
          <tbody>{report.countries.map((row) => <Fragment key={row.country}>
            <tr><th scope="row">{row.country}</th><td>{row.romaPopulation === null ? "N/D" : format(row.romaPopulation)}</td><td>{format(row.confirmed)}</td><td>{format(row.proposed)}</td><td>{format(row.toValidate)}</td><td>{format(row.belowThreshold)}</td><td>{format(row.localities)}</td></tr>
            <tr className="summary-observation"><td colSpan={7}><span>{report.headers[7]}:</span> {row.notes || "—"}</td></tr>
          </Fragment>)}</tbody>
          <tfoot><tr><th scope="row">{report.totalOriginalValues[0]}</th><td aria-label="Total populație nespecificat în sursă">—</td><td>{format(report.totals.confirmed)}</td><td>{format(report.totals.proposed)}</td><td>{format(report.totals.toValidate)}</td><td>{format(report.totals.belowThreshold)}</td><td>{format(report.totals.localities)}</td></tr></tfoot>
        </table>
      </div>
      {report.warnings.length > 0 && <div className="summary-notes warn"><h3>Diferențe în sursă</h3>{report.warnings.map((note) => <p key={note}>{note}</p>)}</div>}
      <section className="summary-notes" aria-labelledby="summary-notes-title"><h3 id="summary-notes-title">Definiții și note din sursă</h3>{report.notes.map((note, i) => <p key={i}>{note}</p>)}</section>
      <footer className="summary-source"><p>Sursă: {report.sourceName}</p><p>Importat: {new Date(report.importedAt).toLocaleString("ro-RO", { timeZone: "Europe/Bucharest" })}. Valorile N/D rămân indisponibile; populațiile din surse cu acoperire diferită nu sunt însumate.</p></footer>
    </article>
  );
}
