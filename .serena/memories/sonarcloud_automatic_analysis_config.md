# SonarCloud quality gate + issues — config gotcha (PR #28)

## The trap
This project's SonarCloud check is **Automatic Analysis** (via the SonarCloud
GitHub App — the "SonarCloud Code Analysis" check links to sonarcloud.io, NOT a
GitHub Actions run; `ci.yml` has no scanner step).

**Automatic Analysis reads `.sonarcloud.properties`, NOT `sonar-project.properties`.**
`sonar-project.properties` only applies to CI-based `sonar-scanner` runs. So the
`sonar.exclusions=...frontend/wailsjs/**...` that lived in `sonar-project.properties`
was silently ignored — the generated Wails bindings were analyzed all along.

Symptom: gate ERROR with `new_duplicated_lines_density` 3.4% (> 3% threshold),
sourced entirely from `frontend/wailsjs/go/models.ts` (every generated model
class repeats an identical ~19-line `convertValues()`; adding a new binding class
pushes new-code duplication over the line). Editing `sonar-project.properties`
had zero effect; creating `.sonarcloud.properties` with the same exclusions
dropped it to 0.0%.

## Fix (committed)
Created `/.sonarcloud.properties` mirroring exclusions:
`sonar.exclusions=design_handoff/**,frontend/node_modules/**,frontend/dist/**,frontend/wailsjs/**,build/**`
plus `sonar.cpd.exclusions` (tests + `frontend/wailsjs/**`) and test inclusions.
Keep it in sync with `sonar-project.properties`.

## Gate-condition vs. non-blocking issues — CHECK BOTH
A green quality gate (`get_project_quality_gate_status`) only covers the gate
*conditions* (ratings/duplication/hotspots on new code). SonarCloud still reports
non-blocking issues (code smells) that the user will see. After the gate is OK,
ALSO run `search_sonar_issues_in_projects(projects, pullRequestId, issueStatuses:["OPEN","CONFIRMED"])`
and drive it to 0.

Issues fixed this PR (all on changed lines, so they surfaced in the PR view even
though some predated it):
- `typescript:S5443` (CRITICAL security → had pushed new_security_rating to E):
  hardcoded `/tmp/p.slv` in a test (publicly writable dir). Use a relative path.
- `go:S3776`: `Crawl` cognitive complexity 21 > 15. Fixed by extracting helpers
  (`claimPage` for the dedup check, `appendChildLinks` for the BFS fan-out).
- `typescript:S6819`: a result-row `<div role="button">` containing other
  interactive controls. Replaced with a real `<button>` on the selectable title
  block; child `<div>`s became `<span>`s (button content model). Outer row is a
  plain div now (no role/onClick/tabIndex/onKeyDown).
- `typescript:S3358` (x2): nested ternaries in the preview render. Extracted into
  `renderPreviewHead()` / `renderPreviewBody()` using if/early-return.

## How to inspect (MCP); projectKey: Zellione_silly-sleeve
- `get_project_quality_gate_status(projectKey, pullRequest:"28")` — omit
  `pullRequest` (branch param isn't accepted) to read the **main branch** gate.
- `search_sonar_issues_in_projects(projects, pullRequestId, issueStatuses:["OPEN","CONFIRMED"], ps:200)`
- `search_duplicated_files(projectKey, pullRequest)`
- Confirm a fix landed for the NEW head SHA (gh pr checks can show the PREVIOUS
  commit's stale result during re-analysis):
  `gh api repos/Zellione/silly-sleeve/commits/<SHA>/check-runs --jq '.check_runs[]|select(.name|test("Sonar";"i"))|"\(.status)|\(.conclusion)"'`

## Final state (PR #28)
PR #28 fully green on commit b184ec0: SonarCloud gate OK (all A, duplication 0.0%,
hotspots 100%, **0 open issues**), build/lint-go/lint-frontend/test-go/
test-frontend/vuln-go all pass. Local gate also clean (549 Go tests, 630 FE tests,
wails build links).

## Recurrence: main-branch gate ERROR from `.github/workflows/ci.yml` itself (2026-08)
The `githubactions` SonarQube language analyzer scans `ci.yml` too — its own
rules can fail `new_security_rating` even when app code is clean. Found via
`get_project_quality_gate_status(projectKey)` (no PR) → `new_security_rating`
ERROR (actual 3/C) → `search_sonar_issues_in_projects(projects, impactSoftwareQualities:["SECURITY"])`
surfaced 10 `VULNERABILITY`-type issues, all in `ci.yml`:
- `githubactions:S8545` — `go install pkg@latest` (Go dep not locked to a
  verified version). Fix: pin to a full commit SHA, e.g.
  `go install github.com/wailsapp/wails/v2/cmd/wails@<sha>` — resolve the SHA
  with `git ls-remote --tags <repo> 'refs/tags/<vX.Y.Z>*'` (use the `^{}`
  peeled commit if the tag is annotated). `go install module@<sha>` works
  directly, no pseudo-version math needed. This matches the file's existing
  convention of pinning `golangci-lint-action` to a commit SHA with a
  "Pinned to a full commit SHA... for supply-chain integrity" comment.
- `githubactions:S6505` — `npm install` without `--ignore-scripts` (lets
  postinstall lifecycle scripts run). Fix: add `--ignore-scripts`.
- `githubactions:S8543` — `npm install` doesn't lock to `package-lock.json`.
  Fix: `npm ci` instead of `npm install`.
- Combined fix for all `npm install` steps: `npm ci --ignore-scripts`. Verified
  safe here — `node -e "... hasInstallScript"` over `package-lock.json` shows
  only `fsevents` (macOS-only optional dep, irrelevant on Linux CI runners) has
  an install script, so skipping scripts doesn't break `vite build`/tests.
- `mcp__sonarqube__analyze_code_snippet`'s `language` enum has no
  `githubactions`/`yaml` option — can't dry-run these rules through that tool;
  verify by actually pinning + running the commands locally instead.
