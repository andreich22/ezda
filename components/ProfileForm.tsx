"use client";

import {FormEvent, useState} from "react";

type Profile = {
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
};

export default function ProfileForm({initialProfile, email}: {initialProfile: Profile; email: string}) {
  const [profile, setProfile] = useState(initialProfile);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch("/api/profile", {
        method: "PATCH",
        headers: {"content-type": "application/json"},
        body: JSON.stringify(profile),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Unable to update profile");
      setProfile(body.profile);
      setMessage("Profile saved.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to update profile");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit}>
      <label className="field">
        <span className="label">Email</span>
        <input value={email} type="email" readOnly />
      </label>
      <label className="field">
        <span className="label">Username</span>
        <input
          value={profile.username}
          onChange={(event) => setProfile({...profile, username: event.target.value})}
          minLength={3}
          maxLength={32}
          pattern="[a-zA-Z0-9_]+"
          required
        />
      </label>
      <label className="field">
        <span className="label">Display name</span>
        <input
          value={profile.displayName ?? ""}
          onChange={(event) => setProfile({...profile, displayName: event.target.value})}
          maxLength={80}
        />
      </label>
      <label className="field">
        <span className="label">Avatar URL</span>
        <input
          value={profile.avatarUrl ?? ""}
          onChange={(event) => setProfile({...profile, avatarUrl: event.target.value})}
          type="url"
          maxLength={500}
          placeholder="https://…"
        />
      </label>
      {error && <p className="error">{error}</p>}
      {message && <p className="auth-message">{message}</p>}
      <button className="button" type="submit" disabled={busy}>{busy ? "Saving…" : "Save profile"}</button>
    </form>
  );
}
