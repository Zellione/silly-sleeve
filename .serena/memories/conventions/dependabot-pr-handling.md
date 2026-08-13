# Handling dependabot PRs

Pattern used 2026-07-06 (PRs #43, #46–#50), 2026-08 (PRs #52–#56), and 2026-08-13 (PRs #59/#60 merge + #57/#63/#61/#65/#64 triage + audit-vuln fix PR #67).

- `gh pr list --author "app/dependabot" --state open --json number,title,statusCheckRollup` to see all open PRs and their CI status.
- Repo settings: squash/merge/rebase all allowed, `required_linear_history: true`, 0 required approving reviews, no branch protection blocking dependabot merges. Repo merge style is **squash** with `--delete-branch` (`gh pr merge <n> --squash --delete-branch`) — main history shows single squashed commits per PR.
- Merging a PR to `main` is treated as a "merge without review" risky action by the auto-mode classifier — it will be denied until the user explicitly confirms (use `AskUserQuestion` to get sign-off before the first `gh pr merge` call in a session). This applies separately to *every* PR merge, including a same-session fix PR you authored yourself (e.g. #67) — approval to *create* a fix PR is not approval to *merge* it; ask again before that `gh pr merge` call.
- Frontend bumps all touch `frontend/package-lock.json` (same for `go.sum`), so merge **sequentially**: after each merge, re-check the rest with `gh pr view <n> --json mergeable,mergeStateStatus` (state shows UNKNOWN briefly while GitHub recomputes — retry after ~10s).
- If a PR turns `CONFLICTING`/`CONFLICTING DIRTY`, comment `@dependabot rebase` and wait — Dependabot rebases automatically (~1-3 min), after which CI re-runs from scratch (checks go back to `pending`). Poll with `gh pr view <n> --json mergeable,mergeStateStatus` and `gh pr checks <n>`.
- Use the `Monitor` tool (background polling loop) rather than manual sleep/poll cycles to wait for rebase + CI to settle. Don't name a shell variable `status` in a Monitor script — it's a read-only special variable in zsh and crashes the loop with "read-only variable: status"; use a different name (e.g. `st`). Working pattern for polling `gh pr checks`:
  ```
  prev=""
  while true; do
    s=$(gh pr checks <n> --json name,bucket 2>/dev/null)
    cur=$(echo "$s" | jq -r '.[] | select(.bucket!="pending") | "\(.name): \(.bucket)"' | sort)
    comm -13 <(echo "$prev") <(echo "$cur"); prev="$cur"
    pending=$(echo "$s" | jq -e 'any(.[]; .bucket=="pending")' 2>/dev/null)
    [ "$pending" != "true" ] && { echo "ALL CHECKS SETTLED"; break; }
    sleep 20
  done
  ```
- Only merge when CI is fully green (lint-go, vuln-go, lint-frontend, test-go, test-frontend, build, SonarCloud).
- **Don't trust an old-but-green PR check as current signal.** `gh pr checks`/`gh pr view --json mergeable` show the *last recorded* run, which can predate a newly-published npm/Go advisory. Before merging a frontend PR whose checks are more than a few days old, cross-check `main`'s own latest CI run (`gh run list --branch main --workflow CI --limit 1 --json conclusion,headSha`) — if `main` itself is currently red, every stale-green frontend PR needs a fresh CI run (push/rebase) before it can be trusted, since they all inherit the same lockfile baseline.
- **After `@dependabot rebase`, a "no pending checks" read can still be stale data from before the rebase.** `gh pr checks <n>` right after commenting can return the *same* run IDs/results as the pre-rebase state (dependabot hasn't pushed yet — takes ~1-5 min, sometimes longer under load). Don't treat "no `pending` bucket" as "settled" on its own; track `gh pr view <n> --json headRefOid` and only trust the checks once the SHA has actually changed from the pre-rebase value. `mergeStateStatus` also flips to `DIRTY`/`UNSTABLE` while the rebase is in flight.
- **Monitor-script gotcha (bash):** dynamic variable names via `eval "prev_sha_$n=$sha"` inside a Monitor `command` crashed one run with a bare exit 1 (no readable error surfaced in the notification). Use `declare -A seen; seen[$n]=...` associative arrays instead — reliable and avoids the eval quoting trap on top of the already-documented zsh `status`-variable trap.

## Known incompatibility (as of 2026-07, reconfirmed 2026-08-13 twice)

Dependabot PR bumping `typescript` 6.0.3 → 7.0.2 in `frontend/` (PR #57) breaks `lint-frontend` CI: `@typescript-eslint/typescript-estree`'s `create-program/shared.js` throws `TypeError: Cannot read properties of undefined (reading 'Cjs')` — TS7 isn't supported yet by the installed `@typescript-eslint` version. Decision: leave this PR open (don't merge, don't close) until `@typescript-eslint` ships TS7 support; Dependabot will keep it updated automatically.

Reconfirmed 2026-08-13 after `typescript-eslint` was bumped 8.63.0 → 8.66.0 (via PR #65, unrelated fix round) — rebased #57 to pick up the newer `typescript-eslint` and it still fails, now with an explicit upstream error rather than the earlier internal crash:
```
typescript-eslint does not support TS 7.0.
See https://github.com/typescript-eslint/typescript-eslint/issues/10940 for tracking typescript-eslint's support for TS >=7.1
```
That's typescript-eslint's own tracking issue for TS ≥7.1 support — check that issue's status before re-testing #57 again; no need to re-test on every `typescript-eslint` patch bump, only when that issue closes or a changelog explicitly mentions TS 7.x support.

## npm audit vulnerabilities can break `main` with zero code changes (2026-08-13)

A GHSA advisory can be published *after* a dependency version is already pinned on `main`, and `npm audit --audit-level=high` (a non-`continue-on-error` step in `lint-frontend`, `.github/workflows/ci.yml`) will then fail on the next push/PR run even though nothing changed — this happened on `main` itself (PR #66 merge) and cascaded to block dependabot PRs #65/#64, whose own bumps were not at fault.

Fix pattern (PR #67), in order of preference — **don't add a manual `overrides` block to `package.json`** (violates AGENTS.md's "never edit package.json directly, only `npm install`" boundary) until the simpler options are exhausted:
1. `npm install <direct-dep>@<range-or-latest>` for whichever *direct* devDependency pulls in the vulnerable transitive package (check `npm ls <vuln-pkg>` to find the parent). This alone can clear multiple advisories — bumping `vite` ^8.1.4→^8.2.1 (still within its existing package.json range, just picking up the latest patch) cleared both `postcss` and `nanoid` advisories in one shot.
2. For a vulnerable dep pulled in by a devDependency with no non-major fix available, a plain major bump often works with zero breaking fallout for a dev-only tool — `jsdom` 29→30 (major) cleared `undici`'s advisories; check the new major's `engines.node` first (`npm view <pkg>@<version> engines`) against CI's pinned Node version.
3. Re-run plain `npm audit fix` (no `--force`) *after* the above — it can resolve remaining nested-duplicate instances (e.g. a vulnerable `brace-expansion` version nested two levels under `eslint-plugin-jsx-a11y`'s pinned `minimatch@3.1.5`, with no newer `eslint-plugin-jsx-a11y` release available) by re-resolving the lockfile's specific dependency edges, without touching `package.json` at all.
4. `npm audit fix --force --dry-run` prints a plan referencing all the right target versions but its trailing "remaining vulnerabilities" report is **stale** — a dry run doesn't mutate `node_modules`, so that final audit re-checks the unchanged tree. Don't take a dry-run's "still vulnerable" tail as a verdict; run the real bumps and audit for real.
- Always confirm with a real `wails build -clean -tags webkit2_41` after a `vite`/frontend-tooling bump, not just `npm run lint`/`test:coverage` — it's the only check that exercises the actual Vite production build + Go embed pipeline together.
- This machine (Arch, webkit2gtk non-4.0 variant) also needs `-tags webkit2_41` for local `wails build`, same as Ubuntu 22.04+ CI — plain `wails build -clean` fails with "Package webkit2gtk-4.0 was not found".

## Session-workflow lesson

The user's stop hook prompts serena memory writes at end of turn — i.e. AFTER any requested commit/push, which leaves the tree dirty again. When a task ends in a commit, write memories BEFORE committing and include them in that commit. Also: pushing to a milestone branch after its PR merged resurrects the deleted remote branch — check PR state before pushing post-merge.

**Fixed 2026-08-13** with a second hook, `PreToolUse`/`Bash` in `.claude/settings.local.json` (personal, gitignored), that denies the first `git push`-shaped command per 5-minute window with a reminder to review/write serena memory, then allows the retry (same debounce sentinel file the `Stop` hook already used: `/tmp/.serena_mem_$(id -u)`). It's a backstop for the gap above, not a guarantee — the retry is allowed unconditionally, so it only forces a deliberate check, not an actual `write_memory` call.

Gotcha while building it: the hook schema's `if` field (e.g. `"if": "Bash(git push *)"`) did **not** reliably scope execution to matching commands — it fired on unrelated `Bash` calls (verified live: an `rm`/`echo` command got denied). Don't trust `if` for a hook that must stay narrowly scoped; instead read `tool_input.command` from stdin inside the command itself (`jq -r '.tool_input.command // empty'`) and grep/test it there before doing anything consequential.

## Maintenance-action note

Before committing a newly-written, untracked memory, check for an existing tracked memory on the same topic and merge into it instead of leaving a duplicate at a different path.
