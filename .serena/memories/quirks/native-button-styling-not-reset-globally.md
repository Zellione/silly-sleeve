# Quirk: style.css has NO global button background reset

`frontend/src/style.css` only declares `button { font-family: inherit; cursor: pointer; }` (line ~71). There is no global `appearance: none; background: transparent; border: 0;` reset — each button class must reset native styling itself (`.v2-iconbtn`, `.btn`, etc. all do).

## Symptom

Any new `<button>` class that skips the reset renders with WebKit's pale-blue `ButtonFace` background in the packaged app — looks like a wrong "accent" color on dark theme. Bit the dashboard project-card pills: `.proj-status` (status pill + trash button, `DashboardScreen.tsx`) lacked it until fixed on branch `fix/dashboard-accent-colors` (commit `0876d0a`, 2026-08-18) by adding `appearance: none; background: transparent;` + a `:hover` matching `.v2-iconbtn`.

## Rule

When adding a styled `<button>`, always include `appearance: none; background: transparent;` (or an explicit background) in its class. jsdom/vitest cannot catch this — stylesheets aren't applied in tests — so it only shows up visually in `wails dev`/build.

## Session state (2026-08-18)

Branch `fix/dashboard-accent-colors` (off `feature/instant-save`, see `mem:workflow/2026-08-18-instant-save-design`) holds `e76e3ad` (memory commit) + `0876d0a` (this fix). Not pushed — awaiting user go-ahead; PR #90 (instant save) was green and unmerged at the time.
