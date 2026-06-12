# Core — silly-sleeve

Wails v2 desktop app: SillyTavern character-card / lorebook creator.
Go backend + React frontend bridged by Wails (CGo + WebKit2GTK on Linux).

## Source map

```
main.go                   Wails entrypoint — creates App, calls wails.Run
app.go                    All Wails-bound App methods (single exported struct)
app_export.go             Export-related App methods
app_files.go              File-read helpers (ReadImageFile, portrait/cover I/O)
character_generator.go    Bulk character generation logic
comfy_service.go          ComfyUI WebSocket/HTTP client
image_prompts.go          AI image-prompt generation
project_manager.go        Project bundle save/open

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
  App.tsx                    Shell + tab routing (no router lib)
  screens/index.tsx          Screen exports + DashboardScreen
  screens/                   One file per tab screen
  components/                Shared UI components and hooks
  utils/image.ts             arrayBufferToDataURL, dataURLToBytes, etc.
  utils/workflow.ts          Workflow/size helpers
  utils/log.ts               Dev logger
  icons.tsx                  SVG icon components (inline, no icon lib)

frontend/wailsjs/            Auto-generated — never edit manually
  go/main/App.d.ts / App.js  Typed JS bindings for all App methods
  go/models.ts               Go struct → TypeScript type bindings
  runtime/runtime.ts         Wails runtime (events, file-drop, etc.)
```

## Key invariants

- `app.go` is the *only* file whose exported methods appear in `wailsjs/go/main/App`.
  Adding a new backend method requires regenerating wailsjs/ (`wails dev` does this).
- Business logic lives in `internal/` — root Go files are thin App-method wrappers.
- Each screen fully unmounts on tab switch; persistent state must be restored in `useEffect`.
- Config (settings) ≠ project data. Settings → `os.UserConfigDir()`; project → bundle ZIP.

See `mem:tech_stack`, `mem:conventions`, `mem:suggested_commands`, `mem:task_completion`.
