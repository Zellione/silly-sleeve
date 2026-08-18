# Staged pages persistence + related fixes — IMPLEMENTED (2026-08-18)

All on branch `fix/dashboard-accent-colors` (not pushed). Gate green: vet, golangci-lint, `go test -race` 916, eslint/tsc clean, vitest 878 / 87% statements, wails build ok.

## Commits

- `1e214d4` feat(projects): new projects start with NO characters. `NewProject` seeds an empty roster; `OpenProjectBundle` no longer resurrects a blank character for empty-roster bundles; EditorScreen gained a real empty state (previously hung on "Loading character…" forever with zero characters — `charsLoaded` flag + gate before the activeChar loading gate).
- `22d4688` fix(lore): bundle-save triggers. The .slv already round-tripped `extraction.json`; nothing triggered writes. Now saved after: successful crawl send (CrawlerScreen.handleSendRow, direct `SaveProjectBundle`), staged mode change / removal / successful extraction (`useLoreStaging` gained `onPersist?` param, threaded from LorebookScreen's `scheduleBundleSave` via new `ExtractPanel.onPersist` prop), and candidate approval (LorebookScreen `onEntriesChanged` now also schedules — it previously only setEntries!).
- `490bb36` feat(lore): persistent extraction-failure display + logging. `useLoreStaging.extractError: Record<url,string>` (set on failure, cleared on retry start + removal); `CandidateList` renders the reason where the shimmer sat (`error` prop; shows when error && no candidates). Console logging: frontend `logError('LoreStaging.extract', e)`; Go `internal/app/applog.go` — `logf` (always, via injectable `logOut io.Writer` for tests) + `debugf` (gated by `SILLY_SLEEVE_DEBUG` env). Frontend `logDebug(context, ...data)` in `utils/log.ts`, gated by `localStorage 'ss-debug'==='1'`, checked per call.

## Conventions established

- Backend operational failures that also return an error to the UI: log via `logf` so detail survives; debug diagnostics via `debugf`.
- Frontend debug channel: `logDebug`; enable with `localStorage.setItem('ss-debug','1')` in devtools.
- Tests asserting toast text that ALSO appears in a persistent pane must use `findAllByText` (two matches by design).

## Tooling trap (new)

Running `npx vitest` from the REPO ROOT (not frontend/) makes npx download a mismatched vitest into `~/.npm/_npx/...` → every test fails with "ReferenceError: document is not defined". The Bash tool's cwd drifts back after `cd /repo && git ...` compounds. Always `cd frontend && ./node_modules/.bin/vitest run`.

## Branch inventory (PR should mention all)

fix/dashboard-accent-colors now carries: dashboard pill native-button fix, lore "Untitled" fix (aliases + key-derived title), memories, no-default-character, staging persistence triggers, extraction failure display + logging.
