# Project Overview

This is a cross-platform desktop application built with Go and the Fyne toolkit. The purpose is to create character cards and lore books for SillyTavern.

## Tech Stack

- **Language:** Go 1.22+
- **UI Framework:** [Fyne v2](https://fyne.io/)
- **Lint:** [golangci-lint](https://golangci-lint.run/)
- **Test:** Go standard `testing` package
- **Config:** `os.UserConfigDir()` for cross-platform config storage
- **AI API:** OpenAI-compatible chat completions API (covers ollama, llama.cpp, koboldcpp)
- **Scraping:** MediaWiki API (fandom wikis)

## Build & Run

```bash
go run ./cmd/silly-sleeve
```

```bash
go build -o silly-sleeve ./cmd/silly-sleeve
```

## Lint

```bash
golangci-lint run ./...
```

## Test

```bash
go test ./...
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
- Use `fyne.io/fyne/v2` for all UI elements.
- Keep business logic separate from UI code; place it in `internal/`.

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

- Use Go's standard `testing` package.
- Place test files next to the code they test (e.g., `mycode_test.go`).

## Boundaries

- **Never** modify `go.mod` or `go.sum` directly. Only use `go get` or `go mod tidy`.
- **Never** commit code that doesn't compile.
- **Always ask** before adding a new external dependency.
- **Default agent:** `build` is fine — edits are local-file-only and easily reversible.
- **Bash:** read-only commands (`ls`, `grep`, `git status`, `git diff`) are safe to auto-allow. Writes (`rm`, `mv`, `git commit`, `git push`) should always require confirmation.

## Editing rules

### Always

- **Match the README's tone.** Practical, mental-model-first, prescriptive ("Reach for it when…"). No marketing fluff.
- **Update the `Last reviewed` date** at the bottom of the README when making material changes.

### Never

- **Don't invent commands, flags, or features.** If you can't verify it, leave it out.
- **Don't add `Co-Authored-By` lines to commits** unless the user asks for them.
- **Don't `git push --force` to `main`**, ever, without explicit permission.

## License

- License: MIT
