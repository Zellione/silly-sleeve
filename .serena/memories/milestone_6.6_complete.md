# Phase 4 · 6.6 — Appearance preferences (COMPLETE, awaiting push approval)

Branch `milestone/6.6-appearance-prefs`, 10 commits, NOT pushed (AGENTS.md approval gate). Implemented 2026-06-20 via subagent-driven development.

## What shipped
Three per-machine appearance prefs in Settings → Appearance, frontend-only, mirroring the theme/font-scale client-side prefs pattern (localStorage + document.documentElement + startup re-apply in main.tsx):
- **Accent color** (`utils/accent.ts`): 6 curated oklch presets `{id,label,l,c,h}` (terracotta default = 0.66 0.18 38). `style.css` accent vars refactored to derive from `--acc-l/--acc-c/--acc-h` on `:root` + the `[data-theme="dark"]` `--acc-soft` override; applyAccent sets those 3 props. Key `ss-accent`.
- **Sidebar style** (`utils/sidebarStyle.ts`): rail/compact/wide via `data-sidebar` on documentElement. CSS overrides `.ss-main { grid-template-columns }` (the REAL width source — NOT `.ss-side`, which has no width). rail=64px, wide=260px, compact=default 240px. Key `ss-sidebar`.
- **Step badges** (`utils/stepBadges.ts`): `data-step-badges="0|1"` on documentElement; CSS-only hides `.ss-nav-num` (sidebar) + `.step-pill` (PageHead) when off. Key `ss-step-badges`, default on.
- Controls: `AccentControl`, `SidebarStyleControl`, `StepBadgesControl` (switch). Wired into SettingsScreen Appearance section + SettingsScreen.test.

## Key deviation: shared accessible RadioGroup
A task review flagged the `<button role="radio">` click-only pattern (used by the shipped FontScaleControl) as an ARIA anti-pattern. User chose "upgrade + retrofit". Added `components/RadioGroup.tsx`: WAI-ARIA roving tabindex (one tab stop; first-focusable fallback when value matches none) + Arrow/Home/End nav with wrap, real `<button>` options, render-prop (`renderOption`) + `getOptionStyle` (swatch bg) + `getOptionLabel` (aria-label for non-text options). AccentControl, SidebarStyleControl, AND FontScaleControl all use it now. StepBadgesControl stays a `role="switch"` button (correct ARIA, no roving). FontScaleControl accessible names unchanged ("Large110%") so its existing tests stayed green.

## Gate (green)
go vet + golangci-lint(0) clean; 558 Go tests (-race); eslint + tsc clean; 703 frontend tests, 84.4% stmts / 86.5% lines; `wails build -clean -tags webkit2_41` links. Final opus whole-branch review: Ready to merge, no Critical/Important.

## IMPORTANT LEARNING — subagent git hygiene
The Task 7 implementer subagent ran a destructive git op + broad `git add` (`-A`/`.`), producing a polluted commit: resurrected pre-c82065d root Go files (app.go, comfy_service.go, etc.), a stray AUDIT.md, old wailsjs/go/main, and REVERTED style.css/FontScaleControl/ROADMAP — yet the frontend suite still passed (CSS isn't unit-tested; reverted FontScaleControl's own test stayed compatible). Recovered via `git reset --hard` to the clean prior commit, then redid the task by hand with a SCOPED `git add <specific files>`.
- Mitigation for future SDD runs: tell implementer subagents to `git add` ONLY their named files (never `-A`/`.`), and the controller must verify `git show --name-only <task-commit>` contains exactly the expected files before marking a task done. Watch for runaway subagents (Task 7 took 80 tool calls / 328s — that was the red flag).

## Remaining in Phase 4
- 6.7 Import existing cards (parse SillyTavern PNG v2/v3 or JSON back into a project) — next/last.
