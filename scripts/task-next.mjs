#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const index = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'tasks', 'index.json'), 'utf8'));
const priorityRank = { P0: 0, P1: 1, P2: 2, P3: 3 };
const terminalStatuses = new Set(['done', 'cancelled']);

export function selectNextTask(taskIndex) {
  const byId = new Map(taskIndex.tasks.map((task) => [task.id, task]));
  return taskIndex.tasks
    .filter((task) => task.status === 'ready')
    .filter((task) => (task.dependencies ?? []).every((id) => terminalStatuses.has(byId.get(id)?.status)))
    .sort((a, b) =>
      (priorityRank[a.priority] ?? 99) - (priorityRank[b.priority] ?? 99) ||
      String(a.createdAt ?? '').localeCompare(String(b.createdAt ?? '')) ||
      a.id.localeCompare(b.id),
    )[0] ?? null;
}

const next = selectNextTask(index);
if (process.argv.includes('--json')) {
  console.log(JSON.stringify({ task: next }, null, 2));
} else if (!next) {
  console.log('No ready tasks.');
} else {
  console.log(`${next.id} [${next.priority}] ${next.title}`);
  console.log(`status: ${next.status}`);
  console.log(`dependencies: ${next.dependencies.length ? next.dependencies.join(', ') : 'none'}`);
}
