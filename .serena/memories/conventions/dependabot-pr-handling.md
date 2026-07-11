# Handling dependabot PRs

Pattern used 2026-07-06 (PRs #43, #46–#50), all dev-dep / CI-action minor+patch bumps.

- Repo merge style is **squash** (`gh pr merge <n> --squash`) — main history shows single squashed commits per PR.
- Frontend bumps all touch `frontend/package-lock.json`, so merge **sequentially**: after each merge, re-check the rest with `gh pr view <n> --json mergeable,mergeStateStatus` (state shows UNKNOWN briefly while GitHub recomputes — retry after ~10s).
- If a PR turns `CONFLICTING DIRTY`, comment `@dependabot rebase` and wait for the rebase + fresh CI before merging (takes several minutes; use a background monitor, not blocking sleeps).
- Only merge when CI is fully green (lint-go, vuln-go, lint-frontend, test-go, test-frontend, build, SonarCloud).

## Session-workflow lesson

The user's stop hook prompts serena memory writes at end of turn — i.e. AFTER any requested commit/push, which leaves the tree dirty again. When a task ends in a commit, write memories BEFORE committing and include them in that commit. Also: pushing to a milestone branch after its PR merged resurrects the deleted remote branch — check PR state before pushing post-merge.
