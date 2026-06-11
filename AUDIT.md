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

## Phase 3 — Backend architecture & testability (MEDIUM)

> **Status:** the contained, test-backed parts are **done** (commit `369a081`).
> The larger, binding-sensitive refactors (god-object decomposition,
> sanitize.go HTML-walker dedup) were moved to **Phase 6** at the end of the
> plan at the maintainer's request — to be done last, as their own increments.

### 3.4 Genericize `comfy/parser.go` param extractors — DONE
Removed 7 redundant pass-through `extract*Param` wrappers; the switch calls the
underlying `extractInt/Float/String/TextPrompt` helpers directly.

### 3.5 Smaller robustness fixes — DONE
- Crawler sentinel errors `ErrHTTPStatus`/`ErrEmptyResult` (classifiable via `errors.Is`).
- `comfy/generator.go` surfaces the image-persistence dir error instead of skipping silently.
- (Magic-number/timeout constants: several added in Phase 1; further centralization deferred.)

### 3.6 Extract character export — DONE
Moved SillyTavern card export out of `app.go` into
`internal/compose/export.go` (`ExportSillyTavernCard`) with tests; `app.go`
868 LOC (was 975). First safe increment of the god-object decomposition.

---

## Phase 4 — Frontend refactor & UX (MEDIUM, ~2 days)

### 4.1 Surface backend errors instead of swallowing them
Multiple `.catch(() => {})` (e.g. `EditorScreen.tsx:376`, `ProjectImageScreen.tsx`)
hide failures from the user. Add a small async helper that toasts + logs on
error; apply at all Wails call sites. **Highest-value frontend fix.**

### 4.2 Extract a shared `TagsInput` component — DONE
New `components/TagsInput.tsx` owns the add/remove/draft/dedup logic (commit on
Enter or comma, Backspace removes last, duplicates ignored). It's parametrized
for the two call sites' cosmetic differences — container/tag/accent class names,
an `emptyClassName`, `accentCount`, a `normalize` transform (editor lowercases),
`disabled` (locked) gating, and split empty/filled placeholders. `EditorScreen`'s
tag field now renders `<TagsInput>` directly; `LorebookScreen`'s `TokenInput`
became a thin wrapper so its call sites are untouched. 10 unit tests added.
(`StatsField` stays separate — it's a key/value grid, not a token field.)

### 4.3 Extract a `useImageGeneration` hook — DONE
`PortraitScreen` and `ProjectImageScreen` shared the whole ComfyUI generation
flow. Extracted:
- `utils/workflow.ts` — `mapWorkflows`, `parseSize`, `aspectFromSize` (pure,
  unit-tested).
- `components/useImageGeneration.ts` — owns sampler/scheduler/checkpoint/workflow
  loading (auto-selecting the first checkpoint), the selected workflow's
  template, the `comfy:progress`/`comfy:error` subscription, and `runGeneration`
  (build params → decode images → toast). Returns the generation state plus
  `stop`/`clearVariants`/`runGeneration`. Hook-level tests cover the success,
  template-not-ready, and failure paths.
Both screens shrank to view + screen-specific state; `ProjectImageScreen`'s
redundant `hasImage` flag folded into `variantImages.length > 0`, and the
verbose per-image `console.log` debug spam was removed (a 4.1 win).

### 4.4 Decompose monolith screens — DONE
- `SettingsScreen.tsx` (1164 → 1028 LOC):
  - [x] `components/LLMEndpointCard.tsx` extracted (one endpoint row + its
    overflow menu); the screen passes menu state/handlers down, keeping the
    outside-click detection in the parent. Unit-tested.
  - [x] `components/AuthTokenBlock.tsx` extracted — the "Use API key / auth
    token" toggle + reveal-able secret input, previously duplicated between the
    endpoint flyout and ComfyUI settings. Reveal state moved inside; value/toggle
    stay controlled. Unit-tested.
  - [x] `components/GenerationDefaultsForm.tsx` extracted — the temperature /
    max-tokens / system-prompt block (presentational; uncontrolled defaults for
    now). Smoke-tested.
- `EditorScreen.tsx` (was ~705 LOC):
  - [x] `components/useFieldEditor.ts` extracted — owns the per-field state
    machine (field map, sync-from-character preserving locked edits, derived
    dirty/locked/composing tallies) and the field mutators (`setFieldValue`,
    `patchField`, `patchAll`, `applyGenerated`, `markAllSaved`, `buildCharacter`,
    `lockedIds`). The field types/`FIELDS`/pure helpers moved into the module
    too. `CountTokens` is now **debounced (300 ms)** instead of firing ~10 calls
    per keystroke. Screen 705 → 521 LOC; the screen keeps character CRUD + LLM
    calls and talks to fields only through the hook. Hook unit-tested (10 tests)
    on top of the 33 existing EditorScreen tests.
  - [ ] (optional) further split the source/preview panes.

### 4.5 Tighten TypeScript at the edges — DONE
- `EditorScreen`: introduced `type FieldValue = string | string[] | StatKV[]`;
  `FieldState.value`, the `wordCount`/`wordCountLabel` helpers, `setFieldValue`,
  and the `FieldCard` `onChange` prop now use it instead of `any`. The render
  branches narrow with explicit `as` casts keyed by `field.type` (also dropped a
  stray `(_: any, j)` in the quote-remove handler).
- `SettingsScreen.set` and `LorebookScreen.set` are now generic
  `<K extends keyof T>(k: K, v: T[K])` instead of `(k, v: any)`.
- `PortraitScreen.activeState` params `any` → `unknown` (equality-only use).
- Left the `catch (e: any)` blocks as-is: narrowing to `unknown` is a separate,
  broader sweep and out of this item's scope.

### 4.6 Accessibility — DONE
- New shared `useFocusTrap(active, onEscape?)` hook (`components/useFocusTrap.ts`):
  initial focus (`[data-autofocus]` → first focusable → container), Tab/Shift+Tab
  cycling, optional Escape routing, focus restoration on close. Unit-tested.
- `ConfirmDialog.tsx`: `role="dialog"`/`aria-modal`/`aria-labelledby` moved onto
  the card, Confirm button autofocused, Escape closes via the trap.
- `WorkflowEditor.tsx` modal: focus trap applied (textarea autofocused); existing
  backdrop role/Escape/click-dismiss kept to preserve its test contract.
- Clickable `<span className="x">` remove controls → `<button>` (`EditorScreen`
  tags/stats/quotes); Settings endpoint flyout backdrop `<div>` → `<button>` with
  `aria-label`, and the flyout `<aside>` gained `role="dialog"`/`aria-modal`/label.
  CSS resets added so the buttons render identically.

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

## Phase 6 — Deferred large refactors (do last, incrementally)

Moved here intentionally: these are the highest-effort, highest-regression-risk
changes and unlock little that the rest of the plan depends on. Each should be
its own small increment with tests green at every step.

### 6.1 Decompose the `app.go` god object — DONE
`App` mixed Wails binding, app state, business logic, IO, and external
integration. Extracted three services (one increment each), with `App` methods
reduced to thin delegators / state-orchestrators so the **Wails binding surface
stayed byte-identical** (verified: no `frontend/wailsjs/` drift). app.go went
868 → 625 LOC.
- ~~**`ComfyUIService`**~~ Done (`comfy_service.go`): `comfyClient`, all
  `GetComfy*`, workflow-registry CRUD, test/generate. Holds a live
  `*settings.Settings` (App's field address is stable across `SaveSettings`)
  and a lazy ctx accessor. +9 tests.
- ~~**`CharacterGenerator`**~~ Done (`character_generator.go`): `GenerateBulk`,
  `GenerateField`, `GenerateImagePrompt`. Stateless — App keeps the mutex +
  character-store orchestration and passes crawl/endpoint/existing-char in.
  Consolidated the 3× duplicated `settings→llm` endpoint mapping into
  `toLLMEndpoint`. This is the LLM seam for 6.2. +4 tests.
- ~~**`ProjectManager`**~~ Done (`project_manager.go`): save/open bundle,
  crawl-cache resolution, character/lorebook export, path pickers. Stateless —
  App gathers a `ProjectSnapshot` under lock and applies the loaded bundle out.
  +6 tests.

Design note: the two state-entangled clusters (CharacterGenerator,
ProjectManager) were kept **stateless** rather than dragging App's mutex +
stores into them; App retains the lock/unlock orchestration. Only Comfy (which
touches just `settings.Comfy`) owns its slice of shared state via a live
pointer. This keeps locking discipline in one place and the services
unit-testable.

### 6.2 Introduce interfaces at network seams
Define `comfy.ComfyClient` and `llm.Completer` interfaces; inject them so
generation logic is unit-testable without real HTTP/WebSocket. Pairs with 6.1.

### 6.3 Extract duplicated helpers in `internal/crawler/sanitize.go` — DONE
- ~~A single `normalizeWhitespace` (4 near-duplicate implementations) — safe.~~
  On inspection the four normalizers (`cleanText`, `cleanParagraph`,
  `cleanInfoboxText`, plus the post-loops) are **not** interchangeable —
  they differ in newline handling (flatten vs. preserve vs. limit) and in
  whether spaces around newlines are trimmed. Merging them would be
  behavior-changing, so instead the genuinely-duplicated logic (the O(n²)
  space-collapse) was extracted into the shared `collapseInlineSpaces`
  primitive now used by all three call sites.
- ~~A generic `walkNodes(n, fn)` replacing ~5 inline recursive `walk`
  closures.~~ Done: one `walkNodes(n, fn func(*html.Node) bool)` (return
  false to skip children) replaces six closures across getTextContent,
  getInlineText, getParagraphText, ExtractInfobox, extractPortableInfobox,
  getPortableInfoboxValue and ExtractSections. `getListContent` keeps its
  depth-carrying walker. Crawler suite (94 tests) green, coverage 93.2%.
- ~~Replace the O(n²) `for strings.Contains(s,"  ")` space-collapse with a
  single-pass builder.~~ Done: `collapseInlineSpaces` +
  `limitConsecutiveNewlines`.

---

## Suggested execution order

1. **Phase 0** (hygiene) — minutes. ✅ done
2. **Phase 1 + Phase 2** — the security/correctness core. ✅ done
3. **Phase 5** — supply-chain/CI guards (incl. the x/net + vite vuln fixes). ✅ done
4. **Phase 3.4–3.6** — contained backend dedup/robustness + export extraction. ✅ done
5. **Phase 4** — frontend error surfacing, dedup, decomposition, a11y. ← next
6. **Phase 6** — god-object decomposition + sanitize dedup, last, incrementally.

Each change should land with tests and keep `go test ./... -race` and the
frontend suite green. Keep PRs small and single-purpose.
