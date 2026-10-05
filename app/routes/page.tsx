import Link from "next/link";
import {Suspense} from "react";
import {getCurrentUser} from "../../lib/current-user";
import RouteCatalog from "../../components/RouteCatalog";

export default async function RoutesPage() {
  const user = await getCurrentUser();

  return (
    <main className="route-catalog-page">
      <header className="route-page-header">
        <Link href="/" className="route-back">← Build a route</Link>
        <div className="logo">Ezda</div>
      </header>
      <section className="route-catalog-content">
        <Suspense fallback={<div className="route-catalog-state card"><div className="label">Routes</div><h1>Loading routes…</h1></div>}>
          <RouteCatalog userId={user?.id ?? null} />
        </Suspense>
      </section>
    </main>
  );
}
