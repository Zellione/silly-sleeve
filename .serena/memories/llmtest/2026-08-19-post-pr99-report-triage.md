# llmtest report triage — 2026-08-19 post-#99 run (gemma-4-e4b)

Report: `docs/llm-reports/2026-08-19-150746-google-gemma-4-e4b/` (gitignored). Ran 3 min after PR #99 merged; field-reroll + both image-prompt scenarios clean, confirming #99 took effect. 35 findings remained; actions 1 and 2 below are IMPLEMENTED and shipped as **PR #100** (branch `fix/llmtest-report-followups`, CI all 8 checks green; unmerged as of session end).

## Implemented (TDD, all gates green)

1. **jsonrepair (a536f2d):** model wrapped `quotes`-array elements in `\"…\"` — backslash-escaped delimiters outside string context — hard-failing bulk-generate 3/3 runs incl. retry. `Repair` now treats `\"` at a value/key position as an over-escaped opener (backslash outside a string is never valid JSON, so valid input can't be affected), closes on the matching `\"`, escapes bare inner `"`, closes on truncation. Verified against the real failing response from `runs.jsonl`.
2. **loreextract (635a836):** `"entryUid":"1"` killed a lore-optimize batch. `suggestionPayload` gained `UnmarshalJSON` using the **existing** `flexInt` (extract.go:87 — it already existed for entryPayload.Order; check before adding one) via the alias-struct + shadowed-flexInt-fields pattern, so all use sites keep plain `int`. Covers entryUid/targetUid/charId/targetCharId/proposed{Order,Position,Depth}.
3. **prompts (8f31819):** default system prompt rule 4 extended — never backslash the quotes that open/close a string; single quotes for quoted speech inside values. Tested via `assert.Contains` like #99's precedent.

## Still deferred (candidates for a follow-up after re-running llmtest post-#100)

- Extraction `characters` array element arriving as object (vs `[]string`, extract.go:80) — low value.
- lore-extract-split "Only 1 keyword" normaliser noise (prompt already says "Keys: 2-5", lore.go:115) — re-measure with stronger model first.
- llmtest `-temperature` flag: harness never sets Temperature and `omitempty` drops 0 (complete.go:59), so server default (~0.8) makes "[consistency]" findings mostly sampling variance.
- `-force-json` comparison run (grammar-constrained JSON mode would likely prevent finding 1 entirely).

## Machine/process notes

- `wails build -clean` fails on this Arch box (webkit2gtk-4.1 only); always add `-tags webkit2_41`.
- `runs.jsonl` records full exchanges; extracting `exchanges[].response` with `repr()` pinpoints exact invalid bytes the report.md preview truncates. Real failing responses make excellent scratch verification fixtures (temporary test file, then delete).
