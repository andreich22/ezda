-- The application expects PostGIS in the `gis` schema.
-- The postgis/postgis Docker image preinstalls PostGIS into `public`,
-- and PostGIS is not relocatable, so a reinstall is required in that case.

create schema if not exists gis;

do $$
declare
  extension_schema text;
begin
  select n.nspname
    into extension_schema
    from pg_extension e
    join pg_namespace n on n.oid = e.extnamespace
   where e.extname = 'postgis';

  if extension_schema is null then
    execute 'create extension postgis with schema gis';
  elsif extension_schema <> 'gis' then
    if exists (select 1 from pg_extension where extname = 'postgis_raster') then
      execute 'drop extension postgis_raster';
    end if;
    if exists (select 1 from pg_extension where extname = 'postgis_tiger_geocoder') then
      execute 'drop extension postgis_tiger_geocoder';
    end if;
    if exists (select 1 from pg_extension where extname = 'postgis_topology') then
      execute 'drop extension postgis_topology';
    end if;
    execute 'drop extension postgis';
    execute 'create extension postgis with schema gis';
  end if;
end $$;
