import {notFound} from "next/navigation";
import Link from "next/link";
import {getPublicProfile, getPublicProfileRoutes} from "../../../lib/db/profiles";

type Props = { params: Promise<{username: string}>; };

function formatDistance(meters: number) { return (Number(meters) / 1000).toFixed(1) + " km"; }
function formatDuration(seconds: number | null) {
  if (seconds == null) return "—";
  const minutes = Math.round(Number(seconds) / 60);
  if (minutes < 60) return minutes + " min";
  return Math.floor(minutes / 60) + " h " + (minutes % 60) + " min";
}
function initials(profile: {username: string; displayName: string | null}) {
  const value = profile.displayName?.trim() || profile.username;
  return value.slice(0, 2).toUpperCase();
}

export default async function PublicProfilePage({params}: Props) {
  const {username} = await params;
  if (!/^[a-zA-Z0-9_]{3,32}$/.test(username)) notFound();
  const profile = await getPublicProfile(username);
  if (!profile) notFound();
  const routes = await getPublicProfileRoutes(profile.id);

  return (
    <main className="route-catalog-page">
      <header className="route-page-header">
        <Link href="/routes" className="route-back">← Public routes</Link>
        <div className="logo">Ezda</div>
      </header>
      <section className="profile-page-content">
        <div className="public-profile-card card">
          <div className="public-profile-avatar" aria-hidden="true">{initials(profile)}</div>
          <div>
            <div className="label">Cyclist profile</div>
            <h1>{profile.displayName || profile.username}</h1>
            <p className="public-profile-username">@{profile.username}</p>
          </div>
        </div>
        <div className="route-catalog-heading">
          <div>
            <div className="label">Shared routes</div>
            <h2>{profile.displayName || "This cyclist"}&apos;s public routes</h2>
            <p>Routes shared publicly by this cyclist.</p>
          </div>
        </div>
        {routes.length === 0 ? (
          <div className="route-catalog-state card">
            <div className="label">No public routes</div>
            <h2>No routes shared yet</h2>
            <p>This cyclist has not published any routes.</p>
          </div>
        ) : (
          <div className="route-catalog-grid">
            {routes.map((route) => (
              <Link href={"/routes/" + route.id} className="route-catalog-card" key={route.id}>
                <div className="label">Public cycling route</div>
                <h3>{route.title}</h3>
                {route.description && <p>{route.description}</p>}
                <div className="route-catalog-metrics">
                  <span>{formatDistance(route.distanceMeters)}</span>
                  <span>{formatDuration(route.durationSeconds)}</span>
                  <span>{route.elevationGainMeters == null ? "—" : "↑ " + Math.round(Number(route.elevationGainMeters)) + " m"}</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
