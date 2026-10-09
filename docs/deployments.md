# Vercel deployments

Ezda keeps the GitHub repository connected to Vercel, but automatic Git-triggered deployments are disabled in `vercel.json` via `git.deploymentEnabled: false`.

## What remains automatic

- GitHub Actions CI still runs on pull requests and pushes to `main`.
- Task validation, tests, build checks, version-bump automation, and release validation continue according to their existing workflow triggers.
- Vercel does **not** automatically create Preview deployments for PR updates or Production deployments after a merge to `main`.

## Start a deployment manually

1. Open the [Ezda Vercel project](https://vercel.com/andreich22s-projects/ezda).
2. Open **Deployments** and select **Create Deployment**.
3. Select the intended Git branch or exact commit SHA. For a Production release, select the verified revision from `main`.
4. Before creating a Production deployment, open the matching commit or PR in GitHub and confirm required CI checks passed for that exact revision.
5. Confirm the target and environment in Vercel before starting the deployment.

The dashboard's manual deployment action is intentional: do not re-enable automatic Git deployments just to create a Preview or Production deployment. Manual Preview deployments must also be started explicitly.

## Vercel project settings

- Keep the GitHub repository connected.
- Keep **Ignored Build Step** set to **Automatic**. Do not use ignored-build scripts as a substitute for disabling automatic deployments.
- The root `vercel.json` keeps the existing `ignoreCommand` for its current change-filtering behavior and adds `git.deploymentEnabled: false` to disable all automatic Git-triggered deployments.
