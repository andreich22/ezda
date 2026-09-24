import Link from "next/link";
import {getPublicRoutes, type PublicRouteListItem} from "../../lib/db/routes";

function formatDistance(meters: number) {
  return (Number(meters) / 1000).toFixed(1) + " km";
}

function formatDuration(seconds: number | null) {
  if (seconds == null) return "—";
  const minutes = Math.round(Number(seconds) / 60);
  if (minutes < 60) return minutes + " min";
  return Math.floor(minutes / 60) + " h " + (minutes % 60) + " min";
}

function RouteCard({route}: {route: PublicRouteListItem}) {
  return (
    <Link href={"/routes/" + route.id} className="route-catalog-card">
      <div className="label">Public cycling route</div>
      <h2>{route.title}</h2>
      {route.description && <p>{route.description}</p>}
      <div className="route-catalog-metrics">
        <span>{formatDistance(route.distanceMeters)}</span>
        <span>{formatDuration(route.durationSeconds)}</span>
        <span>
          {route.elevationGainMeters == null ? "—" : "↑ " + Math.round(Number(route.elevationGainMeters)) + " m"}
        </span>
      </div>
    </Link>
  );
}

export default async function RoutesPage() {
  let routes: PublicRouteListItem[];

  try {
    routes = await getPublicRoutes();
  } catch (error) {
    console.error("Public route catalog lookup failed", error instanceof Error ? error.message : "unknown error");
    return (
      <main className="route-catalog-page">
        <header className="route-page-header">
          <Link href="/" className="route-back">← Build a route</Link>
          <div className="logo">Ezda</div>
        </header>
        <section className="route-catalog-content">
          <div className="route-catalog-state card">
            <div className="label">Public routes</div>
            <h1>Routes are temporarily unavailable</h1>
            <p>We couldn't load the public route catalog. Please try again later.</p>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="route-catalog-page">
      <header className="route-page-header">
        <Link href="/" className="route-back">← Build a route</Link>
        <div className="logo">Ezda</div>
      </header>
      <section className="route-catalog-content">
        <div className="route-catalog-heading">
          <div>
            <div className="label">Community</div>
            <h1>Public routes</h1>
            <p>Explore routes shared by cyclists.</p>
          </div>
          <Link href="/" className="button route-catalog-build">Build a route</Link>
        </div>

        {routes.length === 0 ? (
          <div className="route-catalog-state card">
            <div className="label">No routes yet</div>
            <h2>Be the first to share a route</h2>
            <p>Build a cycling route and save it as public to see it here.</p>
            <Link href="/" className="button route-catalog-build">Build a route</Link>
          </div>
        ) : (
          <div className="route-catalog-grid">
            {routes.map((route) => <RouteCard key={route.id} route={route} />)}
          </div>
        )}
      </section>
    </main>
  );
}
