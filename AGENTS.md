<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Ezda — Project Instructions for AI Agents

## Product
Ezda is a web application for planning, saving, discovering, and sharing bicycle routes.

Core user flow: **Open → build → save → share → another person opens.**

The map is the foundation of the UI; the product is the routes and the community around them.

## Product goals
- Make bicycle route planning simple and fast.
- Use real bicycle road routing through an external routing engine.
- Let users save and publish routes.
- Give every public route a shareable page/link.
- Evolve toward a community of cyclists and their routes.
- Keep the architecture extensible and local development simple.

## MVP priorities
1. Interactive map.
2. Start and finish selection.
3. Bicycle route calculation.
4. Distance.
5. Duration.
6. Elevation gain.
7. Save route.
8. Public route page.
9. Shareable URL.
10. Public route list.

Do not add complex features before the core flow works reliably.

## Stack
- Next.js + React + TypeScript.
- Next.js App Router.
- MapLibre GL JS.
- PostgreSQL + PostGIS.
- Drizzle ORM.
- GeoJSON at API/UI boundaries.
- OpenRouteService, GraphHopper, or Valhalla for routing.
- Docker Compose for local infrastructure.
- Vitest and Playwright for tests.
- Vercel may be used for production.

## Architecture rules
### Routing
Never implement a routing engine from scratch.

Hide the routing provider behind an internal API/service layer so it can be replaced later.

A straight-line fallback is acceptable for the early MVP when no routing API key exists, but the application must distinguish fallback geometry from a real road route.

### Geospatial data
Use GeoJSON between API and UI.

Prefer PostGIS geometry with an appropriate SRID for persistent spatial data. Do not treat plain text geometry as the final architecture once spatial queries are needed.

### Route vs Ride
Keep these concepts separate:
- Route — a planned route.
- Ride — an actual completed trip.

Do not merge them when adding future functionality.

### API
APIs must validate input, return predictable JSON, use appropriate HTTP status codes, avoid exposing secrets, and surface external-provider failures clearly.

## UI/UX
The interface should be map-first and work on desktop and mobile.

Planned routes/pages include:
- / — home.
- /map — map.
- /routes — route catalog.
- /routes/[id] — route detail.
- /routes/new — route creation.
- /routes/[id]/edit — route editing.
- /profile/[username] — profile.
- /my/routes — user's routes.
- /settings — settings.

Keep primary actions obvious and avoid unnecessary UI complexity.

## Data model
A route should support at least:
- id
- author
- title
- description
- geometry
- distance
- elevation gain
- duration
- public/visibility status
- createdAt
- updatedAt

Future entities/features may include route points, photos, likes, comments, saved routes, tags, and points of interest.

## Security
Never commit API keys, passwords, tokens, private credentials, or production secrets.

Use environment variables and keep .env.example updated when configuration changes.

Validate all public API input.

## Code quality
Prefer:
- TypeScript strict mode.
- Small, focused components.
- Reusable functions.
- Explicit API types.
- Server Components by default.
- Client Components only when browser state or browser APIs are required.
- Minimal use of the untyped escape hatch.

Avoid broad refactors unrelated to the current task.

## Database changes
When changing the database schema:
1. Update the Drizzle schema.
2. Create/update a migration.
3. Test the migration against a clean database.
4. Update seed/test data when needed.

The local database should be reproducible from scratch.

## Testing
Gradually add tests for critical user flows.

Minimum target E2E flow:
**Open app → select two points → calculate route → save → open public route page.**

When fixing a bug, add a regression test where practical.

## Local development
Docker:
    docker compose up --build

Without Docker:
    npm install
    npm run dev

The frontend runs at http://localhost:3000.

When PostgreSQL is run outside Docker, DATABASE_URL must point to the local PostgreSQL/PostGIS instance.

## Agent workflow
Before making changes:
1. Inspect the existing project structure.
2. Read relevant files and current implementation.
3. Preserve working functionality.
4. Make the smallest change that solves the task.
5. Follow the current Next.js agent rules above.

After making changes:
1. Run TypeScript/build checks where possible.
2. Test affected APIs.
3. Test affected UI.
4. Check Docker/local startup when infrastructure is affected.
5. Update documentation when behavior changes.

If a check cannot be performed because local infrastructure or secrets are unavailable, state that explicitly.

## Git
Keep commits small and focused.

Use conventional prefixes:
- feat:
- fix:
- refactor:
- docs:
- test:
- chore:

Do not mix unrelated changes in one commit.

## Product priority order
When priorities conflict:
1. Working core user flow.
2. Correct route and geospatial data.
3. Reliability and security.
4. Simple UX.
5. Performance.
6. Extensibility.
7. Additional features.

## Long-term direction
Ezda should evolve from a route planner into a platform where cyclists:
**create → discover → save → edit → ride → discuss → share routes.**

Future directions include route discovery/search, profiles, follows, likes, comments, route copying, photos, points of interest, GPS tracking, ride statistics, and comparison of planned Route versus actual Ride.

New features should not make the core flow unnecessarily complicated.

## Mandatory agent preflight and postflight

This protocol applies to primary agents, delegated agents, and subagents. Follow it in order; do not treat memory or a previously opened checkout as proof that the branch is current.

### Before editing (preflight)

1. Read this file, the task's GitHub Issue and linked dependencies, README.md, relevant documentation, and the code/workflows affected by the task.
2. Fetch the latest remote refs. Determine the repository's default branch from GitHub/repository metadata; this project currently uses `main`. Do not silently assume a branch name if metadata disagrees.
3. Record the current base commit SHA. Verify the worktree and branch before changing anything. If uncommitted work exists, preserve it and understand its ownership; never discard it to make an update easier.
4. Work on `task/<issue-number>-<short-name>`, created from the latest base. For an existing task branch, compare it with the freshly fetched base and update/rebase it safely before editing if needed. Do not use destructive resets or force-push as a shortcut. If safe reconciliation is impossible, stop and report the blocker.
5. Confirm the branch is not based on a stale snapshot and that its intended Issue/PR relationship is clear. The base SHA used to start work should be recorded in the task notes or PR description when useful.

### Before opening/updating a PR (postflight)

1. Fetch the target base again and compare its current SHA with the task branch. If the branch is behind or has conflicts, update it safely and rerun affected checks before claiming it is ready.
2. Ensure the PR targets the correct base, uses the required branch naming convention, and includes `Closes #<issue-number>`. Keep the GitHub Issue as the single source of truth; do not create task registries in repository JSON files.
3. After every push/update, wait for CI to finish for the exact current PR head SHA. A green run on an earlier SHA is stale evidence and must not be reported as success.
4. Inspect all required check conclusions, not just the aggregate UI badge. Distinguish required checks from explicitly informational warnings. A missing, skipped unexpectedly, queued, in-progress, cancelled, or failed required check is not a pass.
5. Do not claim the task is fully complete while required checks are pending/failed, the PR is stale, or required review/merge remains outstanding. Report implementation, verification, review, and merge as separate states. Human merge remains the normal release boundary unless explicit authorization and repository policy say otherwise.

### Required completion report

Include the Issue and PR links; branch and target base; base SHA used for final freshness verification and final PR head SHA; required CI check names and final statuses tied to that head SHA; local commands actually run and results; review/merge state; and any unavailable checks, secrets, infrastructure limitations, or remaining blockers. Never imply a check passed if it was not run or its result could not be verified.

## GitHub Issues as the single source of truth

GitHub Issues are the only canonical task database. Do not maintain task status, priority, acceptance criteria, dependencies, or queue state in repository JSON files.

- Every unit of work starts with one GitHub Issue. Search for duplicates before creating one; use the Issue number as the durable identifier.
- Keep goal, requirements, acceptance criteria, Definition of Ready/Done, priority, and dependency links in the Issue body/labels/relationships.
- PRs and commits reference the Issue number (for example `fix: #140 | description`). PR bodies must contain `Closes #N`.
- Do not create or update `tasks/index.json`, `tasks/<id>.json`, or `tasks/relations.json` as task databases. Do not require local Task IDs, task registry validators, or a local queue.
- Before starting work, follow the mandatory agent preflight and postflight protocol above. Before reporting completion, verify acceptance criteria and CI checks against the latest PR head SHA.
- Keep the protected workflow: issue → task branch → PR → checks/review → human merge. Never commit directly to `main`, bypass protection, or merge your own PR without explicit authorization and repository policy permitting it.
- If legacy task records are encountered, migrate useful requirements and relationships into canonical GitHub Issues before removing them. Do not create duplicate Issues.

## Decision priority

When implementation choices conflict, prioritize:
1. Correctness and reliability.
2. Core route-planning flow.
3. Security and privacy.
4. Simple architecture.
5. Performance.
6. UX.
7. Extensibility.
8. Additional features.

## Agent reporting

After implementation, report:
- Task ID and title;
- branch and PR;
- changed files;
- tests/build/validator commands actually run;
- task relationships created or affected;
- known limitations and remaining risks.

