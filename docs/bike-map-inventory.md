# Bike map inventory (#202)

Scope: epic #201 «развить карту Ezda в полноценный режим для велосипедистов».
This document is the #202 deliverable: what the map is today, which data is
really available, what is lost between provider and UI, and the safe path for
#203–#209. No paid source is connected and no broad refactoring is done here.

Base: `main` @ `4141382d881f45668d46c5e8296ffd1ea7b692be` (verified via
`git fetch origin` + `gh repo view`; default branch is `main`).
Branch: `task/202-map-inventory`. Code refs below are verified by reading.

## 1. Current architecture (as built)

### 1.1 Where the map lives

- There is **no dedicated `/map` route** today, although `AGENTS.md` lists it
  as planned. The interactive map lives on `/` (`app/page.tsx`):
  sidebar (`#route-sidebar` with `MapClient`) + map host (`#map-host`).
- `components/SavedRouteMap.tsx` is the read-only twin used on saved-route
  pages (same raster style, `fitBounds` with padding 50, no editing).
- Both components set the MapLibre worker via
  `scripts/copy-maplibre-worker.mjs` → `public/maplibre/*` and use
  `next.config.ts: transpilePackages: ["maplibre-gl"]` (maplibre-gl 6.10).

### 1.2 Basemap: single OSM raster layer

`MapClient.tsx:19-38` and `SavedRouteMap.tsx:23-41` define the style inline:

- source `osm`: raster tiles
  `https://tile.openstreetmap.org/{z}/{x}/{y}.png`, `tileSize: 256`,
  attribution `© OpenStreetMap contributors`, layers: one `osm` raster layer
  (`minzoom 0`, `maxzoom 19`).
- There are **no vector layers, no toggles, no legend** today.
- Controls: `NavigationControl` top-right; `map.on("error")` surfaces tile
  failures as `Map error: …`. Sidebar collapse fires `ezda:sidebar-change`
  → `map.resize()` (mobile behavior must not regress in #203+).

### 1.3 Route building (UI → API)

`MapClient.tsx:79-133,135-230`:

- Click adds a point; markers are draggable (start `#111`, finish `#d33`,
  waypoints `#f59e0b`). History via `lib/route-history.ts`
  (`pushHistory`/`undoHistory`); per-point removal via `removePointAt`.
- `buildRoute(points)` → `POST /api/route` with `{points: [lon,lat][]}`.
- Rendering: GeoJSON source id `route` + two line layers —
  `route-casing` (white, width 10, opacity 0.95) and `route-line` (red
  `#e63946`, width 6) — then `fitBounds(padding 80, maxZoom 15)`.
- **Elevation is stripped for rendering** (`coordinate[0..1]` only,
  `MapClient.tsx:156-158`) but kept in `route.geometry` for the profile.
- Quick actions: locate-me (geolocation + `flyTo`), fit-route, clear, undo —
  with `action-feedback` status region. Reuse this pattern for layer toggles.
- Summary cards: distance (`m → km`, 1 decimal), time (`s → min / h+min`),
  elevation gain (`↑ … m` or `—` when null), waypoint count.
- Elevation profile: inline SVG polyline `300×90`, min/max labels; rendered
  **only when ≥2 coordinates carry `z`** (`MapClient.tsx:382-464`).
- Save: `POST /api/routes` (create) or `PATCH /api/routes/[id]` (edit),
  body `{title, description, geometry Feature/LineString, distanceMeters,
  durationSeconds, elevationGainMeters, waypoints: points, isPublic}`.
  On success: `invalidateRouteCatalogCache()` + redirect to `data.url`.
  Provider label is shown as `Routing: {route.source}` — fallback geometry
  is already distinguished (per AGENTS.md rule).
- `app/page.tsx:72` copy still says «asks the routing service … otherwise it
  draws a direct fallback» — keep this honest wording for layers too.

### 1.4 Routing API: ORS → OSM → straight line

`app/api/route/route.ts` (verified). Validation: ≥2 points, ≤500 points,
10 s timeout per provider, predictable `{error, code}` JSON, key never
exposed (covered by `tests/routing-save-errors.test.ts`).

| Step | Request | Returns | Elevation |
|---|---|---|---|
| 1. ORS (only if `ORS_API_KEY` set) | `POST api.openrouteservice.org/v2/directions/cycling-regular/geojson` `{coordinates, instructions:false, elevation:true}`, header `Authorization: <key>` | `features[0]` + `summary{distance,duration}`, `elevationGainMeters` = Σ positive `z`-diffs, `source:"OpenRouteService"`, `pointCount` | yes (3rd coordinate) |
| 2. Public OSM bike router (no key) | `GET routing.openstreetmap.de/routed-bike/route/v1/driving/{lon,lat;…}?overview=full&geometries=geojson&steps=false` | `routes[0]{geometry,distance,duration}`, `source:"OpenStreetMap bicycle routing"` | **null** |
| 3. Straight-line fallback | local `hav()` sum | `distance`, `duration = distance/5` (≈18 km/h), `source:"Straight-line fallback"` | **null** |

Notes and open questions for #203/#204 (not changed here):

- The OSM fallback URL uses the **`/driving/` profile on the `routed-bike`
  host** (`route.ts:169`). Whether `routed-bike` + `driving` yields true
  bicycle weighting or car weighting must be verified before #206 claims
  anything about «more cycling infrastructure».
- `Authorization: <key>` is sent raw (no `Bearer` prefix, `route.ts:103`).
  Works with current ORS keys; re-verify if ORS rejects keys in #204 tests.
- Only `routes[0]` / `features[0]` is used; alternatives are discarded.

### 1.5 What the provider returns vs what survives

| Datum | ORS path | OSM path | Fallback | Persisted on save |
|---|---|---|---|---|
| Geometry (LineString) | kept | kept | computed | yes (`gis.geography(LineString,4326)`, GiST) |
| Distance / duration | kept | kept | computed | yes (nullable duration) |
| Elevation gain | computed from `z` | **lost (null)** | **lost (null)** | yes, nullable |
| Per-point `z` | kept in response, stripped for paint | n/a | n/a | **not stored** (only scalar gain) |
| Surface / smoothness | **never requested** (`extras` absent) | **never requested** (`steps=false`, no annotations) | n/a | **not stored** |
| Cycleway / lane tags | **never requested** | **never requested** | n/a | **not stored** |
| Traffic / safety | not provided by either path | not provided | n/a | n/a — must never be invented (#206) |
| Waypoints | `pointCount` returned (ORS only) | order preserved in URL, count not returned | n/a | yes, `waypoints jsonb` |

Consequence: **#203 cannot reuse routing responses for infrastructure or
surface.** It needs a separate read-only OSM data query (see §3). **#204
must handle `elevationGainMeters: null` and `z`-less geometry as the normal
case** whenever the ORS key is absent — profile hidden, `—` shown, no fake
zeros.

### 1.6 Persistence

`lib/db/schema.ts`: `routes{id, author_id, title, description,
geometry gis.geography(LineString,4326) NOT NULL + GiST index,
distance_meters NOT NULL, elevation_gain_meters NULL,
duration_seconds NULL, is_public DEFAULT true, waypoints jsonb,
created_at}`. Production truth = `supabase/migrations/*.sql` (immutable;
`20260922150000` PostGIS in `gis` schema, `20260922160000` routes table +
GeoJSON-text conversion). Recommendation for #203: **no schema change** —
fetch infra/surface on demand; storing per-segment tags is deferred until
#206 proves it needs persisted signals.

### 1.7 Reusable pieces for #203+ (minimal diff)

- GeoJSON source + casing/line layer pattern (`MapClient`/`SavedRouteMap`).
- `NavigationControl` placement, `fitBounds` discipline, `setWorkerUrl`.
- Quick-actions + `action-feedback` + `hint`/`error` copy patterns.
- `route.source` attribution line («Routing: …») — extend to layers.
- `lib/route-history.ts`, `lib/route-catalog-cache.ts`,
  `lib/route-error-messages.ts` (friendly codes, no stack traces).
- New in this PR, behavior-free: `lib/bike-map-layers.ts` (layer/state
  contracts, source metadata, legend copy) + `tests/bike-map-layers.test.ts`.

## 2. Source matrix (documented state, not live-probed)

Quotas below are vendor-documented/fair-use expectations as of 2026-10-11;
exact numbers must be re-checked in the implementing task before pinning
retry/backoff constants. No key is added by this PR.

| Use | Candidate source | Coverage / freshness | License / attribution | Limits / cost |
|---|---|---|---|---|
| Basemap (today) | OSM raster tiles `tile.openstreetmap.org` | World; minutes–days | ODbL, `© OpenStreetMap contributors` (already shown) | Tile-usage policy; heavy use needs own tile provider — monitor, no change now |
| Infra + surface (#203 MVP) | **OSM data via Overpass API** | World, uneven: good in cities, sparse `surface=` elsewhere; community-edited | ODbL, same attribution | Public fair-use; bbox-scoped single query per route, debounced; on 429/5xx → layer off + notice, routing unaffected |
| Infra + surface alternative (rejected for MVP) | ORS `extras` (`surface`, `waytypes`, `steepness`) | Along route only; needs key | ORS ToS + OSM attribution | Quota-gated, key required → not the default path; revisit only if Overpass proves insufficient |
| POI / services (#205) | OSM data via Overpass API (same stack as #203) | `shop=bicycle`, `amenity=bicycle_repair_station`, `amenity=bicycle_parking`, `amenity=bicycle_rental`, plus `drinking_water/toilets/shelter` where tagged | ODbL, same attribution | Same discipline + per-category toggles + marker clustering/caps for mobile |
| Elevation (#204) | ORS `elevation:true` (today) → verify density/noise; else SRTM-derived helper | Along route | Depends on helper; document in #204 | No new key in MVP; never zero-fill missing `z` |
| Weather (#207) | Open-Meteo (candidate) | Global forecasts, model refresh several times/day | CC-BY 4.0, `Weather data by Open-Meteo.com` | Free, no key; per-route cache + timestamp + units; failure never blocks map |
| Community reports (#208) | Own DB (new table in #208, not here) | User content, `expiresAt`-boxed | Own ToS; auth + spam + expiry policy | Server validation, rate limits, confirm/refute; migration from clean DB |
| E-bike (#209) | Formula over distance + gain (+ wind if #207 reliable) | — | Documented assumptions, range output | Do not ship false precision; `not planned` with rationale is acceptable |

## 3. Decision (MVP choice for #203)

**Use OpenStreetMap data via Overpass API (read-only, bbox around the
built route) for both the cycling-infrastructure layer and the surface
layer.** Rationale: no API key, no cost, consistent with the attribution
already displayed, world coverage, sufficient tag vocabulary
(`cycleway`, `bicycle=*`, `highway=cycleway`, `surface`, `smoothness`,
`tracktype`). ORS extras stay a fallback option, not the default.

Explicit non-goals (epic constraints): no «protected lane» inference
without tags; no safety/traffic/crash claims; unknown ≠ absent everywhere;
no new paid source without justification.

## 4. Layer architecture contract (for #203 to implement)

Types are pinned in `lib/bike-map-layers.ts`; prose here binds behavior:

1. **Registry:** five toggleable layers max —
   `cycling-infrastructure`, `surface`, `services`, `weather`, `reports`.
   All default **off** (`DEFAULT_LAYER_STATE`). Toggling never triggers
   routing or re-render of the route line.
2. **Per-layer state:** `{enabled, data: idle|loading|ready|empty|error|
   disabled, notice}`. `layerNeedsNotice()` ⇔ `empty|error|disabled`.
3. **Missing-data rule:** `UNKNOWN_MEANS_UNKNOWN`. Legend and cards say
   «where tagged» / «unknown surface»; absence of rendering is never
   described as absence of infrastructure.
4. **Legend + attribution:** every enabled layer shows its `legendFor(id)`
   lines and its `LAYER_SOURCES[id].attribution`. No safety wording
   (test asserts the legend vocabulary contains no safe/protected/
   guaranteed/traffic-intensity claims).
5. **Fetching discipline:** one bbox query per built route (bbox of route
   geometry + small pad), debounced on map move; in-memory cache keyed by
   rounded bbox; any failure → `data:"error"` + notice, map keeps working.
6. **Mobile/a11y:** toggle control ≥44 px targets (follow `.quick-action`
   precedent), keyboard-operable, `aria-pressed`, legend readable at 360 px;
   desktop + mobile + toggle a11y verified in #203 acceptance.
7. **No persistence change in #203/#204:** layers are derived views, not
   stored columns. #206 documents which signals would need persisting.

## 5. Implementation plan for #203–#209 (after this PR)

1. **#203** — infra + surface layers per §4 on the Overpass MVP source;
   legend, attribution, empty/error states; tests for unknown-handling,
   debounce/bbox, no routing regression (E2E core flow untouched).
2. **#204** — elevation profile upgrade (density/noise/grade segments,
   ascent + descent if `z` allows) on the §1.5 null-handling baseline; can
   start once §4 contracts are agreed, in parallel with #203.
3. **#205** — services/POI reusing the §4 registry + Overpass; category
   toggles, cards with only known fields, marker caps, loading/error/empty.
4. **#206** — route comparison only on documented signals from #202/#203
   (+#204 relief when present); «faster» vs «more infra» with stated
   trade-offs; never «safe»; E2E no-regression on core routing.
5. **#207** — weather candidate validation (limits/license/attribution),
   toggleable strip with timestamp+units+wind-along-track; cached, non-blocking.
6. **#208** — reports model `{category, coords, description, author,
   createdAt, expiresAt, status}` + confirm/refute + auto-expiry; server
   validation, чужое-edit запрет, clean-DB migration test. Needs auth/spam
   design attention beyond §4.
7. **#209** — last; e-bike range estimate only as documented range with
   assumptions (capacity, mass, base consumption); close as `not planned`
   with rationale if calibration data is insufficient.

## 6. Verification of this PR (#202)

- `npm run test:run` — must pass (incl. new `tests/bike-map-layers.test.ts`).
- `npm run build` — must pass.
- `npm run tasks:validate` — **does not exist** in `package.json`; the
  #202 acceptance text predates the current skill-based workflow
  (`skills/task-driven-development/SKILL.md`, AGENTS.md: Issues are the sole
  task DB, no `tasks/*.json`). Not runnable — stated explicitly instead of
  claimed. `docs/development-workflow.md` still describes the retired
  `tasks/*.json` flow and should be updated separately (out of scope here,
  no hidden expansion).
- CI required checks on the PR head SHA: `validate` job
  (freshness / Issue-link+branch / `version:check` / coverage / `build` /
  registration E2E) — recorded in the PR report, not claimed in advance.
- Manual: desktop + mobile render of home map unchanged (this PR adds no
  map UI); `route.source` line unchanged.
