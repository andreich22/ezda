import {notFound} from "next/navigation";
import SavedRouteMap from "../../../components/SavedRouteMap";
import {getPublicRoute} from "../../../lib/db/routes";

type Props = {
  params: Promise<{id: string}>;
};

export default async function RoutePage({params}: Props) {
  const {id} = await params;

  if (!/^[0-9a-fA-F-]{36}$/.test(id)) notFound();

  let route;
  try {
    route = await getPublicRoute(id);
  } catch (error) {
    console.error("Route lookup failed", error);
    throw new Error("Unable to load route");
  }

  if (!route) notFound();

  return (
    <main className="route-page">
      <header className="route-page-header">
        <a href="/" className="route-back">← Build a route</a>
        <div className="logo">Ezda</div>
      </header>
      <div className="route-page-content">
        <section className="route-detail card">
          <div className="label">Saved cycling route</div>
          <h1>{route.title}</h1>
          {route.description && <p className="route-description">{route.description}</p>}
          <div className="stat">
            <div className="card">
              <div className="label">Distance</div>
              <div className="value">{(Number(route.distanceMeters) / 1000).toFixed(1)} km</div>
            </div>
            <div className="card">
              <div className="label">Time</div>
              <div className="value">
                {route.durationSeconds == null
                  ? "—"
                  : Number(route.durationSeconds) >= 3600
                    ? `${Math.floor(Number(route.durationSeconds) / 3600)} h ${Math.round(Number(route.durationSeconds) % 3600 / 60)} min`
                    : `${Math.round(Number(route.durationSeconds) / 60)} min`}
              </div>
            </div>
            <div className="card">
              <div className="label">Elevation gain</div>
              <div className="value">
                {route.elevationGainMeters == null ? "—" : `↑ ${Math.round(Number(route.elevationGainMeters))} m`}
              </div>
            </div>
            <div className="card">
              <div className="label">Created</div>
              <div className="value">{new Date(route.createdAt).toLocaleDateString()}</div>
            </div>
          </div>
        </section>
        <SavedRouteMap geometry={route.geometry} />
      </div>
    </main>
  );
}
