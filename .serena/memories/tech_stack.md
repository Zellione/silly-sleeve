# Tech Stack

## Backend (Go)
- Go 1.25
- Wails v2.12.0 — desktop bridge (CGo; needs GTK3 + WebKit2GTK on Linux)
- github.com/stretchr/testify v1.11.1 — test assertions
- github.com/google/uuid v1.6.0
- github.com/pkoukk/tiktoken-go v0.1.8 — token counting
- github.com/gorilla/websocket v1.5.3 — ComfyUI WS client
- github.com/samber/lo v1.49.1 — generic slice helpers
- golangci-lint — linter (config: .golangci.yml)

## Frontend (TypeScript / React)
- React 19, TypeScript 6
- Vite (build + dev server)
- Vitest + @testing-library/react — unit / component tests
- @vitest/coverage-v8 — coverage (threshold: ≥80% statements)
- ESLint with typescript-eslint + react-hooks + react-refresh plugins
- No routing library — tab state is plain React useState in App.tsx
- No CSS-in-JS — single style.css with CSS custom properties

## Linux system deps (build-time)
- Ubuntu 22.04+ / Arch: libwebkit2gtk-4.1-dev (add `-tags webkit2_41` to wails build)
- Ubuntu 20.04: libwebkit2gtk-4.0-dev
- Arch: `sudo pacman -S gtk3 webkit2gtk`
