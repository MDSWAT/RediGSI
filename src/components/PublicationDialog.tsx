"use client";
import { useMemo, useState } from "react";
import {
  assessPublicationRisk,
  MIN_JUSTIFICATION,
  RISK_LABELS,
} from "@/lib/privacyRisk";
import type { Community } from "@/lib/types";
import Dialog from "./Dialog";
export default function PublicationDialog({
  community,
  onClose,
  onSaved,
}: {
  community: Community;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [publicVisibility, setPublic] = useState(false);
  const [geometry, setGeometry] = useState(false);
  const [reviewed, setReviewed] = useState(false);
  const [justification, setJustification] = useState("");
  const [busy, setBusy] = useState(false);
  const risk = useMemo(
    () =>
      assessPublicationRisk(community, {
        public: publicVisibility,
        shareGeometry: geometry,
      }),
    [community, publicVisibility, geometry],
  );
  const justified =
    !risk.needsJustification ||
    justification.trim().length >= MIN_JUSTIFICATION;
  const [error, setError] = useState("");
  return (
    <Dialog labelledBy="publication-title" onClose={onClose}>
      <form
        className="modal"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          try {
            const r = await fetch("/api/publication", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                id: community.id,
                expected: community,
                public: publicVisibility,
                shareGeometry: geometry,
                privacyReviewed: reviewed,
                justification,
              }),
            });
            const data = await r.json();
            if (!r.ok) throw new Error(data.error);
            onSaved();
            onClose();
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <h2 id="publication-title">Revizuiește publicarea</h2>
        <p>{community.name}</p>
        <p className="muted small">
          Se publică o versiune verificată a câmpurilor de bază. Notele, datele
          suplimentare și informațiile personale nu intră în versiunea publică.
        </p>
        <label className="check-filter consent-field">
          <input
            type="checkbox"
            required
            checked={reviewed}
            onChange={(e) => setReviewed(e.target.checked)}
          />
          Am verificat conținutul și riscurile de confidențialitate înainte de
          publicare.
        </label>
        <label className="check-filter consent-field">
          <input
            type="checkbox"
            checked={publicVisibility}
            onChange={(e) => {
              setPublic(e.target.checked);
              if (!e.target.checked) setGeometry(false);
            }}
          />
          Permite vizualizarea publică a versiunii curente. Debifat: acces
          restricționat.
        </label>
        <label className="check-filter consent-field">
          <input
            type="checkbox"
            disabled={!publicVisibility || !community.geometry}
            checked={geometry}
            onChange={(e) => setGeometry(e.target.checked)}
          />
          Include și geometria exactă, după evaluarea riscurilor.
        </label>
        <section
          className={`risk-panel risk-${risk.level}`}
          aria-live="polite"
          aria-label="Evaluarea riscului de confidențialitate"
        >
          <strong>{RISK_LABELS[risk.level]}</strong>
          {risk.factors.length ? (
            <ul>
              {risk.factors.map((f) => (
                <li key={f.code}>{f.label}</li>
              ))}
            </ul>
          ) : (
            <p className="small">
              {publicVisibility
                ? "Nu au fost identificați factori de risc pentru versiunea publică."
                : "Înregistrarea rămâne restricționată; nu se publică nimic."}
            </p>
          )}
        </section>
        {risk.needsJustification && (
          <label>
            Motivul publicării și măsurile de protecție (consimțământ,
            consultare cu comunitatea etc.)
            <textarea
              required
              minLength={MIN_JUSTIFICATION}
              maxLength={2000}
              rows={3}
              value={justification}
              onChange={(e) => setJustification(e.target.value)}
            />
          </label>
        )}
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <div className="actions">
          <button type="button" onClick={onClose} disabled={busy}>
            Renunță
          </button>
          <button className="primary" disabled={busy || !reviewed || !justified}>
            {busy ? "Se salvează…" : "Confirmă publicarea"}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
