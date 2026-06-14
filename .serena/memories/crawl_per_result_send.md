# Crawl → project: per-result send with dedupe/overwrite

Follow-up to `mem:milestone_6.3_complete`, on branch `milestone/6.3-advanced-crawler` (PR #28).
Replaces the old bulk "Send to project" model with per-row sending.

## Behavior
- Each crawl result row has its own **Send** button driven by its dropdown
  (Character / Lorebook only — the "Skip" option was removed; you just don't
  send rows you don't want).
- Characters are unique **by name**; lorebook entries unique **by SourceURL**.
- Sending a duplicate prompts the user to overwrite (confirm dialog). Confirm →
  re-send with overwrite=true, replacing the existing item in place (no dup).
- Sent rows show a green ✓ badge and the button flips to **Re-send**.

## Backend (app_crawl.go)
- Removed `SendCrawlToProject` + `CrawlAssignment`.
- `SendCrawlResult(pageURL, role string, overwrite bool) SendCrawlOutcome`.
  - `SendCrawlOutcome{Status, Kind, Name, Result}`; Status ∈
    created|overwritten|needs_confirm|missing. On needs_confirm, Result is empty
    (no project state until confirmed).
  - Helpers: `crawlResultByURLLocked`, `sendCharacterLocked` (EqualFold trimmed
    name match), `sendLorebookLocked` (SourceURL match). Split out to keep
    cognitive complexity ≤15 (Sonar S3776).
- `CrawlState` gained `Sent map[string]string` (URL→role). Threaded through
  SaveCrawlState, ClearCrawl (resets it), and persisted in the manifest:
  ProjectManifest.CrawlSent (internal/project/project.go), ProjectSnapshot.CrawlSent
  + SaveBundle (project_manager.go), app.go SaveProjectBundle/OpenProjectBundle.
  So sent-markers survive tab switches AND full project reload, like crawl roles.

## Frontend (CrawlerScreen.tsx)
- `RoleValue` is now `'character' | 'lorebook'`; added `normalizeRole()` helper
  to coerce any stored/legacy value (incl. "skip") to a valid dropdown value.
- `sent` state restored on mount from `st.sent`, auto-committed via SaveCrawlState.
- `handleSendRow(url, title)` calls SendCrawlResult; on needs_confirm uses
  `useConfirmDialog().confirm(...)`; single ternaries only (no nested — Sonar S3358).
- Removed bulk Send button from PageHead; only "Save crawl" remains.

## Test gotchas
- The whole result row is `role="button"`, so `getByRole('button', {name:/Re-send/i})`
  matches BOTH the row (substring) and the inner button. Anchor it: `/^Re-send$/i`.
- CrawlerScreen.test.tsx now wraps in `<ConfirmProvider>` so the confirm dialog
  renders; click its "Confirm"/"Cancel" buttons. mockSendCrawlResult default
  resolves `{status:'created',...}`.
- App.test.tsx / screens/index.test.tsx mock GetCrawlState without `sent` — fine,
  code guards `if (st.sent && ...)`. They don't need SendCrawlResult (not called on mount).

## Gate (all green)
go vet + golangci-lint clean; go test -race 549 pass (main 90.5%, project 83.3%);
tsc + eslint (LOCAL 10.4.0 — a stray GLOBAL eslint 9.16.0 errors on missing
`no-unassigned-vars` rule, ignore it) clean; vitest 630 pass / 84.71%;
wails build -clean -tags webkit2_41 links. Bindings regenerated via wails build.
NOT yet committed at session end.
