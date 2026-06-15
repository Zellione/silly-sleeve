# Silly Sleeve Roadmap

> Last updated: 2026-06-15 — Phase 4 · 6.5 Advanced lorebook in progress.

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
- [~] **6.5** Advanced lorebook: per-character scoping, selective logic, probability sliders, drag reorder, import existing `.json`
- [ ] **6.6** Appearance preferences: accent color picker, sidebar style (rail / compact / wide), step badges toggle
- [ ] **6.7** Import existing cards: parse SillyTavern PNG v2/v3 or JSON back into a project

---

## Progress Log

> Always use explicit dates (YYYY-MM-DD) instead of relative terms like "today" or "yesterday".

### 2026-06-15

- Started Phase 4 · 6.5 — Advanced lorebook (`milestone/6.5-advanced-lorebook`).
  Backend model + export-time scoping already exist; selective logic + probability
  sliders already in the UI. Remaining work: per-character scoping chips, drag
  reorder, and SillyTavern `.json` import.

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
