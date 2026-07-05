# Quirk: wailsjs runtime file modes keep flipping 0755 → 0644

`frontend/wailsjs/runtime/{package.json,runtime.d.ts,runtime.js}` are committed with mode 0755 (restored in commit `7b48629`, and again manually on 2026-07-06). Something — most likely `wails dev` / `wails build` regenerating the bindings — rewrites them as 0644, which shows up as mode-only diffs in `git status`.

Handling:
- Do NOT commit the mode-only diffs; restore with `chmod 0755 frontend/wailsjs/runtime/package.json frontend/wailsjs/runtime/runtime.d.ts frontend/wailsjs/runtime/runtime.js` (the diff then disappears entirely).
- Expect them to reappear after the next wails build. If it becomes annoying, candidates: set `core.fileMode false` locally, or just accept 0644 in one deliberate commit.
