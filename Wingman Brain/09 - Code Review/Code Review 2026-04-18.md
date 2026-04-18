[[09 - Code Review]]

---
# Wingman Daily Code Review — 2026-04-18

## What Was Pushed

Four commits landed yesterday (2026-04-17): the big one (`819d518`) shipped the junction table architecture for KB search, plus two vault backups and a session wrap commit. The junction table work replaced the old approach of cramming 30+ trigger phrases into one blurry embedding with a separate embedding per phrase — similarity scores jumped from 0.38 to 0.65–0.88 on all tested phrases. Three new files were created (`calibrate.js`, `split-triggers.js`, Supabase migration 008) and two production files were updated (`knowledge-search.ts`, `ingest.js`).

## Automated Scan Results

- **TypeScript:** PASSED with 0 errors
- **New dependencies:** None
- **Hardcoded localhost:** None found
- **Secrets exposure:** None found (the `SUPABASE_SERVICE_ROLE_KEY` references in `calibrate.js` and `split-triggers.js` are `process.env` reads in local-only dev tools — not hardcoded values, not in Electron or client-side code)
- **Sensitive data in logs:** None found (the logged `matched_trigger` is a trigger phrase like "I need to think about it", not a secret)
- **Debug artifacts left in code:** None — the `console.log` calls are either intentional terminal output in local dev tools or production-appropriate log lines in `knowledge-search.ts`
- **.env.local modified:** Not touched

## 🔴 Critical Issues — Fix Before Next Beta Call

None found.

## 🟡 High Issues

None found.

## 🟠 Medium Issues

None found.

## 🔵 Low / Nice-to-Fix

1. **Stale comment in `knowledge-search.ts` line 8** — The file header says "Filter to matches above 0.72 threshold" but the live threshold is now 0.65. Anyone reading this file to understand the threshold will see the wrong number. Fix: update the comment to say 0.65.

2. **SQL function default doesn't match live code** — `search_kb_by_trigger` in `008_trigger_junction.sql` has `similarity_threshold float DEFAULT 0.72` but `knowledge-search.ts` always passes 0.65. The code override wins so behavior is correct, but the SQL default is misleading if anyone calls the function directly (e.g. from Supabase dashboard). Fix: change the SQL default to 0.65 in the migration file, or leave it and add a comment explaining the code always overrides it.

3. **`ingest.js` step 8.5 trigger embedding has no AbortController timeout** — The `openai.embeddings.create()` call at line 719 uses the OpenAI SDK with no explicit timeout or `AbortController`. If OpenAI hangs during an ingestion run, the script freezes indefinitely. This is a local dev tool only (never runs on Railway), so the only impact is a confusing freeze during ingestion. Fix: pass `{ signal: controller.signal }` as the second argument, the same way `split-triggers.js` does it in `embedBatch()`.

## Architectural Invariants Check

- **Invariant 1 (Recall key on Railway only):** Checked — clean. No changed file touches `RECALL_AI_API_KEY` or is in `electron/`.
- **Invariant 2 (isRunning set after success only):** Checked — clean. No changes to `electron/recall.ts`.
- **Invariant 3 (stopRecallAI is the only stop path):** Checked — clean. `sdk.stopRecording()` appears only inside `stopRecallAI()` at `electron/recall.ts:389`. No new code touches this.
- **Invariant 4 (isRunning and callActive always change together):** Checked — clean. No changes to Electron state management.
- **Invariant 5 (auto-stops through the full chain):** Checked — clean. No new auto-stop code introduced.

## Product Rules Check

All 10 checked — clean. No changes to signal card firing logic, cooldown handling, stage filtering, transcript storage, or post-call job behavior. The junction table changes are purely upstream infrastructure.

## Known Issues — Status Check

- **Issue #25** (KB pipeline steps 4-5 not wired) — Resolved by this push. `knowledge-search.ts` now calls `search_kb_by_trigger` with the correct RPC and KBMatch interface.
- **Issue #27** (embedding fetch has no timeout) — Resolved by this push. 5-second AbortController timeout added to the OpenAI embed fetch.
- **Issue #28** (negation blindness) — Unchanged. Earmarked for next re-ingestion session.
- **Issue #29** (duplicate trigger phrases) — Unchanged. Earmarked for next re-ingestion session.
- **Issue #24** (non-sales content in KB) — Unchanged.
- **Issue #23** (third-person triggers) — Unchanged.
- **Issue #22** (offer-specific scripts) — Unchanged.
- **Issue #21** (embedding latency / no Redis cache) — Unchanged, but marginally improved: the new per-phrase junction table approach reduces the embedding surface area per call (one query embedding instead of trying to match a diluted block), which may help slightly with latency.

## Stress Test Results

1. **Double-click:** Not applicable to `knowledge-search.ts` — it's a stateless library function, not a button handler.
2. **Internet drop:** If OpenAI embedding times out (5s AbortController), `searchKnowledge` catches the error, logs it, and returns `""` — no card fires, call continues normally. Clean degradation.
3. **Back-to-back calls:** The in-process cache prunes expired entries on every cache miss. No unbounded growth. Checked — clean.
4. **Zoom crash:** No changes to Zoom integration. Pre-existing behavior unchanged.
5. **2-hour call:** The 5-second per-call timeout is correct. No accumulation or overflow risk.
6. **Force-quit mid-call:** No changes to Electron lifecycle. Pre-existing behavior unchanged.
7. **Fresh user, null Offer Brain:** `knowledge-search.ts` does not touch Offer Brain. Checked — clean.
8. **Recall AI upload token expiry:** No changes to token flow. Pre-existing behavior unchanged.
9. **Railway down mid-call:** If Supabase RPC fails, `searchKnowledge` catches the error, logs it, and returns `""`. No card fires, call continues. Clean.
10. **Post-call job timeout:** No changes to post-call flow. Pre-existing behavior unchanged.
11. **Empty transcript:** `if (!query) return ""` at the top of `searchKnowledge` handles this. Checked — clean.

## Verdict

Everything is safe to stay in production as-is. The junction table architecture is a clean win — the three low-priority findings are cosmetic (stale comment, SQL default mismatch) and a local-dev-only inconvenience (missing timeout in ingest.js). None affect live call behavior. No action required before the next beta call.
