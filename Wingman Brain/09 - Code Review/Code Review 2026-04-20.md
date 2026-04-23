[[09 - Code Review]]

---
# Wingman Daily Code Review — 2026-04-20

## What Was Pushed

The main code push was the **Flight Plan feature** — a full 5-step implementation built in one session. This added a new "Flight Plan" page to the dashboard where reps fill out their offer context (target market, core problem, dream outcome, price range, etc.) once. That context is then: (1) frozen into each call record at session start, (2) injected into Claude's live poll prompt so it knows what this specific rep sells, and (3) used by the post-call Sonnet job to evaluate whether the rep covered all 7 key conversation pillars. A "Framework Coverage" scorecard was also added to the Flight Log debrief tab. Three vault backup commits and one Obsidian graph restructure commit are also in scope but contain no application code.

---

## Automated Scan Results

- **TypeScript:** PASSED — 0 errors
- **New dependencies:** None
- **Hardcoded localhost:** None found in application code (one match was inside a Code Review brain file — not application code)
- **Secrets exposure:** None found
- **Sensitive data in logs:** None found — the only `console.log` in the diff logs a success confirmation with call_id and pillar coverage status, not any secret
- **Debug artifacts left in code:** None found — no TODO, FIXME, HACK, or debugger statements in new code
- **.env.local modified:** Not touched

---

## 🔴 Critical Issues — Fix Before Next Beta Call

None found.

---

## 🟡 High Issues

### H1 — Raw transcripts never deleted after post-call job runs

**What's wrong:** The post-call route (`src/app/api/wingman/post-call/route.ts`) was substantially rewritten in this session — 120 lines added — but it still doesn't delete raw transcript rows from the `call_transcript` table after the Sonnet analysis completes. The transcript is loaded, analyzed, used to generate the debrief and pillar evaluation, and then left in the database permanently.

**File:** `src/app/api/wingman/post-call/route.ts` — the final step after `6b. Write pillar_coverage` should be: delete all `call_transcript` rows where `call_id = call_id`.

**What a real user experiences when this fails:** Nothing visible — it's silent accumulation. Every call a user runs leaves its full text transcript stored in Supabase forever. For a rep doing 5 calls a day, that's a growing archive of word-for-word conversations they were promised would be deleted. This is a legal and privacy commitment in the Decisions Log dated 2026-04-02: "Raw transcripts are stored temporarily in Supabase during a call, used by the post-call job, then deleted immediately after the job completes." It's also Product Rule #6 and Architectural Invariant language in CLAUDE.md. This is the right time to fix it since the post-call route was just heavily modified. The fix is one additional `service.from("call_transcript").delete().eq("call_id", call_id)` call after step 6b, wrapped in its own independent try/catch so a delete failure never blocks the debrief.

**Pre-existing:** Yes — this was missing before today's session too. But the post-call route was the subject of today's major work, and this is the right time to add it.

---

## 🟠 Medium Issues

### M1 — FlightPlanTab silently swallows load failure — returning user sees blank form

**What's wrong:** When the component mounts, it calls `GET /api/flight-plan` to load the user's existing data. If that request fails for any reason (network drop, auth error, 500 from Railway), the catch block is empty:

```javascript
.catch(() => {})
.finally(() => setLoading(false));
```

No error state is set, no message is shown. The form renders empty in "edit all at once" mode. A returning user who already has a flight plan filled out sees a blank form with no indication that their data failed to load. If they click "Save Flight Plan," they overwrite their real saved data with 7 empty fields.

**File:** `src/components/dashboard/FlightPlanTab.tsx` — lines 180–182 (the `.catch(() => {})` block)

**Fix:** Add error state: `const [loadError, setLoadError] = useState<boolean>(false)`. In the catch block: `setLoadError(true)`. In the render, above the form, show: `"Couldn't load your flight plan. Refresh to try again."` And add a guard: don't show the Save button when `loadError` is true. This prevents accidental overwrites.

---

## 🔵 Low / Nice-to-Fix

- `src/components/dashboard/FlightLogTab.tsx:540` — Double cast `as unknown as Record<string, { covered: boolean; evidence: string | null }>` to access `pillar_coverage` with dynamic string keys. Technically necessary for the dynamic-key loop pattern, but cleaner alternatives exist (e.g. type the PILLAR_DISPLAY array as `Array<{ key: keyof PillarCoverage; ... }>`). No runtime impact.

- `Wingman Brain/01 - Build Log/Current Sprint.md` — The "Current Blockers" section still says "Flight Log doesn't yet show pillar coverage — display not built yet." But Step 5 was completed in this session — the Framework Coverage card is live. This blocker should be removed from Current Sprint.

---

## Architectural Invariants Check

No changes to `electron/recall.ts` or `electron/main.ts` in this session. Invariants are evaluated against pre-existing state, unchanged.

- **Invariant 1** (Recall key on Railway only): Checked — clean. No new electron/ code references `RECALL_AI_API_KEY`. The flight plan routes use only user-scoped Supabase client for auth.
- **Invariant 2** (`isRunning` set only after success): Checked — clean. `recall.ts` not changed. `isRunning = true` remains at line 325, which is after `sdk.startRecording()` resolves.
- **Invariant 3** (`stopRecallAI` is the only stop path): Checked — clean. `sdk.stopRecording()` appears only at `recall.ts:389` inside `stopRecallAI()`. No new code calls it directly.
- **Invariant 4** (`isRunning` and `callActive` always change together): Checked — clean. Neither `recall.ts` nor `main.ts` was modified.
- **Invariant 5** (auto-stops through the full chain): Checked — clean. No new auto-stop logic introduced.

---

## Product Rules Check

- Rules 1–5: No signal card logic changed. All clean.
- **Rule 6 (transcripts deleted after post-call): VIOLATION** — see High Issue H1. Raw transcripts are not deleted. This is the only rule with a finding.
- Rules 7–10: No audio/video stored, post-call is async, Offer Brain unchanged, no new signal-card frequency changes. All clean.

---

## Known Issues — Status Check

Open High issues and their status after today's push:

| Issue | Prior Status | After Today |
|-------|-------------|-------------|
| #24 — Non-sales content in KB | Open | Unchanged |
| #23 — Third-person triggers | Open | Unchanged |
| #22 — Offer-specific scripts in quality gate | Open | Unchanged |
| #2 — Playbook page not built | Open | Effectively addressed — Flight Plan is the functional Playbook equivalent. Post-call pillar evaluation and the rep framework context are now live. The page doesn't match the "three-tier checklist" description in CLAUDE.md exactly, but the core purpose is served. Worth a conversation with Sebastian on whether to mark this resolved. |
| #20 — Mission Intel chat blocks after error | Open | Unchanged — chat functions in FlightLogTab not touched |

---

## Stress Test Results

All 11 scenarios evaluated against the new code:

1. **Double-click Save (FlightPlanTab):** `saving` state disables the button while a save is in flight. Clean.
2. **Internet drop mid-call:** Session, poll, and post-call routes unchanged in the core recording path. No regression.
3. **Back-to-back calls:** `flightPlan` is fetched fresh from the DB at each session creation. No state accumulation between calls.
4. **Zoom crash:** Auto-stop chain not changed. Not affected.
5. **2-hour call:** No timer logic modified. Not affected.
6. **Force-quit mid-call:** No app lifecycle changes. Not affected.
7. **Fresh user, null Offer Brain:** `buildFlightPlanContext(null)` returns `""` on the first line check. The flight plan context block is simply omitted from the user message. No crash.
8. **Recall AI token expiry mid-call:** Not affected — token flow not changed.
9. **Railway down mid-call:** Polling loop not changed. Not affected.
10. **Post-call job timeout:** Independent write paths (debrief and pillar_coverage each have their own try/catch). If pillar_coverage write fails, debrief is already saved. User sees the debrief without the scorecard — clean degraded state.
11. **Empty transcript:** `if (!transcript || transcript.length === 0)` → returns `{ skipped: "no transcript" }` immediately. Pillar coverage is never attempted. Clean.

---

## Verdict

Everything is safe to stay in production as-is. The Flight Plan feature is well-built with no critical gaps. One High issue (transcript deletion) is a pre-existing privacy commitment that should be added to the next session's work — it is a real violation of Product Rule #6 and should not wait another sprint. One Medium issue (silent load failure in FlightPlanTab) is a low-risk UX bug that won't affect users unless Railway is down during a dashboard load, but is worth a quick fix.
