# Current Sprint

Last updated: 2026-04-09

This is the first file Claude reads at session start. It answers: where are we, what's next, and what's blocking us.

---

## What Was Just Completed (2026-04-09)

- **`/wrap` skill built** — session end automation. Writes daily build log, updates brain files, commits, asks for push approval. Active from next session restart.
- **Obsidian brain added to GitHub** — `Wingman Brain/` removed from `.gitignore`, full vault pushed to repo for cross-device sync.
- **Brain files cleaned up** — Roadmap updated (signal cards working), Decisions Log updated (4 new entries), 2026-04-07 build log written retrospectively.
- **Stop hook hardened** — `.claude/settings.local.json` now explicitly reminds Claude to run `/wrap` before ending a session.

---

## What Was Just Completed (2026-04-07)

- **Transcript dedup fixed** — Recall.ai was firing the same utterance 7-9x (or more). Root cause was likely listener stacking across call sessions + SDK-level duplicates. Fix: `realtimeListenerRegistered` flag ensures the realtime-event delegate is registered only once per app session (after `startRecording`). Dedup logic changed from a 500ms time window to last-text-per-speaker comparison — only emits when the speaker's text changes.
- **Poll chunk size limit raised** — poll route had a 10K char hard cap. With broken dedup, buffer grew to 57K+ chars and got rejected with 400. Raised to 50K as a safety net. With correct dedup, chunks are well under 1K per poll.
- **"No Show" and "Other" disposition bug fixed** — database `calls_outcome_check` constraint didn't include "No Show" or "Other" but the HUD had both as options. SQL migration run: constraint updated to include all valid outcomes.
- **Processing skeleton now waits for full post-call data** — skeleton used to clear the moment disposition was saved, before the debrief was ready. Changed to clear only when both `outcome` AND `summary` are populated. User now sees the full entry (transcript + debrief) when the skeleton disappears — no hard refresh needed.
- **Safety valve reduced** — from 10 minutes to 2 minutes (if post-call job fails, skeleton clears after 2 min instead of 10).
- **CLAUDE.md updated** — added The Plan Review Loop rule: all implementation plans must go through internal revision rounds before being presented to Sebastian. Only the final battle-tested plan gets shown.
- **Dev command saved to memory** — correct command is `npm run electron:dev`, not `npm run dev`.

---

## What Was Just Completed (prior session)

- Signal cards confirmed firing — first working signal card appeared on a real test call.
- 90-second cooldown bypassed for keyword/Alert signals.
- Prospect name auto-detected from transcript.
- Live/Processing skeleton added to dashboard.
- Disposition save bug fixed (hud-outcome getUser fix).
- handleEndCall try/finally hardened.

---

## What's In Progress

- Nothing. Clean stopping point.

---

## What's Next (Priority Order)

1. **#1 — Run a real test call to confirm everything end-to-end**
   Clean transcript (no duplicates), debrief appears without refresh, disposition saves, post-call grade shows. This is the acceptance test for today's session.

2. **#2 — Fix post-call 502 on Anthropic overload**
   No retry logic in `post-call/route.ts`. If Anthropic returns `overloaded_error`, entire post-call job fails silently. Add 3 retries with exponential backoff. (Known Issue #13)

3. **#3 — KB re-ingestion with prospect_trigger field**
   KB returns 0 matches because entries are written from rep/coach perspective. Add `prospect_trigger` field to ingest prompt — 10-15 examples of what the PROSPECT says before this technique is needed. Re-ingest all 37 videos (~$10-15 cost). (Known Issue #14)

4. **#4 — Playbook page**
   Pre-call framework setup. Rep configures once. Three tiers: locked core, default-on toggleable, custom.

5. **#5 — Stripe billing end-to-end test**

6. **#6 — Beta onboarding email**
   Must include: install steps, quarantine removal command, what to expect on first call.

---

## Current Blockers

- **KB returns 0 matches** — semantic mismatch between KB entries (rep-perspective) and search queries (prospect speech). Fix requires re-ingestion. (Known Issue #14)
- **Post-call job fails on Anthropic overload** — no retry logic. (Known Issue #13)
- **Playbook page not built** — Wingman has no rep-specific framework context beyond defaults until this exists.
- **App not Apple-notarized** — beta testers must run quarantine command manually. (Known Issue #5)

---

## How to Update This File

After every build session, Claude updates this file:
- Move completed items to "What Was Just Completed"
- Update "What's In Progress" with anything mid-flight
- Update "What's Next" priority order based on what changed
- Add anything new to "Current Blockers" or remove resolved blockers
