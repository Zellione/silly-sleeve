# Wails CLI silently rewrites go.mod to its own version

## Symptom
`go.mod`'s `github.com/wailsapp/wails/v2` kept "downgrading" from v2.14.0
(Dependabot bump, PR #70 / `d08f747`) back to v2.12.0.

## Cause
Wails v2 CLI commands run inside a project (`wails build`, `wails generate
module`, even `wails version`) sync the project's go.mod/go.sum wails
dependency to match the **installed CLI's** version. The CLI at
`~/go/bin/wails` was still v2.12.0, so every wails invocation reverted the
Dependabot bump as an *uncommitted working-tree change* — easy to sweep into
an unrelated `git add -A` commit.

## Fix (2026-08-17)
`go install github.com/wailsapp/wails/v2/cmd/wails@v2.14.0` — CLI and
library now match; go.mod stays at v2.14.0 across wails commands.

## Rule
After any Dependabot bump of `wailsapp/wails/v2`, also update the local CLI
to the same version, and check `git status` for a dirty go.mod/go.sum after
running any wails command before committing with `git add -A`.
