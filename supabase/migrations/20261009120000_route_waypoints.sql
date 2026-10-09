-- Persist user-clicked route waypoints for display on the saved route page.
-- Keep nullable so existing routes created before this migration remain readable.
alter table public.routes
  add column if not exists waypoints jsonb;

create index if not exists routes_waypoints_idx
  on public.routes using gin (waypoints);
