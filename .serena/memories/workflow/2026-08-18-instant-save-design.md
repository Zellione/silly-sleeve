# Instant-save feature — IMPLEMENTED (2026-08-18)

Branch `feature/instant-save`, commits `b05c40a` (instant save + top-bar Save button), `b3e2d42` (editor infobox order), `d33fc49` (this memory). Status: **awaiting user approval of APPROVAL_REQUEST.md before push/PR** (file exists locally in repo root, must be deleted before pushing, never committed).

## What shipped

1. `App.NewProject(name)` (`internal/app/app_library.go`) now returns `(string, error)`: resets state, then immediately writes a `.slv` bundle into `a.library.LibraryDir()` via `SaveProjectBundle` and returns the path. Helpers `sanitizeBundleName` (keeps unicode/CJK, strips `/\:*?"<>|` + control chars, `Untitled` fallback) and `nextBundlePath` (`-2`/`-3` uniquify, MkdirAll 0o700). Nil library → `("", nil)`, old in-memory behavior. NewProject must NOT hold `a.mu` when calling SaveProjectBundle (it locks internally).
2. `TopBar` (`frontend/src/components/Layout.tsx`) gained optional `onSave` prop → `.v2-savebtn` accent button rendered before `<ThemeToggle />`; CSS added next to `.v2-iconbtn` rules in `style.css`. Button only renders when `onSave` given (keeps old tests valid).
3. `App.tsx`: `handleNewProject` adopts returned path as `projectPath`; `handleSaveProject` saves to `projectPath` with ok/bad toasts ("Project saved" / "Project not saved"), falls back to `PickSaveBundle` when path empty. `useToast` works in `AppShell` (inside ToastProvider).
4. `EditorScreen.tsx` source panel: Infobox now renders BEFORE SectionContent (`marginBottom: 16` instead of `marginTop`), consistent with Crawler/Summaries.

## Verified gates (all green)

go vet, golangci-lint, `go test ./... -race` (907), local `./node_modules/.bin/eslint src --max-warnings 0`, `tsc --noEmit`, vitest coverage 868 tests / 87.06% statements, `wails build -clean -tags webkit2_41`.

## Reusable patterns learned

- Go app tests needing full wiring: `t.Setenv("XDG_CONFIG_HOME", t.TempDir())` + `NewApp()` + `a.startup(context.Background())` gives real library + project manager (see `TestSaveProjectBundle`).
- `wails generate module` regenerates `frontend/wailsjs/go/**` bindings after Go signature changes; this run caused NO go.mod churn (CLI v2.14.0 matches) and NO runtime file-mode flips — but always check `git status` after (see `mem:quirks/wails-cli-rewrites-gomod`, `mem:quirks/wailsjs-runtime-file-modes`).
- rtk hook still substitutes broken global ESLint 9.16.0 for `npm run lint` — run `./node_modules/.bin/eslint` directly (see `mem:quirks/verifying-the-frontend-lint-gate`).
- DOM-order assertions in vitest: `a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING`.
- App.test.tsx mock pattern: module-level `const mockFn = vi.fn()` referenced lazily from the hoisted `vi.mock` factory (`NewProject: (n) => mockNewProject(n)`); set default resolved values in `beforeEach` after `vi.clearAllMocks()`.
