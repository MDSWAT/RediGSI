"use client";
import { useState } from "react";
import { createClient } from "@/utils/supabase/client";
import Dialog from "./Dialog";

/** Passwordless sign-in: a one-time code is emailed from the organisation's mailbox. */
export default function AuthDialog({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"email" | "code">("email");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const requestCode = async () => {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const r = await fetch("/api/auth/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? "Codul nu a putut fi trimis.");
      setStep("code");
      setNotice(
        `Dacă ${email} are acces, ai primit un cod pe email. Verifică și folderul Spam.`,
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog labelledBy="auth-title" onClose={onClose}>
      <form
        className="modal"
        onSubmit={async (e) => {
          e.preventDefault();
          if (step === "email") return void requestCode();
          setBusy(true);
          setError("");
          try {
            const { error } = await createClient().auth.verifyOtp({
              email,
              token: code.trim(),
              type: "email",
            });
            if (error) throw error;
            onSuccess();
          } catch {
            setError("Cod invalid sau expirat. Cere un cod nou.");
          } finally {
            setBusy(false);
          }
        }}
      >
        <h2 id="auth-title">Intră în spațiul de lucru</h2>
        <p className="muted small">
          {step === "email"
            ? "Introdu adresa de email. Îți trimitem un cod de autentificare, fără parolă. Accesul este acordat de administrator."
            : notice}
        </p>
        {step === "email" ? (
          <label>
            Email
            <input
              type="email"
              autoComplete="email"
              required
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
        ) : (
          <label>
            Cod primit pe email
            <input
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6,10}"
              maxLength={10}
              required
              autoFocus
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            />
          </label>
        )}
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <div className="actions">
          {step === "code" && (
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setStep("email");
                setCode("");
                setError("");
              }}
            >
              Altă adresă
            </button>
          )}
          {step === "code" && (
            <button type="button" disabled={busy} onClick={() => void requestCode()}>
              Retrimite codul
            </button>
          )}
          <button type="button" onClick={onClose}>
            Renunță
          </button>
          <button className="primary" disabled={busy}>
            {busy
              ? "Se procesează…"
              : step === "email"
                ? "Trimite codul"
                : "Autentificare"}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
