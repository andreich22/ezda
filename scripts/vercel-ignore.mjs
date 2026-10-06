import { spawnSync } from "node:child_process";

const NON_DEPLOY_PATHS = [
  /^\.github\//,
  /^docs\//,
  /^tests\//,
  /^tasks\//,
  /^skills\//,
  /^AGENTS\.md$/,
  /^README\.md$/,
  /^CLAUDE\.md$/,
];

function readJsonAtRevision(revision, file) {
  const result = spawnSync("git", ["show", revision + ":" + file], {
    encoding: "utf8",
  });
  if (result.status !== 0) return null;
  try {
    return JSON.parse(result.stdout);
  } catch {
    return null;
  }
}

function readCommitSubject(revision) {
  const result = spawnSync("git", ["log", "-1", "--format=%s", revision], {
    encoding: "utf8",
  });
  return result.status === 0 ? result.stdout.trim() : "";
}

export function isIgnoredPath(file) {
  return NON_DEPLOY_PATHS.some((pattern) => pattern.test(file));
}

export function isChoreCommit(message = "") {
  return /^chore:\s/i.test(message.trim());
}

export function isVersionBump(
  files,
  { previousSha, currentSha = "HEAD", versionChanged } = {},
) {
  if (typeof versionChanged === "boolean") return versionChanged;
  if (!previousSha || !files.includes("package.json")) return false;

  const previousPackage = readJsonAtRevision(previousSha, "package.json");
  const currentPackage = readJsonAtRevision(currentSha, "package.json");
  if (!previousPackage || !currentPackage) return false;

  return previousPackage.version !== currentPackage.version;
}

export function shouldIgnore(
  files,
  {
    previousSha,
    currentSha = "HEAD",
    commitMessage = "",
    versionChanged,
  } = {},
) {
  if (files.length === 0) return false;

  // A version bump is intentionally deployable, including the automated chore commit.
  if (isVersionBump(files, { previousSha, currentSha, versionChanged })) return false;

  // Other chore commits are repository maintenance and can be skipped.
  if (isChoreCommit(commitMessage)) return true;

  return files.every(isIgnoredPath);
}

function gitChangedFiles(previousSha, currentSha) {
  const result = spawnSync(
    "git",
    ["diff", "--name-only", previousSha, currentSha, "--"],
    { encoding: "utf8" },
  );
  if (result.status !== 0) {
    console.error(result.stderr?.trim() || "Could not inspect git diff.");
    return null;
  }
  return result.stdout
    .split("\n")
    .map((file) => file.trim())
    .filter(Boolean);
}

function main() {
  const currentSha = process.env.VERCEL_GIT_COMMIT_SHA || "HEAD";
  const previousSha = process.env.VERCEL_GIT_PREVIOUS_SHA;

  if (!previousSha) {
    console.log("No previous Vercel commit is available; building.");
    process.exit(1);
  }

  const files = gitChangedFiles(previousSha, currentSha);
  if (!files) process.exit(1);

  const commitMessage = readCommitSubject(currentSha);
  if (shouldIgnore(files, { previousSha, currentSha, commitMessage })) {
    console.log("Ignoring deployment for: " + commitMessage);
    process.exit(0);
  }

  console.log("Relevant changes detected: " + files.join(", "));
  process.exit(1);
}

if (import.meta.url === "file://" + process.argv[1]) main();
