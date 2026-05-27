# silly-sleeve

Sleeves for your character cards and lore books.

A cross-platform desktop app to create [SillyTavern](https://sillytavern.app/) character cards and lore books using local AI.

## Features

- Connect to local AI via OpenAI-compatible API (ollama, llama.cpp, koboldcpp).
- Scrape fandom wikis via the MediaWiki API.
- Generate SillyTavern character cards (v2 spec) and lore books from scraped content.
- Save configuration and project bundles.

## Prerequisites

**Linux** — Wails requires GTK3 and WebKit2GTK development libraries.

On Debian/Ubuntu:

```bash
# Ubuntu 22.04+ and recent Debian
sudo apt install libgtk-3-dev libwebkit2gtk-4.1-dev

# Older distros (Ubuntu 20.04, etc.)
sudo apt install libgtk-3-dev libwebkit2gtk-4.0-dev
```

> If you have `libwebkit2gtk-4.1-dev`, build with the `webkit2_41` tag:
> ```bash
> wails build -tags webkit2_41
> ```

On Arch:

```bash
sudo pacman -S gtk3 webkit2gtk
```

On Fedora:

```bash
sudo dnf install gtk3-devel webkit2gtk3-devel
```

**macOS** and **Windows** have no extra system dependencies.

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
