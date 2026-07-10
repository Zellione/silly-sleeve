# Silly Sleeve Roadmap

> Last updated: 2026-07-10 — Phase 5 · 7.4 Preview screen chat greeting bubble complete.

## Overview

This document tracks the implementation plan for Silly Sleeve, a desktop app for creating SillyTavern character cards and lore books from wiki sources. The plan is split into milestones and phases.

## Tech Stack (Approved)

| Layer | Technology |
|---|---|
| Frontend | React 18 + Vite + TypeScript |
| Desktop bridge | Wails v2 |
| Backend | Go 1.22+ |
| Config / project storage | `os.UserConfigDir()` for settings; `.slv` bundles (zip) for projects |

## Design Reference

All screens, data models, and interaction patterns are defined in `design_handoff/`. The handoff is treated as a **functional and visual reference** — the React components and CSS custom properties port almost directly into the Wails frontend.

---

## Phase 0 — Bootstrap & Skeleton (MVP Milestone 1)

Goal: A runnable desktop shell with routing, theme, and settings UI.

- [x] **0.1** Bootstrap Wails v2 project (`wails init -n silly-sleeve -t react-ts`)
- [x] **0.2** Port design tokens (`styles.css`) into frontend global styles
- [x] **0.3** Port root layout: TitleBar, Sidebar nav, PageHead, StatusBar primitives
- [x] **0.4** Implement route state: `dashboard`, `crawler`, `editor`, `lorebook`, `projectImage`, `image`, `preview`, `export`, `settings`
- [x] **0.5** Theme toggle: light/dark mode (no accent picker yet)
- [x] **0.6** Toast system (bottom-right stack, auto-dismiss)
- [x] **0.7** Settings screen: single LLM endpoint editor flyout (name, URL, model, API key, Test button)
- [x] **0.8** Go bindings: `GetSettings`, `SaveSettings`, `TestLLMEndpoint`
- [x] **0.9** Persist settings to config dir as JSON

---

## Phase 1 — Crawl & Compose (MVP Milestones 2–4)

Goal: Paste a wiki URL, generate a character via bulk prompt, edit fields, save project.

### Milestone 2 — Crawler

- [x] **1.1** Crawler screen: URL input, crawl options, "Crawl page" button
- [x] **1.2** Go backend: Fandom/MediaWiki `action=parse` fetcher
- [x] **1.3** HTML sanitization: strip nav, refs, TOC, empty headings, galleries
- [x] **1.4** Crawl preview panel: headings, infobox key/value table, word count
- [x] **1.5** Session caching: raw crawl persisted to disk, survives app restart

### Milestone 3 — Compose (Bulk Only)

- [x] **2.1** Editor screen: 10 field cards (line, text, tags, quotes, stats input types)
- [x] **2.2** Bulk generation: send bulk prompt to LLM, parse JSON response into all fields
- [x] **2.3** Character strip: add/switch/delete characters in the current project
- [x] **2.4** Manual field editing with dirty flag tracking
- [x] **2.5** Word/token count per field

### Milestone 4 — Save & Export

- [x] **3.1** "Save project" dialog: write manifest + per-character JSON to a folder
- [x] **3.2** "Open project" dialog: load manifest + characters from a folder
- [x] **3.3** Export character as SillyTavern-compatible JSON (no PNG embedding yet)

---

## Phase 2 — Iterative Refinement

Goal: Per-field AI assistance, lorebook basics, and project bundles.

- [x] **4.1** Per-field rerolls: lock toggle, custom prompt input, shimmer loading, version history
- [x] **4.2** "Re-roll all" with staggered calls, skipping locked fields
- [x] **4.3** Prompt templates screen: default templates per field + bulk, variable chips, reset-to-default
- [x] **4.4** Auto-save: configurable (off / on change / on blur / timed intervals)
- [x] **4.5** Lorebook (basic): entry list, detail editor (triggers, content, position), export as `world_info` JSON
- [x] **4.6** `.slv` project bundle format: zip of manifest, characters, lorebook, prompts, crawl cache

---

## Phase 3 — Images & Production Export

Goal: Full SillyTavern drop-in experience with portraits and PNG embedding.

### Milestone A — Images & ComfyUI

- [x] **5a.1** Data model: add Portrait to Character, ProjectImage to Manifest, ComfyConfig + ComfyWorkflow to Settings, image persistence in bundle
- [x] **5a.2** ComfyUI settings UI: server URL, auth, output folder, workflow import/parse/delete, default workflow
- [x] **5a.3** ComfyUI Go client & workflow parser: `internal/comfy/` package (models, parser, HTTP client, WebSocket listener)
- [x] **5a.4** Portrait screen — generate mode: workflow picker, sampler params, prompt auto-fill from appearance, 4-variant gallery via ComfyUI
- [x] **5a.5** Portrait screen — upload mode: drag-drop zone, file metadata, crop/resize, URL paste
- [x] **5a.6** Project image screen: generate cover art (16:9), 3-variant comparator, upload mode
- [x] **5a.7** Bundle image persistence, Wails Events for progress, tests, quality gate

### Milestone B — Production Export

- [x] **5b.1** PNG CCv3 export engine: `internal/cardexport/png.go` with custom tEXt chunk injection (chara + ccv3)
- [x] **5b.2** Export hub screen: character grid picker, lorebook entry list, format picker, embedding options, destination tree preview
- [x] **5b.3** Export queue & bulk logic: sequential export with Wails Events progress per character
- [x] **5b.4** Tests, quality gate, enable PNG export buttons

> Note: the export engine package is named `cardexport` (not `export`) because
> `export` is a reserved word in TypeScript and breaks the Wails-generated bindings.

---

## Phase 4 — Power User Features

Goal: Multi-source, multi-endpoint, and full project management.

- [x] **6.1** Dashboard: project grid, filter/search, status badges (Draft / Ready / Archived)
- [x] **6.2** Multi-endpoint LLM management: list, add/edit/duplicate/delete/test, default endpoint, per-field override
- [x] **6.3** Advanced crawler: follow links (1-hop / 2-hop), custom CSS selectors, non-Fandom fallback, rate limit, user agent
- [x] **6.4** Font scaling presets: choose between pre-defined UI scale levels (Small / Default / Large / Extra Large), persisted across restarts
- [x] **6.5** Advanced lorebook: per-character scoping, selective logic, probability sliders, drag reorder, import existing `.json`
- [x] **6.6** Appearance preferences: accent color picker, sidebar style (rail / compact / wide), step badges toggle
- [x] **6.7** Import existing cards: parse SillyTavern PNG v2/v3 or JSON back into a project

---

## Phase 5 — Character Preview

Goal: A live "as-you'd-see-it-in-SillyTavern" preview of the assembled card for the
active character, including the opening greeting.

- [x] **7.1** Data model: add `AltGreetings` to `Character` (Go) and the card-field
  export/import path; Editor field card for authoring alternate greetings; bulk and
  per-field LLM generation support
- [x] **7.2** Extract the Editor's inline `CharacterStrip` into a shared component;
  add a `GetCardPreview` Go binding assembling `compose.CardFields` + per-section
  token counts for the active character
- [x] **7.3** Preview screen — character-card sheet: portrait, tags, field sections,
  stat block, matching the `design_handoff/screen-export.jsx` mockup
- [x] **7.4** Preview screen — SillyTavern-style chat header + opening-message
  bubble, swipeable across alternate greetings
- [ ] **7.5** Preview screen — token-budget panel, linked-lorebook panel, ready-check
  panel; tests + quality gate

---

## Progress Log

> Always use explicit dates (YYYY-MM-DD) instead of relative terms like "today" or "yesterday".

### 2026-07-10

- Started Phase 5 — Character Preview (`milestone/7-preview-tab`).
- Implemented 7.1 — Alternate greetings data model.
- Implemented 7.2 — Shared `CharacterStrip` + `GetCardPreview` binding.
- Implemented 7.3 — Preview screen character-card sheet.
- Implemented 7.4 — Preview screen chat greeting bubble.

#### Completed 7.4 — Preview screen chat greeting bubble

- [x] **7.4** A SillyTavern-style chat simulation now sits above the character
  card in `PreviewScreen.tsx`: a chat header (avatar + name + "New chat") and a
  message bubble showing the opening greeting, swipeable across
  `[Quotes[0], ...AltGreetings]` (the same order SillyTavern itself swipes
  through — the primary `first_mes` first, then the authored alternates).
  - New local `ChatPreview`/`Avatar` components in `PreviewScreen.tsx`, keyed by
    `activeChar.id` so the swipe index resets to the first greeting whenever the
    active character changes (React remounts the component on key change —
    no manual reset effect needed). Swipe controls (prev/next, reusing the
    existing `ArrowIcon` mirrored via CSS `rotate(180deg)`, plus an "N / M"
    counter) only render when there's more than one greeting; a single greeting
    shows no controls, and zero greetings show an italic "No opening message
    written yet." empty state.
  - New `.chat-preview`/`.chat-header`/`.chat-avatar`/`.chat-bubble`/
    `.chat-empty`/`.swipe-controls` CSS in `style.css` — this is new UI with no
    `design_handoff` mockup precedent (the existing "Preview screen" mockup
    only lists "First message / greeting" as an unchecked readiness item, never
    rendering the text), so it was designed fresh using the app's existing
    design tokens rather than ported.
  - `Quotes[0]` now legitimately renders twice on screen (the chat bubble here,
    and the pre-existing "Voice — example exchange" blockquote from 7.3) —
    expected, since both are accurate representations of the same authored
    line in different contexts; several 7.3 tests were re-scoped with
    `within()`/`container.querySelector` to disambiguate.
  - Quality gate green: go vet + golangci-lint clean (no Go changes this
    substep); `tsc --noEmit` + eslint clean; 732 frontend tests, 84.73%
    statements / 86.75% line coverage (`PreviewScreen.tsx` 93.33%/94.59%);
    `wails build -clean -tags webkit2_41` links.

#### Completed 7.3 — Preview screen character-card sheet

- [x] **7.3** New `frontend/src/screens/PreviewScreen.tsx` replaces the Phase 0 stub,
  rendering the assembled character card matching the `design_handoff/
  screen-export.jsx` mockup.
  - Fetches `GetCharacters`/`GetActiveCharacter` on mount (honoring whichever
    character the Editor left active) and reuses the shared `CharacterStrip`
    (7.2) to switch; `GetPortrait` + `utils/image.ts`'s `arrayBufferToDataURL`
    render the portrait as an `<img>` layered over the mockup's diagonal-stripe
    placeholder background.
  - Renders `Character` fields directly (Appearance/Personality/Backstory/
    Abilities/Relationships as `.field` blocks, `Quotes[0]` as a "Voice —
    example exchange" blockquote, `Stats` as a `.stat-mini` grid) — deliberately
    not the concatenated `CardFields.Description` export blob, since the mockup
    shows each authored field separately; each section only renders when
    non-empty. An empty-project state ("No characters yet") covers a project
    with zero characters.
  - `.export-grid`/`.character-card`/`.export-side`/`.lorebook-row` CSS ported
    from `design_handoff/screens-styles.jsx` into `style.css` (the side-panel
    rules are unused until 7.5 but came from the same contiguous mockup block).
  - `frontend/src/screens/index.tsx` now exports the real component; removed
    the now-fully-dead `Placeholder`/"Coming soon" machinery it previously
    shared with other screens. Updated `App.test.tsx` and `screens/index.test.tsx`
    accordingly.
  - Quality gate green: go vet + golangci-lint clean (no Go changes this
    substep); `tsc --noEmit` + eslint clean; 727 frontend tests, 84.65%
    statements / 86.69% line coverage (`PreviewScreen.tsx` itself 90.9%/92.85%);
    `wails build -clean -tags webkit2_41` links.

#### Completed 7.2 — Shared CharacterStrip + GetCardPreview binding

- [x] **7.2** Extracted the Editor's character-switcher into a reusable component
  and added the backend seam the Preview screen (7.3/7.4) will read from.
  - `frontend/src/components/CharacterStrip.tsx` (+ test): moved out of
    `EditorScreen.tsx` verbatim, with `onAdd`/`onImport` made optional — omitting
    either hides that action button, so a future read-only consumer (the Preview
    screen) can render just the switcher. `EditorScreen.tsx` now imports it; all
    existing Editor tests passed unchanged, confirming the extraction is
    behavior-preserving.
  - `internal/compose/preview.go`: new `CardPreview{Fields, Tokens}` and
    `CardPreviewTokens{Description, Personality, Scenario, Examples, Total}`;
    `BuildCardPreview(ch)` wraps the existing `BuildCardFields` and tokenizes the
    "permanent" context fields (mirrors real SillyTavern semantics — `FirstMes` is
    inserted once into chat history, not counted in the permanent budget).
  - `internal/app/app.go`: `GetCardPreview()` binding, no-arg like
    `GetActiveCharacter`, returning `compose.BuildCardPreview` for the active
    character (via `activeCharacterLocked`, so it never returns a zero-value
    struct even before any character is set).
  - `frontend/wailsjs/go/{app/App,models}.ts` regenerated via `wails generate
    module`.
  - Quality gate green: go vet + golangci-lint clean; Go tests pass (`-race`), all
    packages ≥80% (`compose` 94.2%, `app` 88.6%); `tsc --noEmit` + eslint clean;
    717 frontend tests, 84.58% statements / 86.62% line coverage; `wails build
    -clean -tags webkit2_41` links.

#### Completed 7.1 — Alternate greetings data model

- [x] **7.1** Added `AltGreetings []string` to `compose.Character`, wired end to end
  so SillyTavern's alternate-greetings concept round-trips instead of being folded
  into the flat `Quotes` list.
  - `internal/compose/models.go`: new field + `FieldIDs`/`FieldLabel`/`FieldType`
    entries (`"altGreetings"`, ordered between `quotes` and `stats`, type `"quotes"`).
  - `internal/compose/export.go`: `CardFields.AltGreetings`, populated in
    `BuildCardFields` via a new `nonEmpty` helper that filters blank entries.
  - `internal/cardexport/card.go`: `buildData` now sources `AlternateGreetings` from
    `CardFields.AltGreetings` instead of a hardcoded empty slice.
  - `internal/cardimport/mapcard.go`: `buildQuotes` no longer folds
    `AlternateGreetings` into `Quotes`; a new `buildAltGreetings` maps them onto the
    dedicated field, filtering blanks.
  - `internal/prompts/prompts.go`: matching `FieldIDs`/`defaultFieldLabels`/
    `defaultFieldPrompt` entries for the per-field reroll template registry.
  - `internal/compose/prompt.go` + `generate.go`: bulk system prompt describes
    `altGreetings`; `generateResponse`, lock-masking, `applyResponse`, `applyField`,
    and `applyStringSliceField` all treat it like `quotes` so both bulk generation
    and per-field reroll work.
  - Frontend (`frontend/src/components/useFieldEditor.ts`): new `FIELDS` entry,
    typed as a `'greetings'` variant of the list-editor UI (so word-count wording
    reads "N greetings" instead of "N quotes"); `fieldStateFromChar`/
    `charsFromFieldState` wired; `EditorScreen.tsx`'s quote-row renderer now also
    handles `'greetings'`, with "Add greeting" / "Remove greeting" labels.
  - `frontend/wailsjs/go/models.ts` regenerated via `wails generate module`.
  - Quality gate green: go vet + golangci-lint clean; 585 Go tests (`-race`), all
    packages ≥80% (`compose` 93.8%, `cardexport` 93.8%, `cardimport` 93.2%,
    `prompts` 96.9%); `tsc --noEmit` + eslint clean; 712 frontend tests, 84.58%
    statements / 86.62% line coverage; `wails build -clean -tags webkit2_41` links.

### 2026-06-23

- Implemented Phase 4 · 6.7 — Import existing cards (`milestone/6.7-import-cards`).
  This completes Phase 4.

#### Completed 6.7 — Import existing cards

- [x] **6.7** Parse an existing SillyTavern character card (PNG v2/v3 or JSON
  v1/v2/v3) back into the current project as a new character, merging any embedded
  `character_book` into the lorebook. Inverse of `internal/cardexport`.
  - New package `internal/cardimport/` (named `cardimport`, not `import` — TS
    reserved word, same reason `cardexport` exists). `parse.go`:
    `ParseCard([]byte)` auto-detects PNG vs JSON; PNG reuses
    `cardexport.ReadTextChunks`, prefers the `ccv3` chunk over `chara`, and
    base64-decodes the value with a raw-JSON fallback (the PNG bytes become the
    portrait); JSON detects the spec wrapper (`chara_card_v3`/`v2`) or a bare v1
    object. `mapcard.go`: `ToCharacter` reverses the lossy export — a `### `
    heading parser routes Appearance/Personality/Backstory/Abilities/Relationships/
    Stats back to their fields (with a whole-description→Backstory fallback when no
    recognized headings exist), `parseStats` reverses the `- **k**: v` rendering,
    quotes rebuild from `first_mes` + `{{char}}:` lines + `alternate_greetings`, and
    `character_book` entries convert to `lorebook.Entry` (`enabled`→`disable`,
    position string→int). Empty input yields the same `[{"",""}]`/`[""]` sentinels
    `compose.NewCharacter` uses, keeping imported and freshly-created characters
    consistent.
  - App: `ProjectManager.PickCardFile` (native `*.png;*.json` dialog) and
    `App.ImportCard() (*ImportCardResult, error)` — opens the dialog, appends the
    mapped character with a fresh ID, sets it active, and merges lorebook entries
    with UIDs renumbered from `lorebook.NextUID`; a cancelled dialog is a no-op.
    The post-dialog work is factored into `importCardData` for testing.
  - Frontend: an "Import card" button on the Editor character strip
    (`EditorScreen.tsx`) calls `ImportCard`, refreshes + selects the imported
    character, and toasts `Imported "{name}" (+N lore entries)`.
  - Quality gate green: go vet + golangci-lint clean; Go tests pass with `-race`
    (`cardimport` 91.5%, app 88.5%, all packages ≥80%); `tsc --noEmit` + eslint
    clean; 705 frontend tests, 84.4% statements / 86.5% line coverage;
    `wails build -clean -tags webkit2_41` links.
  - Known lossy edges (documented): `mes_example`'s `<START>`/`{{user}}:` wrapper,
    exact stat whitespace, and `scenario` (always empty on export) do not
    round-trip.

### 2026-06-20

- Implemented Phase 4 · 6.6 — Appearance preferences (`milestone/6.6-appearance-prefs`).

#### Completed 6.6 — Appearance preferences

- [x] **6.6** Accent color picker (6 curated oklch presets, persisted to
  `ss-accent`; `style.css` accent vars now derive from `--acc-l`/`--acc-c`/`--acc-h`),
  sidebar style tiers (rail / compact / wide via `data-sidebar` on the document
  root overriding the `.ss-main` grid template, persisted to `ss-sidebar`), and a
  step-badges on/off toggle (CSS-only via `data-step-badges`, hides `.ss-nav-num`
  + `.step-pill`, persisted to `ss-step-badges`). Frontend-only, mirroring the
  theme/font-scale client-side prefs pattern; controls live in the Settings →
  Appearance section and re-apply on startup in `main.tsx`.
  - New utils: `accent.ts`, `sidebarStyle.ts`, `stepBadges.ts` (+ tests).
  - New components: `AccentControl`, `SidebarStyleControl`, `StepBadgesControl`
    (+ tests).
  - A code review of the radiogroup pattern prompted a shared accessible
    `RadioGroup` component (roving tabindex + Arrow/Home/End keys); `AccentControl`,
    `SidebarStyleControl`, and the existing `FontScaleControl` were retrofitted onto
    it. `StepBadgesControl` is a `role="switch"` toggle.
  - Quality gate green: go vet + golangci-lint clean; 558 Go tests (`-race`);
    eslint + `tsc --noEmit` clean; 703 frontend tests, 84.4% statements / 86.5%
    line coverage; `wails build -clean -tags webkit2_41` links.

### 2026-06-15

- Implemented Phase 4 · 6.5 — Advanced lorebook (`milestone/6.5-advanced-lorebook`).

#### Completed 6.5 — Advanced lorebook

- [x] **6.5** Per-character scoping, drag reorder, and SillyTavern `.json` import
  layered onto the existing lorebook editor. Selective logic and probability
  sliders were already present in the UI from Phase 2 (4.5); export-time
  per-character scoping was already wired in `internal/cardexport`
  (`filterEntries`, keyed on the character ID string) — so this milestone added
  the remaining authoring surface plus import.
  - Backend (`internal/lorebook/import.go`): `ParseWorldInfo([]byte) ([]Entry,
    error)` accepts three shapes — World Info object map (`{"entries":{"<uid>":
    {…}}}`), `entries` array, and a bare top-level array — returning entries
    sorted ascending by UID; empty/unrecognized input yields an empty slice,
    only malformed JSON errors.
  - App/dialog: `ProjectManager.PickLorebookFile` (native `.json` open dialog)
    and the `ImportLorebook` binding, which reads the chosen file and delegates
    to `ParseWorldInfo` without mutating app state (merge/replace is decided in
    the frontend; cancel returns nil).
  - Frontend helpers (`frontend/src/utils/lorebook.ts`): pure `reorderByDrag`
    (reassigns `order` with gaps — 1000, 990, 980… — so SillyTavern insertion
    priority matches visual order), `remapForMerge`, and `renumberFromZero`.
  - Frontend UI (`LorebookScreen.tsx`): a "Character scope" chip row in the
    entry editor (none selected = global / all characters; stores character ID
    strings), native HTML5 drag-to-reorder of the entry list (disabled while a
    search filter is active), and an "Import .json" flow with a merge-vs-replace
    confirm modal (Escape / backdrop to cancel).
  - Quality gate green: go vet + golangci-lint clean; 554 Go tests (`-race`),
    lorebook package 90.9% / root 89.3%; frontend lint + `tsc --noEmit` clean;
    653 frontend tests, 85.49% line coverage (new `lorebook.ts` at 100%);
    `wails build -clean -tags webkit2_41` links.

### 2026-06-14

- Implemented Phase 4 · 6.4 — Font scaling presets (`milestone/6.4-font-scaling`).
  Inserted as the next milestone; renumbered the previously-pending items
  (advanced lorebook → 6.5, appearance preferences → 6.6, import existing
  cards → 6.7).
- Implemented Phase 4 · 6.3 — Advanced crawler (`milestone/6.3-advanced-crawler`).

#### Completed 6.4 — Font scaling presets

- [x] **6.4** Pre-defined UI scale levels selectable from a new Settings
  "Appearance" section: Small (90%), Default (100%), Large (110%), Extra Large
  (125%). Frontend-only, mirroring the existing theme-toggle pattern — no Go
  changes.
  - `frontend/src/utils/fontScale.ts`: preset table, `applyFontScale` (sets
    `document.documentElement.style.zoom` + persists to the `ss-font-scale`
    localStorage key), `getStoredFontScaleId` (validates/falls back to default),
    `initFontScale` for startup re-application (wired in `main.tsx`).
  - `frontend/src/components/FontScaleControl.tsx`: accessible radiogroup of
    presets that applies the choice live on selection.
  - `SettingsScreen`: new "Appearance" nav section hosting the control;
    `style.css` adds `.font-scale-control` styling and a `.form-label` span
    variant (radiogroup has no single labelable control).
  - Approach chosen: root `zoom` scales every screen uniformly and legibly
    without refactoring the fixed-px typography throughout `style.css`.
  - Quality gate green: go vet + golangci-lint clean; 549 Go tests (`-race`);
    frontend lint + `tsc --noEmit` clean; 642 frontend tests, 85.12% line
    coverage (new modules fully covered); `wails build -clean -tags webkit2_41`
    links.
- Implemented Phase 4 · 6.2 — Multi-endpoint LLM management (`milestone/6.2-multi-endpoint`).

#### Completed 6.3 — Advanced crawler

- [x] **6.3** Multi-result crawl pipeline: the crawler now follows same-domain
  links (1/2-hop), supports custom CSS selectors and a non-Fandom readable
  fallback, sends a configurable User-Agent, and rate-limits requests. Each
  crawled page is its own result; the user assigns a role (Character / Lorebook
  / Skip) per result and "Send to project" creates stubs that remember their
  origin page, so generation later runs from each entity's own source.
  - Dependencies: added `github.com/PuerkitoBio/goquery` and
    `github.com/go-shiori/go-readability` (CSS selector engine + readable
    extraction).
  - Backend (`internal/crawler/`): `CrawlSet` + `CrawlResult.{Depth,ParentURL,
    IsMediaWiki}` + `CrawlOptions.Selectors`; `FetchPageWith`/`FetchOptions`
    (User-Agent); `FetchReadable` readable fallback; `SectionsFromSelectors`
    and `SameDomainLinks` (goquery); `Crawler.Crawl` bounded BFS with a
    delay-based rate limiter, depth + `MaxPages` cap, dedupe, and skip-on-error.
    Extraction precedence: custom selectors → MediaWiki native → readable.
  - App: `CrawlPage` now returns a `CrawlSet`; `cachedCrawlSet`;
    `SendCrawlToProject` (CrawlAssignment → character/lorebook stubs);
    `crawlForActiveCharacterLocked` resolves generation source by the active
    character's `SourceURL` (precedence: SourceURL match → first result → legacy
    cache). `compose.Character` and `lorebook.Entry` gained `SourceURL`.
  - Settings: global `CrawlerConfig{UserAgent, RateLimitMs, MaxPages}` with a
    Crawler section in the Settings screen.
  - Bundle: `CrawlSet` persisted as `crawl_set.json`; legacy `crawl_cache.json`
    upgraded into a one-result set on open (backward compatible).
  - Frontend: rewritten Crawler screen (custom selectors field, multi-result
    list with per-result role control, preview follows selection, "Send to
    project").
  - Quality gate green: go vet + golangci-lint clean; 537 Go tests (`-race`),
    83.6% total coverage (crawler package ~91%); 623 frontend tests, 84.19%
    line coverage; `wails build -clean -tags webkit2_41` links.

#### Completed 6.2 — Multi-endpoint LLM management + per-field override

- [x] **6.2** Per-field (and bulk) LLM endpoint overrides on top of the existing
  endpoint management. Two-level resolution: a global slot→endpoint map in
  `settings.json` and a per-project override map in the `.slv` manifest.
  - Backend: `FieldEndpoints map[string]int` on `Settings`, `ProjectManifest`,
    and `ProjectSnapshot`; `App.endpointForSlot` resolver (precedence
    project → global → default endpoint, dangling IDs fall through);
    `GenerateCharacterBulk`/`GenerateField` routed through it (image-prompt
    generation intentionally left on the default endpoint); bindings
    `GetProjectFieldEndpoints` / `SetProjectFieldEndpoint`; overrides hydrate on
    bundle open and persist on save.
  - Frontend: shared `utils/fieldEndpoints` (slot list + `resolveEndpoint`
    helper mirroring the Go precedence), a Settings "Per-field defaults" table,
    and an inline `FieldEndpointChip` on each editor field card plus the bulk
    control showing the effective endpoint and its source.
  - Hardening: empty-list endpoint-id generation (`nextEndpointId`) and
    overflow-menu accessibility (`role="menu"`/`menuitem`, labelled trigger) on
    the endpoint card.
  - Quality gate green: go vet + golangci-lint clean; 516 Go tests (`-race`),
    root package 89.4% with the new resolver/bindings at 100%; 598 frontend
    tests, 83.25% line coverage with the new modules at 100%;
    `wails build -clean -tags webkit2_41` links.

### 2026-06-13

- Started Phase 4 — Power User Features (`milestone/6.1-dashboard`).

#### Completed 6.1 — Project Dashboard

- [x] **6.1** Hybrid project library: `internal/library/` index + thumbnail cache,
  `LibraryManager`, dashboard bindings (`ListProjects`/`NewProject`/`SetProjectStatus`/
  `RemoveProject`/`GetProjectThumbnail`), manifest `Status`/`Tags`, rewritten
  `DashboardScreen` (filter chips, search, status badges, empty state).

### 2026-06-12

- Started Phase 3B — Production Export (`milestone/5b-production-export`).

#### Completed Milestone B — Production Export

- [x] **5b.1** PNG CCv3 export engine: `internal/cardexport/` package — PNG `tEXt`
  chunk injection/parsing (CRC32), Character Card v2 (`chara`) + v3 (`ccv3`) JSON
  builders, lorebook → `character_book` embedding, embedding `Options`, placeholder
  portrait fallback. 93.8% package coverage.
- [x] **5b.2** Export hub screen — character grid + lorebook entry pickers (All/None),
  format picker (png-v2 / png-v3 / json / bundle), embedding option checkboxes,
  destination folder picker with per-character file tree preview.
- [x] **5b.3** Backend bindings `ExportCharacterPNG` + `ExportCharactersBulk` with
  sequential per-character export emitting `export:progress` / `export:complete`
  Wails events; frontend export queue panel driven by those events.
- [x] **5b.4** Enabled the PNG export buttons; full lint + test + coverage gate green.
- Package named `cardexport` (not `export`) to avoid the TypeScript reserved-word
  collision in the generated Wails bindings.
- Go: 12 packages, vet + golangci-lint clean, tests pass with `-race`.
- Frontend: 27 test files, 556 tests, ≥80% coverage.

### 2026-05-29

- Created milestone workflow in AGENTS.md.
- Started Milestone 2 — Crawler (`milestone/2-crawler`).

#### Completed Milestone 2 — Crawler

- [x] **1.1** Crawler screen with URL input, crawl options, recent wiki chips
- [x] **1.2** MediaWiki action=parse fetcher with URL parsing
- [x] **1.3** HTML sanitization (nav, refs, TOC, galleries stripped; sections + infobox extracted)
- [x] **1.4** Crawl preview panel with headings, infobox, word count, footer metadata
- [x] **1.5** Disk-persisted crawl cache in config dir, survives app restart

### 2026-05-27

- Created roadmap, updated README and AGENTS.md.
- Approved switch from Fyne to **Wails v2 + React + Vite**.
- Approved postponing: image generation (Phase 3), multi-endpoint LLM (Phase 4), project dashboard (Phase 4).
- Started Phase 0 skeleton implementation.

#### Completed 2026-05-29

- [x] **0.1** Bootstrapped Wails v2 project (`wails init -n silly-sleeve -t react-ts`)
- [x] **0.2** Ported design tokens (`styles.css`) into frontend global styles
- [x] **0.3** Ported root layout: TitleBar, Sidebar nav, PageHead, StatusBar primitives
- [x] **0.4** Implemented route state: `dashboard`, `crawler`, `editor`, `lorebook`, `projectImage`, `image`, `preview`, `export`, `settings`
- [x] **0.5** Theme toggle: light/dark mode (persists to `localStorage`)

> **Build note:** The frontend compiles and Wails bindings generate successfully. The native binary cannot be linked in this headless environment because GTK3/WebKit2GTK dev libraries are missing. This is expected — the app will build and run on a standard Linux desktop with `libgtk-3-dev` and `libwebkit2gtk-4.0-dev` installed (see Wails prerequisites).

#### Completed 2026-05-29 (continued)

- [x] **0.6** Toast system — `ToastProvider` with `useToast()` hook, 4 kinds (`ok`/`bad`/`warn`/`info`), 4.2 s auto-dismiss with CSS progress bar
- [x] **0.7** Settings screen — section nav, LLM endpoint list cards, full endpoint editor flyout (slide-in from right) with URL, auth toggle + key input, model, context-size slider + presets, temperature slider, system prompt
- [x] **0.8** Go bindings — `GetSettings`, `SaveSettings`, `TestLLMEndpoint`; test sends a minimal 1-token OpenAI-compatible chat completion
- [x] **0.9** Settings persistence — JSON stored in `os.UserConfigDir()/silly-sleeve/settings.json`; `internal/settings` package with future-proof `[]LLMEndpoint` array
- StatusBar now shows the default endpoint name and live connection dot

### 2026-05-30

- Started Milestone 3 — Compose (Bulk Only) (`milestone/3-compose`).

#### Completed Milestone 3 — Compose (Bulk Only)

- [x] **2.1** Editor screen with 10 field cards (line, text, tags, quotes, stats) and source panel
- [x] **2.2** Bulk generation via LLM with adapted SillyTavern prompt, JSON parsing, lock support
- [x] **2.3** Character strip with add/switch/delete and last-character safety guard
- [x] **2.4** Manual field editing with per-field dirty flag tracking
- [x] **2.5** Word count per field + token count via tiktoken-go
- Added `github.com/pkoukk/tiktoken-go` dependency for accurate token estimation
- Added `internal/llm/complete.go` for full chat-completion calls
- Added `internal/compose/` package: models, token counting, prompt builder, LLM generation

### 2026-05-31

- Started Milestone 4 — Save & Export (`milestone/4-save-export`).

#### Completed Milestone 4 — Save & Export

- [x] **3.1** Save project: PickSaveFolder + SaveProjectTo bindings, internal/project/ package (ProjectManifest, SaveProject, LoadProject), UI buttons in Editor + Dashboard
- [x] **3.2** Open project: OpenProject binding, LoadProject from folder, state hydration
- [x] **3.3** Export character: SillyTavern-compatible JSON mapping (description, first_mes, mes_example), ExportScreen with character picker + format selector + destination picker
- Added `internal/project/` package with folder-based project persistence
- Added `PickSaveFolder`, `SaveProjectTo`, `OpenProject`, `PickExportFolder`, `ExportCharacter` bindings
- Added `ExportScreen` with character picker, JSON-only format, destination input
- DashboardScreen now has functional Save/Open project buttons

### 2026-06-02

- Started Phase 2 — Iterative Refinement (`milestone/5-phase2`).
- Planning complete: per-field LLM calls for rerolls, full handoff lorebook editor, `.slv` zip bundles replacing folder save.

#### Completed Phase 2 — Iterative Refinement

- [x] **4.3** Prompt templates: `internal/prompts/` package with TemplateSet, variable substitution, SettingsScreen editor
- [x] **4.1** Per-field rerolls: `GenerateField` backend, separate LLM calls per field, real `GenerateField` binding
- [x] **4.2** Re-roll all staggered: sequential `GenerateField` calls with 300ms delays, progress tracking
- [x] **4.6** `.slv` project bundles: `internal/bundle/` zip format, replaced folder save with bundle save/open
- [x] **4.5** Lorebook basics: `internal/lorebook/` Entry model, full two-pane editor, world_info JSON export
- [x] **4.4** Auto-save: `useAutoSave` hook with off/onChange/onBlur/timed modes, integrated in EditorScreen
- New packages: `internal/prompts/`, `internal/lorebook/`, `internal/bundle/`
- Updated packages: `internal/settings/`, `internal/compose/generate.go`
- Frontend: prompt template editor, per-field reroll wiring, lorebook editor, auto-save hook
- Go tests: 231 in 10 packages; Frontend tests: ~330 (including lorebook + auto-save tests)

### 2026-06-07

- Started Phase 3A — Images & ComfyUI (`milestone/5a-images-comfy`).

#### Completed Milestone A — Images & ComfyUI

- [x] **5a.1** Data model — `Portrait []byte` on `Character`, `ProjectImage []byte` on `ProjectManifest`, `ComfyConfig`/`ComfyWorkflow`/`WorkflowParams` in settings, image persistence in `.slv` zip entries
- [x] **5a.2** ComfyUI settings UI in `SettingsScreen.tsx` — server URL + test, auth token toggle, output folder, workflow import/parse/delete with auto-extracted params panel
- [x] **5a.3** `internal/comfy/` Go package — HTTP REST client (SystemStats, QueuePrompt, History, GetImage, TestConnection), WebSocket listener (progress/executing/executed/error events), workflow JSON parser with KSampler graph traversal, 10 client tests with mock HTTP server
- [x] **5a.4** PortraitScreen generate mode — workflow picker, sampler params, model/VAE/LoRA selectors, auto-fill prompt from character appearance, 4-variant mock generation with seed offsets, `ImageCanvasPanel` shared component
- [x] **5a.5** PortraitScreen upload mode — drag-drop zone with file metadata, crop/resize select, URL paste card, `ImageUploadPanel` shared component
- [x] **5a.6** ProjectImageScreen — generate cover art (16:9), 3-variant comparator, lorebook context checkboxes, upload mode, `ImageGalleryPanel` shared component
- [x] **5a.7** Backend bindings — `ImportComfyWorkflow`, `TestComfyUIEndpoint`, `DeleteComfyWorkflow`; image persistence as `images/portrait_<id>.png` and `images/project.png` zip entries; Wails Events plumbing for generation progress
- Frontend: 16 test files, 462 tests, 81.08% line coverage
- Go: 10 packages, lint + vet clean
- Shared components extracted to eliminate SonarCloud duplications: `ImageCanvasPanel`, `ImageGalleryPanel`, `ImageUploadPanel`, `GenerationParamsPanel`
- SonarCloud quality gate: all 5 conditions OK
- PR #6 opened at https://github.com/Zellione/silly-sleeve/pull/6
- Real ComfyUI generation wired: placeholder system (`ReplacePlaceholders`, `ExtractPlaceholders`), `Generator` orchestrator with per-variant WSListener, Wails events bridge (`comfy:progress`/`comfy:completed`/`comfy:error`), LLM prompt generation (natural/Danbooru styles), WorkflowEditor modal for JSON template editing with placeholder detection
- Frontend: 17 test files, 475 tests, 80.03% line coverage
