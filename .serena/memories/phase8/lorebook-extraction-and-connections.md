# Phase 8 — Lorebook extraction & connections

Branch `milestone/8-lorebook-extraction`, 12 commits, **not pushed** at session end.
`APPROVAL_REQUEST.md` written to repo root (uncommitted, per AGENTS.md).
Supersedes the lorebook half of `mem:crawl_per_result_send`.

## What changed behaviourally

Sending a crawl with role=lorebook **no longer creates an entry**. It stages the
page; the LLM extracts atomic facts; the user reviews/edits; only ticked
candidates become entries. A separate whole-project pass proposes missed links.

The old path (`appendLorebookFromCrawl` + `crawlPlainText`, both **deleted**)
concatenated every section body into one entry with `Key: []` — an entry that can
never fire in SillyTavern, and blows the context budget if it does.

Character sends are **unchanged** (still create a stub immediately).

New `SendCrawlOutcome.Status` values: `staged`, `restaged` (alongside
created/overwritten/needs_confirm/missing). `CrawlSendResult` gained `Staged`.

## Connections are NOT a new data model

Per the [universal-lorebook-creator v2 spec](https://raw.githubusercontent.com/cha1latte/universal-lorebook-creator/refs/heads/main/lorebook_creator_v2.md)
(the user chose this explicitly): connections live in the SillyTavern fields that
already exist — keyword linkage, `Characters[]` scoping, `preventRecursion` per
category, bracketed `[ relationships(Name(dynamic)); ]` metadata in content, and
content mentions. No graph, no edges table.

## Package layout & why

- `internal/lorebook/{category,normalize}.go` — pure, **LLM-free**. `cardexport`
  and `cardimport` already import `lorebook`; keeping it free of `llm`/`crawler`
  is why the token counter is an injected `TokenCounter` func rather than a
  direct `compose.CountTokens` call.
- `internal/loreextract/` — new package, owns all LLM plumbing (Extractor,
  Connector, prompts wiring, JSON parsing). Only `app` imports it.
- `internal/app/app_lore.go` — bindings.

## Key design decisions (don't relitigate)

1. **`Entry.Category` is stored, not derived.** Position + `preventRecursion`
   cannot distinguish location / organization / concept — all three are
   `(0, false)`. `json:"category,omitempty"` so pre-existing entries round-trip
   without the key.
2. **The normaliser is the enforcement mechanism, not the prompt.** Local models
   cluster every order on 100 and emit bare `"sword"` as a key regardless of
   instructions. `Normalize` **forces** category-implied settings (position,
   recursion, constant) and **reports** judgement calls (too few keys, overlong
   content) rather than repairing them — inventing keywords or truncating
   mid-sentence is worse than the problem. Adjustments surface in the review UI.
3. **Only single-word keys hit the generic stoplist.** Spec treats bare "queen"
   as generic but "the Queen" / "Queen Elara" as valid — qualifying a word is
   what makes it specific. Multi-word keys always pass. `lorebook.IsGenericKey`
   is exported so the Connector reuses one stoplist.
4. **Order redistribution only when >half a batch shares one order.** A
   deliberately spread batch is left alone. Affected entries move to their
   category's tier and fan out inside it.
5. **`Normalize` returns `[]NormalizeResult`** (entry + per-entry adjustments),
   NOT the flat `([]Entry, []string)` in the plan — `Candidate.Adjustments` is
   per-candidate, so a flat list would need re-splitting.
6. **Lorebook gets its own system prompt** (`prompts.LoreSystem`). Framing with
   "expert character card creator" pulls extraction toward writing character
   cards. All 4 lore prompts are user-editable via `TemplateSet.LorePrompts`.
7. **Connection batching is by token budget**, not entry count. Every batch
   carries the full roster + a `uid · comment · keys` index of **all** entries
   (that's what lets links cross batch boundaries) + full text of one batch.
   One bad batch doesn't discard the others; only an all-failed pass errors.
8. **Suggestions are validated before display** — unknown uids/char-ids dropped,
   no-ops dropped (key already present, already scoped). A suggestion that
   silently does nothing on approve is worse than no suggestion.
9. **Approve takes candidates back from the frontend.** The user edits them in
   the review UI; that state is the source of truth for edits in flight.
   Unticked = rejected, not deferred — approving consumes all candidates from
   the pages involved.
10. **Applying suggestions is additive** (merge keys/scoping, case-insensitive
    dedupe) **except** `characterCharacter`, which replaces prose — hence the
    current-vs-proposed diff with an editable proposal.

## Landmines hit

- **`Entry.Characters[]` holds character *ID strings*** (`String(c.id)`), but
  LLMs reason in names. `loreextract.resolveCharacterRefs` maps names→ids
  case-insensitively, drops unmatched, and **reports** the drop. Same seam bit
  again in `SuggestionList.tsx` (`addCharacters` is `string[]`, roster keyed by
  number → `charName(Number(id))`).
- **Wails references types it never emits.** `loreextract.ExtractionMode` is a Go
  string alias; the generator only emits structs, so `App.d.ts` names a type
  absent from `models.ts`. `skipLibCheck` hides it in the `.d.ts` but NOT at our
  call site → one cast in `useLoreStaging.ts`.
- **`SavePromptTemplates` data loss (fixed).** It stored the incoming set
  wholesale; SettingsScreen rebuilds a `TemplateSet` from systemPrompt +
  fieldPrompts only, so editing any character prompt would wipe customised lore
  prompts. Now uses `TemplateSet.Merge` (nil group = keep existing).
- **`{{char}}`/`{{user}}` in the system prompt are literal**, not substitutions.
  `Substitute` leaves unknown placeholders alone, which is what we want — but a
  naive "every placeholder must be declared" test will flag them.
- **The `unused` linter** flags an App struct field added a substep before its
  first use. Add fields in the substep that uses them.
- **Test gotcha:** candidate title and trigger key can be the same string
  ("Denerim" as both `<b>` and `.k`), so `findByText` is ambiguous — anchor on
  `getByRole('checkbox', { name: /Keep X/i })`.
- **Test gotcha:** the crawler role picker is a custom `Dropdown` (button owning
  a listbox), not a native `<select>` — `selectOptions` fails. Click the
  `combobox` by its `Role for <title>` label, then the `option`.
- **Test gotcha:** `vi.mock` replaces the whole App module, so adding bindings
  means updating `LorebookScreen.test.tsx` AND `screens/index.test.tsx` mocks
  even though those screens don't call them.

## Also done this session

`gofmt` was **not** in the linter set and 16 files had drifted. Added a
`formatters:` section to `.golangci.yml` (v2 syntax) and reformatted — whitespace
only, own commit `e4ecee3`.

## Gate (all green)

vet + golangci-lint clean; `go test -race` 793 pass / 86.3%
(loreextract 98.9, lorebook 96.5, prompts 95.7, app 90.3, bundle 81.5);
tsc + eslint clean; vitest 778 pass / 85.4% statements, 87.4% lines;
`wails build -clean -tags webkit2_41` links (12.5s).

## Known gaps

- Lore prompts are stored/honoured but **not listed in SettingsScreen** yet.
- 15s LLM client timeout unchanged — may be tight for split extraction on a long
  page with a slow local model. Raise per-call-site, not globally, if it bites.
- Connection pass batches run sequentially with no progress UI.
- **Prompts never run against a real model** — all LLM paths tested through the
  `llm.Completer` seam with canned responses.

## Not committed

`go.mod`/`go.sum` carry a **pre-existing** local downgrade of `wails/v2`
2.13.0 → 2.12.0 that predates this branch. Left untouched (AGENTS.md forbids
editing them directly).
