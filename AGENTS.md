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

## Mandatory Task-Driven Development

The development workflow is based on the agent-governance rules adopted from `andreich22/privateAI`, adapted to Ezda's Next.js/TypeScript stack.

**Mandatory rule:** AI MUST NOT modify project code, configuration, tests, or documentation without an associated Task ID. New tasks MUST begin as a GitHub Issue titled `TASK-<4 lowercase hex-id> <title>`. The Task metadata (`tasks/<id>.json` and `tasks/index.json`) is part of the same implementation branch and Pull Request as the change; there is no separate registration PR.

Task IDs are exactly four lowercase hexadecimal characters. Every implementation commit MUST use `<type>: <task-id> | <description>`. All commits for the same task use the same ID. Do not mix unrelated tasks in one commit.

Task relationships are stored in `tasks/relations.json`. Use `depends_on` and `parent` for dependency/structure; use `related`, `duplicates`, `derived_from`, `replaces`, and `implements` for other relationships. Do not duplicate reverse edges. Circular `depends_on`/ `parent` graphs are invalid.

Before marking a task `done`, run `npm run tasks:validate` and the relevant tests/build.

## Protected Git workflow for AI

The repository default branch is `main`. AI agents MUST NOT commit directly to `main`, push directly to `main`, force-push it, rewrite its history, or bypass branch protection.

### Ordinary task

For a task that is not a child of an umbrella task, use:

```text
Issue → task/<task-id>-<short-name> → Task metadata + implementation commits → PR → main → checks → human merge
```

The implementation PR targets `main).

### Umbrella task

An umbrella task is a parent task that has one or more child/subtasks in its task relationships.

For an umbrella task:

1. Create a dedicated umbrella branch from `main`:
   `task/<umbrella-task-id>-<short-name>`.
2. The umbrella branch is the integration branch for all child tasks.
3. Every child task MUST have its own task branch.
4. A child-task PR MUST target the umbrella branch, never `main`.
5. Child-task PRs may be merged only into the umbrella branch.
6. A child task MUST NOT create or merge a PR directly into `main`.
7. The umbrella branch MUST NOT be merged into `main` until every child task is either:
   - completed and its PR merged into the umbrella branch; or
   - explicitly closed/cancelled according to the task's lifecycle.
8. Only after all child tasks are resolved is the umbrella branch considered ready for the umbrella PR.
9. The umbrella PR targets `main`.
10. The umbrella PR is the only PR that delivers the umbrella task's integrated child work into `main`.

The required umbrella lifecycle is:

```text
Umbrella Issue
  ↓
task/<umbrella-id>-<short-name>
  ↓
Child Task Issues
  ↓
task/<child-id>-<short-name>
  ↓
Child PR → umbrella branch
  ↓
merge child PR into umbrella branch
  ↓
repeat until all children are resolved
  ↓
Umbrella PR → main
  ↓
checks → human merge
```

When an umbrella task has unresolved child tasks, its branch MUST be treated as not ready for merge into `main`. The child-task PRs are integration PRs only; they are not release-to-`main` PRs.

AI MUST NOT merge its own implementation PR unless the user explicitly instructs it and repository policy permits it.

If implementation reveals unrelated work, create a separate Issue/task instead of silently expanding scope.

## Development procedure

Before editing:
1. Load `skills/task-driven-development/SKILL.md` and `skills/git-workflow/SKILL.md`.
2. Identify the associated GitHub Task Issue.
3. Create/use a task-specific branch: `task/<task-id>-<short-name>`, and add the Task metadata to that branch before or alongside implementation.
4. Verify the Task metadata is complete enough for implementation.
5. Inspect relevant files, tests, existing patterns, lifecycle, persistence, API, database, and browser implications.
6. Make the smallest reasonable change.
7. Avoid unrelated refactors.
8. Use the Task ID in every implementation commit.
9. Run relevant tests, build, and `npm run tasks:validate`.
10. Open/update the implementation PR with requirements, acceptance criteria, validation, risks, and the Task ID.
11. Review the diff for regressions, security issues, data/privacy concerns, and unnecessary dependencies.

## Completion requirements

A task is complete only when requirements and acceptance criteria are satisfied, relevant validation passes, task history/commit metadata are updated, PR checks pass, and the change is merged through the protected PR path.

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

