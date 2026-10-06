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
const VERSION_FILES = new Set(["package.json", "package-lock.json"]);

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, item]) => [key, canonicalize(item)]),
    );
  }
  return value;
}

function withoutVersion(file, value) {
  const copy = structuredClone(value);
  if (file === "package.json") delete copy.version;
  if (file === "package-lock.json") {
    delete copy.version;
    if (copy.packages?.[""]) delete copy.packages[""].version;
  }
  return canonicalize(copy);
}

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

export function isIgnoredPath(file) {
  return NON_DEPLOY_PATHS.some((pattern) => pattern.test(file));
}

export function isVersionOnlyChange(
  files,
  { previousSha, currentSha = "HEAD" } = {},
) {
  if (!previousSha || !files.includes("package.json")) return false;
  if (!files.every((file) => VERSION_FILES.has(file))) return false;

  const previousPackage = readJsonAtRevision(previousSha, "package.json");
  const currentPackage = readJsonAtRevision(currentSha, "package.json");
  if (!previousPackage || !currentPackage) return false;

  if (
    JSON.stringify(withoutVersion("package.json", previousPackage)) !==
    JSON.stringify(withoutVersion("package.json", currentPackage))
  ) {
    return false;
  }

  if (!files.includes("package-lock.json")) return true;

  const previousLock = readJsonAtRevision(previousSha, "package-lock.json");
  const currentLock = readJsonAtRevision(currentSha, "package-lock.json");
  if (!previousLock || !currentLock) return false;

  return (
    JSON.stringify(withoutVersion("package-lock.json", previousLock)) ===
    JSON.stringify(withoutVersion("package-lock.json", currentLock))
  );
}

export function shouldIgnore(files, options = {}) {
  if (files.length === 0) return false;
  if (files.every(isIgnoredPath)) return true;
  return isVersionOnlyChange(files, options);
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

  if (shouldIgnore(files, { previousSha, currentSha })) {
    console.log("Ignoring deployment for: " + files.join(", "));
    process.exit(0);
  }

  console.log("Relevant changes detected: " + files.join(", "));
  process.exit(1);
}

if (import.meta.url === "file://" + process.argv[1]) main();
