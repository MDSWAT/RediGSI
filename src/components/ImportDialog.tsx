"use client";
import { findProbableDuplicates } from "@/lib/duplicates";
import { useMemo, useState } from "react";
import type { CollectionName } from "@/lib/types";
import { COLLECTION_LABELS } from "@/lib/types";
import { FIELDS, guessMapping } from "@/lib/fields";
import {
  buildRecords,
  parseFile,
  type ImportOptions,
  type ParsedFile,
} from "@/lib/importer";
import type { Store } from "@/lib/useStore";
import Dialog from "./Dialog";
import { parseCountrySummary, type CountrySummary } from "@/lib/countrySummary";

interface Props {
  store: Store;
  initialTarget?: CollectionName;
  onClose: () => void;
  onSummaryImported?: () => Promise<void>;
}

const HINTS: Record<CollectionName, string> = {
  communities:
    "Catalogul de comunități: un rând per comunitate. Poziția vine din lat/lng, din o coloană WKT/GeoJSON sau – dacă lipsește – din codul SIRUTA / numele localității (necesită nomenclatorul).",
  entrepreneurs:
    "Lista de antreprenori. Fiecare persoană e plasată pe hartă (coordonate sau localitate) și legată automat de comunitatea în care se află.",
  clients:
    "Clienții finanțați de un partener. Se compară cu comunitățile pe localitate (SIRUTA), județ și țară.",
  localities:
    "Nomenclatorul SIRUTA cu coordonate (cod, denumire, județ, lat, lng). Permite plasarea pe hartă a datelor care au doar localitatea sau codul SIRUTA.",
};

export default function ImportDialog({
  store,
  initialTarget = "communities",
  onClose,
  onSummaryImported,
}: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [parsed, setParsed] = useState<ParsedFile | null>(null);
  const [summary, setSummary] = useState<CountrySummary | null>(null);
  const [target, setTarget] = useState<CollectionName>(initialTarget);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [opts, setOpts] = useState<ImportOptions>({
    defaultCountry: "RO",
    defaultStatus: "validat",
    source: initialTarget === "communities" ? "catalog" : "import",
    partner: "",
  });
  const [batchId, setBatchId] = useState(() => crypto.randomUUID());
  const [excludeDuplicates, setExcludeDuplicates] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const load = async (f: File, sheet?: string) => {
    setError(null);
    setBatchId(crypto.randomUUID());
    setExcludeDuplicates(false);
    setDone(null);
    setParsed(null);
    setSummary(null);
    setFile(null);
    try {
      if (f.name.toLowerCase().endsWith(".csv")) {
        const report = parseCountrySummary(await f.text(), f.name);
        if (report) {
          setSummary(report);
          setFile(f);
          return;
        }
      }
      const p = await parseFile(f, sheet);
      if (!p.rows.length) throw new Error("Fișierul nu conține rânduri.");
      setFile(f);
      setParsed(p);
      setMapping(guessMapping(target, p.headers));
    } catch (e) {
      setError(`Nu am putut citi fișierul: ${(e as Error).message}`);
    }
  };

  const changeTarget = (t: CollectionName) => {
    setTarget(t);
    setOpts((o) => ({
      ...o,
      source: t === "communities" ? o.source : "import",
    }));
    if (parsed) setMapping(guessMapping(t, parsed.headers));
  };

  const preview = useMemo(() => {
    if (!parsed) return null;
    return buildRecords(
      target,
      {
        ...parsed,
        rows: parsed.rows.slice(0, 200),
        geometries: parsed.geometries?.slice(0, 200),
      },
      mapping,
      opts,
      store.db,
    );
  }, [parsed, target, mapping, opts, store.db]);

  const duplicates = useMemo(
    () =>
      preview
        ? findProbableDuplicates(target, preview.items, store.db[target])
        : [],
    [target, preview, store.db],
  );
  const run = async () => {
    if (!parsed && !summary) return;
    setBusy(true);
    setError(null);
    try {
      if (summary && file) {
        const form = new FormData();
        form.set("file", file);
        const response = await fetch("/api/summaries", {
          method: "POST",
          body: form,
        });
        const result = await response.json();
        if (!response.ok)
          throw new Error(result.error ?? "Importul sumarului a eșuat.");
        setDone(
          result.duplicate
            ? "Acest fișier este deja importat. Nu au fost create duplicate."
            : `Sumar importat: ${result.countries} țări, ${result.localities.toLocaleString("ro-RO")} localități. Toate cifrele și notele au fost păstrate.`,
        );
        await onSummaryImported?.();
        return;
      }
      if (!parsed) return;
      const res = buildRecords(target, parsed, mapping, opts, store.db);
      const duplicateRows = new Set(
        excludeDuplicates
          ? findProbableDuplicates(target, res.items, store.db[target]).map(
              (d) => d.index,
            )
          : [],
      );
      const items = res.items
        .filter((_, i) => !duplicateRows.has(i))
        .map((row) => ({
          ...row,
          id: undefined,
          datasetId: batchId,
          datasetName: parsed.name,
        }));
      await store.add(target, items);
      setDone(
        (duplicateRows.size
          ? `${duplicateRows.size} duplicate probabile excluse prin opțiunea selectată. `
          : "") +
          `Importate ${items.length} înregistrări în „${COLLECTION_LABELS[target]}”.` +
          (res.placedAtLocality
            ? ` ${res.placedAtLocality} plasate la centrul localității (fără coordonate exacte).`
            : "") +
          (target === "entrepreneurs"
            ? ` ${res.matchedCommunity} legate de o comunitate.`
            : "") +
          (res.skipped.length ? ` ${res.skipped.length} rânduri sărite.` : ""),
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const rowsTotal = parsed?.rows.length ?? 0;
  const previewNote =
    rowsTotal > 200 ? " (estimare pe primele 200 de rânduri)" : "";

  return (
    <Dialog labelledBy="import-dialog-title" onClose={onClose}>
      <div className="modal wide" onClick={(e) => e.stopPropagation()}>
        <h2 id="import-dialog-title">Import date</h2>

        <div className="row">
          <label>
            Ce importați?
            <select
              disabled={!!summary || busy}
              value={target}
              onChange={(e) => changeTarget(e.target.value as CollectionName)}
            >
              {(Object.keys(COLLECTION_LABELS) as CollectionName[]).map((c) => (
                <option key={c} value={c}>
                  {COLLECTION_LABELS[c]}
                </option>
              ))}
            </select>
          </label>
          <label>
            Fișier (CSV, Excel, GeoJSON, KML)
            <input
              type="file"
              disabled={busy}
              accept=".csv,.txt,.xlsx,.xls,.ods,.geojson,.json,.kml"
              onChange={(e) => e.target.files?.[0] && load(e.target.files[0])}
            />
          </label>
        </div>
        <p className="muted small">
          {summary
            ? "Sumar REDI detectat automat. Import separat de comunitățile geolocalizate, cu toate cifrele, observațiile și fișierul original."
            : HINTS[target]}
        </p>
        {summary && (
          <div className="preview">
            <h3>{summary.title}</h3>
            <p>
              {summary.countries.length} țări ·{" "}
              {summary.totals.localities.toLocaleString("ro-RO")} localități ·{" "}
              {summary.notes.length} note și definiții
            </p>
            <p>{summary.countries.map((row) => row.country).join(", ")}</p>
            {summary.warnings.map((warning) => (
              <p key={warning} className="warn">
                {warning}
              </p>
            ))}
          </div>
        )}

        {parsed?.sheets && parsed.sheets.length > 1 && file && (
          <label>
            Foaie Excel
            <select
              value={parsed.sheet}
              onChange={(e) => load(file, e.target.value)}
            >
              {parsed.sheets.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
        )}

        {parsed && (
          <>
            <h3>
              Potrivire coloane{" "}
              <span className="muted small">
                ({rowsTotal} rânduri în „{parsed.name}”
                {parsed.geometries ? ", cu geometrii" : ""})
              </span>
            </h3>
            <div className="mapping">
              {FIELDS[target].map((fd) => (
                <label key={fd.key} className={mapping[fd.key] ? "mapped" : ""}>
                  <span>
                    {fd.label}
                    {fd.hint && <em className="muted"> – {fd.hint}</em>}
                  </span>
                  <select
                    value={mapping[fd.key] ?? ""}
                    onChange={(e) =>
                      setMapping((m) => ({ ...m, [fd.key]: e.target.value }))
                    }
                  >
                    <option value="">— nu există —</option>
                    {parsed.headers.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
            <p className="muted small">
              Coloanele nepotrivite sunt păstrate în registru ca date
              suplimentare. Exportul include numai câmpurile permise rolului.
            </p>

            <div className="row">
              <label>
                Țară implicită
                <input
                  value={opts.defaultCountry}
                  onChange={(e) =>
                    setOpts({ ...opts, defaultCountry: e.target.value })
                  }
                />
              </label>
              {target === "communities" && (
                <>
                  <label>
                    Status implicit
                    <select
                      value={opts.defaultStatus}
                      onChange={(e) =>
                        setOpts({
                          ...opts,
                          defaultStatus: e.target
                            .value as ImportOptions["defaultStatus"],
                        })
                      }
                    >
                      <option value="validat">Validată</option>
                      <option value="propus">Propusă</option>
                    </select>
                  </label>
                  <label>
                    Sursă
                    <select
                      value={opts.source}
                      onChange={(e) =>
                        setOpts({
                          ...opts,
                          source: e.target.value as ImportOptions["source"],
                        })
                      }
                    >
                      <option value="catalog">
                        Catalog (comunități validate)
                      </option>
                      <option value="import">Alt import</option>
                    </select>
                  </label>
                </>
              )}
              {target === "clients" && !mapping.partner && (
                <label>
                  Nume partener *
                  <input
                    value={opts.partner}
                    onChange={(e) =>
                      setOpts({ ...opts, partner: e.target.value })
                    }
                    placeholder="ex. Banca X"
                  />
                </label>
              )}
            </div>

            {!!duplicates.length && (
              <div className="preview">
                <p>
                  {duplicates.length} duplicate probabile{previewNote},
                  comparate cu registrul și rândurile fișierului. Înregistrările
                  nu sunt eliminate automat.
                </p>
                <label className="check-filter consent-field">
                  <input
                    type="checkbox"
                    checked={excludeDuplicates}
                    onChange={(e) => setExcludeDuplicates(e.target.checked)}
                  />
                  Exclude duplicatele probabile la acest import
                </label>
              </div>
            )}
            {preview && (
              <div className="preview">
                <b>Previzualizare{previewNote}:</b> {preview.items.length} de
                importat
                {preview.placedAtLocality > 0 && (
                  <>
                    {" "}
                    · {preview.placedAtLocality} plasate la centrul localității
                  </>
                )}
                {target === "entrepreneurs" && (
                  <> · {preview.matchedCommunity} legate de o comunitate</>
                )}
                {preview.skipped.length > 0 && (
                  <>
                    {" "}
                    ·{" "}
                    <span className="warn">
                      {preview.skipped.length} sărite
                    </span>
                    <ul className="small">
                      {preview.skipped.slice(0, 5).map((s) => (
                        <li key={s.row}>
                          rândul {s.row}: {s.reason}
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
            )}
          </>
        )}

        {error && <p className="error">{error}</p>}
        {done && <p className="ok">{done}</p>}

        <div className="actions">
          <button onClick={onClose}>{done ? "Închide" : "Renunță"}</button>
          <button
            className="primary"
            disabled={
              (!parsed && !summary) ||
              busy ||
              !!done ||
              (!summary &&
                target === "clients" &&
                !mapping.partner &&
                !opts.partner.trim())
            }
            onClick={run}
          >
            {busy
              ? "Se importă…"
              : summary
                ? "Importă sumarul"
                : `Importă ${rowsTotal || ""} rânduri`}
          </button>
        </div>
      </div>
    </Dialog>
  );
}
