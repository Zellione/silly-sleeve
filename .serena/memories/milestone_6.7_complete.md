# Milestone 6.7 — Import existing cards (COMPLETE) — Phase 4 DONE

Branch `milestone/6.7-import-cards`, 8 commits ahead of main (base 7b48629). Awaiting user
approval (APPROVAL_REQUEST.md at root, gitignored) before push/PR. This completes Phase 4.

## What shipped
New `internal/cardimport/` package (named `cardimport`, NOT `import` — TS reserved word), inverse of `cardexport`:
- `parse.go`: `ParseCard([]byte)(*ParsedCard,error)` auto-detects PNG vs JSON. PNG → `cardexport.ReadTextChunks`, prefer `ccv3` then `chara`, `chunkJSON` base64-decodes with raw-JSON fallback, PNG bytes = Portrait. JSON → `cardEnvelope` detects `chara_card_v3`/`v2` (data wrapper) or bare v1. Types: `ParsedCard`, `CharacterBook`, `BookEntry` (Enabled `*bool` so absent=enabled).
- `mapcard.go`: `ToCharacter(*ParsedCard)(compose.Character,[]lorebook.Entry)`. `parseSections` splits `### ` headings (headingFields map) → fields; content under unrecognized headings dropped; empty sections → whole desc into Backstory. `parseStats` reverses `- **k**: v`. `buildQuotes` from first_mes + `{{char}}:` lines + alternate_greetings. `convertEntries` (positionInt inverse of cardexport positionString; Enabled *bool → Disable). Empty input returns sentinels `[{"",""}]`/`[""]` matching `compose.NewCharacter` (DELIBERATE — user-adjudicated, documented by edge tests).
- `internal/app`: `ProjectManager.PickCardFile` (`*.png;*.json` dialog), `App.ImportCard()(*ImportCardResult,error)` + unexported `importCardData([]byte)` (testable). Appends char w/ nextCharID, sets active, merges lore w/ UIDs renumbered from `lorebook.NextUID`. ImportCardResult{Character,ImportedEntries} → JSON character/importedEntries. Cancel→nil,nil.
- Frontend: EditorScreen character strip "Import card" button → `ImportCard()` → refreshCharacters + setActiveChar + ok toast `Imported "{name}" (+N lore entries)`; cancel no-op; error bad toast. Added to existing EditorScreen.test.tsx mock.

## Quality gate (all green)
go vet + golangci-lint 0 issues; go test ./... -race all pass (cardimport 91.5%, app 88.5%, all ≥80%); tsc clean; eslint clean; 705 frontend tests, 84.43% stmt / 86.51% line; `wails build -clean -tags webkit2_41` LINKS.

## REUSABLE GOTCHAS (important for future milestones)
1. **eslint env trap**: `npm run lint` (and rtk-proxied `eslint`) mis-resolves a GLOBAL eslint 9.16.0 that errors `Could not find "no-unassigned-vars"`. Use the PROJECT-LOCAL binary `frontend/node_modules/.bin/eslint` (v10.5.0) — it's the real gate and is clean.
2. **wails build drops exec bit**: `wails build` rewrites `frontend/wailsjs/runtime/{package.json,runtime.d.ts,runtime.js}` from mode 100755→100644 (tracked files). Restore with `git checkout -- frontend/wailsjs/runtime/...` (commit 7b48629 did this originally). Do NOT commit that mode drift.
3. **wails IS available** here (v2.12.0) and `wails build -tags webkit2_41` LINKS on this Arch box (GTK/webkit present) — the headless-can't-link caveat in AGENTS.md does NOT apply in this env.
4. **cardexport signatures**: `BuildCharacterPNG(ch, entries, spec, opts)` is 4-arg NO charKey; `CardV2JSON(ch, entries, charKey, opts)` IS 4-arg WITH charKey. Easy to confuse.
5. **app test conventions**: construct via `NewApp()` (no newTestApp helper); lorebook setter is `SaveLorebook(entries)`, getter `GetLorebook()`; field is `a.lorebookEntries`; tests are `package app` (can call unexported methods).
6. Harness `<new-diagnostics>` showing `undefined: X` right after a subagent writes a new symbol are STALE LSP — verify with `go build`/`go test`, don't trust them.

## ROADMAP
6.7 marked [x]; "Completed 6.7" progress-log subsection added; Last updated 2026-06-23.
See `mem:phase4/6.7-import-cards-design` for the original design.
