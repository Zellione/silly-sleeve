# Lorebook content style toggle (feature/lore-content-style, 06c6fa5)

## Decision
Investigated prose vs comma-separated (PList) lorebook entry content. Kept prose as default (matches ST docs + lorebook_creator_v2 reference; PList is a 2k-context-era technique with style-bleed risk on small local models). Added a per-staged-page style toggle instead:
- `prose` (default): evocative/sensory wording (original behavior)
- `factual`: "dense, factual prose: short declarative sentences, every clause carrying a fact. No atmosphere, no sensory detail."

## Implementation pattern
- Style swaps ONLY rules 3 and 6 of shared `loreRules` via template variables `{{style.rewrite}}` / `{{style.opening}}` in `internal/prompts/lore.go`; values come from `ContentStyle.PromptVars()` in `internal/loreextract/models.go`. User-customised templates without placeholders are unaffected (Substitute no-ops).
- `ContentStyle` mirrors `ExtractionMode` exactly (Valid/OrDefault, string alias, per-StagedSource field, `SetStagedSourceStyle` App binding mirroring `SetStagedSourceMode`).
- New StagedSource fields are backward compatible: missing JSON field → "" → OrDefault.

## Session learnings
- Wails generated bindings (`frontend/wailsjs/go/{app/App.js,App.d.ts,models.ts}`) can be hand-edited to match generator output; `wails build` regenerates and confirmed identical (no extra diff). d.ts may reference non-emitted Go string-alias types (e.g. `loreextract.ContentStyle`) — safe because `skipLibCheck: true`; frontend casts via `as unknown as Parameters<typeof Fn>[1]`.
- Adding a named export to the mocked `wailsjs/go/app/App` module requires updating ALL vi.mock factories that mock it: ExtractPanel.test.tsx, SuggestionList.test.tsx, LorebookScreen.test.tsx, screens/index.test.tsx.
- `TestExtract_PromptCarriesProjectContext` asserts `NotContains "{{"` — any new template variable must always be substituted in extract.go.
- `TestLoreVariableNames_CoverEveryPlaceholderUsed` auto-guards new placeholders; declare them in `LoreVariableNames()`.
- Environment: `npm run lint` via rtk hook picks up stale GLOBAL eslint 9.16 (crashes on `no-unassigned-vars`); project-local `./node_modules/.bin/eslint` is 10.8.1 and passes. Use the local binary.
- Build on this Arch machine: `wails build -clean -tags webkit2_41` works (~5s).
