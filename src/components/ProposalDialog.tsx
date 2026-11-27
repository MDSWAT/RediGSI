"use client";
import { useClassifications } from "@/lib/classifications";
import { useState } from "react";
import type { Geometry } from "geojson";
import Dialog from "./Dialog";
import { COUNTRY_LABELS } from "@/lib/types";
export interface ProposalFields {
  name: string;
  country: string;
  county: string;
  locality: string;
  classification: string;
  notes: string;
  supportingInformation: string;
  lat: string;
  lng: string;
}
export default function ProposalDialog({
  geometry,
  onClose,
  onDraw,
  initialValues,
}: {
  geometry?: Geometry;
  onClose: () => void;
  onDraw: (fields: ProposalFields) => void;
  initialValues?: ProposalFields;
}) {
  const classifications = useClassifications();
  const [f, setF] = useState<ProposalFields>(
    initialValues ?? {
      name: "",
      country: "RO",
      county: "",
      locality: "",
      classification: "",
      notes: "",
      supportingInformation: "",
      lat: "",
      lng: "",
    },
  );
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [reference, setReference] = useState("");
  const field =
    (k: keyof typeof f) =>
    (
      e: React.ChangeEvent<
        HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
      >,
    ) =>
      setF((v) => ({ ...v, [k]: e.target.value }));
  return (
    <Dialog labelledBy="proposal-title" onClose={onClose}>
      <form
        className="modal wide"
        onSubmit={async (e) => {
          e.preventDefault();
          setError("");
          const lat = Number(f.lat),
            lng = Number(f.lng);
          if (
            !geometry &&
            (!f.lat.trim() ||
              !f.lng.trim() ||
              !Number.isFinite(lat) ||
              !Number.isFinite(lng) ||
              Math.abs(lat) > 90 ||
              Math.abs(lng) > 180)
          ) {
            setError(
              "Introduceți coordonate valide sau desenați limita pe hartă.",
            );
            return;
          }
          setBusy(true);
          try {
            const r = await fetch("/api/proposals", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                ...f,
                geometry: geometry ?? {
                  type: "Point",
                  coordinates: [lng, lat],
                },
                consent,
              }),
            });
            const body = await r.json();
            if (!r.ok) throw new Error(body.error);
            setReference(body.id);
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <h2 id="proposal-title">
          {reference ? "Propunerea a fost trimisă" : "Propune o comunitate"}
        </h2>
        {reference ? (
          <>
            <p>
              Propunerea va fi verificată înainte de a intra în registru.
              Poziția nu este publicată automat.
            </p>
            <p className="muted small">Referință: {reference}</p>
            <button type="button" className="primary" onClick={onClose}>
              Închide
            </button>
          </>
        ) : (
          <>
            <p className="muted small">
              Adaugă informații despre o comunitate. Evită numele persoanelor,
              datele de contact și alte informații personale.
            </p>
            <label>
              Numele comunității
              <input
                required
                minLength={3}
                maxLength={200}
                autoFocus
                value={f.name}
                onChange={field("name")}
              />
            </label>
            <div className="manual-fields">
              <label>
                Țară
                <select value={f.country} onChange={field("country")}>
                  {Object.entries(COUNTRY_LABELS).map(([code, name]) => (
                    <option key={code} value={code}>
                      {name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Județ / regiune
                <input
                  value={f.county}
                  onChange={field("county")}
                  maxLength={200}
                />
              </label>
              <label>
                Localitate
                <input
                  value={f.locality}
                  onChange={field("locality")}
                  maxLength={200}
                />
              </label>
              <label>
                Clasificare comunitate
                <input
                  list="proposal-classification-list"
                  value={f.classification}
                  onChange={field("classification")}
                  placeholder="De exemplu, rurală sau urbană"
                  maxLength={200}
                />
              </label>
            </div>
            <datalist id="proposal-classification-list">
              {classifications.map((c) => (
                <option key={c.id} value={c.name} />
              ))}
            </datalist>
            {geometry ? (
              <div className="preview">
                Geometria desenată pe hartă este atașată propunerii.
              </div>
            ) : (
              <div className="manual-fields">
                <label>
                  Latitudine
                  <input
                    type="number"
                    step="any"
                    min="-90"
                    max="90"
                    value={f.lat}
                    onChange={field("lat")}
                  />
                </label>
                <label>
                  Longitudine
                  <input
                    type="number"
                    step="any"
                    min="-180"
                    max="180"
                    value={f.lng}
                    onChange={field("lng")}
                  />
                </label>
              </div>
            )}
            {!geometry && (
              <button type="button" onClick={() => onDraw(f)}>
                Desenează limita pe hartă
              </button>
            )}
            <label>
              Descriere
              <textarea
                rows={3}
                maxLength={4000}
                value={f.notes}
                onChange={field("notes")}
              />
            </label>
            <label>
              Informații de susținere / surse
              <textarea
                rows={2}
                maxLength={4000}
                value={f.supportingInformation}
                onChange={field("supportingInformation")}
              />
            </label>
            <label className="check-filter consent-field">
              <input
                type="checkbox"
                required
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
              />
              Înțeleg că informațiile vor fi verificate de echipa REDI și
              confirm că nu includ date personale fără temei.
            </label>
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
            <div className="actions">
              <button type="button" onClick={onClose}>
                Renunță
              </button>
              <button className="primary" disabled={busy || !consent}>
                {busy ? "Se trimite…" : "Trimite spre verificare"}
              </button>
            </div>
          </>
        )}
      </form>
    </Dialog>
  );
}
