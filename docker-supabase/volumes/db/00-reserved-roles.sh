#!/usr/bin/env bash
# Create Supabase reserved roles so GoTrue can connect as supabase_auth_admin.
# The official docker/volumes/db/roles.sql only sets passwords on these roles,
# assuming they already exist; a minimal auth-only stack needs them created first.
set -euo pipefail

DB="${POSTGRES_DB:-supabase}"

psql -U postgres -d "$DB" -v ON_ERROR_STOP=1 <<SQL
DO \$\$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role NOLOGIN; END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon NOLOGIN; END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'supabase_auth_admin') THEN CREATE USER supabase_auth_admin WITH PASSWORD '${POSTGRES_PASSWORD}'; END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticator') THEN CREATE USER authenticator WITH PASSWORD '${POSTGRES_PASSWORD}'; END IF;
END
\$\$;

-- Postgres 15+ no longer grants CREATE on the public schema to arbitrary users,
-- so GoTrue (connecting as supabase_auth_admin) cannot create its auth tables.
-- Hand ownership of public to supabase_auth_admin so its migrations can proceed.
ALTER SCHEMA public OWNER TO supabase_auth_admin;
GRANT ALL ON SCHEMA public TO supabase_auth_admin;

-- Pre-create the auth schema owned by supabase_auth_admin so GoTrue's
-- "CREATE TABLE IF NOT EXISTS auth.*" migrations find an existing schema.
CREATE SCHEMA IF NOT EXISTS auth AUTHORIZATION supabase_auth_admin;
GRANT ALL ON SCHEMA auth TO supabase_auth_admin;

-- GoTrue queries auth tables by short name (e.g. "identities"), so the auth
-- admin role must default its search_path to the auth schema, exactly as the
-- full Supabase stack does for its reserved roles.
ALTER ROLE supabase_auth_admin SET search_path TO auth, public;
SQL
