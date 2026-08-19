# Phase 10 — LLM Interaction Test Harness (planned 2026-08-19)

User request: a test script that runs all real LLM interactions against a live
endpoint, logging format + consistency errors for documentation and later prompt
improvement. Endpoint is a parameter, default `http://localhost:8001`.

Decisions (confirmed via AskUserQuestion, all recommended options accepted):

- **Form:** Go CLI `cmd/llmtest` (not a tagged test suite, not a shell script) so it
  reuses the production code paths — `internal/llm`, `internal/compose`,
  `internal/loreextract`, real `TemplateSet` defaults — and tests the exact shipped
  prompts and parsing.
- **Scope:** all 7 LLM surfaces — endpoint test (`llm.Test`), bulk character
  generation (`compose.Generate`), per-field reroll (`compose.GenerateField`), image
  prompt generation (natural + Danbooru), lore extraction (split + summary),
  connection suggestions (`loreextract.Connector`), optimize/rule-change suggestions.
- **Consistency:** each scenario runs N times, flag `-runs`, default 3; report
  compares format-validity rate, field-presence variance, entry/keyword-count
  variance.
- **Reporting:** timestamped folder `docs/llm-reports/<date-time>-<model>/` with
  `report.md` (findings, worst offenders first) + `runs.jsonl` (raw
  request/response). Folder is gitignored — local documentation only.

Other design points:

- CLI flags: `-endpoint` (default http://localhost:8001), `-model`, `-api-key`,
  `-runs`, `-only <scenario,...>`, `-out` (default docs/llm-reports/), `-timeout`.
- Format checks count `jsonloop` repair/retry firings — a repair that succeeds still
  logs a format finding; lore output also reports normaliser adjustment counts.
- New package `internal/llmtest` (scenario runner, result/finding models) with
  fixtures in `internal/llmtest/testdata/` (canned crawl text, character, lorebook
  entries).
- Harness gets unit tests against a mock completer to meet the 80% gate;
  real-endpoint execution is manual only, never in CI.

Substeps 10.1–10.6 are in ROADMAP.md (framework → character scenarios → lore/image
scenarios → consistency analysis → report writer → CLI + README section).

Status: planned only; implementation not started. Suggested branch when starting:
`feature/llmtest-harness`, first commit `chore(roadmap): start Phase 10` marking
10.1 as `- [~]`.
