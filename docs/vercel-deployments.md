# Vercel deployments

Ezda uses Vercel's Git integration. There is no separate Vercel deployment GitHub Action in this repository.

## Deployment triggers

- Relevant commits pushed to a pull request keep Preview Deployments.
- Relevant commits pushed to `main` keep Production Deployments.
- Changes only in documentation, tests, task metadata, skills, or GitHub workflows are ignored.
- `chore:` commits are ignored as maintenance work.
- The automated version bump is the exception: when `package.json` changes its `version`, that commit is deployable and produces the Production Deployment.

## Relevant changes

The ignore script skips only `.github/**`, `docs/**`, `tests/**`, `tasks/**`, `skills/**`, the repository agent/readme files, and non-version `chore:` commits.

Changes under `app/`, `components/`, `lib/`, `public/`, dependency changes, and build/runtime configuration remain deployable unless the commit is explicitly classified as `chore:`. A version change always overrides the chore rule and deploys.

## Why

Vercel's Ignored Build Step uses exit code 0 to skip the build and exit code 1 to proceed. The rule is stored in `vercel.json`.

The version exception is intentionally based on the actual `package.json.version` diff, rather than the commit message, so an automated version bump cannot be accidentally skipped.

The repository cannot verify the external Vercel dashboard settings. After merge, confirm the Ezda project is connected to `andreich22/ezda`, Production tracks `main`, and Preview deployments remain enabled.
