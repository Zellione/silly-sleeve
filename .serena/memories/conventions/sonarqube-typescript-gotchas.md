# SonarQube findings this repo reliably produces (and how to avoid them)

SonarCloud project key: **`Zellione_silly-sleeve`**. Findings are reported per PR
and can be fetched with the sonarqube MCP tools (`pullRequestId`), even when the
quality gate itself passes — **a green gate does not mean zero findings**. Always
check after opening a PR.

## TypeScript / React

- **`typescript:S9011` — explicit `type` on every `<button>`.** Without it a
  button defaults to `submit`. Every `<button>` in this codebase needs
  `type="button"` unless it really submits a form. This is the single most
  common finding here; add it as you write, not afterwards.
- **`typescript:S3358` — no nested ternaries.** Extract to a named helper
  function with early returns. Reads better regardless.
- **`typescript:S4624` — no nested template literals.** Usually appears together
  with S3358 in a label builder; the same extraction fixes both.
- **`typescript:S6819` — no `role="button"` on a `<span>`/`<div>`.** Use a real
  `<button>`. If you reached for `role="button"` because buttons cannot nest,
  the fix is to restructure: a wrapper `<div>` holding **sibling** buttons, not
  one inside the other. Bonus — siblings need no `stopPropagation`.
  See `StagedSourcePanel.tsx` (row = wrapper div + `.lore-source-pick` button +
  `.lore-source-remove` button).
- **`typescript:S6772` — ambiguous JSX whitespace.** A newline+indent between
  text and an inline element (`Content\n  <small>…`) is ambiguous. Keep them on
  one line: `<span>Content<small>…</small></span>`.

## Also: eslint `jsx-a11y/label-has-associated-control`

Not Sonar, but the same class of problem and it **fails CI**. Never wrap a
composite component in `<label>` — `Dropdown` (button owning a listbox) and
`TagsInput` (tag editor) are not native form controls. Use
`<div className="…-field"><span>Label</span><Dropdown aria-label="…"/></div>`.
`<label>` is fine around a bare `<input>`/`<textarea>`/`<select>`.
Watch for a stray `htmlFor` pointing at an id that does not exist.

## Go

- **`go:S3776` — cognitive complexity ≤ 15.** A `switch` whose every case has
  nested `if`s blows past it fast. Split one function per case. This bit
  `sendCrawlResult` in Phase 6.3 and `buildSuggestion` in Phase 8 — same shape
  both times.
- **`go:S1192` — no string literal repeated 3+ times.** Name it a constant.

## Verify BEFORE pushing

`mem:quirks/verifying-the-frontend-lint-gate` — the rtk hook silently substitutes
a broken global eslint, and `$?` after a pipe measures the pipe's last command.
Use `./node_modules/.bin/eslint src --max-warnings 0` and read the exit code
directly.
