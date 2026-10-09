# Git Workflow Skill

## Core rule
AI-generated changes must never be committed or pushed directly to the default branch.

Required path: `GitHub Issue → task/<issue-number>-<short-name> → implementation → PR → checks/review → human merge`.

GitHub Issues are the only task database. Do not add task metadata files or maintain a second status/dependency registry in the repository.

## Before changing files
1. Identify the primary Issue and read requirements, acceptance criteria, labels, comments, and dependencies.
2. Search for duplicates before creating an Issue.
3. Create a branch named `task/<issue-number>-<short-name>` from the current default branch.
4. Use commits formatted as `<type>: #<issue-number> | <description>`.
5. Keep unrelated changes in separate Issues and PRs.

## Pull Request policy
Every implementation change must be delivered through a PR. The PR must target the protected branch, reference exactly one primary Issue with `Closes #<issue-number>`, describe the implementation and acceptance criteria, list actual check results, and state known risks.

## Protected branch policy
Never commit directly to the default branch, force-push it, rewrite history, disable branch protection, or bypass required checks/reviews. Do not merge your own PR unless explicitly authorized and repository policy permits it.

## Validation
Run relevant tests, type checks, and build before opening/updating the PR. CI is authoritative for required repository checks. Never claim a check passed without evidence.

## Completion
An Issue is complete only when acceptance criteria are satisfied and the implementation PR is merged through the protected path. A created PR alone does not mean the task is done.
