import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const tasksDir = path.join(root, "tasks");

export function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

export function extractTaskId(body) {
  const match = (body ?? "").match(/\bTASK-([0-9a-f]{4})\b/i);
  return match ? match[1].toLowerCase() : null;
}

export function shouldSkipRelease({ body, dir } = {}) {
  const scopeDir = dir ?? tasksDir;
  const taskId = extractTaskId(body);
  if (!taskId) return false;

  const taskFile = path.join(scopeDir, `${taskId}.json`);
  if (!fs.existsSync(taskFile)) return false;

  try {
    return readJson(taskFile).skipRelease === true;
  } catch {
    return false;
  }
}

function extractBodyFromEvent(eventPath) {
  const event = readJson(eventPath);
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

  const skip = shouldSkipRelease({ body });
  console.log(`PR references task with skipRelease=${skip ? "true" : "false"}.`);
  process.stdout.write(`skip=${skip ? "true" : "false"}\n`);
}

main();
