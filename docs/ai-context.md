# Ezda — Shared AI Project Context

> Purpose: durable handoff context for independent AI coding agents working on Ezda.
>
> Authority: this file is informational. AGENTS.md is authoritative for mandatory repository rules, Git workflow, task-driven development, branch protection, testing, and agent behavior. When this file conflicts with AGENTS.md or the current repository state, prefer the authoritative source and verify the implementation.

## 1. Project snapshot

Ezda is a bicycle route planning and sharing application.

Core flow: Open → build → save → share → another person opens.

The product is map-first, but the durable product objects are routes and the community around them.

Current stack:
- Next.js + React + TypeScript + App Router
- MapLibre GL JS
- PostgreSQL + PostGIS
- Drizzle ORM
- GeoJSON at API/UI boundaries
- OpenRouteService as the current routing provider, with a straight-line fallback when no ORS key is available
- Docker Compose for local infrastructure
- Supabase PostgreSQL for production database
- Vercel for production hosting
- Supabase Auth for authentication/session flow
- Resend for transactional email

## 2. Important architecture decisions

### Routing
Routing providers are hidden behind the application's internal API/service boundary. Do not couple UI code directly to a provider.

OpenRouteService is the current primary provider. A straight-line fallback is intentionally available for development when an ORS API key is unavailable. Fallback geometry must not be treated as a real road route.

### Geospatial data
GeoJSON is the API/UI boundary format.

Persistent spatial data uses PostGIS. The production schema stores route geometry as gis.geography(LineString, 4326) with spatial indexing.

The authoritative production schema is represented by SQL migrations under supabase/migrations/. Do not edit an already-applied migration; add a new migration.

### Route vs Ride
Keep these concepts separate:
- Route = planned route
- Ride = actual completed trip

Future GPS/ride functionality must not collapse these concepts.

## 3. Database and Supabase

Production PostgreSQL is provided by Supabase.

Vercel/serverless uses the Supabase Transaction Pooler connection string through DATABASE_URL. The application uses a single Postgres.js connection with prepare: false for transaction pooling.

Local Docker development normally uses DATABASE_URL=postgres://ezda:ezda@localhost:5432/ezda.

PostGIS migrations currently include:
- ensuring PostGIS is available in the dedicated gis schema;
- creating public.routes with PostGIS geography geometry;
- converting the earlier MVP geometry representation when upgrading an existing database.

Migration verification is performed with npm run db:migrate and node scripts/verify-migrations.mjs.

Never expose Supabase service-role credentials or database passwords to browser code or NEXT_PUBLIC_* variables.

## 4. Authentication and email

Authentication is implemented with Supabase Auth, but Ezda keeps sessions in server-managed HttpOnly cookies.

### Email confirmation
Signup uses a server-side confirmation callback. The callback consumes a Supabase token_hash, establishes the Ezda session, removes the token from the browser URL, and redirects to the auth page.

Production application URL: https://ezda-eta.vercel.app

Supabase URL configuration must allow the production application and local development. Vercel preview deployments need an appropriate redirect wildcard when preview auth flows are tested.

The Supabase confirmation email template is intentionally configured to link to the Ezda server callback rather than relying on the default client-side fragment flow.

### Password recovery
Password recovery follows the same server-side pattern:
1. Supabase sends a token-hash link.
2. Ezda receives it at /auth/recover.
3. The server establishes HttpOnly session cookies.
4. The user is redirected to /auth/reset-password.
5. Password update is performed through the server-side Ezda API.

NEXT_PUBLIC_SITE_URL is configured for production as https://ezda-eta.vercel.app; local development can rely on the local request origin.

## 5. Resend

Resend is the configured transactional email provider for Ezda's email workflows.

Do not put provider credentials in source control or browser-exposed environment variables.

If email delivery appears broken, inspect the provider's delivery/request logs and the Supabase Auth email configuration before changing application logic.

## 6. Vercel deployment context

Production is hosted on Vercel.

A recurring project concern has been deployment quota/usage, so deployment count should be treated as an operational resource.

The project has an explicit task for optimizing the number of Vercel deployments. Avoid introducing unnecessary deployment-triggering commits or workflow runs.

Automatic application versioning is intentional: version changes after merge into main are expected to trigger the corresponding deployment. Do not optimize deployments by accidentally disabling the required version-release deployment.

For current Vercel behavior, prefer the current Vercel/Next.js project documentation and the repository's installed agent guidance over older assumptions.

## 7. Routes and visibility

The route catalog is public-facing, while authenticated users can have their own routes.

The product direction is to keep route visibility on the same routes page and expose filtering rather than creating a completely separate route-management UI.

Agreed filter vocabulary:
- All
- My Routes
- Public

There is also a hamburger-menu/navigation path intended to take the user directly to their private/personal route view.

Route ownership and visibility are security-sensitive: the UI filter is not a substitute for server-side authorization.

## 8. Route catalog and pagination

The route catalog cannot assume that the total number of routes is small.

Current direction:
- server-side pagination;
- page + limit;
- a page size around 50;
- frontend caching of fetched pages/filter states;
- avoid issuing a new backend request merely because the user switches between filters when the required data is already available.

The architecture should remain suitable for hundreds or thousands of routes.

## 9. User interface conventions

The interface is map-first and must work on desktop and mobile.

Important recent UI work includes:
- collapsible/mobile sidebar;
- hamburger menu;
- quick map actions;
- interactive route summary;
- authentication navigation;
- displaying the user's name in the header derived from the email local-part, the part before @;
- route catalog filtering and pagination.

Do not regress the mobile navigation behavior while changing route/catalog UI.

## 10. Task-driven development

GitHub Issues are the only canonical task database. Task goals, requirements, priority, acceptance criteria, dependencies, and status belong in Issues, labels, and GitHub relationships. Do not use `tasks/index.json`, `tasks/<id>.json`, or `tasks/relations.json` as a task registry, and do not require local task-registry validators.

The protected workflow is:

1. GitHub Issue
2. Fresh `task/<issue-number>-<short-name>` branch
3. Pull request targeting the current default branch (currently `main`)
4. Required CI and review
5. Human merge

PR bodies must contain `Closes #<issue-number>`. The CI validates the Issue link and branch naming. Never commit directly to `main`, bypass branch protection, or merge without explicit authorization and repository policy permitting it.

All primary agents and subagents must follow the mandatory preflight/postflight protocol in `AGENTS.md`: fetch current refs before editing, safely reconcile an existing branch, compare against the latest target branch again before PR readiness, and verify CI against the exact latest PR head SHA. Never discard uncommitted work to update a branch; stop and report if safe reconciliation is impossible.

The CI freshness check fetches the current PR target branch and fails if that exact base SHA is not an ancestor of the PR head, or if the comparison cannot be completed. A green run for an earlier head SHA does not validate later commits. Human merge remains the normal release boundary.

## 11. Autonomous developer pipeline

The project has been evolving toward a more autonomous development workflow.

Relevant task infrastructure includes:
- deterministic task selection through npm run tasks:next;
- task metadata validation through npm run tasks:validate;
- CI validation of task metadata and PR readiness;
- AI review orchestration;
- bounded self-healing CI/PR remediation work;
- human-controlled merge into main.

Self-healing automation is intentionally bounded and must never become an unbounded retry loop or an implicit merge mechanism.

## 12. Recent development history / lessons

### Task-driven workflow simplification
The task workflow was deliberately changed so task registration metadata and implementation can live in the same implementation branch/PR. There is no separate registration PR.

### Umbrella task governance
Umbrella/child relationships were introduced to make larger changes traceable. A child task PR is an integration PR into the umbrella branch, not a release PR into main.

A closed umbrella is no longer a valid target for new child work.

### Authentication rollout
Authentication was introduced together with user profiles and route ownership. Later work has focused on email confirmation, password recovery, profile visibility, route privacy, and navigation.

### Production email troubleshooting
A missing confirmation email can be caused by Supabase Auth configuration/template/redirect settings or provider delivery rather than by the registration UI itself. Diagnose the full chain before changing the client.

### Deployment optimization
Vercel deployment limits became a practical constraint. The goal is not to stop legitimate releases, but to reduce redundant deployments while preserving required version-driven production deployments.

### Route catalog scaling
The catalog was initially simple enough for a small result set. It is now expected to support substantially more routes, so pagination and client-side caching are part of the current architecture direction.

## 13. Current task landscape

GitHub Issues and pull requests are the live source of truth for work in progress. Always search the repository's open Issues and linked PRs before starting work or creating a new Issue. Check dependencies, duplicate work, target branches, and whether related umbrella work is still open.

Related reliability work includes self-healing CI/PR automation (#115–#117), stale AI-context signaling (#132), and warning-only stale-context behavior (#161). Avoid duplicating these scopes when implementing fresh-branch and latest-head completion gates.

## 14. Known operational risks

1. Vercel deployment usage: redundant deployments can consume quota unnecessarily.
2. Auth redirects: production, localhost, and Vercel preview origins differ.
3. Email delivery: Supabase Auth configuration and Resend/provider delivery both matter.
4. Route privacy: authorization must be enforced server-side, not only through filters.
5. Large route catalogs: do not revert to fetching an assumed small fixed set of routes.
6. Agent branch drift: always compare against the freshly fetched target branch before editing and before PR readiness.
7. Stale CI evidence: required check results must belong to the exact latest PR head SHA.
8. Migration drift: applied database migrations are immutable; add new migrations for changes.

## 15. How a new agent should start

1. Read `AGENTS.md` and follow its mandatory preflight/postflight protocol.
2. Read this file, README.md, and relevant implementation/workflow documentation.
3. Inspect the canonical GitHub Issue and linked dependencies; search for duplicate or overlapping Issues/PRs.
4. Fetch the latest remote refs and determine the repository's default branch from GitHub metadata.
5. Verify the worktree, task branch name, base SHA, and whether the branch is current before editing. Preserve local changes; do not use destructive resets.
6. Before opening/updating a PR, fetch the target base again and reconcile stale commits/conflicts safely.
7. After every push, wait for required CI checks on the exact current PR head SHA.
8. Report the Issue/PR, branch/base/head SHAs, actual test commands/results, required check statuses, review/merge state, and any blockers. Do not call work fully complete while required checks or review/merge are outstanding.

## 16. Source of truth hierarchy

When information conflicts, use this order:
1. Current repository implementation and tests
2. AGENTS.md and repository skills
3. Current task metadata and GitHub Issue/PR
4. README.md and this context document
5. Historical conversational context

This hierarchy is intentional: conversational memory is useful for discovering history, but the repository must remain the durable source of truth.

## 17. Keeping this context fresh

This document is durable shared context, but it is intentionally not the authoritative source for repository rules or current implementation details.

Freshness is automated:
- `npm run ai-context:check` verifies fingerprints of the authoritative repository sources.
- `npm run ai-context:refresh` updates only the generated fingerprint block after an intentional context review.
- GitHub Actions checks freshness on relevant pushes to `main` and weekly on Monday.
- In GitHub Actions, stale fingerprints are emitted as warnings and create/update an actionable `[AI context] stale` GitHub Issue; this informational drift does not fail the workflow or modify/merge `main`.
- Running `npm run ai-context:check` locally remains strict and exits non-zero when the context is stale; use the workflow's `check --warning` mode for warning-only reporting.

A changed fingerprint means the context should be reviewed, not that the prose is automatically wrong. After a source change, review the affected sections, update the prose when needed, then run the refresh command and submit the normal task/PR.

The fingerprint covers:
- `AGENTS.md`
- `README.md`
- `package.json`

This is deliberately a deterministic freshness signal rather than an attempt to have an LLM infer semantic correctness automatically.

<!-- BEGIN:ai-context-fingerprint -->
<!-- Generated by npm run ai-context:refresh. Do not edit manually. -->
- `AGENTS.md`: `01143d532fd51eb688031d82d0d7cd7dbd72f6c3`
- `README.md`: `31761129892f42da693cff04f76fe14387f94a6f`
- `package.json`: `6d7ec4819907bffe5c40842077667469ae6b9d44`
<!-- END:ai-context-fingerprint -->
