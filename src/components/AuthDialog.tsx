"use client";
import { useState } from "react";
import { createClient } from "@/utils/supabase/client";
import Dialog from "./Dialog";
export default function AuthDialog({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <Dialog labelledBy="auth-title" onClose={onClose}>
      <form
        className="modal"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          try {
            const { error } = await createClient().auth.signInWithPassword({
              email,
              password,
            });
            if (error) throw error;
            onSuccess();
          } catch {
            setError("Autentificarea a eșuat. Verificați adresa și parola.");
          } finally {
            setBusy(false);
          }
        }}
      >
        <h2 id="auth-title">Intră în spațiul de lucru</h2>
        <p className="muted small">
          Folosește contul Supabase al organizației. Permisiunile sunt atribuite
          de administrator.
        </p>
        <label>
          Email
          <input
            type="email"
            autoComplete="username"
            required
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <label>
          Parolă
          <input
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
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
          <button className="primary" disabled={busy}>
            {busy ? "Se verifică…" : "Autentificare"}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
