"use client";
import { recordsToGeoJSON } from "@/lib/exportFeatures";
import { useState } from "react";
import {
  COLLECTION_LABELS,
  COUNTRY_LABELS,
  type CollectionName,
  type DB,
} from "@/lib/types";
import { canEdit, canExport, isAdmin, type AccessProfile } from "@/lib/access";
import { exportCSV, exportXLSX } from "@/lib/export";
export default function DataWorkspace({
  access,
  db,
  onImport,
  onManual,
  onChanged,
}: {
  access: AccessProfile;
  db: DB;
  onImport: (c: CollectionName) => void;
  onManual: () => void;
  onChanged: () => void;
}) {
  const [country, setCountry] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const countries = [
    ...new Set(
      Object.values(db).flatMap((rows) =>
        rows.map((r: { country: string }) => r.country),
      ),
    ),
  ].sort();
  const archive = async (c: CollectionName) => {
    const ids = db[c]
      .filter((r) => !country || r.country === country)
      .map((r) => r.id);
    if (
      !ids.length ||
      !confirm(
        `Arhivați ${ids.length} înregistrări din ${COLLECTION_LABELS[c]}? Pot fi restaurate din Administrare.`,
      )
    )
      return;
    setBusy(c);
    setError("");
    try {
      for (let i = 0; i < ids.length; i += 2000) {
        const r = await fetch(`/api/data/${c}`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ids: ids.slice(i, i + 2000) }),
        });
        if (!r.ok) {
          const body = await r.json();
          throw new Error(body.error);
        }
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
      onChanged();
    }
  };
  const download = async (
    collection: CollectionName,
    format: "csv" | "xlsx" | "geojson",
  ) => {
    setBusy(collection);
    setError("");
    try {
      const r = await fetch(
        `/api/export?collection=${collection}&country=${encodeURIComponent(country)}`,
      );
      const data = await r.json();
      if (!r.ok) throw new Error(data.error);
      if (format === "csv") exportCSV(collection, data);
      else if (format === "xlsx") exportXLSX(collection, data);
      else {
        const url = URL.createObjectURL(
          new Blob([JSON.stringify(recordsToGeoJSON(data))], {
            type: "application/geo+json",
          }),
        );
        const a = document.createElement("a");
        a.href = url;
        a.download = collection + ".geojson";
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  };
  return (
    <section className="module-workspace">
      <div className="module-title">
        <div>
          <h2>Gestionarea datelor</h2>
          <p>
            Importă și exportă date în limitele rolului și teritoriilor alocate.
          </p>
        </div>
        {canEdit(access) && (
          <button className="primary" onClick={onManual}>
            Adaugă manual
          </button>
        )}
      </div>
      <div className="module-filter">
        <label>
          Țară pentru export
          <select value={country} onChange={(e) => setCountry(e.target.value)}>
            <option value="">Toate țările accesibile</option>
            {countries.map((c) => (
              <option key={c} value={c}>
                {COUNTRY_LABELS[c] ?? c}
              </option>
            ))}
          </select>
        </label>
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <div className="table-wrap">
        <table className="workspace-table dataset-table">
          <thead>
            <tr>
              <th>Set de date</th>
              <th>Înregistrări vizibile</th>
              <th>Operații disponibile</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(COLLECTION_LABELS).map(([key, label]) => {
              const c = key as CollectionName;
              return (
                <tr key={c}>
                  <th>{label}</th>
                  <td>
                    {
                      db[c].filter((r) => !country || r.country === country)
                        .length
                    }
                  </td>
                  <td>
                    <div className="btn-row">
                      {canEdit(access) && (
                        <button onClick={() => onImport(c)}>Importă</button>
                      )}
                      {canExport(access) && (
                        <>
                          <button
                            disabled={!!busy}
                            onClick={() => void download(c, "csv")}
                          >
                            CSV
                          </button>
                          <button
                            disabled={!!busy}
                            onClick={() => void download(c, "xlsx")}
                          >
                            Excel
                          </button>
                          {c !== "clients" && (
                            <button
                              disabled={!!busy}
                              onClick={() => void download(c, "geojson")}
                            >
                              GeoJSON
                            </button>
                          )}
                        </>
                      )}
                      {isAdmin(access) && (
                        <button
                          className="danger"
                          disabled={!!busy || !db[c].length}
                          onClick={() => void archive(c)}
                        >
                          Arhivează selecția
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="data-guidance">
        <section>
          <h3>Import cu verificare</h3>
          <p className="muted small">
            CSV, Excel și GeoJSON folosesc previzualizarea și potrivirea
            coloanelor existente. Importurile în afara teritoriilor alocate sunt
            respinse de baza de date.
          </p>
        </section>
        <section>
          <h3>Export controlat</h3>
          <p className="muted small">
            Exportul folosește o listă explicită de câmpuri. Numele persoanelor
            din afaceri și portofolii, contactele, notele și coloanele
            suplimentare sunt excluse.
          </p>
        </section>
        <section>
          <h3>Istoric și recuperare</h3>
          <p className="muted small">
            Modificările sunt înregistrate în jurnal. Administratorii pot șterge
            controlat și restaura înregistrările din Administrare.
          </p>
        </section>
      </div>
    </section>
  );
}
