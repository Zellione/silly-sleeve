# Verifying the frontend lint gate (this WILL bite you)

Cost a CI failure on PR #75 (Phase 8). Two independent traps stack.

## Trap 1 — the rtk hook substitutes the WRONG eslint

`npm run lint` and `npx eslint` get rewritten by the rtk Claude Code hook to a
stray **global eslint 9.16.0** at `/usr/local/lib/node_modules/eslint`, not the
project's local **10.8.1**. The global one crashes before linting anything:

```
TypeError: Key "rules": Key "no-unassigned-vars":
  Could not find "no-unassigned-vars" in plugin "@".
```

It exits non-zero *without having linted*, and the rtk wrapper prints
`ESLint output (JSON parse failed: EOF ...)` which looks like a tooling hiccup
rather than a failure. CI uses the local binary, so CI and local disagree.

**Always run the local binary directly:**

```bash
cd frontend
./node_modules/.bin/eslint src --max-warnings 0; echo "EXIT: $?"
./node_modules/.bin/tsc --noEmit; echo "EXIT: $?"
./node_modules/.bin/vitest run
```

`./node_modules/.bin/eslint --version` should print **v10.8.1**. If it prints
9.16.0 you are running the wrong one.

## Trap 2 — `$?` after a pipe is the LAST command's status

```bash
npx eslint . 2>&1 | tail -3; echo "eslint=$?"   # ← ALWAYS 0. Measures tail.
```

This reported "clean" all session while eslint was never actually consulted.
Never put `| tail`/`| head` between a gate command and its `$?`. Either run bare
and echo `$?` immediately, or use `${PIPESTATUS[0]}`.

## Prove the linter is live before trusting a green run

A clean run means nothing if the rule isn't loaded. Probe it:

```bash
printf 'export const X = () => <label className="x"><span>a</span><div/></label>;\n' > src/__probe.tsx
./node_modules/.bin/eslint src/__probe.tsx   # must report label-has-associated-control
rm src/__probe.tsx
```

## The actual rule that failed: jsx-a11y/label-has-associated-control

`eslint.config.js` loads `eslint-plugin-jsx-a11y`. **Never wrap a composite
component in `<label>`** — `Dropdown` (a button owning a listbox) and
`TagsInput` (a tag editor) are not native form controls, so no label can ever be
associated with them.

```tsx
<div className="lore-field">                    {/* div, NOT label */}
  <span>Category<small>…</small></span>
  <Dropdown … aria-label={`Category for candidate ${i + 1}`} />
</div>
```

`<label>` is fine around a bare `<input>` / `<textarea>` / `<select>`. Composite
components carry their own `aria-label` instead. See
`frontend/src/components/lore/CandidateRow.tsx` for both shapes side by side.

## Go side has no equivalent trap

`go vet`, `golangci-lint run`, `go test -race` behave normally through the hook.
Note `gofmt` IS now enforced (added to `.golangci.yml` `formatters:` in Phase 8),
so a struct-field alignment slip fails lint.
