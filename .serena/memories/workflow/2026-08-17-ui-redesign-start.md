# UI redesign session start (2026-08-17)

## State
- Branch `feature/ui-redesign` created from up-to-date `main`.
- Serena memory follow-up (PR #83 merge note + S6479 re-check reminder) committed
  on that branch as `c8a5ef6` — it was intentionally left uncommitted by a prior
  session, content was valid.
- Redesign source: Claude Design share link
  `https://claude.ai/design/p/24b2230a-2737-4c47-a976-0a976c2635f1?file=index+v2.html&via=share`
  — **not yet retrieved**; waiting on user to sign in / provide the HTML.

## Traps learned
- `claude.ai/design/p/...` share links return HTTP 403 via WebFetch (only
  `claude.ai/code/artifact/{uuid}` URLs ride the built-in claude.ai auth) and
  redirect to the login page even with `via=share` — they require a signed-in
  claude.ai session.
- The chrome-devtools MCP browser launches with its own persistent profile that
  is NOT signed in to claude.ai; user must log in there once (window is visible
  on the desktop) before such pages can be scraped.

## Next steps
- Obtain `index v2.html` (user login in MCP Chrome, or file dropped into repo,
  or pasted).
- Then: survey `frontend/src/` structure and implement the redesign per project
  quality gates (lint, vitest coverage >= 80%, `wails build -clean`).
