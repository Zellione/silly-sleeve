# PR #88 — accent/contrast fixes, bundled CJK font, loreextract array tolerance

Branch `feature/ui-accent-contrast` (off merged Phase 9 `d5c2617`). Commits:
1. `fix(ui)` accent selected states — style.css only.
2. `fix(ui)` bundled Noto Sans JP.
3. `fix(loreextract)` bare top-level JSON array tolerance (was uncommitted
   work from 2026-08-16).
4. `refactor(loreextract)` S8193 inline single-use err var (`36fd56f`).
Sonar gate green, 0 open issues at `36fd56f`; full local gate green
(897 Go race tests, 86.91% FE stmts).

## Design conventions established (user-requested)
- Selected/active `[data-on="1"]` states use `--acc`/`--acc-fg`, NEVER the
  white `var(--ink)`/`var(--bg)` inversion — user finds white glaring in dark
  mode and wants the accent preset honoured. All 8 occurrences converted
  (filter chips, char-strip pills, settings/prompt navs, lb-seg, iconbtn,
  ep-preset, endpoint icon). Active char-pill avatar inverts to
  `--acc-fg`/`--acc`.
- Deliberately NOT accent (left alone): `.btn` tier system (primary=acc,
  default=ink, ghost=outline), white toggle-switch knobs.
- Small grey text: count badges use `--ink-2` not `--ink-3`; char-pill
  epithet opacity 0.7.
- `.proj-cover` scrim pinned to fixed dark `#101318` + `#f2f3f5` text
  (theme-stable; `var(--ink)` gradient was a white band in dark mode).

## Bundled font pattern
`frontend/src/assets/fonts/NotoSansJP-Variable.woff2` (4.1M) + OFL license
file; `@font-face` (font-weight 100 900) at top of style.css; family appended
to `--f-display/--f-sans/--f-mono` BEFORE the generic fallback. Per-glyph
fallback keeps Geist/JetBrains Mono for latin. Conversion trick when
woff2_compress is absent:
`uvx --from fonttools --with brotli fonttools ttLib.woff2 compress -o out.woff2 in.ttf`
(no project dependency added). Source: raw.githubusercontent.com google/fonts
`ofl/notosansjp/NotoSansJP[wght].ttf`.
Open gaps: Geist + JetBrains Mono still load from Google Fonts CDN (offline
falls back to system for latin); Korean Hangul / zh-specific glyphs not
covered (would add Noto Sans KR/SC the same way). Leftover unused
`nunito-v16-latin-regular.woff2` from v1 can be deleted.

## Misc traps
- `gh pr create` failed twice on GraphQL 503; REST works:
  `gh api repos/Zellione/silly-sleeve/pulls -f title=.. -f head=.. -f base=main -f body=..`.
- Sonar rule `godre:S8193`: err var declared then read once in an `if`
  condition → inline the call (`if json.Unmarshal(..) == nil`).
- rtk swallows `go test` output even via `command go` / redirection; its
  one-line summary ("N passed in M packages") + exit code is the signal.
