-- Ezda initial Supabase/PostGIS schema
-- PostGIS is installed in a dedicated schema instead of public.

create schema if not exists gis;
create extension if not exists postgis with schema gis;

create table if not exists public.routes (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  geometry gis.geography(LineString, 4326) not null,
  distance_meters double precision not null,
  elevation_gain_meters double precision,
  duration_seconds double precision,
  is_public boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists routes_geometry_gist_idx
  on public.routes
  using gist (geometry);

-- The original MVP schema stored GeoJSON in text. If such a table already exists,
-- convert it in-place without losing route metadata.
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'routes'
      and column_name = 'geometry'
      and data_type = 'text'
  ) then
    alter table public.routes
      add column geometry_geog gis.geography(LineString, 4326);

    update public.routes
    set geometry_geog =
      st_setsrid(
        st_geomfromgeojson((geometry::jsonb -> 'geometry')::text),
        4326
      )::gis.geography
    where geometry is not null;

    alter table public.routes drop column geometry;
    alter table public.routes rename column geometry_geog to geometry;
  end if;
end $$;

create index if not exists routes_geometry_gist_idx
  on public.routes
  using gist (geometry);
