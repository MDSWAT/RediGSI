"use client";
import { useState } from "react";
import type { CollectionName } from "@/lib/types";
import { COLLECTION_LABELS } from "@/lib/types";
import { FIELDS, type FieldDef } from "@/lib/fields";
import { buildRecords } from "@/lib/importer";
import { manualSummaryCSV } from "@/lib/countrySummary";
import { parseNum, validLatLng } from "@/lib/geo";
import type { Store } from "@/lib/useStore";
import Dialog from "./Dialog";

export type ManualTarget = CollectionName | "summary";
const summaryFields: FieldDef[] = [
  { key: "country", label: "Țară", aliases: [] },
  { key: "romaPopulation", label: "Populație Roma (gol = N/D)", aliases: [] },
  { key: "confirmed", label: "Localități confirmate", aliases: [] },
  { key: "proposed", label: "Localități propuse", aliases: [] },
  { key: "toValidate", label: "Localități de validat", aliases: [] },
  { key: "belowThreshold", label: "Localități sub prag", aliases: [] },
  { key: "sourceNote", label: "Sursa datelor", aliases: [] },
  { key: "notes", label: "Observații", aliases: [] },
];
const numberFields = new Set(["lat", "lng", "population", "amount", "romaPopulation", "confirmed", "proposed", "toValidate", "belowThreshold"]);
const defaults = () => ({ country: "RO", status: "propus", confirmed: "0", proposed: "0", toValidate: "0", belowThreshold: "0" } as Record<string, string>);

export default function ManualEntryDialog({ store, initialTarget, onSaved, onClose }: {
  store: Store; initialTarget: ManualTarget; onSaved: (target: ManualTarget) => Promise<void>; onClose: () => void;
}) {
  const [target, setTarget] = useState<ManualTarget>(initialTarget);
  const [values, setValues] = useState<Record<string, string>>(defaults);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fields = target === "summary" ? summaryFields : FIELDS[target].filter((field) => !["kind", "coords", "geometry"].includes(field.key));
  const close = () => { if (!saving) onClose(); };
  const update = (key: string, value: string) => setValues((current) => ({ ...current, [key]: value }));

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      if (target === "summary") {
        manualSummaryCSV(values); // Validate counts before sending.
        const response = await fetch("/api/summaries/manual", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(values) });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error ?? "Sumarul nu a putut fi salvat.");
      } else {
        if (!values.name?.trim()) throw new Error("Completați numele.");
        if (target === "clients" && !values.partner?.trim()) throw new Error("Completați partenerul finanțator.");
        if ((values.lat?.trim() || values.lng?.trim()) && !validLatLng(parseNum(values.lat), parseNum(values.lng))) throw new Error("Introduceți ambele coordonate valide: latitudine între -90 și 90, longitudine între -180 și 180.");
        const mapping = Object.fromEntries(FIELDS[target].map((field) => [field.key, field.key]));
        const row = Object.fromEntries(FIELDS[target].map((field) => [field.key, values[field.key] || ""]));
        const result = buildRecords(target, { name: "Introducere manuală", headers: Object.keys(row), rows: [row] }, mapping, { defaultCountry: values.country || "RO", defaultStatus: "propus", source: "manual", partner: values.partner || "" }, store.db);
        if (!result.items.length) throw new Error(result.skipped[0]?.reason ?? "Verificați datele completate.");
        const { id, ...record } = result.items[0];
        void id;
        await store.add(target, [record]);
      }
      await onSaved(target);
      onClose();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Salvarea a eșuat. Reîncercați."); }
    finally { setSaving(false); }
  };

  const renderField = (field: FieldDef) => {
    const required = field.key === "country" || field.key === "name" || (target === "clients" && field.key === "partner") || (target === "localities" && ["siruta", "lat", "lng"].includes(field.key)) || (target === "summary" && ["confirmed", "proposed", "toValidate", "belowThreshold"].includes(field.key));
    return <label key={field.key}>{field.label}{required ? " *" : ""}
      {field.key === "status" ? <select value={values.status} onChange={(event) => update(field.key, event.target.value)}><option value="propus">Propusă</option><option value="validat">Validată</option></select>
        : ["notes", "geometry"].includes(field.key) ? <textarea rows={3} value={values[field.key] || ""} onChange={(event) => update(field.key, event.target.value)} />
          : <input required={required} type={numberFields.has(field.key) ? "number" : field.key === "email" ? "email" : field.key === "phone" ? "tel" : "text"}
            step={field.key === "amount" || field.key === "lat" || field.key === "lng" ? "any" : "1"}
            min={field.key === "lat" ? -90 : field.key === "lng" ? -180 : numberFields.has(field.key) ? 0 : undefined}
            max={field.key === "lat" ? 90 : field.key === "lng" ? 180 : undefined}
            value={values[field.key] || ""} onChange={(event) => update(field.key, event.target.value)} />}
    </label>;
  };

  return <Dialog labelledBy="manual-entry-title" onClose={close}>
    <form className="modal wide" onSubmit={submit}>
      <h2 id="manual-entry-title">Adaugă manual</h2>
      <label>Tip de înregistrare<select disabled={saving} value={target} onChange={(event) => { setTarget(event.target.value as ManualTarget); setValues(defaults()); setError(null); }}>
        {(Object.entries(COLLECTION_LABELS) as [CollectionName, string][]).map(([key, label]) => <option key={key} value={key}>{label}</option>)}<option value="summary">Sumar REDI pe țară</option>
      </select></label>
      <p className="muted small">{target === "communities" ? "Completați coordonatele sau o localitate / un cod SIRUTA din nomenclator. Pentru limite de stradă sau cartier, folosiți desenarea pe hartă." : target === "summary" ? "Creați un sumar separat pentru o țară. Totalul localităților se calculează din cele patru categorii; populația necunoscută rămâne N/D." : "Câmpurile marcate cu * sunt obligatorii. Datele se salvează direct în baza de date."}</p>
      <fieldset disabled={saving} className="manual-fields">{fields.map(renderField)}</fieldset>
      {target === "summary" && <p className="small">Total localități: {["confirmed", "proposed", "toValidate", "belowThreshold"].reduce((sum, key) => sum + (Number(values[key]) || 0), 0).toLocaleString("ro-RO")}</p>}
      {error && <p className="error" role="alert">{error}</p>}
      <div className="actions"><button type="button" disabled={saving} onClick={close}>Renunță</button><button type="submit" className="primary" disabled={saving}>{saving ? "Se salvează…" : "Salvează înregistrarea"}</button></div>
    </form>
  </Dialog>;
}
