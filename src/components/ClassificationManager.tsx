"use client";
import { useEffect, useState } from "react";
import type { Classification } from "@/lib/classifications";
export default function ClassificationManager() {
  const [items, setItems] = useState<Classification[]>([]);
  const [selected, setSelected] = useState<Classification>();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [active, setActive] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  useEffect(() => {
    let alive = true;
    fetch("/api/classifications")
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error);
        if (alive) setItems(data);
      })
      .catch((e) => {
        if (alive) setError(e.message);
      });
    return () => {
      alive = false;
    };
  }, []);
  return (
    <div className="member-layout">
      <div className="member-list">
        <button
          onClick={() => {
            setSelected(undefined);
            setName("");
            setDescription("");
            setActive(true);
          }}
        >
          Clasificare nouă
        </button>
        {items.map((c) => (
          <button
            key={c.id}
            className={selected?.id === c.id ? "selected" : ""}
            onClick={() => {
              setSelected(c);
              setName(c.name);
              setDescription(c.description);
              setActive(c.active);
            }}
          >
            <b>{c.name}</b>
            <span>{c.active ? "Activă" : "Arhivată"}</span>
          </button>
        ))}
      </div>
      <form
        className="member-form"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          setNotice("");
          try {
            const r = await fetch("/api/classifications", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                id: selected?.id,
                name,
                description,
                active,
                expected: selected?.updated_at,
              }),
            });
            const data = await r.json();
            if (!r.ok) throw new Error(data.error);
            setItems((rows) =>
              [...rows.filter((c) => c.id !== data.id), data].sort((a, b) =>
                a.name.localeCompare(b.name),
              ),
            );
            setSelected(data);
            setNotice(
              "Clasificarea a fost salvată. Valorile existente ale comunităților nu sunt rescrise.",
            );
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <h3>{selected ? "Editează clasificarea" : "Clasificare nouă"}</h3>
        <p className="muted small">
          Denumirile active sunt sugestii vizibile și în formularul public.
          Descrierile sunt rezervate administratorilor. Arhivarea nu șterge
          clasificările din înregistrările istorice.
        </p>
        <label>
          Denumire
          <input
            required
            minLength={2}
            maxLength={100}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <label>
          Descriere
          <textarea
            rows={3}
            maxLength={1000}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </label>
        <label className="check-filter consent-field">
          <input
            type="checkbox"
            checked={active}
            onChange={(e) => setActive(e.target.checked)}
          />
          Disponibilă pentru înregistrări noi
        </label>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        {notice && (
          <p className="ok" role="status">
            {notice}
          </p>
        )}
        <button className="primary" disabled={busy}>
          {busy ? "Se salvează…" : "Salvează clasificarea"}
        </button>
      </form>
    </div>
  );
}
