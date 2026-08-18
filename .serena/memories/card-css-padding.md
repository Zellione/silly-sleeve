# .card padding convention

- Base `.card` class (frontend/src/style.css ~line 2548) now includes `padding: 16px` by default (fixed 2026-08-18: Export screen cards had headings/buttons flush against the border).
- Redundant paddings still exist and are harmless: `.export-side .card { padding: 16px }` and inline `style={{ padding: 16 }}` in ImageUploadPanel.tsx — could be cleaned up later.
- New cards should NOT re-add inline padding: 16 unless deviating from the default.

# Known pre-existing issue (unrelated)

- SuggestionList.tsx has TS diagnostics (missing `FlagChanges`, `proposedFlags`, `removeKeys` etc. on generated `wailsjs/go/models` loreextract types) — stale generated Wails bindings; regenerate with `wails dev`/`wails build` (needs GTK/WebKit libs). Vite build passes because it doesn't run tsc.
