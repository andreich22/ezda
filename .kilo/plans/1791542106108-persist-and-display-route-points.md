# Persist and display Route points on the saved route page

## Goal
Show the "Route points" list (Start / Waypoint N / Finish with `lat, lon`) on the saved route page (`/routes/[id]`) exactly as it appears during creation in `components/MapClient.tsx:416`.

## Root cause (why this does not work today)
- During creation, "Route points" renders the user-clicked waypoints from MapClient's `points` state (`[lng, lat]`).
- On save, only the routing engine's `LineString` geometry is persisted to `routes.geometry`. The individual waypoints are **never stored** — see `lib/db/schema.ts` (no waypoints column) and `createRoute` in `lib/db/routes.ts:9`.
- Therefore the saved route page has no data to render that list.

## Decision
Persist the user waypoints in a new nullable JSONB column on `routes`, then surface them on the viewer page. A JSONB column (not a separate table) is chosen for MVP simplicity and matches "smallest change" guidance.

## Data note
- Stored format: ordered array of `[lon, lat]` (consistent with geometry coordinates everywhere).
- MapClient renders coordinates as `lat.toFixed(5), lon.toFixed(5)` (`point[1], point[0]`). Replicate exactly on the viewer page so it looks identical.
- Legacy routes have no waypoints → render the existing "No points yet" empty state.

## Files to change

### 1. DB migration — `supabase/migrations/<timestamp>_route_waypoints.sql` (new)
```sql
alter table public.routes add column if not exists waypoints jsonb;
create index if not exists routes_waypoints_idx on public.routes using gin (waypoints);
```
Timestamp prefix must sort after the latest existing migration.

### 2. `lib/db/schema.ts`
Add to the `routes` table:
```ts
waypoints: jsonb("waypoints").nullable(),
```
(Import `jsonb` from `drizzle-orm/pg-core`.) Keep it in sync with the SQL above so `npm run db:generate` shows no drift.

### 3. `lib/route-validation.ts`
- Add `waypoints?: Point[]` to `CreateRouteInput`.
- In `parseCreateRouteInput`, accept an optional `waypoints` array; validate each entry with the existing `isFiniteNumber`/range checks (lon ∈ [-180,180], lat ∈ [-90,90]); cap count at a new `MAX_WAYPOINTS = 500`; default to `undefined` when absent so existing callers/tests are unaffected.

### 4. `lib/db/routes.ts`
- `createRoute`: store `waypoints: input.waypoints ?? null`.
- `updateRoute`: **conditionally** set waypoints — only include `waypoints` in the SET clause when `input.waypoints != null`. This is edit-safe: a PATCH that omits waypoints (e.g. editing title/description/geometry) must NOT wipe existing ones. When provided, persist them.
- `getRouteForViewer` and `getPublicRoute`: select `waypoints`; include it in the returned object as an array or `null`.

### Editing later (future work — design so it needs no schema/API changes)
- The future edit page will load waypoints via `getRouteForViewer` (owner scope already allows reading own routes), prefill MapClient with them, and re-save through PATCH. Because both save and update carry `waypoints` in `[lon, lat]`, they round-trip unchanged.
- No new column or endpoint is required; only a client edit page that reads/writes the existing field. Coordinate order stays `[lon, lat]` everywhere (save, update, render, edit-prefill).

### 5. `components/MapClient.tsx` (`saveRoute`, ~line 277)
Add `waypoints: points` to the `/api/routes` POST body so the clicked waypoints are persisted on save.

### 6. `app/routes/[id]/page.tsx`
- Accept `route.waypoints` and render a "Route points" card **reusing existing CSS classes** (`.waypoints`, `.point-dot`, `.start`, `.finish`, `.empty`) — no new CSS needed.
- Markup mirrors MapClient: empty state `"No points yet"` when null/empty; otherwise `<ol>` of `<li>` with a `point-dot` (class `start` for index 0, `finish` for last) and label (`Start` / `Waypoint ${index}` / `Finish`) plus small text `{lat.toFixed(5)}, {lon.toFixed(5)}` from `[lon, lat]`.
- Place the card inside the left `.route-detail` column after the `<div className="stat">…</div>`.

## Validation
1. `npm run db:generate` — confirm no schema drift vs. the new migration.
2. `npx tsc --noEmit` (or `npm run build`) — type check.
3. `npm run test:run` — ensure existing route/validation tests still pass.
4. Manual E2E:
   - Log in → create a route with 2+ clicks → save → open the saved page → verify "Route points" list matches the creation view (labels + `lat, lon`).
   - Open a legacy route saved before this change → verify it shows "No points yet".

## Risks / notes
- Coordinate order must stay `[lon, lat]` on write and render as `lat, lon` to match MapClient exactly (save, update, render, edit-prefill).
- Edit-safety: `updateRoute` only writes waypoints when provided; omitting them in a PATCH preserves existing values.
- Legacy routes have null waypoints → viewer shows "No points yet".
- JSONB column is nullable to avoid backfilling existing rows.
- No `/routes/new` or edit page exists today (MapClient mounts only on `app/page.tsx`); the update path is exercised once the edit page lands, but requires no further schema/API work.
