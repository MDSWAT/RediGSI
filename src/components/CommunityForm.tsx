"use client";
import { useClassifications } from "@/lib/classifications";
import { useMemo, useState } from "react";
import type { Geometry } from "geojson";
import type {
  Community,
  CommunityKind,
  CommunityStatus,
  DB,
} from "@/lib/types";
import { KIND_LABELS, STATUS_LABELS } from "@/lib/types";
import {
  buildLocalityIndex,
  center,
  kindForGeometry,
  lookupLocality,
  nearestLocality,
  normCountry,
  normSiruta,
  parseNum,
} from "@/lib/geo";
import Dialog from "./Dialog";

interface Props {
  db: DB;
  /** New shape drawn on the map, or an existing community to edit. */
  geometry?: Geometry;
  existing?: Community;
  onSave: (c: Omit<Community, "id">) => Promise<void>;
  onCancel: () => void;
}

export default function CommunityForm({
  db,
  geometry,
  existing,
  onSave,
  onCancel,
}: Props) {
  const classifications = useClassifications();
  const geom = existing ? existing.geometry : geometry!;
  const idx = useMemo(() => buildLocalityIndex(db), [db]);
  const suggestion = useMemo(() => {
    if (existing || !geom) return undefined;
    const c = center(geom);
    return nearestLocality(idx, c.lat, c.lng, 15);
  }, [existing, geom, idx]);

  const [f, setF] = useState({
    name: existing?.name ?? "",
    classification: existing?.classification ?? "",
    kind: existing?.kind ?? (geom ? kindForGeometry(geom) : "punct"),
    status: existing?.status ?? ("propus" as CommunityStatus),
    siruta: existing?.siruta ?? suggestion?.siruta ?? "",
    locality: existing?.locality ?? suggestion?.name ?? "",
    county: existing?.county ?? suggestion?.county ?? "",
    country: existing?.country ?? suggestion?.country ?? "RO",
    population: existing?.population?.toString() ?? "",
    notes: existing?.notes ?? "",
  });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const set =
    (k: keyof typeof f) =>
    (
      e: React.ChangeEvent<
        HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
      >,
    ) =>
      setF((s) => ({ ...s, [k]: e.target.value }));

  const fillFromSiruta = () => {
    const ref = lookupLocality(idx, { siruta: f.siruta, country: f.country });
    if (ref)
      setF((s) => ({
        ...s,
        locality: ref.name ?? s.locality,
        county: ref.county ?? s.county,
        country: ref.country,
      }));
  };
  const fillFromLocality = () => {
    if (f.siruta) return;
    const ref = lookupLocality(idx, {
      locality: f.locality,
      county: f.county || undefined,
      country: f.country,
    });
    if (ref?.siruta)
      setF((s) => ({
        ...s,
        siruta: ref.siruta!,
        county: s.county || ref.county || "",
      }));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!f.name.trim()) return;
    setSaving(true);
    setError("");
    try {
      await onSave({
        name: f.name.trim(),
        classification: f.classification.trim() || undefined,
        kind: f.kind as CommunityKind,
        status: f.status,
        source: existing?.source ?? "manual",
        geometry: geom,
        locationAccuracy: existing?.locationAccuracy,
        boundary: existing?.boundary,
        siruta: normSiruta(f.siruta),
        locality: f.locality.trim() || undefined,
        county: f.county.trim() || undefined,
        country: normCountry(f.country),
        population: parseNum(f.population),
        notes: f.notes.trim() || undefined,
        extra: existing?.extra,
        createdAt: existing?.createdAt,
      });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog labelledBy="community-dialog-title" onClose={onCancel}>
      <form
        className="modal"
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
      >
        <h2 id="community-dialog-title">
          {existing ? "Editează comunitatea" : "Comunitate nouă"}
        </h2>
        {!existing && suggestion && (
          <p className="muted small">
            Localitate sugerată după poziție: <b>{suggestion.name}</b>
            {suggestion.county ? `, ${suggestion.county}` : ""}
          </p>
        )}
        <label>
          Nume *
          <input
            autoFocus
            required
            value={f.name}
            onChange={set("name")}
            placeholder="ex. Str. Florilor – Cartier Nord"
          />
        </label>
        <label>
          Clasificare comunitate
          <input
            list="community-classification-list"
            value={f.classification}
            onChange={set("classification")}
            placeholder="De exemplu, rurală sau urbană"
          />
        </label>
        <datalist id="community-classification-list">
          {classifications.map((c) => (
            <option key={c.id} value={c.name} />
          ))}
        </datalist>
        <div className="row">
          <label>
            Tip
            <select value={f.kind} onChange={set("kind")}>
              {Object.entries(KIND_LABELS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </label>
          <label>
            Status
            <select value={f.status} onChange={set("status")}>
              {Object.entries(STATUS_LABELS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="row">
          <label>
            Cod SIRUTA
            <input
              value={f.siruta}
              onChange={set("siruta")}
              onBlur={fillFromSiruta}
              inputMode="numeric"
            />
          </label>
          <label>
            Țară
            <input value={f.country} onChange={set("country")} maxLength={40} />
          </label>
        </div>
        <div className="row">
          <label>
            Localitate
            <input
              value={f.locality}
              onChange={set("locality")}
              onBlur={fillFromLocality}
            />
          </label>
          <label>
            Județ
            <input value={f.county} onChange={set("county")} />
          </label>
        </div>
        <label>
          Populație estimată
          <input
            value={f.population}
            onChange={set("population")}
            inputMode="numeric"
          />
        </label>
        <label>
          Observații
          <textarea rows={3} value={f.notes} onChange={set("notes")} />
        </label>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <div className="actions">
          <button type="button" onClick={onCancel}>
            Renunță
          </button>
          <button
            type="submit"
            className="primary"
            disabled={saving || !f.name.trim()}
          >
            {saving ? "Se salvează…" : "Salvează"}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
