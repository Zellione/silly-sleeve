# Phase 4 · 6.4 — Font scaling presets

Branch `milestone/6.4-font-scaling` (awaiting approval, not pushed as of 2026-06-14).

## What & why
User-selectable pre-defined UI scale levels: Small 90% / Default 100% / Large 110% / Extra Large 125%. Inserted as a NEW milestone 6.4; pending items renumbered (advanced lorebook 6.4→6.5, appearance prefs 6.5→6.6, import cards 6.6→6.7).

## Key decisions
- **Root `zoom`** approach: `document.documentElement.style.zoom = value`. Chosen because `style.css` uses fixed-px typography everywhere, so a single `--font-scale` var would NOT cascade. Zoom scales the whole UI uniformly (text+spacing+icons), not font-only. Font-only later = big style.css refactor.
- Frontend-only; **no Go changes**. Mirrors the theme-toggle persistence pattern.

## Patterns / conventions confirmed (reusable)
- **Client-side prefs pattern** (like theme): persist to `localStorage` (`ss-theme`, now `ss-font-scale`), apply via `document.documentElement`. `ThemeToggle` is in `frontend/src/components/Layout.tsx`. Startup application in `frontend/src/main.tsx`.
- **Settings sections**: `SECTIONS` array near top of `frontend/src/screens/SettingsScreen.tsx`; each rendered via `{sect === 'id' && (...)}`; there's a catch-all fallback ("Coming in a later phase") — when adding a section, also exclude its id from that fallback condition.
- New "Appearance" Settings section now exists — future 6.6 (accent color, sidebar style) should extend it.
- **a11y**: radiogroups (no single labelable control) must NOT use `<label>` (eslint `jsx-a11y/label-has-associated-control`). Used `<span className="form-label">` + extended `.form-row label, .form-row .form-label` CSS.

## Testing gotchas
- Accessible name of a button with `<b>Large</b><small>110%</small>` concatenates WITHOUT spaces → use anchored regex `/^Large/` to disambiguate from "Extra Large" in `getByRole('radio', { name })`.
- vitest coverage text reporter uses `skipFull` — files at 100% across the board are omitted from the table (absence = fully covered, not missing).

## New files
- `frontend/src/utils/fontScale.ts` (+ test): `FONT_SCALES`, `applyFontScale`, `getStoredFontScaleId`, `initFontScale`.
- `frontend/src/components/FontScaleControl.tsx` (+ test): accessible radiogroup, live apply.
- `style.css`: `.font-scale-control` / `.font-scale-opt`.

## Gate (green)
go vet + golangci-lint clean; 549 Go tests (-race); eslint + tsc clean; 642 frontend tests, 85.12% lines; `wails build -clean -tags webkit2_41` links.
Note: run project-local eslint via `./node_modules/.bin/eslint` — the global eslint 9.16.0 lacks `no-unassigned-vars` and errors out.
