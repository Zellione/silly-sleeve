# Milestone 6.3 — Advanced Crawler (pushed, PR #28 open)

Branch `milestone/6.3-advanced-crawler`, 2026-06-14. Approved + pushed; PR #28
open (https://github.com/Zellione/silly-sleeve/pull/28). Latest commit: 46183aa.

## What shipped (summary)
Multi-result crawl pipeline: per-page `CrawlResult`, role assignment
(Character/Lorebook/Skip), `SendCrawlToProject` stubs w/ `SourceURL`,
per-active-char source resolution. goquery + go-readability. Crawler BFS
(crawl.go): User-Agent, rate limiter, custom selectors, readable fallback,
dedup, per-page fan-out cap. `RemoveCrawlResult` + remove button. Settings
Crawler section (UA/rate/MaxPages default 10). Bundle `crawl_set.json` + legacy
upgrade. CrawlerScreen + SettingsScreen.

## Post-PR fix commits (chronological)
- edae74a: remove pages from list + fix blank-screen crash on deleting only item
  (nil Results→null over bridge; CrawlerScreen null-safe).
- 52fad6f: dedupe same page via redirect/alias URL forms (`pageIdentity`=
  (domain,title) wiki / normalized URL; `normalizeURL` pre-fetch).
- acb2c85: 2-hop regression test + fixed stale "multi-hop coming later" hint.
- c1c4a3d: per-page FAN-OUT cap so multi-hop reaches deeper pages.
- 46183aa: results list fills remaining vertical space (was maxHeight:300).

## 2-HOP FIX (c1c4a3d) — root cause + resolution
Pure breadth-first let a dense root (Mine=44 same-domain links) consume the whole
MaxPages budget with hop-1 before depth-2 → "2 hops" looked identical to 1 hop.
Fix in `Crawler.Crawl`: when `FollowLinks>=2`, cap NEW links enqueued per page to
`max(maxPages/FollowLinks, 2)`; 1-hop keeps full breadth. Live Mine 2-hop now
depth 0/1/2 = 1/3/6 (was 1/9/0). Test: TestCrawler_TwoHopFanoutReachesDepth2OnDenseRoot.

## RESULTS-LIST LAYOUT FIX (46183aa)
CrawlerScreen results list was pinned `maxHeight:300` + inner scroll → extra
results hidden in a small box (contributed to user thinking "only 6 results"),
short lists left dead space. Fix: results wrapper + inner scroll area use
`flex:1; minHeight:0; overflowY:auto`; left `.col` got `minHeight:0`. Grid
already had `height:100%; align-items:stretch` (style.css .crawler-grid). Now
fills the page body like the preview pane. Frontend-only (hot-reloads in wails dev).

## "6 results at limit 10" explanation (NOT a backend bug)
Engine returns 10 for Mine at cap 10 (proven). User's 6 came from: (a) results
hidden in the 300px box (layout, now fixed), and/or (b) stale crawl / Go backend
not restarted in `wails dev` after backend fixes. Backend reads
`settings.Crawler.Normalized()`; SaveSettings sets `a.settings=s` live.

## Patterns / gotchas (reusable)
- Network IS available in sandbox — curl + live `go test` hit fandom. Best way to
  diagnose crawler behavior. Throwaway: drop `zz*_test.go` in internal/crawler,
  run, `rm` it. Be polite (UA, low volume).
- `wails dev`: .tsx HOT-RELOADS; GO changes need a full restart. User reporting
  "old behavior" after a backend fix → suspect no Go restart. Frontend-only fixes
  don't need a restart.
- Repo LSP/gopls emits STALE "undefined/type/import" diagnostics after Serena
  edits / `wails generate module` / `go get`+tidy — verify with real `go test`/`tsc`.
- `wails build`/`generate module` re-touch `frontend/wailsjs/runtime/*` (no
  content) — `git checkout` it. `go mod tidy` prunes unimported `go get` deps.
- Bash cwd PERSISTS between calls; `wails build` must run from repo root not frontend/.
- Go 1.22: use builtin `max()`/`min()` (gopls flags manual versions as `minmax`).
- Flex-fill pattern here: grid `height:100%`+`align-items:stretch` → col
  `minHeight:0` → child `flex:1;minHeight:0;overflowY:auto`.

## Gate (latest, green)
go vet + golangci-lint clean; `go test ./... -race` 543 pass; tsc + eslint clean;
625 frontend tests; `wails build -clean -tags webkit2_41` links.

## Open (offered, no decision)
Expose fan-out as a "Max links per page" setting/UI note, or keep adaptive
default (currently shipped: adaptive).

See `mem:core`, `mem:conventions`, `mem:milestone_6.2_complete`.
