#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const tasksDir = path.join(root, 'tasks');
const indexPath = path.join(tasksDir, 'index.json');
const relationsPath = path.join(tasksDir, 'relations.json');
const fail = (message) => { console.error(`Task validation failed: ${message}`); process.exitCode = 1; };
const readJson = (filePath) => JSON.parse(fs.readFileSync(filePath, 'utf8'));

if (!fs.existsSync(indexPath)) fail('tasks/index.json is missing');
if (!fs.existsSync(relationsPath)) fail('tasks/relations.json is missing');
if (process.exitCode) process.exit();

const index = readJson(indexPath);
const relationsDoc = readJson(relationsPath);
const allowedStatuses = new Set(['draft', 'ready', 'in_progress', 'review', 'done', 'blocked', 'cancelled']);
const allowedPriorities = new Set(['P0', 'P1', 'P2', 'P3']);
const allowedRelationTypes = new Set(relationsDoc.allowedTypes ?? []);
const ids = new Set();

if (!Array.isArray(index.tasks)) fail('tasks/index.json must contain a tasks array');

for (const entry of index.tasks ?? []) {
  if (!entry || typeof entry !== 'object') { fail('task index entries must be objects'); continue; }
  if (!/^[0-9a-f]{4}$/.test(entry.id ?? '')) fail(`invalid task id: ${entry.id}`);
  if (ids.has(entry.id)) fail(`duplicate task id: ${entry.id}`);
  ids.add(entry.id);
  if (typeof entry.title !== 'string' || !entry.title.trim()) fail(`missing title for ${entry.id}`);
  if (!allowedStatuses.has(entry.status)) fail(`invalid status for ${entry.id}: ${entry.status}`);
  if (!allowedPriorities.has(entry.priority)) fail(`invalid or missing priority for ${entry.id}`);
  if (!Array.isArray(entry.dependencies)) fail(`dependencies must be an array for ${entry.id}`);
  const dependencySet = new Set(entry.dependencies);
  if (dependencySet.size !== entry.dependencies.length) fail(`duplicate dependency for ${entry.id}`);
  for (const dependency of entry.dependencies) {
    if (!/^[0-9a-f]{4}$/.test(dependency)) fail(`invalid dependency ${dependency} for ${entry.id}`);
    if (dependency === entry.id) fail(`task cannot depend on itself: ${entry.id}`);
  }
  const taskPath = path.join(tasksDir, `${entry.id}.json`);
  if (!fs.existsSync(taskPath)) { fail(`task file missing: tasks/${entry.id}.json`); continue; }
  const task = readJson(taskPath);
  if (task.id !== entry.id) fail(`task id mismatch in tasks/${entry.id}.json`);
  for (const field of ['title', 'description', 'requirements', 'definitionOfReady', 'acceptanceCriteria', 'technicalApproach', 'definitionOfDone']) {
    if (!(field in task)) fail(`task ${entry.id} is missing ${field}`);
  }
  if (task.status !== entry.status) fail(`status mismatch for ${entry.id}`);
  if ('priority' in task && task.priority !== entry.priority) fail(`priority mismatch for ${entry.id}`);
  if ('dependencies' in task && JSON.stringify(task.dependencies) !== JSON.stringify(entry.dependencies)) fail(`dependency mismatch for ${entry.id}`);
  if (entry.status === 'done' && (!Array.isArray(task.acceptanceCriteria) || task.acceptanceCriteria.length === 0)) fail(`done task ${entry.id} must have acceptanceCriteria`);
  if ('skipRelease' in entry && typeof entry.skipRelease !== 'boolean') fail(`skipRelease must be a boolean for ${entry.id}`);
  if ('skipRelease' in task && typeof task.skipRelease !== 'boolean') fail(`skipRelease must be a boolean in tasks/${entry.id}.json`);
  if (task.skipRelease === true && entry.skipRelease === false) fail(`skipRelease mismatch for ${entry.id} between index and task file`);
}

if (!Array.isArray(relationsDoc.relations)) fail('tasks/relations.json must contain a relations array');
const dependencyGraph = new Map([...ids].map((id) => [id, []]));
const relationKeys = new Set();
const declaredDependencies = new Map([...ids].map((id) => [id, new Set()]));

for (const relation of relationsDoc.relations ?? []) {
  const { from, type, to } = relation ?? {};
  if (!ids.has(from)) fail(`relation references unknown source task: ${from}`);
  if (!ids.has(to)) fail(`relation references unknown target task: ${to}`);
  if (!allowedRelationTypes.has(type)) fail(`unknown relation type: ${type}`);
  if (from === to) fail(`task cannot relate to itself: ${from}`);
  const key = `${from}:${type}:${to}`;
  if (relationKeys.has(key)) fail(`duplicate relation: ${key}`);
  relationKeys.add(key);
  if (type === 'depends_on' && ids.has(from) && ids.has(to)) {
    dependencyGraph.get(from).push(to);
    declaredDependencies.get(from).add(to);
  }
}

for (const entry of index.tasks) {
  const expected = [...declaredDependencies.get(entry.id)].sort();
  const actual = [...entry.dependencies].sort();
  if (JSON.stringify(expected) !== JSON.stringify(actual)) fail(`dependencies for ${entry.id} do not match tasks/relations.json`);
  const unresolved = entry.dependencies.filter((id) => {
    const dependency = index.tasks.find((candidate) => candidate.id === id);
    return dependency && !['done', 'cancelled'].includes(dependency.status);
  });
  if (entry.status === 'ready' && unresolved.length > 0) fail(`task ${entry.id} is ${entry.status} but dependencies are unresolved: ${unresolved.join(', ')}`);
}

const visiting = new Set();
const visited = new Set();
const visit = (id, stack = []) => {
  if (visiting.has(id)) {
    const start = stack.indexOf(id);
    fail(`circular task dependency: ${[...stack.slice(start), id].join(' -> ')}`);
    return;
  }
  if (visited.has(id)) return;
  visiting.add(id);
  for (const next of dependencyGraph.get(id) ?? []) visit(next, [...stack, id]);
  visiting.delete(id);
  visited.add(id);
};
for (const id of ids) visit(id);
if (!process.exitCode) console.log(`Task metadata valid: ${ids.size} task(s), ${relationsDoc.relations.length} relation(s).`);
