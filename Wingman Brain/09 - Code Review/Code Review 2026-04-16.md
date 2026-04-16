[[09 - Code Review]]

# Wingman Daily Code Review — 2026-04-16

## What Was Pushed

All 17 commits are vault backups and one build session from 2026-04-15. The actual code changes are: the dual KB architecture was built and completed. This includes a new SQL migration (`007_dual_kb.sql`) that renames the `kb_entries` table to `kb_signal_card_entries` and creates the new `kb_coaching_entries` table for the Mission Intel chatbot. A new `backfill-coaching.js` script was added to populate the coaching table from existing signal card data. `cleanup.js` was significantly upgraded — it now has a two-phase process where Haiku scores entries, Sonnet polishes medium-quality entries, and Haiku re-scores them before deciding to delete or promote. Four code files were updated to use the renamed table and RPC. TypeScript files were also updated to reference the new RPC name.

---

## Automated Scan Results

- **TypeScript:** PASSED with 0 errors
- **New dependencies:** None
- **Hardcoded localhost:** None found in code files
- **Secrets exposure:** No actual secrets committed. Three debug command strings in `.claude/settings.local.json` reference `ANTHROPIC_API_KEY` — explained in Low Issues below.
- **Sensitive data in logs:** Same three debug command strings in settings file — not actual logging code in production paths. No production code logs tokens.
- **Debug artifacts:** `console.log` calls are all legitimate progress/status output in local-only scripts (`backfill-coaching.js`, `cleanup.js`). None in server-side production code.
- **.env.local modified:** Not touched.

---

## Critical Issues — Fix Before Next Beta Call

None found.

---

## High Issues

None found.

---

## Medium Issues

**Issue M1 — `knowledge-search.ts`: No timeout on the OpenAI embedding fetch call**

Plain English: The function that looks up sales techniques from the knowledge base makes a network call to OpenAI to convert the transcript into a searchable format. If OpenAI's servers are slow or unresponsive, this call has no time limit — it will hang indefinitely. Since this runs during a live call on every keyword trigger, a hung call means the signal card pipeline is frozen and never recovers until the server restarts.

File: `/Users/sebastianperez/Desktop/Wingman CC/src/lib/wingman/knowledge-search.ts`, line 78 (the `fetch("https://api.openai.com/v1/embeddings", ...)` call)

What a user experiences if this fails: No signal cards appear for the rest of the call. The rep gets no coaching. The logs would show nothing — the request just never returns.

Fix: Add an `AbortController` with a 5-second timeout to the embedding fetch, the same way other production routes handle external API calls. If it times out, log the warning and return an empty string (which already exists as the fallback).

---

**Issue M2 — `backfill-coaching.js`: No timeout on the OpenAI embedding fetch call**

Plain English: Same issue as M1 but in the backfill script. If OpenAI is slow and a batch call hangs, the script freezes indefinitely with no way to recover short of killing the process. This is a local developer tool so the risk to users is zero — but if Sebastian runs this during a slow network period, the process will appear stuck with no explanation.

File: `/Users/sebastianperez/Desktop/Wingman CC/knowledge-base/backfill-coaching.js`, line 43 (the `fetch("https://api.openai.com/v1/embeddings", ...)` call inside `embedBatch`)

What Sebastian experiences if this fails: Terminal appears frozen. No error message. Script must be force-quit with Ctrl+C. Progress is lost but re-running is safe (idempotency is intact).

Fix: Add a 30-second `AbortController` timeout to `embedBatch`. For a batch script it can be more generous than the live call timeout.

---

## Low / Nice-to-Fix

**Low 1 — `.claude/settings.local.json` contains three debug command strings that reference `ANTHROPIC_API_KEY`.**

These are left over from a debugging session. They are stored in the `allowedTools` list — commands Claude is allowed to run — not in production code. They do not print the actual key value (one prints the first 8 characters, which is the publicly-known `sk-ant-a` prefix; the others print only `found` or the key names). No actual secret is exposed. The repo is private. Risk is negligible, but the debug commands should be cleaned up before this repo is ever made public or shared with an advisor. File: `/Users/sebastianperez/Desktop/Wingman CC/.claude/settings.local.json`, lines 12–14.

**Low 2 — `supabase/migrations/007_dual_kb.sql`: `kb_coaching_entries` has no Row Level Security (RLS) policies.**

This is consistent with the existing pattern — `kb_sources` and `kb_signal_card_entries` also have no RLS. All three tables are read via the service role client (not the user-scoped anon client), so RLS would have no effect anyway. This is intentional: the KB tables are shared global data, not per-user data. No action required unless the access pattern changes.

**Low 3 — `cleanup.js` summary label "Already high / kept" is slightly misleading.**

The label implies these entries were already high and unchanged, but the count formula subtracts `toPolish` entries (which were actually "medium" entries successfully upgraded). So the displayed count is correct but the label doesn't fully explain that it also excludes polished-to-high entries (which are shown in a separate section). A future reader of the output could be momentarily confused. Low priority — the separate sections above the summary make the full picture clear.

---

## Architectural Invariants Check

- **Invariant 1 (Recall key on Railway only):** Checked — clean. No new code in `electron/` touches `RECALL_AI_API_KEY`.
- **Invariant 2 (isRunning set after success only):** Checked — clean. No changes to `electron/recall.ts` in this session.
- **Invariant 3 (stopRecallAI is the only stop path):** Checked — clean. `sdk.stopRecording()` only appears inside `stopRecallAI()` at line 389 of `electron/recall.ts`. No new code changes this.
- **Invariant 4 (isRunning and callActive always change together):** Checked — clean. No changes to state management in `electron/main.ts` or `electron/recall.ts`.
- **Invariant 5 (auto-stops through the full chain):** Checked — clean. No new auto-stop logic added.

---

## Product Rules Check

All 10 checked — clean. No changes to signal card firing logic, cooldowns, stage filtering, transcript storage, or post-call job timing. This session only touched knowledge base tooling and the database schema. Product behavior is unchanged.

---

## Known Issues — Status Check

- **Issue #25** (KB pipeline steps 4-5 not yet wired): Unchanged. `knowledge-search.ts` was updated to call the new RPC name, but the dual-pipeline ingestion update to `ingest.js` and the calibration step (Steps 4-5 from the original plan) are still deferred.
- **Issue #24** (Non-sales content in KB): Improved. `cleanup.js` now explicitly scores against 5 criteria including the non-sales-content rule, and `--apply` mode deletes bad entries rather than just marking them low.
- **Issue #23** (Third-person triggers): Improved. `cleanup.js` now explicitly checks for third-person triggers in the scoring criteria and the `POLISH_SYSTEM` prompt rewrites them to first-person.
- **Issue #22** (Offer-specific exact_scripts): Improved. `cleanup.js` RESCORE_SYSTEM prompt now explicitly flags offer-specific scripts (specific numbers, team sizes, pricing) as low.
- **Issue #21** (Embedding latency, no Redis cache): Unchanged. Still open.

---

## Stress Test Results

New code is local developer tooling (`backfill-coaching.js`, `cleanup.js`) — not production server code. The only production code change is `knowledge-search.ts` (renamed RPC call) and the SQL migration (already run). Stress tests applied to new code:

- **Double-click / simultaneous triggers:** Not applicable — scripts are command-line tools run manually, one at a time.
- **Internet drop:** `backfill-coaching.js` and `cleanup.js` both catch errors per batch and log them, then continue. If the internet drops mid-run, failed batches are logged but the script continues to completion. Re-running is safe (idempotency checks prevent duplicate inserts). The missing `AbortController` timeout (M2) means a dropped connection could hang rather than fail fast — this is the Medium issue above.
- **Back-to-back calls:** `knowledge-search.ts` — the RPC rename is a one-line change to a string. All existing timeout, caching, and error handling logic is untouched and was reviewed in previous sessions.
- **Empty result from RPC:** `knowledge-search.ts` correctly handles zero matches by returning an empty string at line 134. The caller (`kb-signal` route) handles empty string as "no signal to show."
- **Partial backfill (crash mid-run):** Analyzed. The backfill script checks existing `source_id` values before inserting. Since Supabase insert batches are atomic, partial-source state cannot occur within a batch. Re-running after a crash safely skips already-inserted sources and retries failed ones. Idempotency is sound.

---

## Verdict

Safe to stay in production as-is. The SQL migration has already been run and all code changes that depend on it (table rename references) are in place. No changes to Electron, API routes, or HUD logic. The two Medium issues (missing `AbortController` timeout on embedding calls in `knowledge-search.ts` and `backfill-coaching.js`) should be fixed before the next beta call — the production path (`knowledge-search.ts`) is the higher priority. The backfill script timeout is a developer convenience fix only.
