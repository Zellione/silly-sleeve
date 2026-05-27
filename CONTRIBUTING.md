# Contributing to silly-sleeve

Thank you for contributing. This document outlines the rules and conventions you must follow.

## Lint Requirements

Every line of code must pass lint with **0 errors and 0 warnings**.

### Backend (Go)

- `gofmt` for formatting — run `gofmt -w .`
- `go vet ./...` for static analysis
- `golangci-lint run ./...` for comprehensive linting

```bash
golangci-lint run ./...
go vet ./...
```

### Frontend (React/TypeScript)

- `tsc --noEmit` for type checking — no implicit `any`, strict mode
- `eslint src --max-warnings 0` for code quality — warnings are treated as errors
- Follows the project's `eslint.config.js` (flat config)

```bash
npm run lint
# Equivalent to: tsc --noEmit && eslint src --max-warnings 0
```

## Testing Requirements

Every feature must have tests. No exceptions.

### Backend (Go)

- Every exported function, method, and package must have corresponding `*_test.go` files co-located with the source.
- Use Go's standard `testing` package with `github.com/stretchr/testify` for assertions.
- Minimum **80%** code coverage (`go test -cover`).
- Mock external dependencies (HTTP, filesystem) using `httptest.Server` and interfaces.

```bash
go test ./... -race -coverprofile=coverage.out
go tool cover -func=coverage.out | grep total
```

### Frontend (React/TypeScript)

- Every feature, component, hook, and utility must have corresponding `*.test.ts` or `*.test.tsx` files co-located with the source.
- Use **Vitest** with `@testing-library/react` and `jsdom`.
- Minimum **80%** code coverage (`npm run test:coverage`).
- Mock Wails bindings (`wailsjs/go/main/App`) and browser APIs (`localStorage`, `matchMedia`).

```bash
npm test
npm run test:coverage
```

### Integration Tests

Complex workflows that span multiple packages or components must have integration tests. These verify that the system's pieces work together correctly.

Examples of complex workflows:
- Settings lifecycle: load → edit → test connection → save → reload
- LLM connectivity: endpoint configuration → test → result propagation
- Character card generation: scrape → summarize → generate → export

Integration tests live alongside unit tests in the same `*_test.go` / `*.test.tsx` files. Use longer scenario-based test functions with descriptive names like `TestSettingsRoundtrip` or `TestEndpointCRUD`.

### What constitutes a complex workflow

A workflow qualifies as complex and requires integration tests when:
1. It involves **3 or more function calls** across different packages or components.
2. It includes **state mutations** that must be verified across boundaries (e.g., UI updates after backend persistence).
3. It includes **I/O operations** (file reads/writes, network calls) chained with business logic.
4. The workflow is described as a named feature in `README.md` or `ROADMAP.md`.

## Pre-commit Checklist

Before opening a PR, ensure:

- [ ] All new code has corresponding tests
- [ ] `go vet ./...` passes
- [ ] `golangci-lint run ./...` passes with **0 errors, 0 warnings**
- [ ] `cd frontend && npm run lint` passes (tsc + eslint) with **0 errors, 0 warnings**
- [ ] `go test ./... -race` passes with **≥ 80%** coverage
- [ ] `npm test` and `npm run test:coverage` pass with **≥ 80%** coverage
- [ ] `wails build` compiles successfully
- [ ] No test is skipped or marked as `t.Skip()` without a linked issue

## CI Enforcement

All PRs and pushes to `main` trigger automated checks (see `.github/workflows/ci.yml`):
- Lint (Go + frontend)
- Unit tests with coverage (threshold: 80%)
- Build verification

PRs that fail CI checks will not be merged.

## Test File Conventions

### Go

```go
package mypackage

import (
    "testing"
    "github.com/stretchr/testify/assert"
)

func TestMyFunction(t *testing.T) {
    result := MyFunction("input")
    assert.Equal(t, "expected", result)
}
```

### React/TypeScript

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';

describe('MyComponent', () => {
  it('renders correctly', () => {
    render(<MyComponent />);
    expect(screen.getByText('Hello')).toBeInTheDocument();
  });
});
```

## Boundaries

- **Never** commit code that has lint errors or warnings.
- **Never** commit code that drops coverage below 80%.
- **Never** commit code that fails any test.
- **Never** skip tests (`t.Skip`, `it.skip`) without a tracking issue linked in the PR.
- **Always** add tests when adding or modifying features.
- **Always** update tests when changing public APIs.
