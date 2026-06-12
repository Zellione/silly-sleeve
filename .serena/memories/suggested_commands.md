# Suggested Commands

## Development
```bash
wails dev                        # hot-reload (Go + frontend together)
cd frontend && npm run dev       # frontend-only Vite dev server
```

## Build
```bash
wails build -clean                          # production binary
wails build -clean -tags webkit2_41        # Ubuntu 22.04+ with libwebkit2gtk-4.1-dev
go build ./...                              # headless check (no CGo/GTK needed)
cd frontend && npm run build               # frontend-only build
```

## Test
```bash
go test ./... -race -cover                 # Go tests
cd frontend && npm test                    # frontend tests (single run)
cd frontend && npm run test:coverage       # with v8 coverage report
```

## Lint
```bash
go vet ./...
golangci-lint run ./...
cd frontend && npm run lint                # runs tsc --noEmit + eslint --max-warnings 0
```

## Notes
- `npm run lint` runs TypeScript type-check first, then ESLint.
- Never use `go mod` or `npm install` flags to add/remove deps without user approval.
- `wails dev` auto-regenerates `frontend/wailsjs/` when Go method signatures change.
