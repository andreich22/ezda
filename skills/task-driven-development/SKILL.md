# Task-Driven Development Skill

## Purpose

This is the canonical, agent-independent procedure for changing the `Ezda` repository.

Repository contract:

- `AGENTS.md` contains mandatory project-wide constraints.
- `tasks/index.json` is the task registry.
- `tasks/<id>.json` is the source of truth for an individual task.
- `tasks/relations.json` is the source of truth for task relationships.
- `scripts/validate-tasks.mjs` enforces structural integrity.
- GitHub Issues define requested work; Task metadata is created on the implementation branch.
- Git history records implementation changes.

## Non-negotiable rules

1. Do not modify project code, configuration, tests, or documentation without an associated Task ID.
2. New tasks MUST start as a GitHub Issue titled `TASK-<4 lowercase hex-id> <title>` (the registration script also accepts `TASK-<id>: <title>` and `TASK-<id>-<title>`).
3. The implementation branch MUST contain `tasks/<id>.json` and the corresponding `tasks/index.json` entry together with the implementation changes.
4. There is no separate task registration PR or registration merge gate.
5. Task IDs are exactly four lowercase hexadecimal characters and must be unique.
6. Do not silently expand the scope of an existing task. Create another task and relate it instead.
7. Every commit must use `<type>: <task-id> | <description>`.
8. All commits belonging to one task use the same ID.
9. Task relationships belong in `tasks/relations.json`; do not duplicate reverse edges in task files.
10. `depends_on` and `parent` relationships must not form cycles.
11. Before setting a task to `done`, run `npm run tasks:validate` and the relevant tests/build.
12. A task is not done merely because the code compiles: acceptance criteria, task history, commit metadata, and validation must be complete.

## Workflow

### 1. Understand the request

Determine the smallest concrete change requested by the user. Inspect the repository, tests, documentation, and related tasks before editing. Do not guess about APIs or existing abstractions.

### 2. Create the GitHub Task Issue

If no suitable task exists, create a GitHub Issue first. The Issue should contain the goal, requirements, Definition of Ready, acceptance criteria, technical approach, and Definition of Done.

Example title:

```text
TASK-a1b2 Short task title
```

Do not start implementation merely because the Issue exists.

### 3. Create implementation branch

After the Task metadata exists, create:

```text
task/<task-id>-<short-name>
```

The implementation branch contains `tasks/<id>.json`, the corresponding `tasks/index.json` entry, and the implementation changes. There is no separate registration PR.

### 4. Verify Definition of Ready

Before implementation:

- confirm the Task ID exists in `tasks/index.json`;
- read `tasks/<id>.json`;
- verify the Definition of Ready;
- inspect `tasks/relations.json` and add required relationships;
- move the task to `ready` only when its Definition of Ready is satisfied.

### 5. Implement the smallest change

Change only what the task requires. Preserve project invariants from `AGENTS.md`, especially local-first execution, privacy, browser-side inference, memory safety, streaming behavior, and minimal dependencies.

If implementation reveals unrelated work, create a new Issue/task and relate it instead.

### 6. Validate continuously

Before completion, at minimum:

```bash
npm run tasks:validate
```

Also run relevant unit/component/e2e tests and `npm run build` when production compilation can be affected. Do not claim a check passed unless it actually passed or an authoritative CI result confirms it.

### 7. Commit with the task ID

Every implementation commit must follow:

```text
<type>: <task-id> | <description>
```

Use the same Task ID for every commit belonging to the task.

### 8. Update task history

Before completion, record final status, relevant commit SHAs/messages, decisions, validation, and known limitations.

### 9. Complete the task

Set the task to `done` only after all requirements and acceptance criteria are satisfied, relevant tests/build pass, `npm run tasks:validate` passes, history/commit metadata are complete, and the implementation PR has passed repository checks and is merged through the protected PR path.

## Machine-readable queue

Every task registry entry must expose `priority` (`P0`–`P3`) and `dependencies` (Task IDs). Dependencies are derived from `depends_on` relations and must remain synchronized with the registry.

Use:

```bash
npm run tasks:next
npm run tasks:next -- --json
```

`tasks:next` validates the task registry before selecting a task. A task is eligible only when it is `ready` and all dependencies are `done` or `cancelled`.

## Scope management

The task is the unit of traceability. If a change is useful but not necessary to satisfy current acceptance criteria, create a separate Issue/task and relate it using `related`, `derived_from`, `parent`, or another appropriate relation.

## Agent handoff

The repository should contain enough information to understand what was requested, why, what was implemented, which decisions were made, which tasks are related, which commits implement it, what remains, and which validations were run. The repository, not transient chat history, is the durable project memory.
