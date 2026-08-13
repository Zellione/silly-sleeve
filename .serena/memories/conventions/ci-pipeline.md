# CI pipeline (.github/workflows/ci.yml)

Jobs: `changes` → `lint-go` / `vuln-go` / `lint-frontend` → `test-go` /
`test-frontend` → `build`. SonarCloud runs separately as Automatic Analysis via
the GitHub App, **not** from this workflow (see
`mem:sonarcloud_automatic_analysis_config`).

## Docs-only changes skip the pipeline (PR #76)

A `changes` job diffs the PR against its base (or a push against its
predecessor) and every other job carries:

```yaml
    needs: changes            # or [changes, <upstream>]
    if: needs.changes.outputs.code == 'true'
```

**Why job-level `if:` and not `paths-ignore` on the trigger.** With
`paths-ignore` the workflow never starts, so its checks never report at all —
and the moment anyone marks one required in branch protection, every docs-only
PR becomes unmergeable waiting for a check that will never arrive. A job skipped
by `if:` still reports, and counts as passing. Branch protection on this repo
currently requires **no** status checks (verified via
`gh api repos/Zellione/silly-sleeve/branches/main/protection`), so this is about
not laying a trap for whoever adds one.

**The filter lists what is safe to ignore** (`*.md`, `LICENSE`), not what counts
as code, so an unanticipated path runs the full pipeline instead of being
silently skipped. Anything undiffable (first push, force-push) also falls
through to running everything.

All `${{ }}` values reach the script through `env:` and are quoted — a branch
name must never be interpolated straight into `run:`.

Verified in CI: the detect job resolved the real diff (not the fallback) and
classified correctly. The **skip** path is still unexercised — the first
docs-only PR proves it.

## Wails CLI ↔ go.mod version drift (recurring)

`wails build` **rewrites `go.mod` to match the locally installed CLI**. Symptom:
an unexplained `github.com/wailsapp/wails/v2` downgrade in an otherwise unrelated
diff.

- `go.mod` committed: **v2.13.0** (dependabot #54)
- CI pins the CLI to **v2.14.0** (`go install ...@857398f611...`) and builds fine
  against the committed version
- A local CLI older than that silently downgrades `go.mod` on every build

**Never commit that downgrade** — it reverts a deliberate dependency bump and
puts local builds out of step with CI. `git checkout -- go.mod go.sum` and carry
on. The durable fix is upgrading the local CLI to CI's pin; otherwise it returns
on the next local `wails build`.

Per AGENTS.md, `go.mod`/`go.sum` are never hand-edited — only `go get` /
`go mod tidy`.
