# Milestone 6.3 — Advanced Crawler (pushed, PR #28 open)

Branch `milestone/6.3-advanced-crawler`, 2026-06-14. Approved + pushed; PR #28
open. Latest commit: be7300d. (This memory file is git-TRACKED in the repo, like
milestone_6.2_complete.md — it gets committed.)

## What shipped (core feature)
Multi-result crawl pipeline: per-page `CrawlResult`, role assignment
(Character/Lorebook/Skip), `SendCrawlToProject` stubs w/ `SourceURL`,
per-active-char source resolution. goquery + go-readability. Crawler BFS
(crawl.go): User-Agent, rate limiter, custom selectors, readable fallback,
dedup, per-page fan-out cap. Settings Crawler section. Bundle persistence.

## Post-PR fix/feature commits (chronological)
- edae74a: remove pages from list + fix blank-screen crash on deleting only item.
- 52fad6f: dedupe same page via redirect/alias URL forms.
- acb2c85: 2-hop regression test + fixed stale "multi-hop coming later" hint.
- c1c4a3d: per-page FAN-OUT cap (`max(maxPages/FollowLinks,2)` when FollowLinks>=2)
  so multi-hop reaches deeper pages (Mine 2-hop now depth 0/1/2=1/3/6 vs 1/9/0).
- 46183aa: results list fills remaining vertical space (was maxHeight:300; flex:1
  + minHeight:0; left .col minHeight:0; grid already height:100%+align stretch).
- be7300d: **persist crawl state across tabs + into the project** (this turn).

## CRAWL STATE PERSISTENCE (be7300d)
Requirements: keep crawl screen state across tab switches; button to save crawl
to project; restore on project load; delete-all button. User clarified: auto-
commit to state on change (no button); the Save button = trigger the same write
auto-save does, earlier.
- Backend: `CrawlState{URL,FollowLinks,Include,Selectors,Roles,Set}` in app_crawl.go.
  App field `crawlInputs CrawlState`. Bindings `GetCrawlState` (returns inputs +
  cachedCrawlSet), `SaveCrawlState` (stores inputs/roles; Set ignored — owned by
  CrawlPage/Remove), `ClearCrawl` (nils set, clears roles, KEEPS params).
- Persistence: crawl params live in the MANIFEST (project.ProjectManifest:
  CrawlFollowLinks/CrawlInclude/CrawlSelectors/CrawlRoles; URL=SourceURL) — done
  this way because bundle pkg can't import main (no import cycle). The set stays
  in crawl_set.json. ProjectSnapshot got matching fields; SaveBundle maps→manifest;
  SaveProjectBundle populates from crawlInputs; OpenProjectBundle restores
  crawlInputs from manifest. app_library.go new-project reset nils crawlInputs.
- Frontend CrawlerScreen: prop `projectPath?:string` (optional, default '' so test
  call sites unchanged). Mount restores via GetCrawlState; a `hydrated` flag gates
  auto-commit so the default render can't overwrite saved state before load.
  Debounced (400ms) SaveCrawlState on input/role change. "Delete all" button in
  results header → ClearCrawl + reset local. "Save crawl" → SaveCrawlState then
  SaveProjectBundle(projectPath) (or warn if no path). App.tsx passes projectPath.

## Gate (latest, green)
go vet + golangci-lint clean; `go test ./... -race` 546 pass; tsc + eslint clean;
628 frontend tests, 84.61% line cov; `wails build -clean -tags webkit2_41` links.

## Patterns / gotchas (reusable)
- Network IS available in sandbox — curl + live `go test` hit fandom. Throwaway
  diagnostic: drop `zz*_test.go` in internal/crawler, run, `rm` it. Be polite.
- `wails dev`: .tsx HOT-RELOADS; GO changes need a FULL restart. User reporting
  "old behavior" after a backend fix → suspect no Go restart.
- Repo LSP/gopls emits STALE "undefined/type/import" diagnostics after Serena
  edits / wails generate / go get+tidy — verify with real `go test`/`tsc`.
- `wails build`/`generate module` re-touch `frontend/wailsjs/runtime/*` (no
  content) — `git checkout` it. `go mod tidy` prunes unimported `go get` deps.
- Bash cwd PERSISTS between calls; run `wails build` from repo root, not frontend/.
- Go 1.22: use builtin `max()`/`min()` (gopls flags manual versions as `minmax`).
- Testing-Library: a crawled result title appears in BOTH the row and the preview
  header → `getByText` throws "multiple elements"; assert via the unique
  per-row "Remove <title>" button instead.
- New App binding → must add to ALL App-module vi.mock blocks (CrawlerScreen.test,
  App.test, screens/index.test) or those suites crash on the mount effect.
- bundle pkg CANNOT import main → persist main-side structs via the manifest
  (internal/project) instead.

## Open (offered, no decision)
Expose fan-out as a "Max links per page" setting/UI note, or keep adaptive default
(currently shipped: adaptive).

See `mem:core`, `mem:conventions`, `mem:milestone_6.2_complete`.
