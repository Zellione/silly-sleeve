# Lorebook content style toggle + staging lifecycle (feature/lore-content-style: 06c6fa5, d27365b)

## Decisions
1. Investigated prose vs comma-separated (PList) lorebook entry content. Kept prose as default (matches ST docs + lorebook_creator_v2 reference; PList is a 2k-context-era technique with style-bleed risk on small local models). Added a per-staged-page style toggle:
   - `prose` (default): evocative/sensory wording (original behavior)
   - `factual`: "dense, factual prose: short declarative sentences, every clause carrying a fact. No atmosphere, no sensory detail."
2. Discussed flipping default to factual — rejected: style bleed toward dry narration hurts RP output for everyone, silent behavior change for pre-feature bundles (missing style field → OrDefault), diverges from reference prompts. If ever wanted: a per-project/settings default style beats changing OrDefault.
3. Staged pages are now CONSUMED on candidate approval (d27365b), not left as 'Extracted' rows. Removal cannot happen at extraction time — the review UI hangs candidates off the staged source (select page → see its candidates). Discard still keeps the page staged (re-extraction affordance); approve-with-nothing-ticked keeps it staged; re-staging via Crawler SendCrawlResult works ("restaged").

## Implementation pattern
- Style swaps ONLY rules 3 and 6 of shared `loreRules` via template variables `{{style.rewrite}}` / `{{style.opening}}` in `internal/prompts/lore.go`; values from `ContentStyle.PromptVars()` in `internal/loreextract/models.go`. User-customised templates without placeholders unaffected (Substitute no-ops).
- `ContentStyle` mirrors `ExtractionMode` (Valid/OrDefault, string alias, StagedSource field, `SetStagedSourceStyle` binding mirroring `SetStagedSourceMode`). Missing JSON field → "" → OrDefault = backward compatible.
- Approval consumption: backend `ApproveLorebookCandidates` calls existing `dropStagedSourceLocked(url)` (removes source + candidates); frontend `useLoreStaging.approve` mirrors with selected-URL set, filters sources, moves activeUrl to next remaining (needed `sources` added to useCallback deps).

## Session learnings
- Wails generated bindings (`frontend/wailsjs/go/{app/App.js,App.d.ts,models.ts}`) can be hand-edited to match generator output; `wails build` regenerates identically. d.ts may reference non-emitted Go string-alias types (safe: `skipLibCheck: true`); frontend casts via `as unknown as Parameters<typeof Fn>[1]`.
- Adding a named export to mocked `wailsjs/go/app/App` requires updating ALL vi.mock factories: ExtractPanel.test.tsx, SuggestionList.test.tsx, LorebookScreen.test.tsx, screens/index.test.tsx.
- `TestExtract_PromptCarriesProjectContext` asserts `NotContains "{{"` — new template variables must always be substituted in extract.go. `TestLoreVariableNames_CoverEveryPlaceholderUsed` auto-guards placeholders; declare them in `LoreVariableNames()`.
- Environment: `npm run lint` via rtk hook picks up stale GLOBAL eslint 9.16 (crashes on `no-unassigned-vars`); use project-local `./node_modules/.bin/eslint` (10.8.1). `wails build -clean -tags webkit2_41` works on this Arch machine (~5s).
- A hook auto-commits serena memory updates onto the current branch (`chore(memories): auto-commit serena memory update`) — expect housekeeping commits interleaved with feature commits.
