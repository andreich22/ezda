"use client";

import {FormEvent, useEffect, useState} from "react";
import Link from "next/link";
import {useRouter, useSearchParams} from "next/navigation";

type Mode = "login" | "signup" | "recover";

export default function AuthPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/auth/session", {cache: "no-store"})
      .then((response) => response.json())
      .then((body) => setUserEmail(body.user?.email ?? null))
      .catch(() => setUserEmail(null));
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");

    const endpoint = mode === "login" ? "login" : mode === "signup" ? "signup" : "recover";
    const payload = mode === "recover" ? {email} : {email, password};

    try {
      const response = await fetch(`/api/auth/${endpoint}`, {
        method: "POST",
        headers: {"content-type": "application/json"},
        body: JSON.stringify(payload),
      });
      const body = await response.json();

      if (!response.ok) throw new Error(body.error || "Authentication failed");

      if (mode === "recover") {
        setMessage("If the account exists, a password reset email has been sent.");
      } else if (mode === "signup" && body.requiresEmailConfirmation) {
        setMessage("Account created. Check your email to confirm the account before signing in.");
      } else {
        router.push("/");
        router.refresh();
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Authentication failed");
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    await fetch("/api/auth/logout", {method: "POST"});
    setUserEmail(null);
    setMessage("Signed out.");
  }

  if (userEmail) {
    return (
      <main className="auth-page">
        <section className="auth-card card">
          <div className="label">Ezda account</div>
          <h1>You are signed in</h1>
          <p>{userEmail}</p>
          <button className="button" onClick={logout}>Sign out</button>
          <Link className="auth-secondary-link" href="/">Back to map</Link>
        </section>
      </main>
    );
  }

  return (
    <main className="auth-page">
      <section className="auth-card card">
        <Link href="/" className="route-back">← Ezda</Link>
        <div className="label">Account</div>
        <h1>{mode === "login" ? "Sign in" : mode === "signup" ? "Create account" : "Reset password"}</h1>
        <p className="auth-copy">
          {mode === "recover"
            ? "Enter your email and we'll send password recovery instructions."
            : "Use your email and password to access your Ezda account."}
        </p>

        <form onSubmit={submit}>
          <label className="field">
            <span className="label">Email</span>
            <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" autoComplete="email" required />
          </label>

          {mode !== "recover" && (
            <label className="field">
              <span className="label">Password</span>
              <input value={password} onChange={(event) => setPassword(event.target.value)} type="password" minLength={8} autoComplete={mode === "login" ? "current-password" : "new-password"} required />
            </label>
          )}

          {error && <p className="error">{error}</p>}
          {message && <p className="auth-message">{message}</p>}
          <button className="button" disabled={busy} type="submit">
            {busy ? "Please wait…" : mode === "login" ? "Sign in" : mode === "signup" ? "Create account" : "Send reset email"}
          </button>
        </form>

        <div className="auth-links">
          {mode !== "login" && <button type="button" onClick={() => setMode("login")}>Sign in</button>}
          {mode !== "signup" && <button type="button" onClick={() => setMode("signup")}>Create account</button>}
          {mode !== "recover" && <button type="button" onClick={() => setMode("recover")}>Forgot password?</button>}
        </div>
      </section>
    </main>
  );
}
