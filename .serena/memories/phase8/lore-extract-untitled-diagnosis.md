# Diagnosis: lore extraction candidates all "Untitled" (2026-08-18, not yet fixed)

User's real local model run produced 8 candidates with correct keys/category/order but empty titles across the board.

## Root cause

The model did not emit the `"comment"` JSON field (or named it differently — `"title"`/`"name"` is typical local-model drift). Chain verified clean everywhere else:

- Prompt (`internal/prompts/lore.go`, `loreExtractSplitPrompt`) does show `"comment"` in its example — prompt is not the bug.
- `entryPayload` (`internal/loreextract/extract.go:62`) maps ONLY `json:"comment"`; unknown fields are silently dropped by `json.Unmarshal`.
- Normalizer (`internal/lorebook/normalize.go:254`) only trims Comment; the `RULE: ` prefix goes on Content, not Comment.
- `lorebook.Entry` tag `json:"comment"` + generated `models.ts` map correctly; UI fallback is `entry.comment || 'Untitled'` (`CandidateRow.tsx:63`, `LorebookScreen.tsx:544`).
- All-8-missing while other fields parse = systematic field-name drift, same class as the array-shape drift PR #88 tolerated (`parseExtraction` accepts `{"entries":[...]}` or bare array).
- Known blind spot: extraction prompts have never run against a real model — everything tested via canned `llm.Completer` responses.

## Agreed fix direction (awaiting user go-ahead)

1. Parse-time alias tolerance: accept `"title"`/`"name"` as fallback for comment in `entryPayload` decoding.
2. Normalizer fallback: empty comment → derive from Key[0], report an adjustment (empty comment also hurts SillyTavern, which uses it as the memo).
