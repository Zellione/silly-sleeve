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
- `c55964d` Summaries tab bucketing rule (user-confirmed semantics), part 1:
  **linkage wins over plan** — priority (1) a character whose `sourceUrl`
  equals the page URL (permanent link; pill shows `→ <name>`), (2) the role in
  the persisted `sent` map, (3) only unsent pages use the crawl screen's role
  dropdown. Prevents character pages showing as "lorebook summaries" and
  Re-send targeting the wrong destination.

- `90ceb40` bucketing part 2: editor-composed characters never get a
  `sourceUrl`, so the link check falls back to a trimmed case-insensitive
  NAME match (mirrors the backend's character dedupe). Fixed "MINE still
  under Lorebook summaries".
- `64a2115` editable summaries + crawl-format parity: `.sum-card .body`
  co-targeted with every `.crawl-preview .body` CSS rule (infobox included,
  rendered infobox-first like CrawlerScreen); Edit → textarea serialising
  sections as `## Heading` text; Save → new binding `UpdateCrawlSummary(url,
  text)` → `crawler.ParseSummaryText` (exact inverse of the frontend
  serialiser, round-trip tested) + `TotalWordCount` recount; updates both
  `cachedCrawlSet` and legacy `cachedCrawl`.
- `8520cbe` SonarCloud PR gate fixes — see `mem:sonarqube/2026-08-17-pr87-findings`.

## Status
Ready to merge as of `8520cbe`: quality gate findings cleared (Sonar
Automatic Analysis lags the push a few minutes), full local gate green
(tsc/eslint clean, 86.9% frontend statements, Go `-race` all pass, wails
build links). Repo uses SQUASH merges — after merging, `git fetch` + branch
delete; do NOT branch off stale `feature/ui-redesign`
(see `mem:conventions/dependabot-pr-handling`).

## Design intent (user-stated)
The Summaries tab is the hub of crawled data ↔ project linkage: crawled pages
link to the characters / lorebook entries they produced so data can be
re-created from source later. Foundation exists: `compose.Character.SourceURL`,
staged-source/entry `SourceURL`, editor re-rolls via `GetCrawlForCharacter`.
Open follow-up idea: per-card "re-draft from source" action.

## Wails CLI note
See `mem:quirks/wails-cli-rewrites-gomod` — CLI updated to v2.14.0; go.mod
stays stable across wails commands now.
