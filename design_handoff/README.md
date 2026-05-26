# Handoff: Silly Sleeve — Desktop workshop for SillyTavern character cards & lorebooks

## Overview

**Silly Sleeve** is a desktop application for authoring SillyTavern-compatible character cards and lorebooks from wiki sources (primarily Fandom wikis). The user pastes a wiki URL, the app crawls the page, an OpenAI-compatible LLM reformats the content into structured character fields, the user iteratively rerolls and locks individual fields, generates a portrait via a ComfyUI backend (or uploads one), authors a project-wide lorebook with per-character scoping, and exports everything as SillyTavern PNG cards + lorebook JSON.

The application is project-based: a project holds multiple characters that share a single lorebook, a project image (cover art), and references to one crawled source.

## About the Design Files

The files in this bundle are **design references created in HTML/React/Babel** — interactive prototypes showing the intended look, layout, interactions, and flow. They are **not production code to copy directly**.

The task is to **recreate these designs in the target codebase's environment**. The original brief was for a desktop application, so the recommended targets are:

- **Tauri 2** with React/SolidJS/Svelte for the webview — closest mapping to the prototype, smallest binary
- **Electron** with React — most familiar tooling, larger binary
- **Native** (SwiftUI on macOS, WinUI / WPF on Windows, GTK / Qt on Linux) — pick this if a fully-native feel is required; the designs translate well since they already use desktop conventions (titlebar with traffic lights, status bar, sidebar nav, modals, flyouts)

If no target codebase exists yet, **Tauri 2 + React + Vite** is the best balance of design fidelity to binary size. All the React components, hooks, and CSS in this bundle would port to that stack with almost no changes.

## Fidelity

**High-fidelity.** The mocks are pixel-perfect with final colors, typography, spacing, interactions, and content. Every screen has been built to a complete, designed state — including loading, empty, hover, and active states. The developer should:

1. Recreate the visual design pixel-perfectly
2. Replace all mocked behavior (setTimeout-driven generations, in-memory state) with real API calls to the OpenAI-compatible LLM endpoint and ComfyUI WebSocket
3. Persist project state (characters, lorebook, prompts, settings) to local disk

## Tech Stack of the Prototype

- React 18 (no JSX compile step in prod — loaded via Babel standalone in the prototype)
- Vanilla CSS with CSS custom properties (no Tailwind, no CSS-in-JS)
- No build step in the prototype; production should use Vite or equivalent
- Google Fonts: Instrument Serif (display), Geist (UI sans), JetBrains Mono (mono)

## Workflow (Routes & Step Numbering)

The app has a left-sidebar nav and 9 routes total — 7 workflow steps plus Projects (dashboard) and Settings:

| ID | Step | Name | File |
|---|---|---|---|
| `dashboard` | — | Projects (dashboard) | `screens-meta.jsx` |
| `crawler` | 01 | Crawl a wiki page | `screen-crawler.jsx` |
| `editor` | 02 | Compose character | `screen-editor.jsx` |
| `lorebook` | 03 | Author lorebook | `screen-lorebook.jsx` |
| `projectImage` | 04 | Project image | `screen-project-image.jsx` |
| `image` | 05 | Portrait (per character) | `screen-image.jsx` |
| `preview` | 06 | Preview character card | `screen-export.jsx` |
| `export` | 07 | Export hub | `screen-export-hub.jsx` |
| `settings` | — | Settings | `screens-meta.jsx` |

## Data Model

```ts
type Project = {
  id: string;
  name: string;                  // "Baldur's Gate · Harper cell"
  createdAt: ISO8601;
  updatedAt: ISO8601;
  sourceUrl: string;             // last-crawled wiki URL
  crawl: {
    cachedAt: ISO8601;
    wordCount: number;
    sections: { tag: string; text: string }[];
    infobox: Record<string, string>;
  } | null;
  projectImage: string | null;   // local file path to cover art
  characters: Character[];
  lorebook: LorebookEntry[];
  activeCharId: string | null;
};

type Character = {
  id: string;                    // "C1", "C2", ...
  name: string;
  initial: string;               // single letter for avatar
  epithet: string;
  tags: string[];
  appearance: string;
  personality: string;
  backstory: string;
  abilities: string;
  relationships: string;
  quotes: string[];
  stats: [string, string][];     // [["STR", "10"], ["HP", "34/34"], ...]
  portrait: string | null;       // local file path
  generationHistory: Record<string, FieldVersion[]>;  // per-field history
  tokenCount: number;
};

type FieldVersion = {
  at: ISO8601;
  value: string | string[] | [string, string][];
  promptUsed?: string;           // if user steered the reroll
};

// Matches SillyTavern's lorebook entry spec exactly
type LorebookEntry = {
  uid: number;
  comment: string;               // human-readable name
  key: string[];                 // primary trigger keys
  keysecondary: string[];        // secondary keys
  content: string;               // injected text
  constant: boolean;             // always-active flag (⚓)
  selective: boolean;            // require secondary
  selectiveLogic: 0 | 1 | 2 | 3; // 0=AND ANY, 1=NOT ALL, 2=NOT ANY, 3=AND ALL
  addMemo: boolean;
  order: number;                 // higher = inserted first
  position: 0 | 1 | 2 | 3 | 4 | 5 | 6;  // see POSITIONS table below
  disable: boolean;
  probability: number;           // 0-100
  useProbability: boolean;
  depth: number;                 // for position 4 (@ depth)
  sticky: number;                // stay active N messages after trigger
  vectorized: boolean;
  ignoreBudget: boolean;
  excludeRecursion: boolean;
  preventRecursion: boolean;
  characters: string[];          // SillySleeve extension: char IDs this entry scopes to; empty = global
};

type LLMEndpoint = {
  id: number;
  name: string;
  url: string;                   // OpenAI-compatible base, ends in /v1
  model: string;
  key: string | null;            // null = no auth
  isDefault: boolean;
  contextSize: number;
  temperature: number;
  systemPrompt: string;
  ok: boolean;                   // last test result
};

type ComfyConfig = {
  url: string;                   // ws://127.0.0.1:8188
  authToken: string | null;
  outputDir: string;
  defaultWorkflow: string;
  workflows: ComfyWorkflow[];
};

type Settings = {
  endpoints: LLMEndpoint[];
  comfy: ComfyConfig;
  prompts: Record<string, string>;  // per-field + lorebook + bulk
  crawler: CrawlerDefaults;
  generationDefaults: { temperature: number; maxTokens: number; systemPromptTemplate: string };
  autoSave: { enabled: boolean; frequency: 'change' | 'blur' | string };  // string = seconds
};
```

### LorebookEntry.position values (SillyTavern spec)

| Value | Name | Hint |
|---|---|---|
| 0 | Before Char Defs | Top of context — system frame |
| 1 | After Char Defs | Just after the character card |
| 2 | Before Example Msgs | Ahead of `<START>` examples |
| 3 | After Example Msgs | After `<START>` examples |
| 4 | @ Depth (in chat) | Injected N messages back · uses `depth` |
| 5 | Before Author Note | Just above the author note |
| 6 | After Author Note | Below the author note |

## Backend Contracts

### LLM endpoint
Any OpenAI-compatible `/v1/chat/completions` endpoint works — local (koboldcpp, ollama, vLLM, llama-server) or hosted (OpenRouter, Mistral, OpenAI, Anthropic via proxy). Auth is `Authorization: Bearer <token>` if a key is configured.

Per-field rerolls send the field's prompt template (from Settings → Prompts) with `{{wikiContent}}`, `{{name}}`, `{{epithet}}`, etc. interpolated. The "Full character (bulk)" prompt outputs one JSON object filling every field; "Full lorebook (bulk)" outputs a JSON array of entries.

Default prompts live in `screens-meta.jsx` inside the `SettingsPrompts` function — `FIELD_PROMPTS`, `LORE_PROMPT`, and `BULK_PROMPTS`. These are the production defaults.

### ComfyUI backend
WebSocket connection to a running ComfyUI instance (typically `ws://127.0.0.1:8188`). The workflow JSON files in the design are placeholders — the real app should let users import any ComfyUI workflow `.json`, extract its `KSampler` and `CLIPTextEncode` nodes, and surface their params (steps, CFG, denoise, sampler, scheduler, seed, prompt, negative prompt) in the Portrait / Project image screens.

### Wiki crawler
Fetches the URL server-side (CORS will block client-side fetch of Fandom). Uses MediaWiki API where available (Fandom exposes `/api.php?action=parse`). Strips per the Settings → Wiki crawler toggles. Respects rate limit from settings (default 1 req/sec). User agent should identify the app (default `SillySleeve/0.4 (+https://sillysleeve.app)`).

## Design System

### Type pairing

| Role | Family | Weights used |
|---|---|---|
| Display headers, italic flourishes | Instrument Serif (Google) | 400 regular, 400 italic |
| All UI sans (buttons, labels, body) | Geist (Google) | 400, 500, 600, 700 |
| Mono labels, code, IDs, technical data | JetBrains Mono (Google) | 400, 500, 600 |

The display serif is used italicized at large sizes for page titles, project names, modal titles. Mono is used in caps for `.uplabel` style microcopy (10px, letter-spacing 0.12–0.18em, uppercase, `var(--ink-3)` color).

### Color tokens (CSS custom properties, exact values)

**Light mode (`:root`)**

| Token | Value | Used for |
|---|---|---|
| `--bg` | `#efe9dc` | Page background |
| `--panel` | `#f7f2e6` | Cards, sidebar, modals |
| `--panel-2` | `#faf6ec` | Nested cards, form fields |
| `--ink` | `#1c1813` | Body text |
| `--ink-2` | `#4a4239` | Secondary text |
| `--ink-3` | `#8a8175` | Tertiary / labels |
| `--hair` | `#1c181322` | Hairline borders |
| `--hair-strong` | `#1c181355` | Stronger borders |

**Dark mode (`[data-theme="dark"]`)**

| Token | Value |
|---|---|
| `--bg` | `#15120e` |
| `--panel` | `#1c1813` |
| `--panel-2` | `#221d17` |
| `--ink` | `#ede4d3` |
| `--ink-2` | `#b8ad9b` |
| `--ink-3` | `#756c5e` |
| `--hair` | `#ede4d31a` |
| `--hair-strong` | `#ede4d340` |

**Accent (themeable, 6 options exposed via Tweaks)**

| Token | Default | Notes |
|---|---|---|
| `--acc` | `#e07a4f` (persimmon) | Primary accent · also `oklch(0.66 0.18 38)` |
| `--acc-soft` | `--acc` + alpha | Soft fill for selected states |
| `--acc-line` | `--acc` + `66` alpha | Border on focused/selected elements |
| `--acc-fg` | `#fff` | Text on accent backgrounds |

Other accent options: `#8b5cf6` (violet), `#22a06b` (green), `#d33f49` (red), `#3b82f6` (blue), `#c79e3b` (amber).

**Status colors**

| Token | Value | Used for |
|---|---|---|
| `--ok` | `oklch(0.62 0.14 150)` | Success states, "connected" |
| `--warn` | `oklch(0.72 0.16 80)` | Warnings |
| `--bad` | `oklch(0.58 0.18 25)` | Errors, delete actions |

### Spacing & rhythm

- Page padding: `26px 32px 18px` for headers, `24px 32px 40px` for body
- Card padding: `14px 16px` or `16px 18px`
- Form gap: `12–14px`
- Border radius: `4px` (inputs, small cards), `6px` (cards), `8–10px` (modals, large panels)
- Hairlines: `1px solid var(--hair)` (most), `1px solid var(--hair-strong)` (emphasis)
- Default font size: `13px` body, `12px` UI controls, `10–11px` labels

### Component patterns

- **Title bar** with macOS-style traffic lights + center label (`.ss-title`)
- **Sidebar** with brand mark, workflow nav with step numbers, "Setup" section, project pill + Save button at bottom
- **Page header** with step pill (mono uppercase + accent step number), italic serif title, action buttons right-aligned
- **Status bar** at bottom with LLM/ComfyUI dots, token count, route label
- **Cards** with `.card` class — `var(--panel)` background, `1px solid var(--hair)`, `6px` radius
- **Buttons** — `.btn`, `.btn.primary` (ink/accent fill), `.btn.ghost` (transparent + border), `.btn.sm`, `.btn.icon`
- **Tags** — `.tag`, `.tag.acc` (accent variant)
- **Placeholder images** — `.hatch` class for striped 135° hatching with mono caption
- **Toasts** — bottom-right stack, 4 kinds (ok/bad/warn/info), color-coded left border + filled icon + progress bar countdown, auto-dismiss 4.2s. Triggered via `window.toast({kind, title, body})`.
- **Flyouts** — side drawer (`.ep-flyout`), slides in from right, blurred backdrop
- **Popover menus** — anchored to a button, click-outside + Esc close
- **Modals** — centered, blurred backdrop, `.ss-modal`

## Screens

### 01 — Crawl (`screen-crawler.jsx`)

Two-column layout (`.crawler-grid`). Left: source URL input with link icon prefix, recent-wikis chip row, crawl options grid (follow links, include checkboxes, custom CSS selectors). Right: live preview panel showing crawled headings, infobox (key/value table), highlighted "pick" spans (dashed accent underline). Footer with status (200 OK, latency, cache hit) and token count estimate.

Hitting "Crawl page" shows a shimmer-loading state in the preview for ~1.1s, then renders the content. Re-crawl button to refresh.

### 02 — Compose (`screen-editor.jsx`)

Two-column layout (`.editor-grid`). Left: sticky source panel showing the crawled content with `<mark>` highlights on spans that were consumed by the formatter. Right: stack of 10 **field cards** — Name, Epithet, Tags, Appearance, Personality, Backstory, Abilities, Relationships, Quotes, Stats.

Each field card has:
- Numbered index (01, 02, …) + field title + required/optional pill
- Action tools: custom reroll prompt toggle, lock toggle, copy, reroll
- Body — single-line input / textarea / tags input / quote rows / stat key-value rows depending on field type
- Footer: word count + version history dropdown ("3 versions") + helper text
- Custom-prompt reveal: an inline text box for the user to steer the reroll ("more sinister, less courtly")
- Rolling state: accent-colored shimmer at bottom of the card during generation

Header has Delete (with confirmation modal), Save, Re-roll all (skips locked), Continue.

Character switcher strip (`<CharacterStrip>`) below the page header — pill tabs of all characters + "+ Add character" (only on this screen).

### 03 — Lorebook (`screen-lorebook.jsx`)

Two-pane layout (`.lb-grid`). Left: entries list with search, sort by order, drag handles, UID badges, key chips (primary in accent), per-entry character avatar dots (or "global" tag). Right: detail editor with sections:

- **Triggers** — primary keys input, secondary keys input, selective-logic segmented control (AND ANY / NOT ALL / NOT ANY / AND ALL), selective toggle
- **Linked characters** — Project-wide / Per-character toggle; when per-character, chips for each character (toggle on/off)
- **Content** — large textarea with char + token count
- **Position** — 7 card-style selectors (the SillyTavern position enum); shows depth input when position 4 selected
- **Activation** — Order, Sticky, UID number inputs; Probability slider with separate `useProbability` toggle
- **Behavior** — 7 toggle rows in 2-col grid (Constant, Vectorized, Add memo, Ignore budget, Exclude recursion, Prevent recursion, Disabled)
- Footer bar summarizes active flags

Header actions: Import .json, Continue to Project image.

### 04 — Project image (`screen-project-image.jsx`)

Three-column layout (`.proj-img-grid`). Tabs at top right: Generate / Upload. Generate mode: workflow picker (3 cover-friendly workflows), sampler params (steps, CFG, sampler, aspect), seed, "Use project context" toggles (mood from lorebook, setting from World entry, cameo characters). Center: preview canvas with checkerboard pattern; when generated, shows project name as overlay text on the cover art. Right: 3-version comparator with thumb + meta + "Use as project image" CTA.

Upload mode: 16:9 dropzone, file metadata card, crop/resize options, URL paste card.

### 05 — Portrait (`screen-image.jsx`)

Same layout as Project image but at 3:4 portrait aspect, with character-specific workflows (`portrait_sdxl_v3.json`, `illustrious_anime.json`, `flux_dev_portrait.json`). Generate mode pulls character context (name, appearance) into the prompt automatically — the prompt textarea has an "auto-fill from card" link. Right column shows a 4-thumbnail gallery (`.gallery`) with selected variant + per-variant metadata. CharacterStrip at top (no Add button).

### 06 — Preview (`screen-export.jsx`)

Two-column (`.export-grid`). Left: an assembled **character card** mockup (`.character-card`) — portrait left, body right with title block (epithet in mono caps + accent, italic serif name), then sections for Appearance, Personality, Voice (italic blockquote with accent border-left), Stat block (mini grid). Right: token budget bars, linked lorebook list scoped to this character, ready-check (6 items with check/X icons). CharacterStrip at top.

### 07 — Export (`screen-export-hub.jsx`)

Two-column. Left has two stacked panes:
- **Characters** — selectable grid of character cards with thumbnail + name + epithet + meta + checkbox; All / None controls
- **Lorebook entries** — checkbox list with UID, name, per-entry character scope chips (showing which characters each entry attaches to), Position + Order pill

Right column has cards:
- **Export format** picker (4 options): Character PNG v2, Character PNG v3 (CCv3), JSON only, Silly Sleeve bundle (.slv)
- **Embedding options** checkboxes (embed lorebook in each char, scope to per-char links, include greeting, strip metadata)
- **Destination** with path input + folder picker, live-updating directory tree preview
- **Summary** card (counts, format, size estimate)
- **Export queue** (appears during running export with per-character progress)

Header actions: Reveal in Finder, Export lorebook (N), Export N characters (primary). Both Export buttons run the queue animation.

### Dashboard (`screens-meta.jsx → Dashboard`)

Project grid (`.grid-cards`) with filter chips (All / Drafts / Ready / Archived with counts), search input, and a "+ New character" pill at the end. Each project card has a 4:3 portrait thumb (with badges), name + ID, source wiki, tag chips, token count + last-updated footer.

Empty state when no projects.

### Settings (`screens-meta.jsx → Settings`)

Two-column layout with section nav on the left, content on the right. Sections: LLM endpoints, ComfyUI, Prompts, Wiki crawler, Shortcuts, About.

**LLM endpoints** lists configured endpoints as cards. Each card has:
- Name + first-letter icon + model name in mono caps
- Default pill (accent), status pill (connected/untested), more-menu button (...)
- URL in mono
- Auth state + Test / Edit buttons

The more-menu opens a popover with: Set as default, Duplicate, Export config, Delete.

The Edit / Add buttons open the **Endpoint editor flyout** (slide-in from right, ~480px wide):
- Name as inline editable italic serif title
- Base URL with link-icon prefix and inline Test button (idle/Testing/OK/Failed states)
- Auth toggle row; when on, animated key input with show/hide eye toggle
- Model input (mono)
- Context size slider + numeric input + 6 quick presets (4k/8k/16k/32k/128k/200k)
- Temperature slider + numeric input
- System prompt textarea with live char/token count + Clear
- Footer: Delete (left, danger), Cancel + Save (right)

Below endpoints: Generation defaults form (temperature, max tokens, system prompt template).

**ComfyUI** — server URL + Test, auth token, output folder, default workflow select, saved workflows list with import.

**Prompts** — Three-section list of prompts:
- **Bulk generation**: Full character (bulk), Full lorebook (bulk) — single calls that fill every field / generate the whole lorebook
- **Character fields**: one prompt per character field (10 total)
- **Lorebook**: one prompt for individual lorebook entries

Right pane: prompt editor with mono textarea, variable insert chips (`{{wikiContent}}`, `{{name}}`, etc. — click to insert), modified indicator dot, Reset-to-default per prompt.

**Wiki crawler** — Follow-links select, Strip toggle list (modern bordered list with check + label + hint + status pill "stripped/kept"), User agent, Rate limit.

**Shortcuts** — Keyboard shortcut reference list.

**About** — Version, runtime, dependencies notice.

## Interactions & Behavior

- **Reroll**: per-field generation takes ~1.1s mocked; replace with real LLM call. Reroll-all skips locked fields and staggers them with 120ms offset for visual rhythm.
- **Test endpoint**: mocked with ~80% success rate, 280–980ms latency. Real impl: send a 1-token `chat.completions.create` to verify URL + auth + model.
- **Save** (any): all save actions fire a toast via `window.toast({kind: 'ok', title, body})`.
- **Auto-save**: configurable from sidebar Save button's chevron menu (off / every 15s / 30s / 1min / 5min / 15min / on every change / on blur).
- **Image generation**: progress bar animated locally; real impl listens to ComfyUI WebSocket `progress` events.
- **Toast lifecycle**: 4.2s timeout, dismissible by X. Stacked bottom-right, column-reverse so newest is at bottom.
- **Modals & flyouts**: backdrop click closes; Esc closes; outside-click on popovers closes them.
- **Character switching**: instant; field values are mocked to be the same across characters in the prototype — real impl would swap to the active character's stored fields.
- **Theme toggle**: live; sets `[data-theme="dark"|"light"]` on `<html>` and updates accent variables.

## State Management

The prototype lifts the following state into the App root (`app.jsx`):
- `route` — current screen id
- `characters` — array of character objects
- `activeCharId` — current character
- `unsaved` — dirty flag
- `modal` — modal open state
- `confirmDelete` — character being confirmed for delete

Each screen manages its own form state internally with `useState`. The Settings screen further owns `endpoints`, `editing`, `testing`, and `moreOpen` state.

Toasts are global via `window.toast()` (registered by `ToastProvider` at App level).

For production, recommend:
- **React Query / TanStack Query** or **SWR** for any server state (LLM calls, ComfyUI WebSocket messages)
- **Zustand** or **Jotai** for project + character state (lightweight, file-persisted)
- **Tauri commands** / **Electron IPC** for filesystem operations (project save/load, image writes)

## Tweaks (in-design preference panel)

A bottom-right floating "Tweaks" panel (visible when the design system's edit mode is on) exposes:
- Dark / Light toggle
- Accent color picker (6 swatches)
- Sidebar style: rail / compact / wide
- Step number badges on/off
- Jump-to-screen list

These are real preferences that should be promoted to a "Preferences" / "Appearance" section in the production app's Settings.

## Assets

No images are bundled — every image slot in the design is either a hatched placeholder (`.hatch` class — 135° striped pattern with mono caption) or a checkerboard canvas with overlaid text. The production app generates portraits via ComfyUI and accepts uploads for project images.

Icons are all inline SVG components defined in `icons.jsx` — stroke-based, 1.6px, 24×24 viewBox, `currentColor` so they inherit. Replace with the codebase's icon library (Lucide, Phosphor, Heroicons) for consistency.

Fonts are loaded from Google Fonts. For an offline-capable desktop app, self-host the fonts and bundle them.

## Files (in this handoff)

| File | Purpose |
|---|---|
| `index.html` | Main entry point; loads fonts, React, Babel, and all jsx |
| `styles.css` | Design tokens (CSS custom properties), base styles, primitive classes (`.btn`, `.field`, `.card`, `.tag`, `.hatch`, `.dot`, `.bar`, etc.) |
| `app.jsx` | Root App component; route state, character state, modal/toast wiring |
| `components.jsx` | TitleBar, Sidebar (with SaveButton + auto-save popover), PageHead, CharacterStrip, StatusBar, Modal, ToastProvider |
| `icons.jsx` | Inline SVG icon set (Dashboard, Globe, Pen, Book, Image, Eye, Cog, etc.) |
| `screens-styles.jsx` | All screen-specific CSS injected at runtime |
| `screens-meta.jsx` | Dashboard + Settings (with sub-sections: LLM, ComfyUI, Prompts, Crawler, Shortcuts, About) + EndpointEditor flyout |
| `screen-crawler.jsx` | Step 01 — wiki crawler |
| `screen-editor.jsx` | Step 02 — character composer with reroll |
| `screen-lorebook.jsx` | Step 03 — lorebook editor with linked-character scoping |
| `screen-project-image.jsx` | Step 04 — project cover art |
| `screen-image.jsx` | Step 05 — character portrait via ComfyUI |
| `screen-export.jsx` | Step 06 — character card preview |
| `screen-export-hub.jsx` | Step 07 — bulk export hub |
| `tweaks-panel.jsx` | Reusable preference panel (host-protocol-aware) |
| `index-print.html` | A separate print-friendly entry that renders every screen as a fixed-size page; produces the PDF |
| `Silly Sleeve.pdf` | (Optional) Exported PDF of every screen — request from designer if not present |

## Implementation Order Recommendation

1. **Bootstrap the project shell** — title bar, sidebar nav, status bar, page-head primitive, route state, theme tokens (CSS vars + theme switcher). This unblocks every screen.
2. **Settings → LLM endpoints + ComfyUI** — without backends, the rest is dead. Build the editor flyout, test-connection plumbing, settings persistence.
3. **Crawl** — server-side fetcher with Fandom MediaWiki API, source caching.
4. **Compose** — field cards, per-field LLM rerolls with the prompt templates from Settings, generation history, lock states.
5. **Lorebook** — entry list + detail editor; JSON import/export matching SillyTavern's spec exactly.
6. **Project image + Portrait** — ComfyUI WebSocket integration; workflow parameter extraction; gallery management.
7. **Preview + Export** — assemble the character card; write the SillyTavern PNG v2/v3 format (PNG with `tEXt` chunk holding base64-encoded JSON character data).
8. **Dashboard** — project listing, opening, archiving.
9. **Auto-save + project file format** — local-first persistence; .slv bundle format.
