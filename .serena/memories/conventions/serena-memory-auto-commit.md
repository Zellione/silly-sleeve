# Serena memories auto-commit via PostToolUse hook (since 2026-08-18)

`.claude/settings.local.json` has a PostToolUse hook matching `mcp__serena__(write|edit|delete|rename)_memory` that immediately runs `git add -A .serena/memories` and commits only that pathspec as `chore(memories): auto-commit serena memory update`. It no-ops on a clean tree and never touches other staged files.

Why: the Stop hook (same file) requests a memory write at end-of-turn — always AFTER the turn's commits — so `.serena/memories` was perpetually left dirty and needed manual cleanup commits before pushing.

Consequences:
- Never manually commit `.serena/memories` anymore; the hook does it the moment a memory tool runs.
- Auto-commits land on whatever branch is checked out — including `main`. Memory-only commits there are accepted by the user (explicitly requested "always committed").
- If the hook's commit fails (e.g. mid-merge), the failure surfaces in the tool result; commit manually then.
