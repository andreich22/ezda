import {notFound} from "next/navigation";
import CopyRouteLink from "../../../components/CopyRouteLink";
import SavedRouteMap from "../../../components/SavedRouteMap";
import {getRouteForViewer} from "../../../lib/db/routes";
import {getCurrentUser} from "../../../lib/current-user";
import {isValidRouteId} from "../../../lib/route-id";

type Props = {
  params: Promise<{id: string}>;
};

export default async function RoutePage({params}: Props) {
  const {id} = await params;

  if (!isValidRouteId(id)) notFound();

  const user = await getCurrentUser();
  let route;
  try {
    route = await getRouteForViewer(id, user?.id);
  } catch (error) {
    console.error("Route lookup failed", error);
    throw new Error("Unable to load route");
  }

  if (!route) notFound();

  return (
    <main className="route-page">
      <header className="route-page-header">
        <a href="/routes" className="route-back">← Routes</a>
        <div className="logo">Ezda</div>
      </header>
      <div className="route-page-content">
        <section className="route-detail card">
          <div className="label">{user?.id ? "Saved cycling route" : "Public cycling route"}</div>
          <h1>{route.title}</h1>
          {route.description && <p className="route-description">{route.description}</p>}
          <CopyRouteLink path={`/routes/${route.id}`} />
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
          <div className="waypoints card">
            <div className="label">Route points</div>
            {route.waypoints && route.waypoints.length > 0 ? (
              <ol>
                {route.waypoints.map((point: number[], index: number) => (
                  <li key={point[0] + "-" + point[1] + "-" + index}>
                    <span className={"point-dot " + (index === 0 ? "start" : index === route.waypoints!.length - 1 ? "finish" : "")} />
                    <span>
                      <strong>
                        {index === 0 ? "Start" : index === route.waypoints!.length - 1 ? "Finish" : "Waypoint " + index}
                      </strong>
                      <small>{point[1].toFixed(5)}, {point[0].toFixed(5)}</small>
                    </span>
                  </li>
                ))}
              </ol>
            ) : (
              <div className="empty">No points yet</div>
            )}
          </div>
         </section>
         {route.geometry?.geometry && (
           <SavedRouteMap
             geometry={{
               type: "Feature",
               properties: {},
               geometry: {
                 type: "LineString",
                 coordinates: (route.geometry.geometry as GeoJSON.LineString).coordinates,
               },
             }}
           />
         )}
       </div>
     </main>
   );
 }
