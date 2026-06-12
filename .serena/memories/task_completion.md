# Task Completion Checklist

Run all of the following before committing. All must exit 0 with ≥80% coverage.

```bash
go vet ./...
golangci-lint run ./...
go test ./... -race -cover
cd frontend && npm run lint && npm run test:coverage && cd ..
```

At milestone completion, also verify the binary links:
```bash
wails build -clean
# Ubuntu 22.04+ with libwebkit2gtk-4.1-dev:
wails build -clean -tags webkit2_41
# Headless (no GTK/WebKit dev libs):
go build ./...
cd frontend && npm run build
```

## Commit conventions
- Subject: `<type>(<scope>): <description>` — e.g. `feat(crawler): add URL input`
- Types: feat, fix, chore, refactor, test, docs
- Scope: Go package name or frontend component/screen name
- Never amend published commits; always create a new commit after hook failure.
- Never add `Co-Authored-By` lines unless explicitly requested.
