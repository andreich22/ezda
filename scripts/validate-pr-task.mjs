import fs from 'node:fs';

const eventPath = process.env.GITHUB_EVENT_PATH;
if (!eventPath || !fs.existsSync(eventPath)) {
  console.error('GITHUB_EVENT_PATH is required.');
  process.exit(1);
}

const event = JSON.parse(fs.readFileSync(eventPath, 'utf8'));
const pr = event.pull_request;

if (!pr) {
  console.log('Not a pull_request event; nothing to validate.');
  process.exit(0);
}

const text = `${pr.title ?? ''}\n${pr.body ?? ''}`;
const ids = [...new Set([...text.matchAll(/\b([0-9a-f]{4})\b/gi)].map((m) => m[1].toLowerCase()))];
if (ids.length === 0) {
  console.error('PR must reference a Task ID (exactly four lowercase hexadecimal characters).');
  process.exit(1);
}

const index = JSON.parse(fs.readFileSync('tasks/index.json', 'utf8'));
const knownIds = new Set(index.tasks.map((task) => task.id));
const knownMatches = ids.filter((id) => knownIds.has(id));

if (knownMatches.length !== 1) {
  console.error(`PR must reference exactly one known Task ID; found: ${knownMatches.join(', ') || 'none'}.`);
  process.exit(1);
}

const taskId = knownMatches[0];
const task = index.tasks.find((entry) => entry.id === taskId);
if (!task || !['P0', 'P1', 'P2', 'P3'].includes(task.priority) || !Array.isArray(task.dependencies)) {
  console.error(`Task metadata is incomplete for ${taskId}.`);
  process.exit(1);
}

const taskFile = JSON.parse(fs.readFileSync(`tasks/${taskId}.json`, 'utf8'));
if (taskFile.id !== taskId || taskFile.status !== task.status) {
  console.error(`Task metadata mismatch between tasks/index.json and tasks/${taskId}.json.`);
  process.exit(1);
}

if (task.status !== 'review') {
  console.error(`Task ${taskId} must be in review status before the PR can be considered ready; current status: ${task.status}`);
  process.exit(1);
}

const headBranch = pr.head?.ref ?? '';
const branchMatch = headBranch.match(/^task\/([0-9a-f]{4})-[a-z0-9][a-z0-9-]*$/);
if (!branchMatch) {
  console.error(`PR head branch must match task/<task-id>-<short-name>; got: ${headBranch}`);
  process.exit(1);
}

if (branchMatch[1] !== taskId) {
  console.error(`PR branch Task ID ${branchMatch[1]} does not match referenced Task ID ${taskId}.`);
  process.exit(1);
}

const issueNumber = taskFile.issue?.number;
if (!Number.isInteger(issueNumber)) {
  console.error(`Task ${taskId} is missing issue.number metadata.`);
  process.exit(1);
}

if (!new RegExp(`(?:Closes|Fixes|Resolves)(?:\\s*:)?\\s*#${issueNumber}\\b`, 'i').test(pr.body ?? '')) {
  console.error(`PR body must link the task issue with "Closes #${issueNumber}".`);
  process.exit(1);
}

console.log(`PR task validation passed: ${taskId} [${task.priority}]`);
