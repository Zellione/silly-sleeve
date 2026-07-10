# Reconciling Plan Mode with the superpowers:brainstorming skill

When the harness's Plan Mode is active (system-enforced: only the plan file at
`~/.claude/plans/<slug>.md` may be written; no other file writes, commits, or
branch creation), and the task is creative/feature-design work that would normally
trigger `superpowers:brainstorming`:

- Still invoke `superpowers:brainstorming` (per its own instruction: "before entering
  plan mode ... invoke brainstorming first" / "if you haven't already brainstormed").
- Follow its conversational process (explore context, ask one clarifying question at a
  time, propose 2-3 approaches) — this is compatible with Plan Mode.
- **Skip** the skill's "write design doc to `docs/superpowers/specs/...` and commit it"
  step — Plan Mode forbids writing any file other than the plan file. Fold the design
  content directly into the plan file instead (Context + approach sections), rather
  than creating a separate spec doc.
- Do not commit anything, create branches, or run non-read-only tools until the plan is
  approved via ExitPlanMode and Plan Mode ends.

This came up 2026-07-10 when the user asked (while Plan Mode was active) to plan a new
ROADMAP.md phase for a "preview tab" feature in the silly-sleeve project.
