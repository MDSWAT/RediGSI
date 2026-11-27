"use client";
import { useEffect, useState } from "react";
import type { Community } from "@/lib/types";
import {
  ACCURACY_LABELS,
  type GeocodingCandidate,
  type GeocodingMetadata,
} from "@/lib/geocoding";
import { validLatLng } from "@/lib/geo";
import Dialog from "./Dialog";
export default function CoordinateDialog({
  community,
  onSave,
  onClose,
}: {
  community: Community;
  onSave: (
    lat: number,
    lng: number,
    metadata?: GeocodingMetadata,
  ) => Promise<void>;
  onClose: () => void;
}) {
  const initial =
    community.geometry?.type === "Point"
      ? community.geometry.coordinates
      : null;
  const [lat, setLat] = useState(initial ? String(initial[1]) : "");
  const [lng, setLng] = useState(initial ? String(initial[0]) : "");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [provider, setProvider] = useState<{
    enabled: boolean;
    host: string | null;
  }>();
  const [query, setQuery] = useState("");
  const [consent, setConsent] = useState(false);
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<GeocodingCandidate[]>([]);
  const [selected, setSelected] = useState<GeocodingCandidate>();
  const [searched, setSearched] = useState(false);
  useEffect(() => {
    let alive = true;
    fetch("/api/geocode")
      .then(async (r) => {
        if (r.ok && alive) setProvider(await r.json());
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);
  const search = async () => {
    setSearching(true);
    setSearched(false);
    setResults([]);
    setError("");
    try {
      const r = await fetch("/api/geocode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query,
          id: community.id,
          country: community.country,
          consent,
        }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error);
      setResults(data.results);
      setSearched(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSearching(false);
    }
  };
  return (
    <Dialog labelledBy="coordinate-title" onClose={onClose}>
      <form
        className="modal"
        onSubmit={async (e) => {
          e.preventDefault();
          const latitude = Number(lat),
            longitude = Number(lng);
          if (!lat.trim() || !lng.trim() || !validLatLng(latitude, longitude)) {
            setError("Introduceți coordonate valide WGS84.");
            return;
          }
          setBusy(true);
          setError("");
          try {
            await onSave(
              latitude,
              longitude,
              selected
                ? {
                    source: selected.source,
                    accuracy: selected.accuracy,
                    label: selected.label,
                  }
                : undefined,
            );
            onClose();
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <h2 id="coordinate-title">Corectează coordonatele</h2>
        <p className="muted small">
          {community.name}. Poziția anterioară rămâne în istoric. Coordonatele
          publice nu sunt schimbate automat.
        </p>
        <div className="row">
          <label>
            Latitudine
            <input
              type="number"
              step="any"
              min="-90"
              max="90"
              autoFocus
              required
              value={lat}
              onChange={(e) => {
                setLat(e.target.value);
                setSelected(undefined);
              }}
            />
          </label>
          <label>
            Longitudine
            <input
              type="number"
              step="any"
              min="-180"
              max="180"
              required
              value={lng}
              onChange={(e) => {
                setLng(e.target.value);
                setSelected(undefined);
              }}
            />
          </label>
        </div>
        <details className="geocode-search">
          <summary>Caută o adresă</summary>
          {provider?.enabled ? (
            <>
              <label>
                Adresă sau localitate în {community.country}
                <input
                  value={query}
                  maxLength={250}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setSearched(false);
                    setResults([]);
                  }}
                  placeholder="Fără nume de persoane sau informații confidențiale"
                />
              </label>
              <label className="check-filter consent-field">
                <input
                  type="checkbox"
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                />
                Sunt de acord să trimit textul căutării către {provider.host},
                serviciul configurat de organizație.
              </label>
              <button
                type="button"
                disabled={
                  !consent || query.trim().length < 3 || searching || busy
                }
                onClick={() => void search()}
              >
                {searching ? "Se caută…" : "Trimite căutarea"}
              </button>
              <div className="geocode-results">
                {results.map((r, i) => (
                  <button
                    type="button"
                    key={i}
                    onClick={() => {
                      setLat(String(r.lat));
                      setLng(String(r.lng));
                      setSelected(r);
                    }}
                  >
                    <b>{r.label}</b>
                    <span>{ACCURACY_LABELS[r.accuracy]}</span>
                  </button>
                ))}
              </div>
              {searched && !results.length && (
                <p className="muted small">
                  Nu au fost găsite rezultate în țara selectată.
                </p>
              )}
              <p className="muted small">
                Precizia indică tipul rezultatului, nu o măsurătoare GPS. Datele
                cartografice: © OpenStreetMap contributors, prin serviciul
                configurat.
              </p>
            </>
          ) : (
            <p className="muted small">
              Geocodarea este disponibilă după configurarea unui serviciu al
              organizației. Coordonatele pot fi introduse manual.
            </p>
          )}
        </details>
        {selected && (
          <p className="preview">
            {ACCURACY_LABELS[selected.accuracy]} · {selected.source}. Rezultatul
            se salvează numai la confirmarea poziției.
          </p>
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
          <button className="primary" disabled={busy || searching}>
            {busy ? "Se salvează…" : "Salvează poziția"}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
