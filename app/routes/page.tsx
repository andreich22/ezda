import Link from "next/link";
import {getCurrentUser} from "../../lib/current-user";
import {getPublicRoutes, type PublicRouteListItem, type RouteVisibility} from "../../lib/db/routes";
import {normalizeRouteVisibility} from "../../lib/route-filters";

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
      <div className="label">{route.isPublic ? "Public cycling route" : "Private route"}</div>
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

const FILTERS: Array<{value: RouteVisibility; label: string}> = [
  {value: "all", label: "All"},
  {value: "my", label: "My Routes"},
  {value: "public", label: "Public"},
];

export default async function RoutesPage({
  searchParams,
}: {
  searchParams: Promise<{visibility?: string}>;
}) {
  const user = await getCurrentUser();
  const params = await searchParams;
  const visibility = normalizeRouteVisibility(params.visibility, Boolean(user));

  let routes: PublicRouteListItem[];
  try {
    routes = await getPublicRoutes(50, visibility, user?.id);
  } catch (error) {
    console.error("Route catalog lookup failed", error instanceof Error ? error.message : "unknown error");
    return (
      <main className="route-catalog-page">
        <header className="route-page-header">
          <Link href="/" className="route-back">← Build a route</Link>
          <div className="logo">Ezda</div>
        </header>
        <section className="route-catalog-content">
          <div className="route-catalog-state card">
            <div className="label">Routes</div>
            <h1>Routes are temporarily unavailable</h1>
            <p>We couldn't load the route catalog. Please try again later.</p>
          </div>
        </section>
      </main>
    );
  }

  const heading =
    visibility === "my"
      ? "My Routes"
      : visibility === "private"
        ? "Private Routes"
        : visibility === "all"
          ? "All Routes"
          : "Public routes";

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
            <h1>{heading}</h1>
            <p>
              {visibility === "my"
                ? "Your public and private routes."
                : visibility === "private"
                  ? "Your private routes."
                  : visibility === "all"
                    ? "Public community routes and your private routes."
                    : "Explore routes shared by cyclists."}
            </p>
          </div>
          <Link href="/" className="button route-catalog-build">Build a route</Link>
        </div>

        {user && (
          <nav className="route-catalog-filter" aria-label="Route visibility">
            {FILTERS.map((filter) => (
              <Link
                key={filter.value}
                href={"/routes?visibility=" + filter.value}
                className={"route-catalog-filter-link" + (visibility === filter.value ? " active" : "")}
                aria-current={visibility === filter.value ? "page" : undefined}
              >
                {filter.label}
              </Link>
            ))}
          </nav>
        )}

        {routes.length === 0 ? (
          <div className="route-catalog-state card">
            <div className="label">No routes</div>
            <h2>
              {visibility === "private"
                ? "You have no private routes"
                : visibility === "my"
                  ? "You have no saved routes"
                  : "No routes found"}
            </h2>
            <p>
              {visibility === "private"
                ? "Save a route as private to see it here."
                : "Build a cycling route and save it to see it here."}
            </p>
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
