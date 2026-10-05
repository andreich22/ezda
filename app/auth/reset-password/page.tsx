"use client";

import {FormEvent, useState} from "react";
import {useRouter} from "next/navigation";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmation) {
      setError("Passwords do not match.");
      return;
    }

    setBusy(true);
    try {
      const response = await fetch("/api/auth/update-password", {
        method: "POST",
        headers: {"content-type": "application/json"},
        body: JSON.stringify({password}),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Unable to update password");

      router.replace("/auth?password_updated=1");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to update password");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-card card">
        <div className="label">Ezda account</div>
        <h1>Choose a new password</h1>
        <p className="auth-copy">Your recovery link is verified. Set a new password for your account.</p>

        <form onSubmit={submit}>
          <label className="field">
            <span className="label">New password</span>
            <input value={password} onChange={(event) => setPassword(event.target.value)} type="password" minLength={8} autoComplete="new-password" required />
          </label>

          <label className="field">
            <span className="label">Confirm password</span>
            <input value={confirmation} onChange={(event) => setConfirmation(event.target.value)} type="password" minLength={8} autoComplete="new-password" required />
          </label>

          {error && <p className="error">{error}</p>}
          <button className="button" disabled={busy} type="submit">
            {busy ? "Saving…" : "Set new password"}
          </button>
        </form>
      </section>
    </main>
  );
}
