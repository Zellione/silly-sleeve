# Project Overview

This is a cross-platform desktop application built with **Wails v2** (Go backend + React frontend) for creating SillyTavern character cards and lore books.

## Tech Stack

- **Language:** Go 1.22+
- **Frontend:** React 18 + Vite + TypeScript
- **Desktop bridge:** Wails v2
- **Lint:** `golangci-lint` (Go), ESLint (React)
- **Test:** Go standard `testing` + `stretchr/testify`; Vitest + Testing Library (React)
- **Config:** `os.UserConfigDir()` for cross-platform config storage
- **AI API:** OpenAI-compatible chat completions API (covers ollama, llama.cpp, koboldcpp)
- **Scraping:** MediaWiki API (fandom wikis)

## Build & Run

Requires [Wails CLI](https://wails.io/docs/gettingstarted/installation).

### Linux prerequisites

```bash
# Ubuntu 22.04+
sudo apt install libgtk-3-dev libwebkit2gtk-4.1-dev
# Ubuntu 20.04 / older Debian
sudo apt install libgtk-3-dev libwebkit2gtk-4.0-dev
# Arch
sudo pacman -S gtk3 webkit2gtk
# Fedora
sudo dnf install gtk3-devel webkit2gtk3-devel
```

### Development (hot-reload)

```bash
cd frontend && npm install && cd ..
wails dev
```

### Production build

```bash
cd frontend && npm install && cd ..
wails build -clean
```

> With `libwebkit2gtk-4.1-dev` (Ubuntu 22.04+), add the build tag:
> ```bash
> wails build -clean -tags webkit2_41
> ```

> In headless environments without GTK3 / WebKit2GTK dev libraries, the
> CGo link step will fail. This is expected — verify Go compilation with
> `go build ./...` and the frontend with `cd frontend && npm run build`
> instead.

## Lint

```bash
go vet ./...
golangci-lint run ./...
cd frontend && npm run lint && cd ..
```

## Test

```bash
go test ./... -race -cover
```
```bash
cd frontend && npm test && cd ..
```

## Function

- Connect local AIs via OpenAI-compatible API (ollama, llama.cpp, koboldcpp).
- Scrape fandom wikis via the MediaWiki API and sanitize the result.
- Use AI to summarize the scraped content with a special output format.
- Use that special output format to create character card or lorebook compatible with SillyTavern.
- Save the character card as JSON.
- Settings menu for AI connection configuration.
- Save configuration (separate from project data).
- Save current work as a project bundle.

## References

Only ever load references if needed !

### Character Card Creation

- https://wikia.schneedc.com/bot-creation/trappu/creation
- https://rentry.co/alichat
- https://rentry.co/kingbri-chara-guide
- https://docs.sillytavern.app/usage/core-concepts/characterdesign/

### World Info

- https://rentry.co/world-info-encyclopedia
- https://docs.sillytavern.app/usage/core-concepts/worldinfo/

### System Prompt Examples:

- https://raw.githubusercontent.com/cha1latte/sillytavern-character-generator/refs/heads/main/character_card_creator.md
- https://raw.githubusercontent.com/cha1latte/universal-lorebook-creator/refs/heads/main/lorebook_creator_v2.md

## Code Style & Conventions

- Follow standard Go conventions (gofmt).
- Follow standard React/TypeScript conventions (ESLint, Prettier if configured).
- Keep business logic separate from UI code; place Go logic in `internal/` and React logic in `frontend/src/`.

### Markdown

- One blank line between sections. No trailing whitespace.
- Code fences with language tags: ` ```bash `, ` ```json `, ` ```markdown `.
- Internal links use anchor form: `[label](#section-id)`. Anchors are auto-derived from headings (lowercased, spaces → dashes, special chars stripped).
- Tables: header row, separator row, no leading/trailing pipes. Keep column widths reasonable for desktop reading.
- Callouts use blockquotes with emoji prefixes:
  - `> 💡 **Pro Tip:** …` for tips
  - `> ⚠️ **Warning:** …` for foot-guns
  - `> 🆕 …` for new features
  - `> 📚 …` for deeper-reading pointers
- Emoji policy:
  - **OK** — one leading emoji on H2 navigation headings (🧭 🧠 📚 📖), and the callout-prefix set above.
  - **Not OK** — decorative emoji inside prose, in code, or on H3/H4 headings. One per spot, never decorative density.

## Testing

- Use Go's standard `testing` package with `stretchr/testify` for assertions.
- Place test files next to the code they test (e.g., `mycode_test.go`).
- Every feature must have tests — both backend and frontend. Minimum **80%** coverage.
- Complex workflows require integration tests.
- See [CONTRIBUTING.md](CONTRIBUTING.md) for detailed testing rules and CI expectations.

## Boundaries

- **Never** modify `go.mod` or `go.sum` directly. Only use `go get` or `go mod tidy`.
- **Never** modify `frontend/package.json` or `package-lock.json` directly. Only use `npm install`.
- **Never** commit code that doesn't compile.
- **Never** commit code that drops test coverage below 80% or lacks tests for new features.
- **Never** commit code that has lint errors or warnings.
- **Never** commit code that fails `go vet`, `golangci-lint`, `tsc --noEmit`, or `eslint`.
- **Always ask** before adding a new external dependency.
- **Default agent:** `build` is fine — edits are local-file-only and easily reversible.
- **Bash:** read-only commands (`ls`, `grep`, `git status`, `git diff`) are safe to auto-allow. Writes (`rm`, `mv`, `git commit`, `git push`) should always require confirmation.

## Editing rules

### Always

- **Match the README's tone.** Practical, mental-model-first, prescriptive ("Reach for it when…"). No marketing fluff.
- **Update the `Last updated` date** in `ROADMAP.md` when making material changes.
- **Run all lint + test + coverage checks before committing.** Execute `go vet ./...`, `golangci-lint run ./...`, `go test ./... -race -cover`, `cd frontend && npm run lint`, and `cd frontend && npm run test:coverage && cd ..`. Only commit when all commands exit with **0 errors, 0 warnings, and ≥ 80% coverage**.
- **Run `wails build -clean` at milestone completion** to verify the binary compiles and links correctly on the target platform.

### Never

- **Don't invent commands, flags, or features.** If you can't verify it, leave it out.
- **Don't add `Co-Authored-By` lines to commits** unless the user asks for them.
- **Don't `git push --force` to `main`**, ever, without explicit permission.

## Workflow: Feature & Milestone Implementation

This section defines the step-by-step process for implementing any milestone or feature from `ROADMAP.md`.

### 1. Planning & Branching

- Identify the milestone or feature from `ROADMAP.md`.
- Ensure `main` is up to date: `git checkout main && git pull`.
- Create a branch using the approved naming convention:
  ```bash
  git checkout -b milestone/2-crawler
  # or
  git checkout -b feature/toast-system
  ```
- Update `ROADMAP.md`:
  - Update `Last updated:` date to today's date (YYYY-MM-DD).
  - Mark the first substep as in progress: `- [~] **1.1** ...`.
  - Add a new progress log entry with today's date.
- Commit:
  ```text
  chore(roadmap): start <milestone name>
  ```

### 2. Substep Implementation

For each substep (e.g., `1.1`, `1.2`):
1. Implement code and tests.
2. Run the full local quality gate:
   ```bash
   go vet ./...
   golangci-lint run ./...
   go test ./... -race -cover
   cd frontend && npm run lint && npm run test:coverage && cd ..
   wails build -clean
   ```
3. Verify **0 errors, 0 warnings**, and **≥80% coverage**.
4. Commit using the substep number in the subject line:
   ```text
   feat(crawler): 1.1 add URL input and crawl options UI
   ```
   Include the full substep description in the commit body.

### 3. Milestone Completion

- Mark all substeps as completed in `ROADMAP.md`: `- [x]`.
- Ensure the progress log reflects completion with today's date.
- Run the full pre-commit checklist one final time:
   ```bash
   go vet ./...
   golangci-lint run ./...
   go test ./... -race -cover
   cd frontend && npm run lint && npm run test:coverage && cd ..
   wails build -clean
   ```
- **Do not push.**

### 4. Approval Gate

Before pushing, generate an `APPROVAL_REQUEST.md` file in the repository root containing:
- Branch name.
- List of commits mapped to their ROADMAP substeps.
- Lint and coverage summary.
- Any deviations or assumptions made.
- `git diff --stat` summary.

**`APPROVAL_REQUEST.md` must never be committed or pushed.**
It is for local review only.

Wait for explicit user approval before proceeding.

### 5. Push & PR

Once approved:
- **Delete `APPROVAL_REQUEST.md`** before pushing.
- Push the branch:
  ```bash
  git push -u origin <branch-name>
  ```
- Open a Pull Request describing each commit and its corresponding substep.
- Ensure CI passes before merge.

If rejected:
- Revise the code as requested.
- Delete `APPROVAL_REQUEST.md`.
- Re-generate it after fixes and return to step 4.

## License

- License: MIT
