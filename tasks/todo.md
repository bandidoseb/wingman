# Fix Known Issues #53 (compass freeze) + #52 (dig false take-close)

Plan-reviewed 2026-07-24 (plan-reviewer: NEEDS REVISION → all 4 findings folded in below).
Branch: `feat/confrontation-dial` (held local). Prior dial plan archived → `tasks/todo-confrontation-dial-archive.md`.

---

## Bug #53 — → Close press freezes the whole compass ~40s

**Root cause (proven, Flight Recorder call 6999e874):** the dashboard window is HIDDEN during calls
and has no `backgroundThrottling: false`, so Chromium throttles its timers (hidden 5+ min → chained
timers batched to ~1 wake/minute). `summarizeNow()`'s wait is a chained 120 ms setTimeout poll that
checks its own 8 s cap INSIDE the loop — the loop never woke, the cap never fired, the shared
`isGeneratingRef` busy-lock stayed on 42 s, every press dropped. Contributing: every close press
force-fires a summarize that the server 429s inside its 30 s/user floor (wasted, doomed request).

**Bigger blast radius (reviewer W4):** the same throttling has been silently hitting the 25 s
transcript-save heartbeat and the 2-min summarizer on EVERY call while the dashboard sits behind
Zoom — stale ladders + batched saves (a crash mid-batch loses up to ~1 min of transcript). Fix 1
repairs that whole class, not just the close path. Tradeoff: renderer stays at full CPU while
hidden during calls — correct for a live-call engine.

### Steps
1. [x] `electron/main.ts` (~428): add `backgroundThrottling: false` to mainWindow webPreferences.
       (Reaches packaged apps at the next desktop release; dev immediately.)
2. [x] `src/hooks/useWingmanPoller.ts` — event-driven `summarizeNow`, no polling:
       - `completionPromiseRef` (init `Promise.resolve()`) created SYNCHRONOUSLY where
         `isSummarizingRef` flips true (line ~547), resolved in `executeSummarize`'s `finally` (~594). (W1)
       - `lastSummaryAtRef` stamped on ANY `res.ok` — not only when `data.summary` is truthy —
         so the client's 30 s floor tracks the server's rate-limit clock. (W3)
       - `summarizeNow` logic:
         - no callId → return cached
         - in-flight → `Promise.race([completionPromiseRef.current, 8s timeout])`
         - fresh-enough (summary exists, < 30 s old) → return it instantly (kills the 429 storm;
           "force-fresh" sooner than 30 s was always impossible server-side)
         - else → `Promise.race([executeSummarize(true), 8s timeout])`
         - the race timer is `clearTimeout`-ed in a `finally` (no dangling nested timers). (W2)
       - Ships via Railway → protects EXISTING packaged apps before they get step 1.

## Bug #52 — ↓ Dig says "go for the close" with zero discovery

**Root cause (proven, Flight Recorder call 928e4249):** the dig prompt gives Sonnet only two
outputs — dig a belief, or `{null,null}` = take-the-close. On a degenerate call (empty summary /
all-⬜ ladder, no prospect) Sonnet's only escape hatch is `{null,null}`, and the route
unconditionally renders "They're ready — go for the close."

### Steps
3. [x] `src/lib/wingman/close-readiness.mjs`: expose the already-computed `cold` boolean on
       `scoreReadiness`'s return (additive; chip path ignores it).
4. [x] `src/app/api/wingman/kb-signal/route.ts` (dig nudge branch ~362): gate the take-close line —
       if `!summary?.trim() || scoreReadiness(summary).cold` send an honest early-call line instead
       (wording = Sebastian's call). **Gate is `cold`-only, NOT `not-ready`** (reviewer W5:
       `not-ready` would clobber the locked verbal-readiness override — prospect says "how do we
       start?" with only Pain 🟡 → doctrine says take the close; cold-only can't touch that case).
5. [x] `src/lib/wingman/dig-prompt.mjs`: minimal additive rule in WHEN NOT TO DIG — never
       `{null,null}` when discovery hasn't started; ask the opening Pain question instead.
       (Byte-identity `buildDigSystemPrompt('direct') === base` holds by construction.)
6. [x] Tests/evals: dig-eval fixture (early-call + all-open ladder → expect a dig question, not
       null); unit tests for the gate mapping incl. the only-Pain-partial → take-close case (locks
       the W5 override); re-run dig-eval + tic-gate + test-close-readiness.

## Gates before "done"
- [x] typecheck web + electron · 187 unit tests · dig-eval (≥4.58 / 0-fab) · tic-gate ·
      test-close-readiness · belief-ladder eval untouched · wingman-reviewer on the full diff

## Results (2026-07-24)
- typecheck web+electron clean · 194 vitest (187+7 new) · test-close-readiness 28/28 ·
  dig-eval FULL GATE PASS (15/15 contract, tonality 4.62, 0 fabrication, take-close fixtures intact,
  new #52 fixture digs 3/3) · wingman-reviewer APPROVE (zero findings)
- Wording locked: "Start discovery." · cold-only gate confirmed
- NOT yet live-call verified — next local call: rapid-press → close (chip <8s, other arrows alive),
  early-call ↓ dig (question or "Start discovery.", never take-close). Flight Recorder will show it.

## Open decisions (Sebastian) — RESOLVED
1. Wording of the dig early-call line (proposal: "Too early to dig — get them talking first.")
2. Confirm the `cold`-only gate (recommended) vs a harder `not-ready` gate that would also
   suppress a legit early verbal-ready take-close.
