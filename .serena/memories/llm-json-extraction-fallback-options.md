# LLM JSON robustness — shipped (2026-08-18)

Feature complete: PR #92 (https://github.com/Zellione/silly-sleeve/pull/92), branch `feature/json-robustness`, all 8 CI checks green (build, test-go, test-frontend, lint-go, lint-frontend, vuln-go, SonarCloud, path detection). Awaiting merge by user.

## What exists now
- `internal/jsonrepair` — `Clean(s)` (fence/prose stripping, shared by loreextract + compose) and `Repair(s)` (state-machine scanner: control chars in strings, trailing commas, single-quoted strings, Python True/False/None, comments, truncation closing). Hand-rolled; package doc names `github.com/kaptinlin/jsonrepair` as future library option.
- Layer 1: `ForceJSON bool` on `settings.LLMEndpoint` + `llm.LLMEndpoint` (json tag `forceJson,omitempty`); sends `response_format: {"type":"json_object"}` in `Complete` and `TestEndpoint` (Test button = backend-support probe). Off by default. UI: "Force JSON output" switch in EndpointFlyout.
- Layer 2: `llm.CompleteJSON[T]` in `internal/llm/jsonloop.go` — parse → Repair(Clean()) → one retry embedding failed reply + parse error in user prompt (Completer interface untouched). Returns `(T, []string notes, error)`; notes surfaced as candidate Adjustments in loreextract only.
- All 4 call sites wired: loreextract Extract, connect batches, compose GenerateBulk, GenerateField (text-field raw fallback = success → never retries).
- `flexInt` tolerates `"order": "300"` string numbers; `TestLLMEndpoint` reuses `toLLMEndpoint` (old copy dropped TimeoutSeconds); `AuthTokenBlock` switch has `aria-label={toggleLabel}`.

## Patterns / gotchas
- Project workflow: feature branch → TDD → full gate (`go vet`, `golangci-lint`, `go test -race -cover`, frontend lint+coverage, `wails build -clean -tags webkit2_41` on Arch) → APPROVAL_REQUEST.md (never committed) → user approval → delete it → push → `gh pr create` → verify CI green before merge.
- Wails bindings regenerate with `~/go/bin/wails generate module` after Go struct changes.
- Retry semantics shift scripted-fake response indices: an "unparseable batch" fixture needs TWO garbage replies.
- loreextract has `scriptedCompleter` (connect_test.go, repeats last response) and `fakeCompleter` (extract_test.go, callCount); compose now has its own `scriptedCompleter`.
- `.serena/memories/` is NOT gitignored in this repo — keep out of `git add` (candidate for .gitignore).
- CI monitoring pattern: Monitor tool with gh pr checks poll loop (30s), emit non-pending deltas, exit when all terminal.
