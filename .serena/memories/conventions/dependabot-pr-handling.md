# Handling dependabot PRs

Pattern used 2026-07-06 (PRs #43, #46–#50) and 2026-08 (PRs #52–#56), all dev-dep / CI-action minor+patch bumps.

- `gh pr list --author "app/dependabot" --state open --json number,title,statusCheckRollup` to see all open PRs and their CI status.
- Repo settings: squash/merge/rebase all allowed, `required_linear_history: true`, 0 required approving reviews, no branch protection blocking dependabot merges. Repo merge style is **squash** with `--delete-branch` (`gh pr merge <n> --squash --delete-branch`) — main history shows single squashed commits per PR.
- Merging a PR to `main` is treated as a "merge without review" risky action by the auto-mode classifier — it will be denied until the user explicitly confirms (use `AskUserQuestion` to get sign-off before the first `gh pr merge` call in a session).
- Frontend bumps all touch `frontend/package-lock.json` (same for `go.sum`), so merge **sequentially**: after each merge, re-check the rest with `gh pr view <n> --json mergeable,mergeStateStatus` (state shows UNKNOWN briefly while GitHub recomputes — retry after ~10s).
- If a PR turns `CONFLICTING`/`CONFLICTING DIRTY`, comment `@dependabot rebase` and wait — Dependabot rebases automatically (~1-3 min), after which CI re-runs from scratch (checks go back to `pending`). Poll with `gh pr view <n> --json mergeable,mergeStateStatus` and `gh pr checks <n>`.
- Use the `Monitor` tool (background polling loop) rather than manual sleep/poll cycles to wait for rebase + CI to settle. Don't name a shell variable `status` in a Monitor script — it's a read-only special variable in zsh and crashes the loop with "read-only variable: status"; use a different name (e.g. `st`).
- Only merge when CI is fully green (lint-go, vuln-go, lint-frontend, test-go, test-frontend, build, SonarCloud).

## Known incompatibility (as of 2026-07)

Dependabot PR bumping `typescript` 6.0.3 → 7.0.2 in `frontend/` breaks `lint-frontend` CI: `@typescript-eslint/typescript-estree`'s `create-program/shared.js` throws `TypeError: Cannot read properties of undefined (reading 'Cjs')` — TS7 isn't supported yet by the installed `@typescript-eslint` version. Decision: leave this PR open (don't merge, don't close) until `@typescript-eslint` ships TS7 support; Dependabot will keep it updated automatically.

## Session-workflow lesson

The user's stop hook prompts serena memory writes at end of turn — i.e. AFTER any requested commit/push, which leaves the tree dirty again. When a task ends in a commit, write memories BEFORE committing and include them in that commit. Also: pushing to a milestone branch after its PR merged resurrects the deleted remote branch — check PR state before pushing post-merge.
