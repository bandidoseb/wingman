
## Session: 2026-04-04

### Always check .gitignore before telling Sebastian to commit or push anything
**What happened:** Told Sebastian to commit and push the Wingman Brain files without checking `.gitignore` first. The folder was already excluded — the suggestion was unnecessary and wrong.
**Rule:** Before suggesting any `git add` or `git push`, check `.gitignore` to confirm what's actually tracked. Never assume a folder inside the project is committed just because it exists there.

---

## Session: 2026-04-03

### Always update WingmanBridge type when adding methods to preload.ts
**What happened:** Added `setZoomStatus` and `onNavigateToSettings` to `preload.ts` but forgot to add them to the `WingmanBridge` interface in `src/types/index.ts`. TypeScript compiled fine locally but Railway's production build failed with "Property 'onNavigateToSettings' does not exist on type 'WingmanBridge'." Caused a failed deployment.
**Rule:** Any time a new method is added to the `wingman` bridge in `preload.ts`, immediately add the matching type signature to `WingmanBridge` in `src/types/index.ts` in the same edit. These two files must always stay in sync.

### Pre-implementation bug review is worth doing — catches real problems before writing code
**What happened:** Before implementing the Zoom name warning feature across 5 files, did a full review of the proposed plan against the actual code. Found 3 real bugs: (1) race condition in zoom name tristate, (2) preload needed two additions not one, (3) tray height management missing. All were fixed before writing a line of code, not after.
**Rule:** For any multi-file feature, read ALL the files it touches before writing code. Run through the review checklist mentally. Real bugs are easier to fix in the plan than in the code.

### Recall AI API format can change silently — always read the error body
**What happened:** Every call start was failing with the stage bar appearing then immediately disappearing. Root cause was Recall AI changed `deepgram` to `deepgram_streaming` in their API. The error was clearly in the terminal: `400 {"non_field_errors":["Must provide exactly one of: deepgram_streaming, ..."]}` — but it wasn't visible until we checked the terminal logs.
**Rule:** When a call fails to start and the HUD disappears after <1 second, always check the terminal for `[Recall AI]` lines immediately. The error body from external APIs always tells you exactly what's wrong.

---

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
