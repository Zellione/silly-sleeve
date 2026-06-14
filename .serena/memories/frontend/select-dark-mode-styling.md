# Dropdowns: dark-mode + the custom `<Dropdown>` component

## Resolution (2026-06)
Native `<select>` option popups render white-on-dark and CANNOT be themed in
WebKitGTK — the popup is an internal widget that ignores `<option>` CSS,
`color-scheme`, AND the system GTK theme (confirmed: GTK theme was already dark
`Tokyonight-Dark`, webkit2gtk-4.1 2.52.4, popup still white).

**Fix shipped:** all native `<select>`s replaced by a custom DOM dropdown:
`frontend/src/components/Dropdown.tsx` (+ `Dropdown.test.tsx`). It renders a
`button[role=combobox]` trigger + `ul[role=listbox]`/`li[role=option]` list,
styled with theme tokens → themes correctly on every platform.

### Component API
`<Dropdown options={[{value,label,disabled?}]} value|defaultValue onChange={(v:string)=>}
 id className style disabled placeholder title aria-label data-source />`
- Controlled when `value` set, else uncontrolled from `defaultValue`.
- `className` → trigger button; `style` → wrapper (use for width).
- Variants via class on trigger: `as-mono` (mono font), `as-chip` (compact, honors
  `data-source="project"` accent). `.img-kv` context auto-applies mono + narrow.
- Keyboard: Arrow/Home/End/Enter/Space/Escape via `aria-activedescendant`.

### Converted call sites (8 files)
PerFieldDefaults, FieldEndpointChip, GenerationParamsPanel (workflow/sampler/
scheduler/aspect), ImageUploadPanel (crop/resize), ProjectImageScreen (checkpoint),
PortraitScreen (checkpoint/vae/lora/promptStyle), CrawlerScreen (follow),
SettingsScreen (auto-save mode). CSS lives at end of `style.css` under
`.ss-dropdown*`. `<label htmlFor>` kept pointing at the trigger `id` (button is a
labelable element → lint-clean + clickable).

### Testing notes
- Native-select test helpers DON'T work: replace `user.selectOptions(...)` and
  `select.value` assertions with: click `getByRole('combobox',{name})` then click
  `getByRole('option',{name})`; assert label via `toHaveTextContent`.
- Closed dropdown only renders the selected label — options exist only when open,
  so "lists all options" tests must open the dropdown first.

## SonarQube (PR #27, project key `Zellione_silly-sleeve`)
SonarCloud automatic analysis runs on push (no CI scan step wired yet). Findings on
the Dropdown were resolved (commit a37b8ab):
- Code-fixed: S3776 (flatten onKeyDown via moveActive/confirmActive/first/lastEnabled
  helpers), S7766 (Math.max), S4138 (Array.from/reduce, no index for-loops),
  S4325 (instanceof instead of `as Node`), S7735 ×2 (positive conditions).
- S6819 (combobox/listbox roles) ACCEPTED in Sonar with justification — native
  <select> is exactly what we replace; documented inline above the JSX. If a future
  scan re-opens them, accept again rather than "fixing" with a native control.
Use MCP `change_sonar_issue_status` (accept/falsepositive/reopen) for intentional
findings; re-query with `search_sonar_issues_in_projects` pullRequestId=27.

## Earlier styling convention (still true for the closed trigger)
Every control needs explicit `background: var(--panel-2)` + `color: var(--ink)`;
the global `select { color: inherit }` only sets text color.

## Tooling gotcha
`npm run lint` picks up a GLOBAL eslint 9.16.0 that lacks `no-unassigned-vars` and
crashes. Run the project's local v10 directly: `node_modules/.bin/eslint src
--max-warnings 0`. (Pre-existing; not caused by the dropdown work.)
