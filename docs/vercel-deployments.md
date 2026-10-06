# Vercel deployments

Ezda uses Vercel's Git integration. There is no separate Vercel deployment GitHub Action in this repository.

## Deployment triggers

- Relevant commits pushed to a pull request keep Preview Deployments.
- Relevant commits pushed to `main` keep Production Deployments.
- Changes only in documentation, tests, task metadata, skills, or GitHub workflows are ignored.
- The automatic version-bump PR is ignored when it changes only application version metadata, preventing a second equivalent Production Deployment immediately after the original merge.

## Relevant changes

The ignore script skips only `.github/**`, `docs/**`, `tests/**`, `tasks/**`, `skills/**`, the repository agent/readme files, and a narrow version-only change to `package.json` plus optional `package-lock.json`.

Changes under `app/`, `components/`, `lib/`, `public/`, `scripts/`, dependency changes, and build/runtime configuration remain deployable.

## Why

Vercel's Ignored Build Step uses exit code 0 to skip the build and exit code 1 to proceed. The rule is stored in `vercel.json`.

The version-only exception compares the JSON after removing only version fields. Dependency or other semantic changes therefore continue to deploy.

The repository cannot verify the external Vercel dashboard settings. After merge, confirm the Ezda project is connected to `andreich22/ezda`, Production tracks `main`, and Preview deployments remain enabled.
