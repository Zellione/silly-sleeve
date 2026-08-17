# SonarCloud findings follow-up on PR #83 (branch `fix/audit-findings`)

Two commits on top of the 7 already pushed: `54dffe2` (S9011/S6772/S3358) and
`c1b4118` (S6479). Cleared all 24 PR findings + the 5 pre-existing S6479.

Gate after: 878 Go tests `-race`; vitest **827 pass / 52 files** (was 809/50),
frontend **86.2%** statements; `tsc` + `eslint --max-warnings 0` clean;
`wails build -clean -tags webkit2_41` links (12.6 MB).

## Tooling traps (the expensive lessons)

### `npx eslint` runs the WRONG eslint on this box
`npx eslint src` picks up a **globally installed eslint 9.16.0** which dies on
this project's flat config:
`TypeError: Key "rules": Key "no-unassigned-vars": Could not find ... in plugin "@"`.
Always use **`./node_modules/.bin/eslint src --max-warnings 0`** from
`frontend/`. (`npm run lint` also failed here via the rtk wrapper.)

### `mcp__sonarqube__analyze_code_snippet` CANNOT verify JSX rules
Its `language` enum has `ts`/`js` but **no `tsx`**, so a file containing JSX
fails to parse and the tool returns `issueCount: 0` — indistinguishable from
"clean". Proven with a negative control: a snippet containing the ORIGINAL
`key={i}` / bare-text-before-`<small>` / nested-ternary patterns also returned
zero issues, while a plain-TS snippet correctly raised S108/S1854/S1862.
**Never treat a zero-issue result on JSX as verification.** Verify JSX rules by
pushing and reading the real PR analysis.

### ESLint here does NOT mirror the Sonar rules
`frontend/eslint.config.js` contains none of `react/no-array-index-key`,
`react/button-has-type`, `react/jsx-child-element-spacing`, `no-nested-ternary`.
A clean eslint run says nothing about S6479/S9011/S6772/S3358.

### Sonar excludes test files from these rules
24 `<button>` tags without `type` remain in `*.test.tsx` and are NOT findings
(`sonar.test.inclusions` covers them; the issue list has zero test-file hits).
Don't churn test files chasing the count.

## Scanning for S9011 needs a real parser, not a regex
JSX attributes contain `>` inside `{() => ...}`, so a naive
`<button[^>]*>` regex mis-slices tags. Use the brace/quote-aware scanner at
`scratchpad/scanbtn.py` (tracks `{}` depth and quote state to find the tag's
real closing `>`). 176 button tags in `frontend/src`.

## Why the findings clustered where they did
Every one of the 24 PR findings was in `frontend/src/components/settings/`.
The `type="button"` sweep during the audit remediation ran BEFORE
`SettingsScreen.tsx` was split into those four components, so the extracted
files never received it. **After any component extraction, re-run the sweeps
that were applied to the parent.**

## S6479 — how it was actually fixed

### `components/useRowIds.ts` (new)
Stable ids for editable rows with no id of their own (stat pairs, quote
strings). Ids live in **state**, not refs — that is what made this pass ESLint
where `useStableIds` failed:

- `resize(state, length)` grows/trims the id list, minting `row-N` ids.
- Render-time re-sync uses React's documented *"adjusting state when a prop
  changes"* pattern: compute `synced`, and `if (synced !== state) setState(synced)`
  during render. React re-runs the component before committing, so rows never
  paint with a missing key. **No refs, no effect, no eslint error.**
- Returns `rows: {item, key, index}[]` so the key site is `key={key}` and the
  array index never appears in a key expression.
- `removeRow(i)` / `addRow()` are called ALONGSIDE the parent's `onChange` in
  the same handler (both setStates batch). Appends from OUTSIDE the component
  (the "Add quote" button lives in `FieldInput`, not `QuoteRows`) need no call —
  the length change makes `resize` mint an id at the end, which is correct.

Real benefit beyond the rule: deleting a middle row used to re-key every row
below it, so React reused the wrong DOM nodes and the focused input jumped.
`useRowIds.test.tsx` asserts the surviving row keeps its **same DOM node**.

### `components/Infobox.tsx` (new)
The infobox block was duplicated in `CrawlerScreen` and `EditorScreen`. Now one
component. Keys derive from the entry's own `section`/`key` with a running
occurrence counter (wikis DO repeat a label inside one section, so a plain
content key would collide). Multi-line values render as plain text with
`white-space: pre-wrap` on `.infobox dd` (both scoped copies in `style.css`)
instead of being split into `<br>`-joined fragments — that deleted the second
index-keyed list outright rather than re-keying it.

## Other fixes
- **S6772** (`EndpointFlyout`): `"Authentication"` was a bare text node before
  `<small>`. Wrapped in `<span>` — matching the `<label><span>X</span><small>`
  shape used everywhere else in that file, which Sonar did NOT flag.
- **S3358** (`EndpointFlyout`): context-preset label nested ternary extracted as
  `formatContextPreset(n)`.
- **S9011 × 25**: re-verified the app still has **no `<form>` elements**, so no
  button was an implicit submit.
- Exporting a helper from a component file trips
  `react-refresh/only-export-components` (warning, and lint runs at
  `--max-warnings 0`). Kept `keyInfoboxRows` module-private and tested it
  through the component.

## Already fixed earlier — do not re-fix
These appear in the PROJECT-WIDE (main-branch, pre-PR) issue list but are
already gone in the working tree: `go:S3776` × 4 (compose/generate.go,
crawler/sanitize.go), `godre:S8205` (crawler/fetch.go anon struct),
`typescript:S7761` (Layout.tsx setAttribute), `css:S4666` (.lb-entry dup),
`typescript:S3358` in App.tsx and EditorScreen. **The project-wide list is stale
until the PR merges — always diff it against the working tree before acting.**

## Status
**MERGED** 2026-08-14 as `1018838` (PR #83, 83 files +5200/-1436). Main quality
gate OK. Branch `fix/audit-findings` can be deleted.

### S6479 verdict still OPEN at merge time
SonarCloud's main-branch issue list was still the PRE-merge snapshot minutes
after the merge — it listed S6479 at `EditorScreen.tsx:33/97/536` and
`CrawlerScreen.tsx:269/274` with creationDates from May, plus S9011 findings on
buttons that the audit remediation had ALREADY fixed. There is no Sonar scan
step in CI (see the note in `sonar-project.properties`); this project relies on
SonarCloud **Automatic Analysis**, which lags a push.
**So: re-check the main-branch issues later before concluding whether
`key={key}` (destructured from useRowIds) satisfies S6479.** If it does not, the
fallback is marking the rule accepted — the underlying focus/DOM-reuse bug in
the stat and quote rows is fixed regardless of what Sonar decides.
