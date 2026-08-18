# "Optimize lorebook" feature — IMPLEMENTED, awaiting push approval (2026-08-18)

Branch `feature/optimize-lorebook`, commits 9b6d60b (backend) + 59a0305 (frontend). All quality gates pass (978 Go tests, 892 frontend tests, coverage ≥80%, wails build OK). APPROVAL_REQUEST.md generated (never commit it); waiting on user approval before push + PR per AGENTS.md workflow.

## What shipped
- Button renamed "Suggest connections" → "Optimize lorebook" (running: "Optimizing…"); review pane "Suggested improvements".
- 4 new suggestion kinds in `internal/loreextract`: `entryOrder` (0–1000, no-op dropped), `entryPosition` (0–6, depth 0–64, keeps entry depth when unproposed, depth-only change at pos 4 valid), `entryFlags` (FlagChanges struct with *bool/*int fields: constant, selective, selectiveLogic ≤3, probability ≤100, useProbability, exclude/preventRecursion — only differing valid fields kept), `removeKeys` (case-insensitive match, carries entry's own spelling, non-constant entry must keep ≥1 key).
- Suggestion model carries Current*/Proposed* pairs for delta rendering; apply cases in `app_lore.go` (`applyFlagChanges`, `withoutItems` helpers).
- Prompt `loreConnectPrompt` extended (template id stays `connect`; label now "Lorebook — optimize"); custom user templates won't emit new kinds until reset.
- UI: per-item ✓/✗ verdict buttons (selected flag; rejected greys via `data-on="0"`), Accept all/Reject all (`setAllSelected` in useLoreConnections, `onSetAll` through ExtractPanel ConnectionReview), footer "Apply N accepted"/"Nothing accepted", "Dismiss all" → "Discard". Delta components: `.lore-delta`, `.lore-flag-delta`; POSITION_NAMES/LOGIC_NAMES maps in SuggestionList.
- Entries/Extract toggle moved from PageHead actions to `.lore-tabs-row` (padding 14px 32px 0) at top-left of page body.

## Environment gotchas learned
- `npm run lint` in frontend crashes: global ESLint 9.16.0 at /usr/local shadows local; use `./node_modules/.bin/eslint .` instead (passes clean).
- `wails generate module` regenerates frontend/wailsjs bindings without a full build.
- Build tag needed on Arch: `wails build -clean -tags webkit2_41`.
- LSP TS diagnostics for wailsjs models go stale after regeneration; trust `npx tsc --noEmit`.
