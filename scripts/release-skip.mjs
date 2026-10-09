import fs from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { execFileSync } from "node:child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function extractIssueNumber(body) {
  const match = (body ?? "").match(/\b(?:closes|fixes|resolves)\s+#(\d+)\b/i);
  return match ? match[1] : null;
}

export function shouldSkipReleaseByLabels(labels) {
  if (!Array.isArray(labels)) return false;
  return labels.some((label) => String(label).toLowerCase() === "skip-release");
}

export function fetchIssueLabelNames(issueNumber, options = {}) {
  const repository = options.repository ?? process.env.GITHUB_REPOSITORY;
  const token = options.token ?? process.env.GH_TOKEN;
  if (!repository || !token) return [];

  const output = execFileSync(
    "gh",
    ["issue", "view", String(issueNumber), "--repo", repository, "--json", "labels", "--jq", ".labels[].name"],
    { env: { ...process.env, GH_TOKEN: token }, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
  );

  return output.trim().split("\n").filter(Boolean);
}

function extractBodyFromEvent(eventPath) {
  const event = JSON.parse(fs.readFileSync(eventPath, "utf8"));
  return `${event.pull_request?.title ?? ""}\n${event.pull_request?.body ?? ""}`;
}

function main() {
  let body = "";
  try {
    const eventPath = process.env.GITHUB_EVENT_PATH;
    if (eventPath && fs.existsSync(eventPath)) {
      body = extractBodyFromEvent(eventPath);
    }
  } catch {
    // Fall through to PR_BODY env.
  }

  if (!body) {
    body = process.env.PR_BODY ?? "";
  }

  const issueNumber = extractIssueNumber(body);
  let skip = false;
  if (issueNumber) {
    try {
      const labels = fetchIssueLabelNames(issueNumber);
      skip = shouldSkipReleaseByLabels(labels);
    } catch {
      skip = false;
    }
  }

  console.log(`PR links issue #${issueNumber ?? "none"}; skipRelease=${skip ? "true" : "false"}.`);
  process.stdout.write(`skip=${skip ? "true" : "false"}\n`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.join(__dirname, "release-skip.mjs")) {
  main();
}
