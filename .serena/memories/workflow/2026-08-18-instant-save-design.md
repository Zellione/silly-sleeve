# Instant-save feature — PR #90 open, CI green (2026-08-18)

Branch `feature/instant-save`, PR https://github.com/Zellione/silly-sleeve/pull/90 — all 8 CI checks passed, awaiting merge. Commits: `b05c40a` (instant save + top-bar Save button), `b3e2d42` (editor infobox order), `d33fc49`/`429a947` (memory notes). APPROVAL_REQUEST.md was deleted before push per workflow.

## What shipped

1. `App.NewProject(name)` (`internal/app/app_library.go`) now returns `(string, error)`: resets state, then immediately writes a `.slv` bundle into `a.library.LibraryDir()` via `SaveProjectBundle` and returns the path. Helpers `sanitizeBundleName` (keeps unicode/CJK, strips `/\:*?"<>|` + control chars, `Untitled` fallback) and `nextBundlePath` (`-2`/`-3` uniquify, MkdirAll 0o700). Nil library → `("", nil)`, old in-memory behavior. NewProject must NOT hold `a.mu` when calling SaveProjectBundle (it locks internally).
2. `TopBar` (`frontend/src/components/Layout.tsx`) gained optional `onSave` prop → `.v2-savebtn` accent button rendered before `<ThemeToggle />`; CSS next to `.v2-iconbtn` rules in `style.css`. Button renders only when `onSave` given.
3. `App.tsx`: `handleNewProject` adopts returned path as `projectPath`; `handleSaveProject` saves with ok/bad toasts ("Project saved" / "Project not saved"), falls back to `PickSaveBundle` when path empty.
4. `EditorScreen.tsx` source panel: Infobox renders BEFORE SectionContent (`marginBottom: 16`), consistent with Crawler/Summaries.

## Reusable patterns learned

- Go app tests needing full wiring: `t.Setenv("XDG_CONFIG_HOME", t.TempDir())` + `NewApp()` + `a.startup(context.Background())` gives real library + project manager (see `TestSaveProjectBundle`).
- `wails generate module` regenerates `frontend/wailsjs/go/**` bindings after Go signature changes; this run caused NO go.mod churn (CLI v2.14.0 matches) and NO runtime file-mode flips — but always check `git status` after (see `mem:quirks/wails-cli-rewrites-gomod`, `mem:quirks/wailsjs-runtime-file-modes`).
- rtk hook substitutes broken global ESLint 9.16.0 for `npm run lint` — run `./node_modules/.bin/eslint` directly (see `mem:quirks/verifying-the-frontend-lint-gate`).
- DOM-order assertions in vitest: `a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING`.
- App.test.tsx mock pattern: module-level `const mockFn = vi.fn()` referenced lazily from the hoisted `vi.mock` factory; set default resolved values in `beforeEach` after `vi.clearAllMocks()`.
- The repo pre-push hook blocks `git push` until a serena memory write happened that session; just retry the push after writing (see `mem:quirks/pre-push-hook-aborts-compound-commands`).
- CI waiting: `until gh pr checks N --json name,bucket | jq -e 'length > 0 and all(.bucket != "pending")'; do sleep 20; done` via run_in_background works well.
