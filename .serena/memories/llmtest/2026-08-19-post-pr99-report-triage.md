# llmtest report triage — 2026-08-19 post-#99 run (gemma-4-e4b)

Report: `docs/llm-reports/2026-08-19-150746-google-gemma-4-e4b/` (gitignored). Ran 3 min after PR #99 merged; field-reroll + both image-prompt scenarios now clean, confirming #99's prompt fixes took effect. 35 findings remain across 5 scenarios.

## Necessary actions (agreed assessment, not yet implemented)

1. **bulk-generate hard-fails 3/3 runs (real bug, highest priority).** Model wraps `quotes`-array elements in backslash-escaped quotes *outside* string context: `..., \"'You look lost...'\", ...` → Go error `invalid character '\' looking for beginning of value`. Retry reproduces the same mistake; `internal/jsonrepair/repair.go` has no rule for it. Fix: extend the repairer state machine — a `\` outside a string at a value/key position followed by `"` → drop the backslash. Optional prompt rule: never backslash-escape string-delimiting quotes; use single quotes for nested speech.
2. **Brittle unmarshals lose whole runs (medium).** lore-optimize: model returns `"entryUid": "1"` but `internal/loreextract/connect.go:56` declares `EntryUID int` — add flexible-int unmarshal (accept quoted ints). lore-extract-summary: objects inside `characters` array vs `[]string` at `internal/loreextract/extract.go:80` — lower value, retry + repairer mostly covers it.
3. **Optional:** lore-extract-split noise dominated by "Only 1 keyword" normaliser corrections (6–15/run) despite prompt already saying "Keys: 2-5 per entry" (`internal/prompts/lore.go:115`). Model non-compliance, autofixed; leave and re-measure with a stronger model, or exclude from llmtest counting like #99's `IsCategoryMandated` approach.

## Harness gaps discovered

- llmtest never sets `Temperature`; `internal/llm/complete.go:59` uses `json:"temperature,omitempty"` so 0 is dropped and the server samples at its own default (~0.8 in LM Studio). All "[consistency] varied across runs" findings are largely sampling variance. Consider a `-temperature` flag if consistency findings should be actionable.
- Run didn't use `-force-json`; llama.cpp-backed JSON mode is grammar-constrained and would likely prevent finding #1 entirely — a comparison run is worthwhile.

## Diagnostic technique

`runs.jsonl` records full exchanges (system prompt, response per retry); extracting `exchanges[].response` with `repr()` around the failure point pinpoints exact invalid bytes the report.md preview truncates.
