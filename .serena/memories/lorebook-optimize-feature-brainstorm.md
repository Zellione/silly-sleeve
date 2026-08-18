# "Optimize lorebook" feature — PR #94 green, ready to merge (2026-08-18)

Branch `feature/optimize-lorebook`, PR https://github.com/Zellione/silly-sleeve/pull/94. All 8 CI checks pass. Feature branch matches origin at 2d80a97; working tree clean.
Commits: 9b6d60b backend kinds · 59a0305 review UI + toggle move · da45009 S3776 refactor (applySuggestionLocked) · 5528f48 before/after chip context · c9b4ee7 filler-relationship guard · 2d80a97 CI hardening.

## Pending branch: chore/serena-memory-sync
Holds the serena-memory auto-commit 98243ed, pushed. It was cut FROM the feature branch (base 2d80a97, not main): after #94 merges, rebase it onto main or cherry-pick 98243ed before opening its PR — a PR now would show the whole feature diff.

## Feature summary
- "Optimize lorebook" button (was Suggest connections); pane "Suggested improvements"; per-item ✓/✗ verdicts, Accept all/Reject all, "Apply N accepted", Discard.
- 4 new suggestion kinds in loreextract: entryOrder, entryPosition, entryFlags (FlagChanges ptr-struct), removeKeys — validated, no-ops dropped, Current*/Proposed* pairs drive delta UI.
- Additive kinds show before/after: existing values muted `.k` chips, additions `.k.add` (green, `+` via CSS ::before so tests match bare text), removals `.k.del` struck beside kept keys; unscoped entry shows italic `.ctx` "global".
- Filler guard: `isFillerRelationship`/`fillerRelationshipPhrases` in connect.go drop characterCharacter proposals admitting no real connection; prompt tells model to omit placeholders. Open follow-up idea: exclude unnamed ("Untitled") characters from the roster.
- Entries/Extract toggle moved to `.lore-tabs-row` below the page header.

## CI hardening (2d80a97)
ci.yml: workflow-level `concurrency: group: ci-${{ github.ref }}` with `cancel-in-progress: ${{ github.ref != 'refs/heads/main' }}` (main exempt) and `timeout-minutes: 30` on build. Runs predating the setting are NOT auto-cancelled — `gh run cancel <id>` manually.

## Environment gotchas
- 2026-08-18 GitHub ubuntu runner apt mirrors degraded: "Install system dependencies" 20s–2m normally, 15–25 min that day but succeeds. Diagnose via step durations across runs (`gh run view <id> --json jobs`), not by assuming code broke it.
- SonarQube project key `Zellione_silly-sleeve`; PR issues via search_sonar_issues_in_projects with pullRequestId.
- Global ESLint 9.16.0 shadows local → use `frontend/node_modules/.bin/eslint .`; vitest must run from frontend/ (repo root fails all tests); rtk vitest parser flaky → `rtk proxy npx vitest run`.
- Pre-push hook can block compound `commit && push` commands mid-way and auto-commits serena memories at stop; check `git log` before retrying. Memory auto-commits land on whatever branch is checked out.
- `wails generate module` regenerates bindings; LSP TS diags on wailsjs go stale — trust `npx tsc --noEmit`. Arch build tag `-tags webkit2_41`.
