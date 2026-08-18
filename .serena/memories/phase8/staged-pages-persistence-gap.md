# Staged pages lost on reload — diagnosis + approved-pending design (2026-08-18)

User report: lorebook staged pages vanish ("No pages staged" after reload); they should persist for later refinement.

## Key finding: persistence EXISTS, triggers don't

The `.slv` bundle already round-trips the whole extraction review: `bundle.go` writes/reads `extraction.json` (`loreextract.State` = Sources + Candidates + Suggestions), `SaveProjectBundle` captures it via `extractionStateLocked()` (`app.go:661`), `OpenProjectBundle` restores via `applyExtractionStateLocked` (`app.go:757`, nil clears to avoid cross-project leak).

The gap is purely frontend save triggers:
- `CrawlerScreen.handleSendRow` (~line 133): successful `SendCrawlResult` (staged/restaged AND character created/overwritten) never schedules a bundle save.
- `useLoreStaging.ts`: `SetStagedSourceMode`, `RemoveStagedSource`, extract completion (stores backend `loreCandidates`) never schedule one. Only entry approval saves, indirectly via LorebookScreen `persist` (line ~320, the only `scheduleBundleSave()` caller).
- Compounding: pre-instant-save projects had empty `projectPath`, so `useBundleSave` silently no-oped anyway (fixed on this branch/PR #90).

## Design presented in chat (awaiting explicit user approval)

1. CrawlerScreen: add `useBundleSave`, schedule after every successful send.
2. Thread LorebookScreen's `scheduleBundleSave` into `useLoreStaging`; call after mode change, removal, successful extraction. Candidate tick/edits are frontend-only until approve — nothing to persist.
3. Frontend tests only; no Go changes. Target branch: `fix/dashboard-accent-colors`.
