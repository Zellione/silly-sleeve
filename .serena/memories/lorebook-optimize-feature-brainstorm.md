# "Optimize lorebook" feature — PR #94 open (2026-08-18)

Branch `feature/optimize-lorebook`, PR https://github.com/Zellione/silly-sleeve/pull/94.
Commits: 9b6d60b backend kinds · 59a0305 review UI + toggle move · da45009 S3776 refactor (applySuggestionLocked extracted) · 5528f48 before/after chip context · c9b4ee7 filler-relationship guard. All gates pass (985 Go tests, 896 frontend, coverage ≥80%).

## Feature summary
- "Optimize lorebook" button (was Suggest connections); pane "Suggested improvements"; per-item ✓/✗ verdicts, Accept all/Reject all, "Apply N accepted", Discard.
- 4 new suggestion kinds in loreextract: entryOrder, entryPosition, entryFlags (FlagChanges ptr-struct), removeKeys — all validated, no-ops dropped, Current*/Proposed* pairs for delta UI.
- Additive kinds show before/after context: existing values muted `.k` chips, additions `.k.add` (green, CSS `+` via ::before so tests match bare text), removals `.k.del` (red struck) beside kept keys; unscoped entry shows italic `.ctx` "global".
- Filler-relationship guard: `isFillerRelationship` in connect.go drops characterCharacter proposals containing phrases like "not enough information", "cannot be established", "no known relationship" (list `fillerRelationshipPhrases`, extendable); prompt now tells model to omit rather than emit placeholders. Untouched follow-up idea: exclude unnamed ("Untitled") characters from the roster.
- SonarQube: project key `Zellione_silly-sleeve`; PR analysis via pullRequestId param; go:S3776 fixed by extracting dispatch.

## Environment/CI gotchas
- CI `build` job hanging 2026-08-18 afternoon = GitHub ubuntu runner apt-mirror slowness (apt-get install gtk/webkit step: 20s–2m normally, 15+ min today, still succeeds). Not code-related.
- ci.yml has NO concurrency cancel-in-progress group and NO timeout-minutes on build — superseded runs pile up; cancelled stale run manually (gh run cancel). Suggested hardening not yet applied.
- Global ESLint 9.16.0 shadows local → use `frontend/./node_modules/.bin/eslint .`; rtk vitest parser sometimes fails → `rtk proxy npx vitest run` and run from frontend/ (running from repo root fails all tests).
- Pre-push hook may block compound `git commit && git push` commands mid-way and auto-commit serena memories; verify `git log` before retrying.
- `wails generate module` regenerates bindings; LSP TS diags on wailsjs go stale — trust `npx tsc --noEmit`. Arch build tag: `-tags webkit2_41`.
