# Full project audit — 2026-08-14 (main @ bc24c24)

10 parallel agents + SonarCloud + local gate run. Every finding below was
re-verified against source by the orchestrator. Report artifact:
https://claude.ai/code/artifact/d751769d-f3a5-477f-ab05-8a13667b38dd

## Baseline (all green)

- `go build/vet/golangci-lint/gofmt/mod tidy/govulncheck`, `tsc`, `eslint`,
  `npm audit`: 0 errors. Working tree clean, no stray artifacts tracked.
- Go coverage 86.3% (all 14 pkgs >= 80%, `-race` clean, 793 tests).
  Frontend 85.55% stmts / 76.31% branch / 80.17% func, 778 tests / 48 files.
- SonarCloud gate OK, but **139 open issues** (~110 = `typescript:S9011`
  `<button>` without `type`; 4 = `go:S3776` Critical complexity).

## Open findings (not yet fixed)

### Correctness
1. **HIGH — PortraitScreen VAE/LoRA dropdowns are dead UI.**
   `PortraitScreen.tsx:213-226` use `defaultValue` with no `value`/`onChange`/state,
   AND `GenerationRequest` (`useImageGeneration.ts:13`) has no `vae`/`lora` field.
   Selection cannot reach the backend by any path. Wire both ends or remove.
2. **HIGH — `comfy_service.go:85 GetComfyWorkflows` returns raw nil slice.**
   Violates the documented `mem:conventions` Wails invariant (nil -> JS `null` =
   cancel sentinel). `GetComfy{Samplers,Schedulers,Checkpoints,VAEs,LoRAs}` pass
   `GetNodeInputList` through unguarded too. Frontend does `.then(setVaes)` ->
   `modelOpts(null)` throws. The rule is written down but nothing enforces it.
3. **MED — character-switch races.** `PortraitScreen.tsx:179`,
   `PreviewScreen.tsx:240-246` chain awaited calls with no guard.
   `EditorScreen` already has the `activeIdRef` fix — copy it.
4. **MED — auto-save failures silent.** `PortraitScreen.tsx:147`,
   `ProjectImageScreen.tsx:70`, `LorebookScreen.tsx:327` console-log a failed
   debounced `SaveProjectBundle`. Highest data-loss risk in the app.
5. **MED — floating promise** `EditorScreen.tsx:469` `SetProjectFieldEndpoint`.
   Note `no-floating-promises` is OFF (eslint is non-type-checked tseslint).
6. **LOW — `CrawlerScreen.tsx:89`** `.catch(() => {})` swallows state restore.

### Security (one real hole; everything else clean)
7. **HIGH — path traversal via server-controlled `promptID`.**
   `comfy/generator.go:265-267` interpolates `g.promptID` (set from the ComfyUI
   queue response at :116) into `filepath.Join`. Nuance: the format always
   appends `-<stamp>-<idx>.png`, so attacker controls dir + prefix but NOT the
   extension — arbitrary `.png` write, not RCE. Sanitize to `[A-Za-z0-9_-]`.
8. **LOW — dir perms inconsistent.** `project.go:58,71` + `library/sync.go:29`
   use `0o755`; `settings.go:87`, `library.go:66`, `thumbnail.go:27` use `0o700`.
9. **LOW — no aggregate caps.** `bundle.go:25` caps each entry at 64 MiB and
   `safeEntryName` blocks zip-slip (tested), but no entry-COUNT or total-bytes
   cap. `cardimport/parse.go:148` base64-decodes with no length check; no
   file-size cap upstream at `app.go:816,840`.

Verified CLEAN: no `dangerouslySetInnerHTML`, no `os/exec`, no
`InsecureSkipVerify`, URL scheme validation on both LLM + Comfy base URLs,
zip-slip tested, secrets `0o600` and never logged, no hardcoded creds,
crawler emits text not HTML, govulncheck + npm audit in CI.

### Maintainability
10. **`internal/crawler/sanitize.go` is the worst file in the repo** — 3 of the 4
    Sonar Critical complexity findings: `ExtractSections`:432 = **68**,
    `getListContent`:273 = 42, `extractTableInfobox`:340 = 29 (limit 15).
    It also parses untrusted wiki HTML, so complexity there is a correctness risk.
    Also `compose/generate.go:90` = 19.
11. Size outliers: `SettingsScreen.tsx` 1196 LOC, `app.go` 916 LOC.
12. Crawler takes no `context.Context` (`app.go:257`) — crawl is uncancellable.
13. `WSListener.Connect` would leak a goroutine if called twice, but
    `Generator.Run` pairs it with `defer Close()` on a per-generation instance —
    **latent API hazard, NOT a live bug.**

### Tests
14. `components/GenerationParamsPanel.tsx` has **no test file** (only component
    in the dir without one).
15. **No integration tests** for crawl->summarize->compose->export, bundle
    round-trip, or lorebook extraction — despite AGENTS.md requiring them.
    Unit coverage is high because layers are tested in isolation; the seams are
    exactly where findings 2 and 3 live.
16. `useAutoSave.test.ts:83,108,129,151,175` call `vi.useFakeTimers()` inside
    test bodies — the exact anti-pattern `mem:conventions` forbids.

### Docs / CI drift
17. `AGENTS.md:7` says Go 1.22+; `go.mod` is 1.25.0; README says 1.25+.
18. `mem:tech_stack` line 5 says Wails v2.12.0; `go.mod` has v2.14.0. **STALE.**
19. CI has **no explicit `go vet` step** though CONTRIBUTING claims it (covered
    implicitly by golangci-lint's standard preset).
20. `actions/checkout|setup-go|setup-node|upload-artifact` on mutable `@v7`;
    only golangci-lint-action is SHA-pinned. Sonar `githubactions` analyser has
    already pushed security rating to C over this class before — it will return.
21. `AGENTS.md:28` says `pacman -S webkit2gtk`; README:36 says `webkit2gtk-4.1`.
22. Both `.opencode/` and `.claude/` agent configs exist — divergence risk.

## Agent claims that were WRONG (do not re-report)

- "ExportScreen leaks event listeners / missing dep array" — FALSE.
  `ExportScreen.tsx:82` has `}, []` plus a matching `EventsOff`.
- "ConfirmDialog focuses Cancel not Confirm" — FALSE. `useFocusTrap.ts:43`
  queries `[data-autofocus]` BEFORE first-focusable, and it's on Confirm.
- "CardScreen.tsx has 49% branch coverage" — FALSE. No such file exists.
- "LLM client is not injectable / hard-wired to DefaultCompleter" — FALSE.
  Seams exist and are documented: `completerOrDefault()` in
  `character_generator.go:31`, `extract.go:32`, `connect.go:34`;
  `NewExtractor(llm.Completer)`; `GenerateBulkWith`/`GenerateFieldWith`.

## Process lesson

Roughly 1 in 5 subagent findings did not survive verification against source —
including several rated "critical". **Always re-check a subagent's claim by
reading the cited lines before acting on it or reporting it to the user.**
Severity ratings from agents also skew high; recalibrate against real
exploitability and reachability (e.g. finding 7's forced `.png` suffix,
finding 13's paired Connect/Close).
