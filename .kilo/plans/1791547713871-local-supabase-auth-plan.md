# Plan: Local authentication (self-hosted Supabase in Docker)

## Context
The auth system depends entirely on an external **Supabase Auth** service (`lib/auth.ts` calls `${SUPABASE_URL}/auth/v1/...`). The local Docker stack runs only PostGIS + app; there is no local auth provider, and `SUPABASE_URL` / `SUPABASE_ANON_KEY` are empty in `.env.example` and are **not injected** into the `app` container. That is why `/api/auth/login` and `/api/auth/signup` fail locally.

The user chose to **self-host Supabase in Docker**. This is infra/config only — no application source changes are required, because `lib/auth.ts:18` reads credentials from `process.env` at request time.

Existing flow (keep intact):
- Signup → `/api/auth/signup` → Supabase sends confirmation email (SMTP mock on **port 4010**).
- User clicks link → `/auth/confirm?token_hash=…&type=signup` (`app/auth/confirm/route.ts`) → `verifyEmailToken` → sets HttpOnly session cookies → redirects to `/auth?confirmed=1`.
- Login → `/api/auth/login` → `signIn` → `ensureProfile` (creates `public.profiles` row keyed by Supabase user id) → session cookies.

The e2e test `tests/e2e/auth-registration.spec.mjs` already expects the Supabase SMTP mock at `http://127.0.0.1:4010/test/confirmation?email=…`, so **email confirmation must stay enabled locally** (disabling it would break that test).

## Decisions
- Run a self-contained Supabase instance in its own Docker service with its own Postgres (auth lives in the `auth` schema, separate from the ezda PostGIS db). The two databases link only by user id in `public.profiles`.
- Keep email confirmation ON locally; rely on Supabase's built-in SMTP mock (port 4010) + the existing `/auth/confirm` callback. This keeps the e2e test green and matches current design.
- Inject credentials into the `app` container via docker-compose env, using the **docker service hostname** for `SUPABASE_URL` (reachable from inside the network), while Supabase's allowed redirect/site URL includes `http://localhost:3000`.

## Tasks

### 1. Add a self-hosted Supabase service to `docker-compose.yml`
- Add a `supabase` service using the official Supabase self-host image/compose (verify current instructions in Supabase docs — env names change across versions). It must bring: Auth (gotrue), its own Postgres, SMTP mock on **4010**, Studio on **5000**.
- Put it on the default compose network so `app` can reach it by service name. Expose 4010 (smtp) and 5000 (studio) to the host for debugging/inbox.
- Do **not** confuse this with the existing `supabase/migrations/*.sql` — those are Ezda app-schema SQL (routes/profiles), unrelated to the auth database.

### 2. Obtain SUPABASE_URL and SUPABASE_ANON_KEY from the running instance
This is the riskiest step (keys are generated at startup). Recommended approaches, verify against current docs:
- Read them from the container env via `docker inspect ezda-supabase-1` (`GOTRUE_API_KEY`, JWT secret) and derive/confirm the anon key, **or**
- Open Supabase Studio on port 5000 → API settings → copy the `anon` / `public` key and the local URL.
- Provide a small helper (e.g. `scripts/local-supabase-keys.mjs`) that prints the two values so they can be pasted into env, to make this repeatable.

### 3. Inject credentials into the `app` service + document them
- In `docker-compose.yml`, add to the `app` environment:
  - `SUPABASE_URL=http://supabase:8000/auth/v1` (docker hostname; confirm the auth port your image exposes).
  - `SUPABASE_ANON_KEY=<from step 2>`.
- Update `.env.example` with placeholder guidance and document a `.env.local` workflow for non-Docker runs, where `SUPABASE_URL` would be `http://localhost:<port>/auth/v1` instead.

### 4. Configure Supabase allowed origins / redirect URLs
- In Supabase Auth settings set the Site URL to `http://localhost:3000` and add redirect URLs including `http://localhost:3000/auth/confirm` and `http://localhost:3000/auth`. The signup route passes `redirect_to=${origin}/auth/confirm` with origin `localhost:3000`; Supabase will reject it if not permitted.

### 5. Verify end-to-end locally
- `docker compose up --build`, open http://localhost:3000/auth.
- Sign up with a test email → copy the confirmation link from the SMTP mock (`http://127.0.0.1:4010/...`) or Studio inbox → open it → land on `/auth?confirmed=1` and signed in.
- Sign out, then **log in** with the same credentials to confirm the login path works.
- Run `npm run test:run` (vitest) — expect no regressions (`tests/auth-recovery.test.ts` stubs SUPABASE and is unaffected).
- Optionally run `npm run test:e2e:auth` against the local stack (requires 4010 reachable).

## Implementation status (completed on branch task/a7c3-local-supabase-auth)

Self-hosted Auth is integrated into the root `docker-compose.yml` and verified
locally (signup -> login -> `/api/auth/session` -> `public.profiles` row all pass;
vitest 119/119 green). Deviations from the draft above, driven by live testing:

- **GoTrue version / path prefix.** Used `supabase/gotrue:v2.196.0`. Empirically
  it serves its routes at the **root** and ignores `GOTRUE_API_PATH_PREFIX`
  (`/signup` -> 200, `/auth/v1/signup` -> 404 with the prefix set). Since
  `lib/auth.ts:40` hardcodes appending `/auth/v1/` (required for real Supabase and
  the E2E mock provider on :4010), added an **nginx proxy** (`docker-supabase/nginx.conf`)
  that strips `/auth/v1` -> GoTrue root. `lib/auth.ts` and all tests are unchanged.
- **App URL.** `SUPABASE_URL=http://auth-proxy:8000` (base only; `lib/auth.ts` appends
  `/auth/v1`). GoTrue is internal-only (`expose: 9999`); the proxy exposes host
  `${SUPABASE_DEBUG_PORT:-8000}` for debugging.
- **Email confirmation.** Set `GOTRUE_MAILER_AUTOCONFIRM=true` for a reliable local
  signup (GoTrue v2 uses a noop mailer and standalone SMTP config is fragile). With
  auto-confirm, `/signup` returns the user but no session, so the user signs in via
  `/api/auth/login` — which works. The E2E auth test uses its own mock provider on :4010
  and is unaffected by this setting. Set `SUPABASE_MAILER_AUTOCONFIRM=false` + an SMTP
  server to exercise the real confirmation flow later.
- **No Studio / standalone SMTP.** The minimal GoTrue+Postgres stack omits Studio (:5000)
  and a live SMTP inbox; keys are not extracted (GoTrue v2 standalone does not enforce an
  API key, so `SUPABASE_ANON_KEY` is a fixed dev placeholder). Removed the redundant
  standalone `docker-supabase/test-compose.yml` stack (broken `4010:4010` mapping) and
  kept `docker-supabase/volumes/db/00-reserved-roles.sh` for auth-db init.

### Risks / open questions
- Exact self-hosted Supabase image env vars vary by version — implementer must verify with current Supabase docs rather than assume.
- Automating anon-key extraction is the main fragility; a small helper script mitigates it but may need tuning per image version.
- Two different `SUPABASE_URL` values exist depending on context: docker hostname (`http://supabase:8000/...`) inside the container vs `http://localhost:<port>/...` for non-Docker local dev — keep them straight.
- Confirm with the user whether they also want Google OAuth working locally (the page already links `/api/auth/google`, which needs its own Supabase OAuth provider config) — out of scope for this plan unless requested.
