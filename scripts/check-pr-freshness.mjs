#!/usr/bin/env node

import fs from "node:fs";
import { execFileSync, spawnSync } from "node:child_process";

export function evaluateFreshness({ baseRef, baseSha, headSha, isAncestor }) {
  if (!baseRef || !baseSha || !headSha) {
    return { ok: false, message: "Could not determine target branch, base SHA, or PR head SHA." };
  }
  if (typeof isAncestor !== "boolean") {
    return { ok: false, message: "Could not compare the target base and PR head commits." };
  }
  if (!isAncestor) {
    return {
      ok: false,
      message: `PR branch is behind ${baseRef} or cannot be proven up to date (base ${baseSha}, head ${headSha}). Update/rebase the task branch and rerun CI.`,
    };
  }
  return { ok: true, message: `PR head ${headSha} includes current ${baseRef} base ${baseSha}.` };
}

function git(args) {
  return execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}

function main() {
  const eventPath = process.env.GITHUB_EVENT_PATH;
  if (!eventPath || !fs.existsSync(eventPath)) {
    throw new Error("GITHUB_EVENT_PATH is missing; refusing to skip the PR freshness check.");
  }
  const event = JSON.parse(fs.readFileSync(eventPath, "utf8"));
  const baseRef = event.pull_request?.base?.ref;
  const headSha = event.pull_request?.head?.sha;
  if (!baseRef || !headSha) {
    throw new Error("PR event does not include target branch and head SHA.");
  }

  git(["fetch", "--no-tags", "origin", `+refs/heads/${baseRef}:refs/remotes/origin/${baseRef}`]);
  const baseSha = git(["rev-parse", `refs/remotes/origin/${baseRef}^{commit}`]);
  git(["cat-file", "-e", `${headSha}^{commit}`]);
  const ancestor = spawnSync("git", ["merge-base", "--is-ancestor", baseSha, headSha], { encoding: "utf8" });
  if (ancestor.error) throw ancestor.error;
  const isAncestor = ancestor.status === 0 ? true : ancestor.status === 1 ? false : undefined;
  const result = evaluateFreshness({ baseRef, baseSha, headSha, isAncestor });
  console.log(`Target branch: ${baseRef}`);
  console.log(`Current target SHA: ${baseSha}`);
  console.log(`PR head SHA: ${headSha}`);
  if (!result.ok) {
    console.error(`::error::${result.message}`);
    process.exitCode = 1;
    return;
  }
  console.log(result.message);
}

if (process.argv[1] && new URL(import.meta.url).pathname === process.argv[1]) {
  try {
    main();
  } catch (error) {
    console.error(`::error::PR freshness check could not complete: ${error.message}`);
    process.exitCode = 1;
  }
}
