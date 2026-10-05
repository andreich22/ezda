"use client";

import Link from "next/link";
import {useEffect, useMemo, useState} from "react";
import {useSearchParams} from "next/navigation";
import {normalizeRouteVisibility} from "../lib/route-filters";
import {
  ROUTE_PAGE_SIZE,
} from "../lib/route-pagination";
import {
  createRouteCatalogCache,
  invalidateRouteCatalogCache,
  type RouteCatalogVisibility,
  type RouteCatalogCacheKey,
} from "../lib/route-catalog-cache";

type RouteItem = {
  id: string;
  title: string;
  description: string | null;
  distanceMeters: number;
  durationSeconds: number | null;
  elevationGainMeters: number | null;
  createdAt: string;
  isPublic: boolean;
};

type RouteCatalogPage = {
  items: RouteItem[];
  page: number;
  pageSize: number;
  total: number;
  hasNextPage: boolean;
};

type Props = {
  userId: string | null;
};

const FILTERS: Array<{value: RouteCatalogVisibility; label: string}> = [
  {value: "all", label: "All"},
  {value: "my", label: "My Routes"},
  {value: "public", label: "Public"},
];

const routeCache = createRouteCatalogCache<RouteCatalogPage>();

function formatDistance(meters: number) {
  return (Number(meters) / 1000).toFixed(1) + " km";
}

function formatDuration(seconds: number | null) {
  if (seconds == null) return "—";
  const minutes = Math.round(Number(seconds) / 60);
  if (minutes < 60) return minutes + " min";
  return Math.floor(minutes / 60) + " h " + (minutes % 60) + " min";
}

function RouteCard({route}: {route: RouteItem}) {
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

function setCatalogUrl(visibility: RouteCatalogVisibility, page: number) {
  const params = new URLSearchParams(window.location.search);
  params.set("visibility", visibility);
  params.set("page", String(page));
  params.set("limit", String(ROUTE_PAGE_SIZE));
  window.history.pushState(null, "", `/routes?${params.toString()}`);
}

export default function RouteCatalog({userId}: Props) {
  const searchParams = useSearchParams();
  const visibility = normalizeRouteVisibility(searchParams.get("visibility") ?? undefined, Boolean(userId));
  const requestedPage = Number.parseInt(searchParams.get("page") ?? "1", 10);
  const page = Number.isFinite(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const pageSize = ROUTE_PAGE_SIZE;
  const cacheKey: RouteCatalogCacheKey = useMemo(
    () => ({userId, visibility, page, pageSize}),
    [userId, visibility, page, pageSize],
  );
  const [catalog, setCatalog] = useState<RouteCatalogPage | null>(() => {
    return routeCache.get(cacheKey) ?? null;
  });
  const [error, setError] = useState("");
  const [retryNonce, setRetryNonce] = useState(0);

  useEffect(() => {
    const cached = routeCache.get(cacheKey);
    if (cached) {
      setCatalog(cached);
      setError("");
      return;
    }

    let cancelled = false;
    setError("");

    fetch(
      `/api/routes?visibility=${encodeURIComponent(visibility)}&page=${page}&limit=${pageSize}`,
      {cache: "no-store"},
    )
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || "Unable to load routes");
        return body as RouteCatalogPage;
      })
      .then((nextCatalog) => {
        if (cancelled) return;
        routeCache.set(cacheKey, nextCatalog);
        setCatalog(nextCatalog);
      })
      .catch((reason) => {
        if (!cancelled) {
          setCatalog(null);
          setError(reason instanceof Error ? reason.message : "Unable to load routes");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [cacheKey, retryNonce]);

  useEffect(() => {
    const invalidate = () => {
      routeCache.clear();
      setCatalog(null);
      setError("");
      setRetryNonce((value) => value + 1);
    };

    window.addEventListener("ezda:route-catalog-invalidate", invalidate);
    return () => window.removeEventListener("ezda:route-catalog-invalidate", invalidate);
  }, []);

  useEffect(() => {
    if (catalog && catalog.page !== page) setCatalog(null);
  }, [catalog, page]);

  const totalPages = catalog ? Math.max(1, Math.ceil(catalog.total / pageSize)) : 1;
  const heading =
    visibility === "my"
      ? "My Routes"
      : visibility === "private"
        ? "Private Routes"
        : visibility === "all"
          ? "All Routes"
          : "Public routes";

  function changeFilter(nextVisibility: RouteCatalogVisibility) {
    const normalized = normalizeRouteVisibility(nextVisibility, Boolean(userId));
    setCatalog(null);
    setError("");
    setCatalogUrl(normalized, 1);
  }

  function changePage(nextPage: number) {
    if (nextPage < 1 || (catalog && nextPage > totalPages)) return;
    setCatalog(null);
    setError("");
    setCatalogUrl(visibility, nextPage);
  }

  if (error) {
    return (
      <>
        <div className="route-catalog-heading">
          <div>
            <div className="label">Community</div>
            <h1>{heading}</h1>
            <p>We couldn't load the route catalog. Please try again later.</p>
          </div>
          <Link href="/" className="button route-catalog-build">Build a route</Link>
        </div>
        {userId && (
          <nav className="route-catalog-filter" aria-label="Route visibility">
            {FILTERS.map((filter) => (
              <button
                key={filter.value}
                type="button"
                className={"route-catalog-filter-link" + (visibility === filter.value ? " active" : "")}
                onClick={() => changeFilter(filter.value)}
              >
                {filter.label}
              </button>
            ))}
          </nav>
        )}
        <div className="route-catalog-state card">
          <div className="label">Routes</div>
          <h2>Routes are temporarily unavailable</h2>
          <p>{error}</p>
          <button className="button" type="button" onClick={() => invalidateRouteCatalogCache()}>Try again</button>
        </div>
      </>
    );
  }

  return (
    <>
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

      {userId && (
        <nav className="route-catalog-filter" aria-label="Route visibility">
          {FILTERS.map((filter) => (
            <button
              key={filter.value}
              type="button"
              className={"route-catalog-filter-link" + (visibility === filter.value ? " active" : "")}
              onClick={() => changeFilter(filter.value)}
              aria-current={visibility === filter.value ? "page" : undefined}
            >
              {filter.label}
            </button>
          ))}
        </nav>
      )}

      {!catalog ? (
        <div className="route-catalog-state card">
          <div className="label">Routes</div>
          <h2>Loading routes…</h2>
        </div>
      ) : catalog.items.length === 0 ? (
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
        <>
          <div className="route-catalog-grid">
            {catalog.items.map((route) => <RouteCard key={route.id} route={route} />)}
          </div>
          <nav className="route-catalog-pagination" aria-label="Route pages">
            <button
              className="button"
              type="button"
              onClick={() => changePage(page - 1)}
              disabled={page <= 1}
            >
              ← Previous
            </button>
            <span>Page {page} of {totalPages}</span>
            <button
              className="button"
              type="button"
              onClick={() => changePage(page + 1)}
              disabled={!catalog.hasNextPage}
            >
              Next →
            </button>
          </nav>
        </>
      )}
    </>
  );
}
