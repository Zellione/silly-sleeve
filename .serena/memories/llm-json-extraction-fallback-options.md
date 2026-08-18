# LLM JSON robustness — designed AND implemented (2026-08-18)

User approved layers 1+2; implemented on branch `feature/json-robustness` (4 commits, unpushed, awaiting user approval via APPROVAL_REQUEST.md — workflow gate step 4).

## What exists now
- `internal/jsonrepair` — `Clean(s)` (fence/prose stripping, shared by loreextract + compose; replaced their duplicate cleaners) and `Repair(s)` (state-machine scanner: control chars in strings, trailing commas, single-quoted strings, Python True/False/None, // and /* */ comments, truncation closing). Hand-rolled; package doc names `github.com/kaptinlin/jsonrepair` as the future library option if scope grows.
- Layer 1: `ForceJSON bool` on `settings.LLMEndpoint` + `llm.LLMEndpoint` (json tag `forceJson,omitempty`); sends `response_format: {"type":"json_object"}` in `Complete` and `TestEndpoint` (Test button = backend-support probe). Off by default. UI: "Force JSON output" switch in EndpointFlyout.
- Layer 2: `llm.CompleteJSON[T]` in `internal/llm/jsonloop.go` — parse → Repair(Clean()) → one retry embedding the failed reply + parse error in the user prompt (kept Completer interface untouched). Returns `(T, []string notes, error)`; notes surfaced as candidate Adjustments in loreextract only.
- All 4 call sites wired: loreextract Extract, loreextract connect batches, compose GenerateBulk, compose GenerateField (text-field raw fallback counts as success → never retries).
- `flexInt` in extract.go tolerates `"order": "300"` string numbers.
- `TestLLMEndpoint` in app.go now reuses `toLLMEndpoint` (previously hand-copied and silently dropped TimeoutSeconds).
- `AuthTokenBlock` switch gained `aria-label={toggleLabel}` (flyout now has two switches).

## Patterns / gotchas learned
- Project workflow: feature branch → TDD per unit → full gate (`go vet`, `golangci-lint`, `go test -race -cover`, frontend lint+coverage, `wails build -clean -tags webkit2_41` on Arch) → APPROVAL_REQUEST.md (never committed) → wait for user approval → delete it → push + PR.
- Wails bindings regenerate with `~/go/bin/wails generate module` after Go struct changes (frontend/wailsjs/go/models.ts).
- loreextract/connect tests use `scriptedCompleter` (repeats last response when exhausted); extract tests use `fakeCompleter` with callCount. Retry semantics shift scripted-response indices — an "unparseable batch" fixture needs TWO garbage replies now.
- Coverage after change: jsonrepair 97.1%, llm 91.4%, loreextract 98.9%, compose 94.3%; frontend 87% statements, 881 tests.
- `.serena/memories/` is NOT gitignored in this repo — keep it out of `git add`.
