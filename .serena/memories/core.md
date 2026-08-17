# Core — silly-sleeve

Wails v2 desktop app: SillyTavern character-card / lorebook creator.
Go backend + React frontend bridged by Wails (CGo + WebKit2GTK on Linux).

## Source map

```
main.go                   Wails entrypoint — creates App, calls wails.Run
                          (native OS frame; Frameless removed 2026-08-17)

internal/app/             THE Wails-bound App package (single exported struct
                          spread across app.go, app_crawl.go, app_export.go,
                          app_files.go, app_library.go, app_lore.go, plus
                          character_generator.go, comfy_service.go,
                          image_prompts.go, library_manager.go,
                          project_manager.go)

internal/
  settings/    Persistent config — stored in os.UserConfigDir()
  project/     In-memory project state (characters, lorebook)
  compose/     Character card data model + export helpers
  bundle/      Project bundle (ZIP) serialisation
  cardexport/  PNG CCv2/v3 character-card export engine
  comfy/       ComfyUI API types and workflow parsing
  crawler/     MediaWiki scraper
  llm/         OpenAI-compatible chat completions client
  lorebook/    Lorebook data model
  prompts/     System-prompt templates

frontend/src/
  App.tsx                    Route state (no router lib); dashboard route
                             early-returns the full-screen projects picker
  components/Layout.tsx      v2 shell: TopBar (tabbed), PageHead, StatusBar,
                             ThemeToggle; tab list in components/tabs.ts
  screens/DashboardScreen.tsx  Full-screen projects picker + named creation
  screens/                   One file per tab screen (Crawler, Summaries,
                             Characters list→Editor detail, Lorebook, Images
                             [Portrait/ProjectImage sub-tabs], Preview,
                             Export, Settings)
  utils/theme.ts             Dark default; applied at startup in main.tsx
  components/                Shared UI components and hooks
  utils/image.ts             arrayBufferToDataURL, dataURLToBytes, etc.
  utils/workflow.ts          Workflow/size helpers
  utils/log.ts               Dev logger
  icons.tsx                  SVG icon components (inline, no icon lib)

frontend/wailsjs/            Auto-generated — never edit manually
  go/app/App.d.ts / App.js   Typed JS bindings for all App methods
                             (regen: `wails generate module`)
  go/models.ts               Go struct → TypeScript type bindings
  runtime/runtime.ts         Wails runtime (events, file-drop, etc.)
```

## Key invariants

- The `internal/app` package's exported App methods are what appear in
  `wailsjs/go/app/App`. Adding a backend method requires regenerating
  wailsjs/ (`wails generate module` or `wails dev`).
- Business logic lives in the other `internal/` packages — `internal/app`
  files are thin App-method wrappers.
- Each screen fully unmounts on tab switch; persistent state must be restored in `useEffect`.
- Config (settings) ≠ project data. Settings → `os.UserConfigDir()`; project → bundle ZIP.

See `mem:tech_stack`, `mem:conventions`, `mem:suggested_commands`, `mem:task_completion`.
