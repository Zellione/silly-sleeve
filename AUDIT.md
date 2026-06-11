# Quality Audit & Improvement Plan

Branch: `audit/quality-improvements`
Date: 2026-06-11
Scope: Go backend (~10.5k LOC), React/TS frontend (~9.7k LOC), tooling/CI.

This plan is ordered by **risk × leverage / cost**. Each phase is independently
shippable. Severity ratings are calibrated for the app's threat model: a
**local-first desktop app** where the user configures their own endpoints, but
which **ingests untrusted data** from fandom wikis (crawler) and LLM/ComfyUI
servers, and opens `.slv` bundles that may come from third parties.

---

## Phase 0 — Repo hygiene (do first, ~15 min)

| # | Item | File | Action |
|---|------|------|--------|
| 0.1 | Uncommitted `package-lock.json` | `frontend/package-lock.json` | Decide: commit the regenerated lockfile or `git checkout` it. Reproducible builds depend on it. |
| 0.2 | Stale local `replace` directive | `go.mod:46` | Delete the commented `// replace github.com/wailsapp/wails/v2 ... => /home/zellione/...` line. Local-dev cruft, leaks a username. |
| 0.3 | `CLAUDE.md` untracked | repo root | Decide whether to track or gitignore it. |

---

## Phase 1 — Security: untrusted-input hardening (HIGH, ~½ day)

These are the findings that actually matter given the threat model. All are small, well-bounded changes.

### 1.1 File permissions for secrets & user data — `0o644` → `0o600`
Secrets (LLM API keys, ComfyUI auth tokens) and project data are written
world-readable. On multi-user machines any local user can read them.
- `internal/settings/settings.go:90` (contains API keys/tokens) — **highest priority**
- `internal/crawler/cache.go:32`
- `internal/project/project.go:54`, `:68`
- `internal/comfy/generator.go:245`

**Fix:** change mode to `0o600`. Add a regression test asserting `FileMode()&0o077 == 0`.

### 1.2 Bound all reads from untrusted servers (DoS / memory exhaustion)
A malicious or buggy ComfyUI/LLM server, or a crafted `.slv`, can return
gigabytes and OOM the app.
- `internal/comfy/client.go:188` (image download) — wrap with `io.LimitReader` (e.g. 100 MB).
- `internal/comfy/client.go:136,163,185` (error/JSON bodies) — bound to a few MB.
- `internal/comfy/websocket.go` — call `conn.SetReadLimit(maxMessageSize)` right after dial; bound the binary-image path.
- LLM response decode in `internal/llm/complete.go` — bound the body.

**Fix:** introduce a shared `maxResponseBytes` constant; wrap each read.

### 1.3 `.slv` bundle: zip-slip + decompression-bomb protection
`internal/bundle/bundle.go` reads zip entries directly.
- **Zip-slip:** validate every entry path: `clean := filepath.Clean(name)` and reject if it contains `..` or is absolute, before using it. Current prefix/`filepath.Base` checks are not equivalent to a containment check.
- **Zip-bomb:** wrap each entry reader (`:239`, `:252`) with `io.LimitReader` and cap total uncompressed size across the archive.

### 1.4 Crawler SSRF: validate redirects and target hosts
`internal/crawler/fetch.go:51` uses a default client that follows up to 10
redirects anywhere. A hostile wiki can redirect to `169.254.169.254`,
`127.0.0.1`, or RFC-1918 ranges.

**Fix:** custom `http.Client.CheckRedirect` that (a) caps redirect count and
(b) blocks redirects to a different host and to private/loopback/link-local IPs.
Consider applying the same private-IP guard to the initial URL.

### 1.5 Endpoint URL scheme allow-list
LLM and ComfyUI base URLs are user-supplied and unvalidated (`file://`,
`gopher://` etc. accepted). Validate scheme ∈ {http, https} at save/connect
time (`internal/llm/*`, `internal/comfy/client.go`, settings save path in `app.go`).
Surface a clear error in the UI rather than silently proceeding.

### 1.6 Sanitizer hardening (defense-in-depth, LOW for now)
`internal/crawler/sanitize.go` strips `<script>/<style>` but not `on*` event
handler attributes or `javascript:`/`data:` URLs. **Not currently exploitable**
— the frontend renders crawled text as plain text (no `dangerouslySetInnerHTML`,
verified). Keep this in mind: if rich rendering is ever added, the sanitizer
must strip event handlers and dangerous URL schemes first. Track, don't rush.

---

## Phase 2 — Concurrency & correctness (HIGH, ~½ day)

### 2.1 WebSocket data race / nil-deref — `internal/comfy/websocket.go`
`listen()` reads `l.conn` after releasing the lock; a concurrent `Close()` can
set it nil → panic on `ReadMessage()`.
**Fix:** snapshot `conn` under lock inside the loop (or use `atomic.Pointer`), and exit cleanly when `running` is false.

### 2.2 Goroutine cancellation — `internal/comfy/websocket.go`
`go l.listen()` can't be stopped if blocked on `ReadMessage`. Add a
`context.WithCancel`; `Close()` cancels it and closes the conn.

### 2.3 `done` channel double-close — `internal/comfy/generator.go`
Multiple `OnCompleted`/`OnError` paths guard `close(g.done)` ad-hoc. Replace
with a single `sync.Once`-backed `markDone(err)`.

### 2.4 Context propagation through generation/LLM calls
`compose.GenerateBulk/GenerateField`, `llm.Complete`, and `comfy.Generator.Run`
ignore `context.Context`, so user-cancelled / navigated-away operations keep
running. Thread `ctx` from `app.go` (it already holds `a.ctx`) through these
functions and into `http.NewRequestWithContext`.

### 2.5 Frontend auto-save race — `frontend/src/components/useAutoSave.ts`
The `onChange` debounce can fire after unmount or after the project path
changed (saves stale path / no error surfaced). Add cleanup to clear the timer
on unmount, await the save, and catch+report errors.

---

## Phase 3 — Backend architecture & testability (MEDIUM, ~2–3 days)

### 3.1 Decompose the `app.go` god object (975 LOC) — highest-leverage refactor
`App` mixes Wails binding, app state, business logic, IO, and external
integration. Extract services (each behind an interface for testing):
- **`ComfyUIService`** — `comfyClient()`, all `GetComfy*`, test/generate.
- **`CharacterGenerator`** — `GenerateCharacterBulk`, `GenerateField`, `GenerateImagePrompt`.
- **`ProjectManager`** — save/open bundle, export character/lorebook, path pickers.
`App` shrinks to thin Wails bindings delegating to services. Do this
incrementally, one service at a time, keeping tests green.

### 3.2 Introduce interfaces at network seams
Define `comfy.ComfyClient` and `llm.Completer` interfaces; inject them so
generation logic is unit-testable without real HTTP/WebSocket. Enables the
currently-missing `websocket_test.go` and pure-logic tests for `GenerateBulk`.

### 3.3 Extract duplicated helpers in `internal/crawler/sanitize.go` (592 LOC)
- A single `normalizeWhitespace` (4 near-duplicate implementations).
- A generic `walkNodes(n, fn)` replacing ~5 inline recursive `walk` closures.
- Replace the O(n²) `for strings.Contains(s,"  ")` space-collapse with a single-pass builder.

### 3.4 Genericize `comfy/parser.go` param extractors
Collapse the 6 near-identical `extract*Param` funcs into
`extractIntParamNamed`/`extractStringParamNamed`.

### 3.5 Smaller robustness fixes
- Wrap errors with `%w` consistently (`crawler/fetch.go:66,81`).
- Don't silently skip image persistence on dir-create failure (`comfy/generator.go:198–209`).
- Centralize hardcoded timeouts/limits/retry constants in one config file.

---

## Phase 4 — Frontend refactor & UX (MEDIUM, ~2 days)

### 4.1 Surface backend errors instead of swallowing them
Multiple `.catch(() => {})` (e.g. `EditorScreen.tsx:376`, `ProjectImageScreen.tsx`)
hide failures from the user. Add a small async helper that toasts + logs on
error; apply at all Wails call sites. **Highest-value frontend fix.**

### 4.2 Extract a shared `TagsInput` component
`TagsField`/`StatsField` (`EditorScreen.tsx`) and `TokenInput`
(`LorebookScreen.tsx`) duplicate add/remove/draft logic. Extract one component.

### 4.3 Extract a `useImageGeneration` hook
`PortraitScreen.tsx` and `ProjectImageScreen.tsx` share ~80 LOC of generation +
workflow-mapping logic. Pull into a hook + `utils/workflow.ts`.

### 4.4 Decompose monolith screens
- `SettingsScreen.tsx` (1164 LOC): extract `LLMEndpointCard`, `GenerationDefaultsForm`, reusable auth-token block.
- `EditorScreen.tsx` (705 LOC): extract a `useFieldEditor` hook to stop prop-drilling field state; debounce backend `CountTokens`.

### 4.5 Tighten TypeScript at the edges
Replace `v: any` setters with generic `<K extends keyof T>(k: K, v: T[K])`;
type `FieldState.value` as a union instead of `any`.

### 4.6 Accessibility
- `ConfirmDialog.tsx`: move `role="dialog"`/`aria-modal` onto the card, add `aria-labelledby`, autofocus the confirm button.
- `WorkflowEditor.tsx` modal: add a focus trap.
- Convert clickable `div`/`span` (`onClick`) to `<button>` (e.g. flyout backdrop, tag remove span).

---

## Phase 5 — Tooling, CI & supply chain (MEDIUM, ~½ day)

| # | Item | Action |
|---|------|--------|
| 5.1 | esbuild/vite advisory | `npm audit` flags esbuild (dev-server CORS bypass) via old vite. Update vite/@vitejs/plugin-react; re-run audit. Dev-only impact but fix it. |
| 5.2 | `.golangci.yml` | Add explicit config (errcheck, govet, staticcheck, gosec, bodyclose, unused…) and **pin the action version** instead of `latest`. |
| 5.3 | `govulncheck` in CI | Add `govulncheck ./...` job for Go CVEs. |
| 5.4 | `npm audit` in CI | Add `npm audit --audit-level=high` to the frontend job. |
| 5.5 | Multi-OS build matrix | CI builds only on `ubuntu-latest`; add `macos-latest` + `windows-latest` build verification for this cross-platform desktop app. |
| 5.6 | Pin GitHub Actions to SHAs | `actions/*`, `golangci-lint-action` use floating tags; pin to commit SHAs. |
| 5.7 | `sonar-project.properties` | Either complete it (projectKey/sources/tests/coverage paths + CI scan step) or remove it. |
| 5.8 | TypeScript 4.x → 5.x | Old (2022); upgrade and verify under strict mode. |

CI currently runs vet + golangci-lint + `go test -race` + frontend lint/test +
build, with ~88% Go coverage and `tsc --noEmit` in the lint script — a solid
baseline. The above are gaps, not rewrites.

---

## Suggested execution order

1. **Phase 0** (hygiene) — minutes.
2. **Phase 1.1–1.5 + Phase 2** — the security/correctness core. One PR per logical group, each with a regression test.
3. **Phase 5.1–5.4** — supply-chain/CI guards, cheap and high-value.
4. **Phase 3.1–3.2** — god-object decomposition (unlocks everything else; do incrementally).
5. **Phase 4.1–4.3** — error surfacing + dedup (user-visible wins).
6. Remaining Phase 3/4/5 polish as capacity allows.

Each change should land with tests and keep `go test ./... -race` and the
frontend suite green. Keep PRs small and single-purpose.
