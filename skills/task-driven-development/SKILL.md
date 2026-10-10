# Task-Driven Development Skill

## Purpose
GitHub Issues are the sole source of truth for tasks in Ezda. This skill defines the canonical workflow for all coding agents.

## Non-negotiable rules
1. Every change must be associated with one GitHub Issue.
2. Store goal, requirements, acceptance criteria, priority, lifecycle, and dependencies in that Issue and its labels/relationships.
3. Do not create or update repository-side task registries such as `tasks/index.json`, `tasks/<id>.json`, or `tasks/relations.json`.
4. Use the GitHub Issue number as the task identifier in branch names, commits, and PRs.
5. Every implementation commit uses `<type>: #<issue-number> | <description>`.
6. Do not silently expand scope. Create a separate Issue and relate it when unrelated work is discovered.
7. Never commit directly to the default branch or bypass branch protection.

## Workflow
### 1. Understand the Issue
Read the full Issue, acceptance criteria, labels, comments, and related/blocked-by Issues. Search for an existing equivalent Issue before creating one.

### 2. Create an implementation branch
Use `task/<issue-number>-<short-name>`, based on the current default branch. Make all changes on that branch.

### 3. Implement and validate
Make the smallest change satisfying the acceptance criteria. Preserve invariants in `AGENTS.md`. Run relevant tests, type checks, and production build. Never claim a check passed unless it actually ran or an authoritative CI result confirms it.

### 4. Open a PR
Open a PR against the appropriate protected target branch. The PR must reference exactly one primary Issue using `Closes #<issue-number>`, summarize the change, map acceptance criteria to implementation, list actual checks/results, and identify risks.

### 5. Completion
A task is complete only when acceptance criteria are met, required CI checks pass, review requirements are satisfied, and the PR is merged through the protected path. An open PR is not a completed task.

## Dependencies and queue
Represent dependencies and parent/child relationships in GitHub Issues (native relationships where available; otherwise explicit `Depends on #N`, `Parent: #N`, and `Related: #N` references). Use labels for priority and workflow classification. The open Issues view and GitHub Projects, if configured, are the work queue; do not mirror it in JSON.

## Agent handoff
Keep durable requirements and decisions in the Issue/PR discussion, not transient chat or local task files. Report Issue number, branch, PR, changed files, actual test results, affected relationships, and remaining risks.
