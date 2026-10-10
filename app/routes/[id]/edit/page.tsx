import {notFound} from "next/navigation";
import DeleteRouteButton from "../../../../components/DeleteRouteButton";
import MapClient from "../../../../components/MapClient";
import {getCurrentUser} from "../../../../lib/current-user";
import {getEditableRoute} from "../../../../lib/db/routes";
import {isValidRouteId} from "../../../../lib/route-id";
import {toEditInitialState} from "../../../../lib/route-edit";

type Props = {
  params: Promise<{id: string}>;
};

export default async function RouteEditPage({params}: Props) {
  const {id} = await params;

  if (!isValidRouteId(id)) notFound();

  const user = await getCurrentUser();
  if (!user) notFound();

  let route;
  try {
    route = await getEditableRoute(id, user.id);
  } catch (error) {
    console.error("Route edit lookup failed", error);
    throw new Error("Unable to load route");
  }

  if (!route) notFound();

  const initial = toEditInitialState(route);

  return (
    <main className="shell">
      <header className="header">
        <a href={`/routes/${id}`} className="route-back">← Back to route</a>
        <div className="logo">Ezda</div>
      </header>
      <div className="content">
        <aside className="sidebar">
          <h1>Edit route</h1>
          <p>
            Drag points or click the map to change the route. Nothing is saved until you press
            “Save changes”.
          </p>
          <MapClient
            initialPoints={initial.points}
            initialTitle={initial.title}
            initialDescription={initial.description}
            initialIsPublic={initial.isPublic}
            editRouteId={id}
          />
          <DeleteRouteButton routeId={id} />
        </aside>
        <div className="map-wrap"><div id="map-host" className="map" /></div>
      </div>
    </main>
  );
}
