# UI v2 redesign — post-approval follow-ups on PR #87

Continues `mem:workflow/2026-08-17-ui-redesign-start`. Branch
`feature/ui-redesign`, PR #87 open; all commits pushed.

## Commits after the approved milestone
- `320c38b` dark mode is the DEFAULT; theme handling moved to
  `frontend/src/utils/theme.ts` and applied at startup in main.tsx (fixes the
  unthemed full-screen projects picker — ThemeToggle only mounts in the shell).
- `e71e8d6` / `9ef1ddf` portrait thumbnails in the characters list rows and
  character strip pills — `GetCharacters` already carries portrait bytes per
  character; render via `arrayBufferToDataURL(c.portrait)`, letter fallback.
- `df635bf` NATIVE window frame: `Frameless` removed in main.go (title
  "Silly Sleeve"), fake traffic lights + all `--wails-draggable` markers and
  the runtime Quit/Minimise/Maximise usage deleted.
- `c55964d` Summaries tab bucketing rule (user-confirmed semantics):
  **linkage wins over plan** — priority (1) a character whose `sourceUrl`
  equals the page URL (permanent link; pill shows `→ <name>`), (2) the role in
  the persisted `sent` map, (3) only unsent pages use the crawl screen's role
  dropdown. Prevents character pages showing as "lorebook summaries" and
  Re-send targeting the wrong destination.

## Design intent (user-stated)
The Summaries tab is the hub of crawled data ↔ project linkage: crawled pages
link to the characters / lorebook entries they produced so data can be
re-created from source later. Foundation exists: `compose.Character.SourceURL`,
staged-source/entry `SourceURL`, editor re-rolls via `GetCrawlForCharacter`.
Open follow-up idea: per-card "re-draft from source" action.

## Wails CLI note
See `mem:quirks/wails-cli-rewrites-gomod` — CLI updated to v2.14.0; go.mod
stays stable across wails commands now.
