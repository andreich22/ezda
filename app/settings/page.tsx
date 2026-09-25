import Link from "next/link";
import {redirect} from "next/navigation";
import {getCurrentUser} from "../../lib/current-user";
import {ensureProfile} from "../../lib/db/profiles";
import ProfileForm from "../../components/ProfileForm";

export default async function SettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/auth");

  const profile = await ensureProfile(user.id, user.email);
  return (
    <main className="auth-page">
      <section className="auth-card card">
        <Link href="/" className="route-back">← Ezda</Link>
        <div className="label">Settings</div>
        <h1>Your profile</h1>
        <p className="auth-copy">Manage the information that will be shown on your public profile.</p>
        <ProfileForm initialProfile={profile} email={user.email ?? ""} />
      </section>
    </main>
  );
}
