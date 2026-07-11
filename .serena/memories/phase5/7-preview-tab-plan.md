# Phase 5 — Character Preview (`milestone/7-preview-tab`) — COMPLETE

All substeps 7.1–7.5 implemented, tested, and committed on branch
`milestone/7-preview-tab`. Full quality gate green at every substep.

## Commits (in order)
- 7.1 alt-greetings data model
- 7.2 shared `CharacterStrip` + `GetCardPreview` binding
- 7.3 `feat(preview): 7.3 add Preview screen character-card sheet` (35e542f)
- 7.4 `feat(preview): 7.4 add chat greeting bubble with swipe controls` (22ff9d8)
- 7.5 `feat(preview): 7.5 add token budget, linked lorebook, and ready check panels` (011c700)

## 7.5 summary (final substep)
Populated the `.export-side` right column (CSS-only since 7.3) in
`frontend/src/screens/PreviewScreen.tsx` with three new local components:
- `TokenBudgetPanel` — uses `GetCardPreview().tokens`; bar width = `value/total`
  (self-normalizing, not a hardcoded per-field max); footer row
  `total.toLocaleString() / 2048` (2048 is a fixed presentational reference,
  no config source exists for it).
- `LinkedLorebookPanel` — uses `GetLorebook()`; filters via the milestone-6.5
  scoping convention: `lorebook.Entry.characters: string[]` holds stringified
  character IDs, **empty array = global** (applies to all characters). Filter:
  `characters.length === 0 || characters.includes(String(activeChar.id))`.
- `ReadyCheckPanel` — pure client-side derivation from already-fetched
  `activeChar` + `portrait` state, 6 items matching the mockup exactly (Name &
  tags, Personality, Appearance, Backstory, Portrait, First message/greeting).
  Each row has `aria-label="<item>: complete|incomplete"` for testable a11y
  (avoids relying on icon color/shape).

Key technical decision: `GetCardPreview()` takes **no character-ID arg** (reads
server-side active character), unlike `GetPortrait(id)`. So `selectChar` chains
`SetActiveCharacter(id).then(() => GetCardPreview()).then(setCardPreview)`
rather than a separate `activeId`-keyed `useEffect`, to avoid a race where the
panel could show the previous character's tokens.

CSS: ported base `.card` (background/border/radius), `.bar`, `.divline` from
`design_handoff/styles.css` into `frontend/src/style.css` — these are generic
rules the pre-existing `.export-side .card` / `.lorebook-row` (added in 7.3)
depended on but that had never actually been ported in any earlier milestone
(also fixes latent unstyled `.card` usage in `ExportScreen.tsx`/`ImageUploadPanel.tsx`).

Test fix pattern (recurring since 7.4): new UI text duplicates existing field
labels ("Appearance", "Personality", etc. now also appear as ReadyCheck row
labels) → scope assertions with `within(container.querySelector('.character-card')!)`
rather than bare `screen.getByText`.

Final quality gate (7.5): go vet/golangci-lint clean (no Go changes), tsc/eslint
clean, 737 frontend tests / 84.92% stmts / 86.9% lines (PreviewScreen.tsx
97.05%/96.61%), Go 591 tests passing `-race`, `wails build -clean -tags webkit2_41` links.

## Status
**Phase 5 is done.** Branch has 3 non-roadmap commits ahead too (`1992afd`
gitignore chore, `1a32cae` wailsjs runtime cleanup — pre-existing, not part of
this feature work). Not yet pushed; no PR opened. Per `AGENTS.md` workflow,
next step is the Approval Gate (step 4): generate `APPROVAL_REQUEST.md`
(local-only, never committed) summarizing branch/commits/lint/coverage before
asking the user for push approval — only do this if/when the user asks to
proceed to push, not automatically.
