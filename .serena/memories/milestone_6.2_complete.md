# Milestone 6.2 — Multi-endpoint LLM management + per-field override: COMPLETE & MERGED-PENDING-CI

Branch `milestone/6.2-multi-endpoint`, 16 commits (c88785d..cd78cc6). Pushed to origin; PR #27 open: https://github.com/Zellione/silly-sleeve/pull/27 (awaiting CI/merge). APPROVAL_REQUEST.md was generated locally then deleted before push (gitignored; never commit/push it).

## What shipped
Per-field + bulk LLM endpoint overrides. Two-level resolution: global slot->endpointID map in settings.json + per-project map in .slv manifest.
- Backend: FieldEndpoints map on Settings/ProjectManifest/ProjectSnapshot; App.endpointForSlot (project->global->default, dangling falls through) + lookupEndpoint; GenerateCharacterBulk("bulk")/GenerateField(fieldID) routed through it; GenerateImagePrompt left on defaultEndpoint (not overridable, by design); GetProjectFieldEndpoints/SetProjectFieldEndpoint bindings (id<=0 clears); hydrate on OpenProjectBundle, capture on SaveProjectBundle.
- Frontend: utils/fieldEndpoints.ts (SLOTS=bulk+10 fields, resolveEndpoint mirrors Go precedence); PerFieldDefaults Settings table; FieldEndpointChip in EditorScreen field cards + bulk control; style.css.
- Hardening: nextEndpointId (empty-safe id gen); LLMEndpointCard overflow-menu a11y (role=menu/menuitem, labelled trigger).

## Gate (all green on HEAD)
go vet clean; golangci-lint clean; 516 Go tests -race (root pkg 89.4%, new symbols 100%); tsc clean; eslint --max-warnings 0 clean; 598 frontend tests (83.25% lines, new modules 100%); wails build -clean -tags webkit2_41 LINKS OK (env has GTK/WebKit).

## Important environment learnings
- This repo's committed Go files are NOT gofmt-clean under go1.26 (formatted under older Go), but golangci-lint does NOT enforce gofmt. Do NOT run `gofmt -w .` / `goimports -w` repo-wide; it reformats ~14 unrelated files creating out-of-scope churn.
- rtk proxy garbles eslint/vitest/npm output. Lint via LOCAL binary `cd frontend && ./node_modules/.bin/eslint src`. For coverage numbers use `npx vitest run --coverage --coverage.reporter=json-summary` then read coverage/coverage-summary.json.
- `git stash push -u` stashes untracked (non-ignored) files including .serena/memories/*.md; `stash drop` deletes them. Be careful — it deleted scratch memories mid-session. APPROVAL_REQUEST.md is gitignored so safe from stash -u.
- LSP "Cannot find module / undefined method" diagnostics after subagent edits are STALE; trust tsc/go build/tests.
- .serena/memories/*.md are TRACKED in this repo (onboarding memories committed). Milestone memories should be committed to the working branch too (user preference).
