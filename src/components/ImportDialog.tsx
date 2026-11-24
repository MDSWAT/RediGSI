"use client";
import { useMemo, useState } from "react";
import type { CollectionName } from "@/lib/types";
import { COLLECTION_LABELS } from "@/lib/types";
import { FIELDS, guessMapping } from "@/lib/fields";
import { buildRecords, parseFile, type ImportOptions, type ParsedFile } from "@/lib/importer";
import type { Store } from "@/lib/useStore";

interface Props {
  store: Store;
  initialTarget?: CollectionName;
  onClose: () => void;
}

const HINTS: Record<CollectionName, string> = {
  communities: "Catalogul de comunități: un rând per comunitate. Poziția vine din lat/lng, din o coloană WKT/GeoJSON sau – dacă lipsește – din codul SIRUTA / numele localității (necesită nomenclatorul).",
  entrepreneurs: "Lista de antreprenori. Fiecare persoană e plasată pe hartă (coordonate sau localitate) și legată automat de comunitatea în care se află.",
  clients: "Clienții finanțați de un partener. Se compară cu comunitățile pe localitate (SIRUTA), județ și țară.",
  localities: "Nomenclatorul SIRUTA cu coordonate (cod, denumire, județ, lat, lng). Permite plasarea pe hartă a datelor care au doar localitatea sau codul SIRUTA.",
};

export default function ImportDialog({ store, initialTarget = "communities", onClose }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [parsed, setParsed] = useState<ParsedFile | null>(null);
  const [target, setTarget] = useState<CollectionName>(initialTarget);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [opts, setOpts] = useState<ImportOptions>({
    defaultCountry: "RO",
    defaultStatus: "validat",
    source: initialTarget === "communities" ? "catalog" : "import",
    partner: "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const load = async (f: File, sheet?: string) => {
    setError(null);
    setDone(null);
    try {
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
    setOpts((o) => ({ ...o, source: t === "communities" ? o.source : "import" }));
    if (parsed) setMapping(guessMapping(t, parsed.headers));
  };

  const preview = useMemo(() => {
    if (!parsed) return null;
    return buildRecords(target, { ...parsed, rows: parsed.rows.slice(0, 200), geometries: parsed.geometries?.slice(0, 200) }, mapping, opts, store.db);
  }, [parsed, target, mapping, opts, store.db]);

  const run = async () => {
    if (!parsed) return;
    setBusy(true);
    setError(null);
    try {
      const res = buildRecords(target, parsed, mapping, opts, store.db);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const items = res.items.map(({ id, ...rest }) => rest);
      await store.add(target, items);
      setDone(
        `Importate ${items.length} înregistrări în „${COLLECTION_LABELS[target]}”.` +
        (res.placedAtLocality ? ` ${res.placedAtLocality} plasate la centrul localității (fără coordonate exacte).` : "") +
        (target === "entrepreneurs" ? ` ${res.matchedCommunity} legate de o comunitate.` : "") +
        (res.skipped.length ? ` ${res.skipped.length} rânduri sărite.` : ""),
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const rowsTotal = parsed?.rows.length ?? 0;
  const previewNote = rowsTotal > 200 ? " (estimare pe primele 200 de rânduri)" : "";

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal wide" onClick={(e) => e.stopPropagation()}>
        <h2>Import date</h2>

        <div className="row">
          <label>Ce importați?
            <select value={target} onChange={(e) => changeTarget(e.target.value as CollectionName)}>
              {(Object.keys(COLLECTION_LABELS) as CollectionName[]).map((c) => <option key={c} value={c}>{COLLECTION_LABELS[c]}</option>)}
            </select>
          </label>
          <label>Fișier (CSV, Excel, GeoJSON)
            <input type="file" accept=".csv,.txt,.xlsx,.xls,.ods,.geojson,.json" onChange={(e) => e.target.files?.[0] && load(e.target.files[0])} />
          </label>
        </div>
        <p className="muted small">{HINTS[target]}</p>

        {parsed?.sheets && parsed.sheets.length > 1 && file && (
          <label>Foaie Excel
            <select value={parsed.sheet} onChange={(e) => load(file, e.target.value)}>
              {parsed.sheets.map((s) => <option key={s}>{s}</option>)}
            </select>
          </label>
        )}

        {parsed && (
          <>
            <h3>Potrivire coloane <span className="muted small">({rowsTotal} rânduri în „{parsed.name}”{parsed.geometries ? ", cu geometrii" : ""})</span></h3>
            <div className="mapping">
              {FIELDS[target].map((fd) => (
                <label key={fd.key} className={mapping[fd.key] ? "mapped" : ""}>
                  <span>{fd.label}{fd.hint && <em className="muted"> – {fd.hint}</em>}</span>
                  <select value={mapping[fd.key] ?? ""} onChange={(e) => setMapping((m) => ({ ...m, [fd.key]: e.target.value }))}>
                    <option value="">— nu există —</option>
                    {parsed.headers.map((h) => <option key={h} value={h}>{h}</option>)}
                  </select>
                </label>
              ))}
            </div>
            <p className="muted small">Coloanele nepotrivite sunt păstrate ca „date suplimentare” și apar la export.</p>

            <div className="row">
              <label>Țară implicită
                <input value={opts.defaultCountry} onChange={(e) => setOpts({ ...opts, defaultCountry: e.target.value })} />
              </label>
              {target === "communities" && (
                <>
                  <label>Status implicit
                    <select value={opts.defaultStatus} onChange={(e) => setOpts({ ...opts, defaultStatus: e.target.value as ImportOptions["defaultStatus"] })}>
                      <option value="validat">Validată</option>
                      <option value="propus">Propusă</option>
                    </select>
                  </label>
                  <label>Sursă
                    <select value={opts.source} onChange={(e) => setOpts({ ...opts, source: e.target.value as ImportOptions["source"] })}>
                      <option value="catalog">Catalog (comunități validate)</option>
                      <option value="import">Alt import</option>
                    </select>
                  </label>
                </>
              )}
              {target === "clients" && !mapping.partner && (
                <label>Nume partener *
                  <input value={opts.partner} onChange={(e) => setOpts({ ...opts, partner: e.target.value })} placeholder="ex. Banca X" />
                </label>
              )}
            </div>

            {preview && (
              <div className="preview">
                <b>Previzualizare{previewNote}:</b> {preview.items.length} de importat
                {preview.placedAtLocality > 0 && <> · {preview.placedAtLocality} plasate la centrul localității</>}
                {target === "entrepreneurs" && <> · {preview.matchedCommunity} legate de o comunitate</>}
                {preview.skipped.length > 0 && (
                  <> · <span className="warn">{preview.skipped.length} sărite</span>
                    <ul className="small">{preview.skipped.slice(0, 5).map((s) => <li key={s.row}>rândul {s.row}: {s.reason}</li>)}</ul>
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
          <button className="primary" disabled={!parsed || busy || !!done || (target === "clients" && !mapping.partner && !opts.partner.trim())} onClick={run}>
            {busy ? "Se importă…" : `Importă ${rowsTotal || ""} rânduri`}
          </button>
        </div>
      </div>
    </div>
  );
}
