# Rebasing a dependent branch after its parent PR squash-merges

This repo squash-merges PRs (e.g. #90 → single commit `96783cd` on main). A branch created off the feature branch (as `fix/dashboard-accent-colors` was off `feature/instant-save`) therefore carries ancestry commits that main does not have by SHA.

Before opening the dependent branch's PR:

```bash
git fetch origin
git rebase --onto origin/main origin/<parent-branch> <dependent-branch>
```

This transplants only the dependent branch's own commits onto main, so the PR diff shows just the new work. Re-run the test suites after the rebase before pushing. Applied 2026-08-18 for PR #91 (13 commits transplanted cleanly; 916 Go + 878 frontend tests re-verified).

Status note: PR #91 (staging persistence, extraction feedback, UI fixes) opened and CI-green on 2026-08-18; this memory's auto-commit lands after that push, so push the branch again if the memory should ride along before merge.
