# Handling dependabot PRs

Pattern used 2026-07-06 (PRs #43, #46–#50), 2026-08 (PRs #52–#56), and 2026-08-13 (PRs #59/#60 merge + #57/#63/#61/#65/#64 triage + audit-vuln fix PR #67).

- `gh pr list --author "app/dependabot" --state open --json number,title,statusCheckRollup` to see all open PRs and their CI status.
- Repo settings: squash/merge/rebase all allowed, `required_linear_history: true`, 0 required approving reviews, no branch protection blocking dependabot merges. Repo merge style is **squash** with `--delete-branch` (`gh pr merge <n> --squash --delete-branch`) — main history shows single squashed commits per PR.
- Merging a PR to `main` is treated as a "merge without review" risky action by the auto-mode classifier — it will be denied until the user explicitly confirms (use `AskUserQuestion` to get sign-off before the first `gh pr merge` call in a session). This applies separately to *every* PR merge, including a same-session fix PR you authored yourself (e.g. #67) — approval to *create* a fix PR is not approval to *merge* it; ask again before that `gh pr merge` call.
- Frontend bumps all touch `frontend/package-lock.json` (same for `go.sum`), so merge **sequentially**: after each merge, re-check the rest with `gh pr view <n> --json mergeable,mergeStateStatus` (state shows UNKNOWN briefly while GitHub recomputes — retry after ~10s).
- If a PR turns `CONFLICTING`/`CONFLICTING DIRTY`, comment `@dependabot rebase` and wait — Dependabot rebases automatically (~1-3 min), after which CI re-runs from scratch (checks go back to `pending`). Poll with `gh pr view <n> --json mergeable,mergeStateStatus` and `gh pr checks <n>`.
- **Poll workflow runs on `status == "completed"`, never on `status != "in_progress"`.** A run
  sits in `queued` before it starts, so the negated form exits immediately and reports a
  half-finished run: `conclusion` comes back as `""` and the not-yet-started jobs print blank
  conclusions. Bit once this session — it looked like main had finished with two silent jobs.
  ```bash
  until [ "$(gh run list --branch main --workflow CI --limit 1 --json status --jq '.[0].status')" = "completed" ]; do sleep 25; done
  ```
  Same shape as the `$?`-after-pipe trap: an empty/blank field is not a pass, it means "no
  answer yet". Treat a blank `conclusion` as "keep waiting", never as success.
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

## Ungrouped `react` / `react-dom` bumps produce a self-breaking PR (2026-08-14, PR #74)

Dependabot bumped `react` 19.2.7 → 19.2.8 (grouped with `@types/react`) but left `react-dom`
at 19.2.7, because they were **separate update jobs**. react-dom hard-throws on a mismatch:

```
Error: Incompatible React versions: The "react" and "react-dom" packages must have
the exact same version. Instead got: react 19.2.8 / react-dom 19.2.7
```

All 36 test files fail to load (10 pass — the ones that never mount a component), `build`
is skipped. It looks catastrophic but is a one-line resolution problem, not a React defect.

- Diagnose by reading the actual error, not the failure count: 36 red files with only
  75 tests *passing* and none *failing* means a module-load error, not broken assertions.
- `package.json` already had `react-dom: "^19.2.7"`, which **permits** 19.2.8 — only the
  lockfile pinned it. A bare `npm install` will NOT fix it: the locked 19.2.7 still satisfies
  `^19.2.7`, so npm leaves it alone. Use `npm install react-dom@^19.2.8` to move both the
  range and the lock (this is the AGENTS.md-sanctioned route — never hand-edit package.json).
- **Fixed structurally**: `.github/dependabot.yml` now has a `react` group covering
  `react` / `react-dom` / `@types/react` / `@types/react-dom` so they always ship in one PR.
  If a future React bump still desyncs, check that group is intact before debugging anything else.
- **Confirmed working the same day**: PR #78 opened titled "... in /frontend **in the react
  group**", and GitHub added a `.github/dependabot.yml` check that validates the config
  server-side (it passed). That title suffix and that check are the two signals the grouping
  is live — no need to wait for a real multi-package React release to verify it.

## Merging one batch spawns the next — and those are safe to trust

Merging the queue moved `main` five times, and Dependabot immediately opened three fresh PRs
(#78/#79/#80) cut from the *post-fix* `main`. Unlike the original batch these need **no**
rebase: verify by checking they carry the fix rather than assuming either way —
`git show origin/<branch>:.github/workflows/ci.yml | /usr/bin/grep -c 1.25.13` (use
`/usr/bin/grep`, the shell's `grep` is `rg`-backed — see
`mem:quirks/verifying-the-frontend-lint-gate`), and compare `baseRefOid` against the fixed SHA.

Caveat actually hit: after merging the first of the three, the other two still reported
`mergeable=CLEAN` because they touched *different* packages in `package-lock.json`, so they
merged on CI that predated the two merges before them. That is a real (if small) stale-signal
compromise — textual cleanliness is not proof of semantic consistency. `main`'s own post-merge
run is the thing that actually settles it, so always confirm main green at the end rather than
treating the last `gh pr merge` as the finish line.

## Dependabot may rebase *while you are fixing its branch* — replay, never force-push

Hit on PR #74. Sequence: `@dependabot rebase` → it pushed b7506f4 → I committed my fix on
top locally → meanwhile the merge of #73 moved `main`, so Dependabot **rebased again** to
1bd025e → my `git push` was rejected with `(fetch first)`.

`--force` here would have discarded Dependabot's newer rebase. Correct recovery:

```bash
git fetch origin <dependabot-branch>
git checkout -B fix74 origin/<dependabot-branch>   # adopt ITS new head
git cherry-pick <my-commit>                        # replay my fix on top
```

The cherry-pick auto-merged `package.json` / `package-lock.json` cleanly. **Re-run the full
gate after replaying** — the base changed, so the pre-cherry-pick green run proves nothing
(`npm ci` then eslint/tsc/vitest).

Two consequences of pushing a manual commit to a Dependabot branch:
- Dependabot **stops auto-rebasing it** from then on. Further staleness is yours to fix.
- Avoid the race entirely by fixing the broken PR **last**, after the merge train is drained,
  so nothing moves `main` underneath you.

## Merge-train ordering that actually worked (2026-08-14)

With five dependabot PRs open and a toolchain fix needed first, this order avoided all conflicts:

1. Land the `ci.yml` fix on `main` first — otherwise every PR re-runs against the broken workflow.
2. `@dependabot rebase` the **Go** PR and **one** frontend PR together — different ecosystems
   (`go.sum` vs `package-lock.json`) don't collide, so these two can go in parallel.
3. Then frontend PRs strictly **one at a time**: rebase → wait for green → merge → rebase next.
   Each merge rewrites `package-lock.json`, so rebasing them all up front just wastes CI.
4. Fix the *broken* frontend PR **last** — every preceding merge would have invalidated its
   lockfile anyway, so one `npm install` at the end resolves against final state.

Dependabot took ~1–5 min per rebase here; #71's push lagged ~5 min behind #70's despite being
requested at the same moment. Wait on `headRefOid` changing, never on the clock.

## `vuln-go` can break `main` with zero code changes too — Go *stdlib* advisories (2026-08-14)

Same shape as the npm-audit cascade below, but on the Go side and with a different fix.
`main` went red on `vuln-go` with three Go **standard library** advisories — GO-2026-6218
(quadratic `resolvePath` in `net/url`), GO-2026-6090 (post-handshake message flooding in
`crypto/tls`), GO-2026-5972 (recursion depth in `encoding/asn1`) — all fixed in **go1.25.13**.
No dependency and no repo code was at fault: CI had installed go1.25.12.

- **Stdlib advisories are not fixable with `go get`.** There is no module to bump — the only
  fix is installing a newer Go toolchain, i.e. a `.github/workflows/ci.yml` change. Don't
  waste a round on `go get`/`go mod tidy`; go straight to the `setup-go` pin.
- `ci.yml` uses `go-version: '1.25'` + `check-latest: true` across **six** `setup-go` steps
  (lint-go, vuln-go, build×2, test-go, and the Sonar job). All six must move together.
- **`check-latest: true` is already set**, which matters: it makes setup-go skip the runner's
  local tool cache and query the manifest. So the range form *does* self-heal on its own once
  the manifest catches up — the tool-cache staleness trap does **not** apply to this repo.
  Don't cite it as a reason to pin.
- **`actions/go-versions` lags go.dev by days.** Check both before deciding:
  ```bash
  curl -s "https://go.dev/dl/?mode=json&include=all" | jq -r '.[].version' | grep '^go1\.25\.' | sort -V | tail -3
  curl -s "https://raw.githubusercontent.com/actions/go-versions/main/versions-manifest.json" | jq -r '.[].version' | grep '^1\.25\.' | sort -V | tail -3
  ```
  On 2026-08-14 go.dev had 1.25.13 but the manifest topped out at 1.25.12, so *no* re-run
  could have gone green — waiting was the only alternative to pinning.
- **An exact pin works even when the manifest lacks the version**: setup-go resolves
  local cache → go-versions manifest → **direct download from go.dev**. Verified in the
  setup-go README, not assumed.
- Pin is therefore **temporary by design** — an exact patch pin silently stops picking up
  *future* stdlib CVEs, the opposite of the range's behaviour. Each of the six sites carries a
  comment saying to revert to `'1.25'` once the manifest ships 1.25.13. Revert it; don't
  leave the repo pinned.
- Get the fix-version set straight from the advisory rather than guessing per release branch:
  ```bash
  curl -s https://vuln.go.dev/ID/GO-2026-6218.json | jq -r '.affected[0].ranges[0].events[] | select(.fixed) | .fixed'
  ```
- **Ordering consequence for the merge train:** dependabot PRs carry the *old* `ci.yml` on
  their branches, so their `vuln-go` fails until rebased. Land the toolchain fix on `main`
  first, then `@dependabot rebase` each PR so it re-runs against the fixed workflow. Merging
  them on stale-green checks would "work" but produces unverified merges.

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
