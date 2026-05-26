# silly-sleeve

Sleeves for your character cards and lore books.

A cross-platform desktop app to create [SillyTavern](https://sillytavern.app/) character cards and lore books using local AI.

## Features

- Connect to local AI via OpenAI-compatible API (ollama, llama.cpp, koboldcpp).
- Scrape fandom wikis via the MediaWiki API.
- Generate SillyTavern character cards (v2 spec) and lore books from scraped content.
- Save configuration and project bundles.

## Tech Stack

- **Frontend:** React 18 + Vite + TypeScript
- **Desktop bridge:** Wails v2
- **Backend:** Go 1.22+
- **Config / storage:** `os.UserConfigDir()` for settings; `.slv` zip bundles for projects

## Build & Run

> Requires [Wails CLI](https://wails.io/docs/gettingstarted/installation) and Go 1.22+.

```bash
cd frontend && npm install && cd ..
wails dev
```

```bash
wails build
```

## Lint

```bash
cd frontend && npm run lint && cd ..
golangci-lint run ./...
```

## Test

```bash
go test ./...
cd frontend && npm test
```

## License

MIT
