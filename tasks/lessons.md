
## Session: 2026-04-13

### Self-review of plans has diminishing returns — use an adversarial subagent
**What happened:** Ran Plans A → B → C and declared Plan C production-grade. Sebastian challenged this. Ran an adversarial subagent whose only job was to break the plan. Found 24 issues — including 5 that would have caused silent production failures that neither of us would have caught without running and watching it break.
**Rule:** For any major architectural plan, spin up an adversarial subagent explicitly tasked to find holes — not validate. Never ask it "does this look good?" Always ask "what would break this?" Self-review is biased toward the plan you wrote. The adversarial agent has no such bias.

### Run batch ingestion at off-peak hours — 529s are time-of-day dependent
**What happened:** Started ingestion during US business hours. Anthropic's API returned 529 "overloaded" errors on nearly every Sonnet call. 30 out of 38 sources failed on the first run. Running early morning CST (7am) on the second run cleared almost all of them.
**Rule:** Any large batch job hitting Anthropic Sonnet should be scheduled for off-peak hours — before 8am CST or after midnight CST. Never start a large ingestion run during business hours.

### console.anthropic.com and claude.ai are completely separate — document both
**What happened:** Anthropic credits ran out mid-run. Sebastian went to top up and couldn't find the account — it was under a personal Gmail (sebmattiasperez@gmail.com), not his work email. He'd never set up console.anthropic.com consciously. Also accidentally bought $50 of claude.ai credits (chat interface) thinking it was the API console — they're completely separate billing systems.
**Rule:** At the start of any project using the Anthropic API, confirm which email the console.anthropic.com account is under and document it. The API console and the Claude chat interface have zero billing relationship. Adding credits to one does nothing for the other.

### Auto-reload threshold must be set high enough for the actual workload
**What happened:** Anthropic auto-reload was set to top off to $15 when balance hits $5. A batch ingestion run burned through credits faster than the reload triggered, causing a mid-run failure at video 30 of 38.
**Rule:** Before any large ingestion run, check the auto-reload threshold and set it to at least 3x the estimated run cost. For a ~$15 run, the threshold should be set to top off to $50.

### Always QA a sample of KB entries immediately after ingestion — before wiring into the live pipeline
**What happened:** After ingestion, Sebastian manually skimmed entries in Supabase and immediately found 3 categories of bad data: offer-specific scripts, third-person triggers, non-sales content. These would have fired garbage signal cards on real calls if we'd wired up the pipeline without reviewing.
**Rule:** After any KB ingestion (initial or re-ingestion), always QA at least 20-30 random entries in Supabase before enabling the KB in the live pipeline. Look specifically for: (1) exact_script containing offer-specific details, (2) prospect_triggers in third person, (3) entries that have nothing to do with live sales conversations.

### Prompt quality issues are invisible until you look at the actual data
**What happened:** The Pass 2 and Pass 3 prompts looked solid in review. The adversarial agent didn't catch the extraction quality problems. Only by looking at real extracted entries did we find that Sonnet was extracting personal productivity content, writing third-person triggers, and failing to flag offer-specific scripts.
**Rule:** You cannot fully evaluate an extraction prompt by reading it. You can only evaluate it by running it and reading the output. Always treat the first ingestion run as a prompt calibration exercise, not a final result.

### The --force flag re-processes ALL sources including already-completed ones — cost implication
**What happened:** Running `node ingest.js --force` re-processes all 38 sources regardless of status. The 8 that already succeeded were re-ingested on Run 2 and Run 3 unnecessarily. Small extra cost but adds up.
**Rule:** Consider whether a smarter skip logic is needed for large KB updates — e.g., only re-process sources that are status='failed' or that have been explicitly flagged for re-ingestion. The current --force behavior is correct for full re-architecture runs but wasteful for partial updates.

---

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
