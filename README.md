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

### Development (hot-reload)

```bash
cd frontend && npm install && cd ..
wails dev
```

### Production build (current platform)

```bash
cd frontend && npm install && cd ..
wails build -clean
```

> `-clean` ensures a fresh build by cleaning the build directory first.

## Building Release Binaries

### Linux

```bash
wails build -clean
```

For Ubuntu 22.04+ with `libwebkit2gtk-4.1-dev`:

```bash
wails build -clean -tags webkit2_41
```

Cross-compile for specific architecture:

```bash
wails build -clean -platform linux/amd64
wails build -clean -platform linux/arm64
```

### macOS

```bash
wails build -clean
```

Universal binary (Intel + Apple Silicon):

```bash
wails build -clean -platform darwin/universal
```

### Windows

From Windows directly:

```bash
wails build -clean
```

Cross-compile from Linux (requires `mingw-w64`):

```bash
wails build -clean -platform windows/amd64
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

## License

MIT
