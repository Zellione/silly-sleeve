# Lore extraction "Untitled" candidates — FIXED (2026-08-18)

Fixed in `5221d8b` on `fix/dashboard-accent-colors` (TDD; gate green: vet, golangci-lint, `go test -race` 912 pass).

## Root cause

Real local models emit the entry title as `"title"`/`"name"` instead of the `"comment"` field the prompt requests; `entryPayload` only mapped `"comment"`, `json.Unmarshal` silently dropped the alias, and the UI fell back to `entry.comment || 'Untitled'`. Same drift class as the entries-object-vs-bare-array tolerance from PR #88. Extraction prompts have never run against a real model — canned-response tests can't catch shape drift.

## Fix (two layers)

1. `internal/loreextract/extract.go`: `entryPayload` gained `Title`/`Name` alias fields; `buildCandidates` uses `firstNonEmpty(Comment, Title, Name)`.
2. `internal/lorebook/normalize.go` (`normalizeContent`): empty comment + keys present → comment = Key[0], adjustment "No title from the model — used the first key as the title." (SillyTavern uses comment as the memo, so empty hurts export too.)

Tests in `normalize_comment_test.go` / `extract_comment_test.go` cover aliases, precedence (comment wins), key-derived fallback, and no-keys pass-through.

## Pattern

When a local model ignores the prompt's JSON shape, add tolerance in the PARSER (aliases, shape variants) plus a reported fallback in the NORMALIZER — never rely on prompt wording, and never repair silently (adjustments surface in the review UI).
