# Audit remediation — 2026-08-14 (branch `fix/audit-findings`)

Fixes for every finding in `mem:audits/2026-08-14-full-project-audit`.
63 files changed, +2124/-1398, plus 10 new files. NOT yet pushed.

Final gate: `go build/vet/golangci-lint/gofmt` clean, `go test ./... -race`
878 pass / 16 pkgs, Go coverage **86.5%**; `tsc`/`eslint` clean, vitest
**809 pass / 50 files**, frontend **86.09%** statements;
`wails build -clean -tags webkit2_41` links (12.6 MB).

## Design decisions worth remembering

### VAE/LoRA (the "dead UI" finding)
- ComfyUI's VAELoader/LoraLoader need a REAL model file, so "baked VAE" / "no
  LoRA" cannot be a placeholder value — the node must be ABSENT and its
  consumers rewired. Hence `templates.go` now BUILDS the graph
  (`buildWorkflowGraph(withVAE, withLoRA)`) instead of storing one JSON blob.
  Four variants from one source of truth.
- Node IDs are stable across variants (1..7 base, 8=LoraLoader, 9=VAELoader).
- The frontend fetches a template when the WORKFLOW changes — before the user
  picks a VAE/LoRA. So `ComfyUIService.generateVariants` re-resolves it at
  generation time via `comfy.ResolveWorkflowTemplate(tmpl, vae, lora)`.
  `IsBuiltInTemplate` compares against all four variants; anything else is
  user-edited and returned UNTOUCHED (their template may use {{vae}}/{{lora}}).
- Sentinel for "omit the loader" is the **empty string** (`UsesVAE`/`UsesLoRA`
  also accept legacy "baked"/"none"). The dropdown's none-option has `value: ''`.
- `BuildPlaceholderValues` ALWAYS supplies vae+lora keys even when unused —
  `replaceStringPlaceholder` errors on an unknown placeholder, so a custom
  workflow referencing {{vae}} would fail to generate otherwise.

### WSListener supersede bug (introduced by a subagent, caught in review)
The agent's `Connect` guard closed the old conn — but the OLD listen goroutine
then got its read error and cleared the SHARED `running` flag, silently killing
the NEW connection. Fixed by handing each goroutine the conn it owns
(`go l.listen(conn)`) and only clearing state when `l.conn == conn`.
**Lesson: a "defensive guard" added without an ownership check can create a
worse bug than the latent one it fixes.**

### app.go split — rejected the subagent's version
The agent produced an `ImageManager` with `GetProjectImage(b []byte) []byte {
return b }` and a `SaveProjectImage` that ignored its first param; app.go GREW
916→923. Deleted it and moved the four portrait/cover methods into the existing
`app_files.go` (which exists for image I/O). app.go 916→**888**, no ceremony.
**Don't accept an extraction that adds indirection without encapsulating logic.**

### S6479 index keys — ATTEMPTED AND REVERTED (do not retry the same way)
Built a `useStableIds` ref-based hook so deleting a stats/quotes row wouldn't
re-key later rows. **ESLint rejected it: "Cannot access refs during render"
(10 errors)** — the rule is right. A correct fix needs row ids carried in the
character data model itself. Reverted; index keys kept with an explanatory
comment at both sites (`StatsField`, `QuoteRows` in EditorScreen).
**Recommendation: mark `typescript:S6479` accepted in SonarCloud** for the
read-only infobox lists too (static render, no reorder — index keys are correct).

## Other notable changes

- `crawler`: `Crawl(ctx, ...)`, `FetchPageWith(ctx, ...)`, `FetchReadable(ctx, ...)`
  now take a context; `FetchPage(url)` kept as a non-cancellable back-compat
  wrapper. `wait(ctx)` uses a timer+select so cancellation interrupts the
  rate-limit delay instead of sleeping it out. `App.crawlContext()` falls back to
  `context.Background()` because `a.ctx` is nil until Wails calls startup.
- `useBundleSave(projectPath, delay, label)` in `components/` replaces three
  duplicated debounced `SaveProjectBundle` blocks that only `console.error`d —
  failures now toast, because a failed bundle write means the work is memory-only.
- 93 `<button>` elements given `type="button"`. **Verified safe: the app has NO
  `<form>` elements at all**, so nothing could have been a submit button.
- CI actions SHA-pinned; I verified every SHA with `git ls-remote` and corrected
  one wrong comment (checkout@3d3c42e5 is **v7.0.1**, not v7.0.0).
- New integration tests: `internal/bundle/bundle_integration_test.go` (round-trip,
  field-level), `internal/cardimport/roundtrip_integration_test.go` (export→import
  fidelity; must be `package cardimport_test` to avoid an import cycle, since both
  cardexport and cardimport import compose), `internal/loreextract/integration_test.go`.
  `internal/compose/integration_test.go` (subagent-written) is WEAK — it only
  asserts the file exists and is >100 bytes; the real fidelity check is the
  cardimport round-trip one.

## Known follow-ups (not done)

- `frontend/src/components/settings/ComfyUISettings.tsx` is only 31% covered and
  `EndpointFlyout.tsx` 57% — the split made SettingsScreen's pre-existing low
  coverage visible per-file. Overall gate still passes.
- Wails CLI on this box is v2.12.0 but go.mod wants v2.14.0 (build warns).
- `.opencode/` vs `.claude/` dual agent config still unresolved.
