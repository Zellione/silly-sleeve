# Phase 4 · 6.5 — Advanced Lorebook (COMPLETE, PR #30 open & clean)

## Status
All 7 plan tasks implemented + SonarCloud fixes applied on branch `milestone/6.5-advanced-lorebook`
(base main @ f185609). PR #30: https://github.com/Zellione/silly-sleeve/pull/30
All CI checks green; SonarCloud PR analysis = 0 open issues. Awaiting merge.

## Commits (f185609..HEAD)
8498507 roadmap start · dce6745 ParseWorldInfo · cb159a1 ImportLorebook binding+dialog ·
3a9f903 TS helpers · 12720bd scoping chips · 82ed478 drag-reorder · 5b18d55 import flow ·
0259a69 review fixes · 5d13e31 roadmap complete · 826d06d SonarCloud fixes.

## What shipped
- `internal/lorebook/import.go`: `ParseWorldInfo([]byte)([]Entry,error)` — 3 shapes (object map,
  entries array, bare array), sorted asc by UID, empty->empty, malformed->error.
- `app.go ImportLorebook()` + `project_manager.go PickLorebookFile()` (.json dialog, no state mutation).
- `frontend/src/utils/lorebook.ts`: reorderByDrag (gapped order 1000/-10), remapForMerge, renumberFromZero.
- `LorebookScreen.tsx`: scope chips (store String(c.id); empty=global), HTML5 drag-reorder (off while
  searching), Import .json merge/replace native <dialog> modal (Escape via onCancel + Cancel button).
- Selective logic + probability sliders already existed (Phase 2 4.5); export scoping already in cardexport.

## SonarCloud fixes (commit 826d06d) — both in LorebookScreen.tsx import modal
- S6819 "use <dialog> not role=dialog": converted overlay div to native <dialog> driven by
  showModal()/close() via a ref+useEffect; removed manual Escape keydown listener AND the jsx-a11y
  eslint-disable; dropped backdrop-click-to-close (it would re-need an eslint suppression). CSS:
  .lb-import-overlay -> .lb-import-dialog[open] + transparent ::backdrop.
- S3358 nested ternary: extracted `firstImportedIdx = mode==='merge'?entries.length:0` in applyImport.
- Query PR issues: mcp__sonarqube__search_sonar_issues_in_projects projects=["Zellione_silly-sleeve"]
  pullRequestId="30". Project key = Zellione_silly-sleeve (from SonarCloud dashboard URL; NOT in
  sonar-project.properties).

## Gotchas learned this session
- jsdom 29 does NOT implement HTMLDialogElement.showModal (undefined). A shim already exists in
  frontend/src/test-setup.ts (lines ~49-55) toggling .open + dispatching 'close' — reuse it for any
  <dialog> work.
- jsx-a11y treats <dialog> as NON-interactive: onClick on it triggers click-events-have-key-events +
  no-noninteractive-element-interactions. Avoid mouse handlers on <dialog>; use onCancel for Escape.
- TWO eslint on this machine: GLOBAL v9 (/usr/local) errors spuriously on `no-unassigned-vars`. ALWAYS
  use ./node_modules/.bin/eslint (v10); `npm run lint` resolves local.
- A subagent left the repo on `main` once (commits safe on milestone branch). Re-assert branch + verify
  `git branch --show-current` after subagent runs.
- `wails build` regenerates frontend/wailsjs/runtime/* as file-mode-only churn — revert with
  `git checkout -- frontend/wailsjs/runtime/`.
- LSP diagnostics repeatedly STALE after edits — verify with real go test / vitest / tsc.
- rtk hook can mangle `npm run lint` output / mask exit codes; use `cmd > /dev/null 2>&1; echo $?` or
  `rtk proxy <cmd>` to see raw output/exit.

## Pre-existing (NOT this PR, out of scope): ConfirmDialog.tsx & WorkflowEditor.tsx still use role="dialog".
