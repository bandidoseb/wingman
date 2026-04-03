
## Session: 2026-04-01

### Never make multi-file changes without showing a plan and getting explicit approval
**What happened:** Made changes across keyword-triggers.ts and useWingmanPoller.ts without presenting a plan first and waiting for Sebastian's "yes."
**Rule:** Any change touching more than 1 file requires writing the plan out first, showing it to Sebastian, and waiting for explicit approval before writing a single line of code. No exceptions, even if the fix seems obvious.

---

## Session: 2026-03-17

### npm version patch requires a completely clean git working directory
**What happened:** `npm version patch` failed with "Git working directory not clean" because modified files (`.claude/launch.json`, `CLAUDE.md`, etc.) weren't committed.
**Rule:** Before running `npm version patch`, always run `git add -A && git commit -m "..."` first to commit ALL pending changes, not just the files you touched.

### Always add .claude/launch.json to git when modified
**What happened:** Added a new preview server to `.claude/launch.json` but didn't include it in the `git add` command, causing the working directory to be dirty.
**Rule:** When modifying `.claude/launch.json`, include it in the commit explicitly.
