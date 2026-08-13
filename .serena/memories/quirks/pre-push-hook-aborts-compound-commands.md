# The pre-push hook aborts the WHOLE compound command — your commit may not exist

Cost a false "fixed and pushed" claim on PR #75.

## What happens

This repo has a Claude Code pre-push hook demanding a serena memory sync. When it
fires, it does **not** block only the `git push` — it aborts the entire chained
command, so anything earlier in the chain never runs either:

```bash
git add -A && git commit -F - <<'EOF'
...
EOF
git push          # ← hook fires here
```

The error text ("Before pushing: ... just retry the git push") *reads* as though
only the push was stopped. It was not: **the commit never happened**. Retrying
just the push then pushes whatever else is staged — in the PR #75 case, a
later memory-only commit — while the real work sat uncommitted in the worktree,
looking committed because the files on disk were correct.

## Do this instead

1. **Never chain `git commit` and `git push` in one call.** Separate calls.
2. **Verify the commit exists before pushing:** `git log --oneline -2` and
   `git status --short` (the changed files must be gone from the status list).
3. **Verify the push landed** — the authoritative check, since `git log` alone
   cannot tell you what the remote has:

```bash
git diff --stat origin/<branch> -- <paths>   # empty output = in sync
```

## Related trap: a stale-looking scan may be telling the truth

After "fixing and pushing", SonarQube still reported all 17 findings with the
same issue keys and pre-fix creation dates. That looked exactly like a stale
analysis, and `gh api .../check-runs` confirmed an analysis *had* completed for
the head SHA — which made "stale index" even more plausible.

It was not stale. The fix had never been pushed. **Before concluding a scanner
is stale, prove your change is on the remote** with the `git diff --stat
origin/...` check above. `mem:sonarcloud_automatic_analysis_config` documents a
genuine stale-result case, so both are real — distinguish them by checking your
own side first.

## The general lesson

Both failures this session were the same shape: asserting an outcome from a
command whose result was never actually inspected (see also the `$?`-after-pipe
trap in `mem:quirks/verifying-the-frontend-lint-gate`). Report "done" only from
a check that would have failed if it weren't.
