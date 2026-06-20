# Go backend layout (post repo-cleanup, branch chore/repo-cleanup-audit)

The Wails binding layer was moved out of the repo root into `internal/app`.

## Layout
- `main.go` is the ONLY Go file at repo root. It MUST stay there because of
  `//go:embed all:frontend/dist` (embed paths are relative to the source file).
- All App logic + service types + their tests live in `internal/app` as
  `package app`: `app.go`, `app_*.go`, `comfy_service.go`,
  `character_generator.go`, `project_manager.go`, `library_manager.go`,
  `image_prompts.go` (+ `*_test.go`).
- `main.go` does `application := app.NewApp()` (var renamed to `application`
  to avoid clashing with the package name) and binds it to Wails.

## Startup hook pattern (important)
The lifecycle hook `(a *App) startup(ctx)` stays **unexported** so Wails does
NOT generate it as a frontend-callable binding. main.go reaches it via a
package-level adapter, NOT a method:
```go
// in internal/app/app.go
func Startup(a *App) func(context.Context) { return a.startup }
```
main.go: `OnStartup: app.Startup(application)`.
Rule: only EXPORTED METHODS on the bound struct become frontend bindings.
Don't export `startup` directly or it'll appear in wailsjs.

## Wails bindings namespace
Because the bound struct moved from `package main` to `package app`, the
generated namespace changed `main` -> `app`:
- `frontend/wailsjs/go/main/` -> `frontend/wailsjs/go/app/`
- `models.ts`: `export namespace main` -> `export namespace app` (holds
  CrawlState etc.)
- ~29 frontend src files updated: import path `wailsjs/go/main/App` ->
  `wailsjs/go/app/App`, and `CrawlerScreen.tsx` `{ main }` -> `{ app }` /
  `new main.CrawlState` -> `new app.CrawlState`.
Regenerate with `wails generate module` (CLI v2.12.0, works headless here).

## Verifying headless
`wails build -clean` fails headless (CGo/GTK link). Per AGENTS.md, verify with
`go build ./...` + `cd frontend && npm run build` instead. All gates pass:
internal/app coverage 89.6%.

## Known pre-existing issues (not caused by refactor)
- Frontend coverage: branches 75.9% / functions 77.0% (<80%); vitest config
  does NOT enforce a threshold so it passes silently. Statements/lines ok.
- `go test ./...` walks into `frontend/node_modules/flatted/golang/pkg/flatted`
  (stray vendored Go pkg). Harmless, pollutes test scope.

## Tooling gotcha
rtk hook rewrites `grep`/`find` and breaks `-exec`/command-substitution file
lists. Use `rtk proxy <cmd>` to run them raw when scripting bulk edits.
