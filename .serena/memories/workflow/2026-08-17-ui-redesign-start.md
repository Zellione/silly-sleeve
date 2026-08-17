# UI v2 redesign session (2026-08-17) — APPROVED, PR #87

## Outcome
Phase 9 (UI v2 redesign) fully implemented on `feature/ui-redesign`
(milestone commits `c8a5ef6`..`c849c4f`). Approved by the user, pushed,
opened as **PR #87**. Post-approval follow-ups continued on the same PR —
see `mem:workflow/2026-08-17-ui-redesign-followups` for the full list
(dark-mode default, portrait thumbs, native frame, summaries linkage,
editable summaries, Sonar fixes).

## Design source
Claude Design project id `24b2230a-2737-4c47-ba5e-0a976c2635f1`, entry
`index v2.html` (+ v2 jsx/css files at project root; `design_handoff_silly_sleeve/`
folder there mirrors the repo's old v1 handoff). Fetched via the DesignSync
tool (`claude_design` MCP) — NOT the claude.ai share URL.

## What changed (summary)
- 9.1 tokens: flat neutral palettes, Geist-only (`--f-display` now = sans),
  4 oklch accent presets (slate default #3d639f ≈ oklch(0.50 0.10 258)).
- 9.2 shell: `TopBar` (components/Layout.tsx) + `TABS` (components/tabs.ts),
  sidebar/titlebar deleted, sidebar-style & step-badge prefs/utils removed.
- 9.3 routes: `characters` (list `CharactersScreen` + EditorScreen detail with
  back bar), `images` (`ImagesScreen` = Portrait/ProjectImage sub-tabs);
  helpers in screens/characterList.ts.
- 9.4 projects: DashboardScreen = full-screen `.v2-pre` picker; Go:
  `NewProject(name string)`, `GetProjectName()`, `ProjectSnapshot.Name` wins
  manifest name, restored on OpenProjectBundle; bindings via `wails generate module`.
- 9.5 `SummariesScreen`: crawl results as accordion cards, char/lore sub-tabs
  by roles map, send wired to SendCrawlResult (+confirm overwrite, staging toast),
  sent persisted via SaveCrawlState.
- 9.6 PageHead v2 (no step prop — removed from all screens), editor grid
  3fr/2fr with source panel `order:2` (right).

## Gate at HEAD (all green)
go vet+golangci clean; go test -race 889 pass (app 90.2%, project 82.1%);
tsc clean; local eslint 0/0; vitest 845 pass / 86.70% stmts;
`wails build -clean -tags webkit2_41` links.

## Traps (this session)
- rtk shell wrapper: cwd does NOT persist between Bash calls reliably and
  `;`/`&&`-chained `npx tsc`/`npx vitest` commands get mangled (vitest run from
  repo root loses jsdom → mass localStorage failures). Always
  `cd /home/zellione/projects/silly-sleeve/frontend && <single command>`.
- `rtk proxy go test -cover` to see actual coverage percentages (rtk filter hides them).
- Global eslint 9.16 errors on `no-unassigned-vars`; use `./node_modules/.bin/eslint .`.

## Follow-up candidates
- ~~Summary in-place editing~~ — DONE (`64a2115`, `UpdateCrawlSummary` +
  `crawler.ParseSummaryText`).
- Tab count badges (characters/lorebook counts in top bar).
- Self-hosted fonts for offline — PARTIAL: Noto Sans JP (CJK fallback) bundled
  in PR #88; Geist + JetBrains Mono still on Google Fonts CDN.
- Design purity: hide character strip in detail view once add/import relocate.
- Stamp `sourceUrl` when the editor composes a character from a crawl
  (would replace the name-match fallback in SummariesScreen, see `90ceb40`).
- Per-card "re-draft from source" action on the Summaries tab.
