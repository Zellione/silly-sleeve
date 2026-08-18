# Instant-save feature design + save/persistence architecture (2026-08-18)

Design proposed in chat, awaiting user approval; suggested branch `feature/instant-save`.

## Key facts

- `NewProject(name)` (`internal/app/app_library.go`) only resets in-memory state; nothing is written to disk. Frontend `projectPath` stays `""` until the user saves via a native dialog.
- `SaveProjectBundle(filePath)` (`internal/app/app.go` ~line 623) snapshots all in-memory state into a `.slv` bundle, sets `a.projectDir`, and registers the project in the library index (`registerInLibrary`).
- `PickSaveBundle()` opens the native save dialog; used by `ExportScreen.tsx` and `EditorScreen.tsx`.
- `LibraryManager` (`internal/app/library_manager.go`) resolves `library.ConfigDir()` (index + thumbnails) and `library.DefaultLibraryDir()` — the latter is documented as "the default folder new bundles are saved into", ideal target for instant saves. `a.library` may be nil (headless/init failure); all callers nil-check.
- Frontend: `useBundleSave.ts` is the shared debounced bundle writer — **silently no-ops when `projectPath` is empty**, so unsaved new projects get no auto-persistence at all.
- `App.tsx` owns `route`, `projectPath`, `projectName`; `handleNewProject` calls `NewProject` then routes to crawler. Dashboard is a full-screen pre-screen (no TopBar).
- `TopBar` (`frontend/src/components/Layout.tsx`) right group `.v2-right` contains `<ThemeToggle />` (sun/moon — what the user calls the "UI toggle") then the Settings cog. New Save button goes before ThemeToggle.
- Wails bindings in `frontend/wailsjs/` are generated; changing a Go method signature (e.g., `NewProject` returning `(string, error)`) requires regenerating them.

## Infobox placement (screenshot triage)

Infobox renders FIRST in CrawlerScreen (~line 268) and SummariesScreen (`SummaryBody`, ~line 57), but LAST in the Characters tab's source panel (`EditorScreen.tsx:604-609`, sections then `<Infobox style={{marginTop:16}}>`). A screenshot with footer "N → M tokens · ✓ embedded" is the EditorScreen source panel, not the Crawl tab. `CharactersScreen` wraps `EditorScreen`. No CSS reordering exists (no `order:`/`column-reverse` on those bodies).

## Pending design scope (3 items)

1. `NewProject` writes a bundle immediately into the managed library dir, filename from sanitized name (`untitled` fallback, `-2`/`-3` uniquify), returns the path; frontend adopts it as `projectPath`.
2. Prominent labeled Save button in `TopBar` left of ThemeToggle; saves to `projectPath` with toast, falls back to `PickSaveBundle` when path empty.
3. `EditorScreen.tsx`: swap source panel order — Infobox first (`marginBottom: 16`), then `SectionContent`, for consistency with Crawl/Summaries tabs.
