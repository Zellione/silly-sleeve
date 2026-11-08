# silly-sleeve

Sleeves for your character cards and lore books.

A local tool to create [SillyTavern](https://sillytavern.app/) character cards and lore books using local AI. The heavy lifting (wiki scraping, LLM calls, card and lorebook assembly, exports) runs in a Go backend; the UI is a React app served to your browser from `127.0.0.1`.

## Features

- Connect to local AI via OpenAI-compatible API (ollama, llama.cpp, koboldcpp).
- Scrape fandom wikis via the MediaWiki API.
- Generate SillyTavern character cards (v2 spec) and lore books from scraped content.
- Save configuration and project bundles.
- Everything runs on loopback: the backend listens on `127.0.0.1` only and opens your browser automatically.

## Prerequisites

- [Go 1.26+](https://go.dev/doc/install)
- [Node.js 22+](https://nodejs.org/)

No system GUI libraries are required — the app is a plain Go binary that serves the frontend to a normal browser, so it builds headless (CI, containers, servers).

## Tech Stack

- **Frontend:** React 18 + Vite + TypeScript (thin client: input and output only)
- **Backend:** Go 1.26+ (crawling, LLM, ComfyUI, export, persistence)
- **Bridge:** local HTTP server (stdlib `net/http`) + Server-Sent Events
- **Config / storage:** `os.UserConfigDir()` for settings and the managed project library; `.slv` zip bundles for projects

## Build & Run

### 1. Build the frontend

```bash
cd frontend && npm install && npm run build && cd ..
```

The built `frontend/dist` is embedded into the Go binary at compile time.

### 2. Run

```bash
go run .
```

This starts the backend on `http://127.0.0.1:8090` (the next free port is used if 8090 is taken) and opens a browser window. Useful flags:

```bash
go run . -listen 127.0.0.1:9000   # fixed port
go run . -no-browser              # don't open a browser
```

### Development (hot-reload)

The backend serves the built frontend, so `go run .` alone is enough for a normal
run — no separate frontend server is needed. The Vite dev server is optional,
and only for source hot-reload:

```bash
# Backend — API, SSE and static frontend on 127.0.0.1:8090
# (build frontend/dist first with `npm run build`)
go run . -no-browser

# Optional — hot-reload UI on http://localhost:5173
cd frontend && npm install && npm run dev
```

The Vite dev server proxies `/api/*` to the backend; it is not part of the normal
run.

## Building Release Binaries

The binary embeds the frontend and links without CGo, so cross-compiling is a plain `GOOS`/`GOARCH` build. Build `frontend/dist` first, then:

```bash
# Current platform
go build -o build/bin/silly-sleeve .

# Cross-compile
GOOS=linux GOARCH=amd64 go build -o build/bin/silly-sleeve-linux-amd64 .
GOOS=linux GOARCH=arm64 go build -o build/bin/silly-sleeve-linux-arm64 .
GOOS=darwin GOARCH=arm64 go build -o build/bin/silly-sleeve-darwin-arm64 .
GOOS=windows GOARCH=amd64 go build -o build/bin/silly-sleeve-windows-amd64.exe .
```

## Lint

```bash
go vet ./...
golangci-lint run ./...
cd frontend && npm run lint && cd ..
```

## Test

```bash
go test ./... -race -cover
cd frontend && npm run test:coverage && cd ..
```

## LLM Interaction Test Harness

Reach for it when you want to know how well a local model handles the app's real
prompts — it runs every LLM interaction (bulk generation, per-field rerolls,
image prompts, lore extraction, connections, optimize suggestions) against a
live endpoint and documents format and consistency problems.

```bash
# Test the default local endpoint (http://localhost:8001/v1), 3 runs per scenario.
# Without -model, the harness asks the endpoint's /models listing and uses the
# first model it reports.
go run ./cmd/llmtest

# Different endpoint, fewer runs, one scenario only
go run ./cmd/llmtest -endpoint http://localhost:11434/v1 -model llama3 -runs 1 -only bulk-generate

# List available scenarios
go run ./cmd/llmtest -list
```

The endpoint connectivity test runs first; if it fails in every run, the
remaining scenarios are skipped. Each run writes a timestamped folder under
`docs/llm-reports/` (gitignored) containing `report.md` — findings, worst
offenders first — and `runs.jsonl` with every raw request/response pair for
later analysis. The report is rewritten after every scenario, so an
interrupted run keeps everything gathered up to that point. Findings never
fail the process; they are the product.

> ⚠️ **Warning:** The harness sends real requests to the endpoint you point it
> at. It is a manual tool — it is not part of `go test` or CI.

## License

MIT
