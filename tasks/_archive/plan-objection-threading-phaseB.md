# Phase B (+B3) — Live Objection Threading Wiring — Concrete Implementation Plan

**Scope:** Turn the Phase-A threading brain (already merged into this branch, offline-gated,
wired-but-single-shot) into a live capability on a real call. This plan covers **B2 (client thread
ledger in DashboardClient)** and **B3 (kb-signal route plumbing)** together — they are inseparable
(the route currently passes NO thread arg, so B2 alone is a no-op). **B4 (similarity retry-guard) is
a separate follow-up.** Phase C (single-↑ hotkey + combined card) is NOT in scope.

Context already verified by reading the real code:
- `src/hooks/useWingmanPoller.ts` — B1 shipped: `getTranscriptCursor()` + `getTranscriptSince(cursor)`
  over an append-only whole-call `fullTranscriptRef`. Monotonic within a call; resets on new callId.
- `src/lib/wingman/objection-signal.ts` — `streamObjectionCard(transcriptChunk, liveSummary?, signal?,
  thread?)` already accepts `thread: ObjectionThread = { linesGiven, historyTranscript, beatNumber,
  gapFlag? }`. `transcriptChunk` is fed as `latestResponse` into the prompt builder.
- `src/lib/wingman/objection-prompt.mjs` — `buildObjectionUserSegments` activates threading only when
  `thread && beatNumber > 1`. Layer order: CALL MEMORY (cached) → EXCHANGE SO FAR (cached) → MOVES +
  beat + gap + latest marker (fresh tail). Single-shot (no thread / beat<=1) is byte-identical to today.
- `src/app/api/wingman/kb-signal/route.ts` — reads only `transcript_chunk, live_summary, slot,
  current_stage`. Objection slot streams via `streamObjectionCard(transcript_chunk, summary, req.signal)`
  — **no 4th arg today.** Pre-Sonnet empty-transcript guard (line ~101) returns a static Nudge JSON.
  Size guard rejects transcript_chunk > 3500 chars. Rate limit 3s/user.
- `src/app/(dashboard)/dashboard/DashboardClient.tsx` — `handleMenuPick(direction)` is the ONLY press
  handler. `isGeneratingRef` + `lastSummonAtRef`/`SUMMON_THROTTLE_MS` (3.5s) serialize presses (no two
  in flight). The SSE loop's `done` branch (line ~647) has the authoritative final `line`. `release()`
  (line ~548, in `finally`) is the idempotent terminal owner — runs on EVERY exit incl. abort/error.

---

## The data model (client)

New ref in DashboardClient:
```ts
type ObjectionThread = {
  active: boolean;          // a flow is open
  linesGiven: string[];     // verbatim lines handed to the rep (the no-repeat guard)
  beatNumber: number;       // 1 after card-1 done; ++ on each subsequent real line
  anchorCursor: number;     // getTranscriptCursor() at flow open — objection-open point
  lastMoveCursor: number;   // getTranscriptCursor() at the most recent done — end of last move
  beliefSnapshot: string | null; // liveSummary FROZEN at flow open (cache stability)
};
const objectionThreadRef = useRef<ObjectionThread>({ active:false, linesGiven:[], beatNumber:0,
  anchorCursor:0, lastMoveCursor:0, beliefSnapshot:null });
```
`lastPressAt` is NOT a new ref — reuse `lastSummonAtRef` (already the last non-throttled press time).

### Cursor semantics
- `anchorCursor` set once, at **beat-1 `done`** (flow open). Marks where the threaded exchange begins.
- `lastMoveCursor` updated at **each `done`** to the then-current cursor. Marks "everything up through
  the last move."
- At a continuing press, BEFORE sending:
  - `latestResponse = getTranscriptSince(lastMoveCursor)`  (fresh tail — what they said since last move)
  - `sinceAnchor    = getTranscriptSince(anchorCursor)`
  - `historyTranscript = sinceAnchor.slice(0, sinceAnchor.length - latestResponse.length)` (= anchor→lastMove)
    — robust because `latestResponse` is always a suffix of `sinceAnchor` (lastMove ≥ anchor, same
    monotonic buffer). No new B1 accessor needed; B1 stays frozen-as-reviewed.

---

## Control flow inside `handleMenuPick` (objection slot only)

All reads of the thread happen at the TOP (into locals); all mutations happen ONLY in the `done`
branch. Because `isGeneratingRef` + the 3.5s throttle guarantee one press in flight at a time, this
read-at-top / write-at-done pattern has no intra-call race.

1. After the existing throttle passes (`lastSummonAtRef` already updated), compute `sinceLast =
   Date.now() - <prev lastSummonAtRef>`. **Capture `sinceLast` BEFORE the existing line updates
   `lastSummonAtRef`** (reorder: read prev, compute gap, then set = now).
2. Read `const t = objectionThreadRef.current`. Decide mode:
   - **Stale-flow reset (press-time):** if `t.active && sinceLast > FLOW_IDLE_MS (120_000)` → treat the
     flow as expired: reset the ref to inactive NOW, fall through as a fresh beat-1 single-shot.
   - **Threaded continuation:** else if `t.active && t.beatNumber >= 1` → build thread payload:
     - `latestResponse` + `historyTranscript` per cursor semantics above.
     - `gapFlag = sinceLast > GAP_FLAG_MS (40_000)` (but ≤ FLOW_IDLE_MS, else we'd have reset).
     - `beatNumber = t.beatNumber + 1`.
     - `liveSummaryToSend = t.beliefSnapshot ?? liveSummary` (FROZEN belief for cache stability).
     - `transcript_chunk = capLatest(latestResponse)`, `history_transcript = capHistory(historyTranscript,
       latestResponse)` (see caps below).
   - **Fresh beat-1 (single-shot):** else → today's behavior exactly: `transcript_chunk =
     getRecentTranscript()`, no thread fields, `liveSummaryToSend = liveSummary`.
3. Send to `/kb-signal`. Request body gains OPTIONAL fields (absent for beat-1 → byte-identical request):
   `lines_given?: string[]`, `history_transcript?: string`, `beat_number?: number`, `gap_flag?: boolean`.
   `transcript_chunk` continues to carry the "latest" text (120s for beat-1, fresh tail for threaded) —
   this matches how the route already feeds it as `latestResponse`.
4. **On the `done` event (SEV-E — the ONLY mutation site):**
   - `const line = <parsed final line>` (already computed at line ~648).
   - If NOT currently active (this was beat-1): open the flow —
     `objectionThreadRef.current = { active:true, linesGiven:[line], beatNumber:1,
       anchorCursor:getTranscriptCursor(), lastMoveCursor:getTranscriptCursor(),
       beliefSnapshot: beliefAtPress }` where `beliefAtPress = liveSummary` captured at top of handler.
   - Else (threaded continuation): advance —
     `linesGiven.push(line); beatNumber = beatNumberSent; lastMoveCursor = getTranscriptCursor();`
   - Guard: only mutate if `isActiveRef.current` still true and `callId` unchanged (see resets). If the
     call ended between press and done, do NOT open/advance a dead thread.
5. **On `nudge`/abstain:** do NOTHING to the thread (see decision D1). No open, no advance, no reset.
6. **On `error`/`abort`/no-terminal:** do NOTHING to the thread. The beat did not advance; next press
   retries the same beat with the same cursors. Correct.
7. `release()` (finally) stays EXACTLY as-is — it must NEVER touch the thread (it runs on abort/error).

### Caps (SEV-C — never amputate the opening, never bust the stream)
- `capLatest(s)`: `s.length <= LATEST_MAX (3500) ? s : s.slice(-3500)` — the tail is the freshest speech;
  latest is what they JUST said, so keep the END. (Matches today's 120s-window size regime.)
- `capHistory(history, latest)`: budget = `HIST_MAX (4500)`. If `history.length <= budget` return as-is.
  Else pin the opening + keep the recent tail, elide the middle:
  `head = history.slice(0, floor(budget*0.4))`, `tail = history.slice(-floor(budget*0.6))`,
  return `head + "\n--- earlier exchange omitted ---\n" + tail`. NEVER `slice(-n)` the whole thing
  (that would drop the objection opening). Combined worst case ≈ 3500 + 4500 + marker ≈ 8k, matching the
  route's ≤8k contract. (Rep-line stripping from history is a deferred optimization, NOT done here —
  correctness does not depend on it; the route backstop still bounds cost.)

### Resets (thread → inactive)
- **callId change** (new call): new effect resets `objectionThreadRef.current` to the inactive default.
- **isActive → false** (manual end / auto-stop / meeting lost): extend the existing abort effect
  (line ~475) to also reset the thread. (Card dismiss does NOT reset — Sebastian's rule; dismiss only
  aborts the stream, line ~468, and must NOT touch the thread.)
- **Stale-flow (2-min idle):** press-time check in step 2 (no timer — Phase C moves ownership to main.ts).

---

## B3 — route changes (`kb-signal/route.ts`)

1. Read new optional fields from body, with defensive caps (untrusted client input — cost boundary):
   - `lines_given`: array of strings; cap to last 12 entries, each `.slice(0, 400)`. Non-array → [].
   - `history_transcript`: string; `.slice(0, 5000)`. Non-string → "".
   - `beat_number`: number; clamp `0..20` via `Number.isFinite` → else 0.
   - `gap_flag`: boolean coerce.
2. Build `thread` ONLY when `beat_number > 1 && history/lines present`; else `undefined` (single-shot).
3. Pass as 4th arg: `streamObjectionCard(transcript_chunk, summary, req.signal, thread)`.
4. **Combined-size backstop (defensive):** if `transcript_chunk.length + history_transcript.length >
   8000`, trim `history_transcript` from the FRONT-of-middle is overkill server-side — simplest safe
   backstop: cap `history_transcript` to `8000 - transcript_chunk.length` via the same pin-head/keep-tail
   helper (shared util) OR just reject-to-single-shot (drop thread) if still over. Decision D2 below.
5. The existing empty-`transcript_chunk` guard (static Nudge) stays. For a threaded press where the fresh
   tail is empty (rep pressed before the prospect answered), this returns the static Nudge — acceptable
   (rep waits, thread survives per D1). Documented wart, not harmful; refine copy in Phase C.
6. The 3500-char transcript_chunk reject (line ~115): threaded `latestResponse` is already `capLatest`-ed
   to 3500 client-side, so it won't trip. Keep the guard as the backstop.
7. Logging: extend the TIMING log with `beat=<n> hist=<len>` so live testing can watch caching depth.

---

## Decisions to ratify (the pressure points)

**D1 — Abstain/nudge during an active flow does NOT reset the thread.** *(Deviation from the todo.md
line "reset on abstain/nudge" — deliberate.)* Rationale: the thread only ever OPENS on a real `done`
line, so a beat-1 abstain opens nothing (nothing to reset). A mid-flow abstain almost always means "the
prospect is still talking / hasn't answered yet" — resetting there would throw away the whole exchange
the rep built. Genuine resolution or subject-change is covered by (a) the 2-min stale-flow reset and
(b) the `gapFlag` re-diagnosis + the prompt's built-in "switched objection → treat as new" doctrine
(objection-prompt.mjs lines 63–64). So not-resetting is strictly safer. Beat number never advances on
abstain (only on `done`).

**D2 — Server combined-size backstop:** if `transcript_chunk + history_transcript > 8000` after the
per-field caps, DROP the thread (fall back to single-shot on `transcript_chunk` alone) rather than
half-trim. Simple, safe, and near-unreachable given client caps (3500 + 4500 + marker leaves the
combined just over 8000 only in a pathological case; the client helper already keeps it under). The
route stays dumb; the client owns the smart elision. Ratify or prefer the shared pin-head/keep-tail util.

**D3 — Belief freeze:** threaded beats send `beliefSnapshot` (frozen at flow open), NOT live `liveSummary`.
Loses at most one 2-min summarizer update during a ≤2-min flow; buys cache-prefix stability (the whole
"beat 8 as fast as beat 1" promise). Beat-1 sends live `liveSummary` as today.

---

## Files touched (exactly 2)
1. `src/app/(dashboard)/dashboard/DashboardClient.tsx` — thread ref, press-handler branching, done-branch
   mutation, cap helpers, reset effects.
2. `src/app/api/wingman/kb-signal/route.ts` — read/cap/pass thread fields, logging.
(`objection-signal.ts` / `objection-prompt.mjs` already accept the thread — NO change. `useWingmanPoller.ts`
B1 already ships the accessors — NO change.)

## Out of scope
B4 similarity retry-guard (next). Phase C single-↑ + combined card. Rep-line stripping from history.

---

## HARDENED (post plan-review, rev 2) — this section supersedes the above where they differ

Plan-review verdict was NEEDS REVISION → 3 blockers fixed below. Implement from THIS numbered list.

**File 1 — `DashboardClient.tsx`**
1. **Destructure the B1 accessors** — add `getTranscriptCursor, getTranscriptSince` to the
   `useWingmanPoller({...})` destructure (~line 88–98). *(BLOCKER 1 — without this it won't compile.)*
2. **Add `callIdRef`** mirroring `isActiveRef` (~line 75): `const callIdRef = useRef<string|null>(null);
   useEffect(() => { callIdRef.current = callId; }, [callId]);`. *(BLOCKER 3.)*
3. **Add `objectionThreadRef`** with the inactive default.
4. **Top of `handleMenuPick`, right after the throttle passes (~line 511):** capture press-time locals —
   `const callIdAtPress = callId;` `const beliefAtPress = liveSummary ?? undefined;`
   `const t = objectionThreadRef.current;`. Use `beliefAtPress` EVERYWHERE below (never re-read
   `liveSummary` in the done branch — it may update mid-stream). *(BLOCKER 2.)*
5. **Mode decision** (stale-reset / threaded / beat-1). In the threaded branch, capture explicit locals:
   `beatNumberSent = t.beatNumber + 1`, `gapFlag`, the cap-helper outputs, and
   `liveSummaryToSend = t.beliefSnapshot ?? beliefAtPress`. Beat-1 sends `beliefAtPress`. *(LOW 1.)*
6. **Send** optional thread fields (`lines_given`, `history_transcript`, `beat_number`, `gap_flag`) —
   absent for beat-1 so the request is byte-identical to today.
7. **`done` branch — GUARD FIRST, gating the whole mutation:**
   `if (!isActiveRef.current || callIdRef.current !== callIdAtPress) { /* dead thread — do NOT touch */ }`
   `else { open (beat-1) or advance (threaded) using getTranscriptCursor() + beatNumberSent }`.
   *(BLOCKER 3 + BLOCKER 4 ordering — this is the load-bearing safety guard.)*
8. `nudge` / `error` / `abort` / no-terminal → NO thread mutation (only `done` ever mutates).
9. **Cap helpers** `capLatest` (keep tail ≤3500) / `capHistory` (pin head + keep tail, elide middle;
   never front-slice the whole thing).
10. **Reset effects:** (a) new effect keyed on `callId` → reset thread to inactive default; (b) extend the
    **isActive effect (~line 475) ONLY** to also reset the thread, with a code comment:
    `// thread reset lives on the isActive effect ONLY — dismiss must NEVER reset (Sebastian's rule)`.
    Do NOT touch the dismiss effect (~466). *(MEDIUM 4.)*
11. Add `getTranscriptCursor, getTranscriptSince` to `handleMenuPick`'s dep array (~line 683).

**File 2 — `kb-signal/route.ts`**
12. Read + cap the 4 optional fields: `lines_given` (last 12 × `.slice(0,400)`, non-array→[]),
    `history_transcript` (`.slice(0,5000)`, non-string→""), `beat_number` (Number.isFinite, clamp 0–20,
    else 0), `gap_flag` (bool coerce).
13. Build `thread` only when `beat_number > 1 && (history or lines present)`; else `undefined`.
14. **D2 (ratified): if `transcript_chunk.length + history_transcript.length > 8000`, TRIM
    `history_transcript` via pin-head/keep-tail — NEVER drop `linesGiven`, NEVER drop the thread.**
    (linesGiven is the no-repeat guard; dropping it produces a repeated line = a visibly broken card.)
    *(MEDIUM 1.)*
15. Pass 4th arg: `streamObjectionCard(transcript_chunk, summary, req.signal, thread)`.
16. Empty-`transcript_chunk` guard stays (~line 101) → static Nudge for an empty-latest threaded press.
    ASSERT: the client's JSON (non-stream) branch does NOT advance the thread (only `done` mutates), so
    the thread survives and the rep just waits. *(HIGH 2 — verified safe.)*
17. Log `beat=<n> hist=<len>` — **lengths only, never content.** *(LOW 2.)*

**Ratified decisions**
- **D1 (kept):** abstain/nudge during an active flow does NOT reset the thread. Covering mechanisms
  (state explicitly): the 2-min stale-flow reset + the `gapFlag` re-diagnosis + the prompt's abstain gate
  (`objection-prompt.mjs:62`) and switched-objection doctrine (`:64`). Beat number advances ONLY on `done`.
- **D2 (ratified):** trim history, never drop `linesGiven` (see step 14).
- **D3 (kept + reasoning stated):** threaded beats send the FROZEN `beliefSnapshot`. Caching seg-2
  (EXCHANGE SO FAR) pays off because it's **append-only → each beat is a prefix-extension of the last**,
  so Anthropic prompt-caching hits the prior history prefix and only writes the delta. Latency ≈ flat
  across beats; per-beat cost rises to a bounded plateau (history capped ~4500) then holds — NOT truly
  flat, but bounded. *(MEDIUM 2.)*

**Known residual (accepted, not a blocker):** resolve-then-NEW-objection within 40s (no gapFlag) → the
card is generated as a deep beat with stale `linesGiven` + a "lean toward close" instruction; the only
guardrail is the prompt's switched-objection line (`objection-prompt.mjs:64`). B4 (similarity guard) +
Phase-C single-↑ reduce this. Added to live tests (step 10 below).

---

## ADDENDUM (rev 3) — Sebastian's two directives (2026-07-02)

### C. No silent drops — "coalesced deferred press" (replaces the silent throttle drop)
Today a press in the 2–3.5s throttle dead-zone is silently eaten (DashboardClient ~line 507–510).
Sebastian: the user must always know something happened. Fix = **defer, don't drop**:
- On an objection press inside the throttle window (and NOT already generating): show the **"thinking"
  pill immediately**, set `pendingPressRef=true`, schedule ONE timer for the remaining throttle time
  (+~50ms). On fire: clear pending, and if still active re-enter `handleMenuPickRef.current(dir)` — which
  re-reads FRESH context/thread/throttle and generates. Pill stays "thinking" seamlessly → card.
- **Coalesce:** ONE pending press max (a boolean, not a queue — respects "never queue"). Extra presses
  during the wait are absorbed (pill already up).
- **During active generation** (isGeneratingRef true): unchanged — the streaming card/pill is already
  visible, so feedback exists; do NOT start a second card (one-card rule). Not a silent drop.
- **Cancel pending** on call end (isActive→false) and dismiss (clear timer + pending + pill). Dismiss
  cancels the queued fire but does NOT reset the thread (Sebastian's rule stands).
- New refs `pendingPressRef` / `pendingTimerRef`, cleaned in the isActive + dismiss effects. Accepted edge:
  if a generation is somehow in flight at the deferred re-entry, it drops (rare; the pill gave feedback).

### D. Long-objection overflow → BACKGROUND ROLLING FLOW SYNTHESIS (replaces literal cutting)
Long objection grinds (~10–20 min) are COMMON and high-stakes, not an edge case. Literal middle-cutting
leaves a real context hole that degrades the card. Replace with a **rolling, pre-computed strategic recap
of the middle**, maintained in the BACKGROUND during the prospect's talk time so press-time latency ~0.

Architecture (flow-scoped; mirrors the 2-min Belief Ladder summarizer in `belief-ladder.ts` +
`summarize/route.ts`, tuned for objection strategy):
- New ledger fields: `recapCursor` (how far the recap absorbed; starts = `anchorCursor`) + `flowRecap:
  string` (synthesized state, anchor→recapCursor).
- **Press-time composition** of "EXCHANGE SO FAR": `flowRecap` (compact strategic state of the OLD middle)
  + `verbatim(recapCursor → lastMoveCursor)` (recent turns stay verbatim — nuance matters most recent).
  `latestResponse` (lastMove→now) is the fresh tail. **No context hole.**
- **Runs ONLY when long:** `(currentCursor − anchorCursor) > SYNTH_THRESHOLD (~3000 chars)`. Short/medium
  objections never synthesize → zero added cost; verbatim-history stays the default AND the fallback.
- **Rolling cadence:** flow-scoped ~35–45s timer that, while long+active, synthesizes `verbatim(recapCursor
  → (lastMoveCursor − RECENT_TAIL~1500))` into `flowRecap`, advancing `recapCursor`. Uses dead time so the
  recap is pre-warm at press. Never reactive to a press.
- **Model:** Sonnet 4.6. Bounded cost (long flows only, ~500-tok output, server rate-limited like
  summarize). New `POST /api/wingman/flow-synth` (or a `mode` on summarize — decide in impl). Resets with
  the thread.

The synthesis prompt (the crux), grounded in the doctrine just read from `PLAYBOOK-SYNTHESIS.md` (7
beliefs Pain/Doubt/Cost/Desire/Money/Support/Trust; buckets uncertainty→financial→support;
pace→tie-down→isolate→handle→trade) + `LIVE-CALL-FINDINGS.md` (angles: tie-down, cost-of-inaction,
fear-magnify, analogy, permission-reframe, financial trade; "note other objections but ram ONE line to
yes"). Frame: *"maintain a strategic state read of ONE live objection so a closer who missed the middle
picks the perfect next move."* Compact FIXED-SIZE (like the Belief Ladder), preserving:
```
OBJECTION FLOW RECAP
Real objection → belief: <driving belief + bucket, not surface words>
Angles tried → reaction:
  • <angle> → <softened | hardened | deflected | conceded | ignored>
Trajectory: <warming to yes | digging in | circling/stuck> — <where momentum is>
Conceded / anchored (verbatim): "<quote>" · "<quote>"
Dead angles (do NOT repeat): <what isn't landing>
Suggested next lever: <the pivot the state implies>   (advisory — the card prompt still decides)
```
Belief-ladder discipline: grounded only in what was said; verbatim quotes exact; update-in-place,
fixed-size (must NOT grow with beats); recent overrides stale. Complements (not duplicates) the frozen
Belief Ladder sent as CALL MEMORY — recap = objection-exchange specific; belief snapshot = macro.

### E. Quality gate — eval, not vibes
Add a **long-flow fixture** (~15–20-min grind that forces synthesis) to `scripts/objection-threading-
eval.mjs`. Judge (Claude + optional GPT) scores whether the post-synthesis card is **as sharp as** the
full-verbatim card on the same fixture. Quality drop → gate FAILS → tune the synth prompt. This gate is
component D's definition of done. Single-shot tonality gate stays green (no regression).

### F. CALL-LEVEL OBJECTION MEMORY (NEW — Sebastian, 2026-07-02)
**Directive:** learnings from handled objections must NEVER die with a flow reset. Every new objection
card should know what was already worked this call — but as a compact digest, never a latency tax.

- **Store (client):** `callObjectionMemoryRef` in DashboardClient — `{ archivedFlows: string[],
  allLinesGiven: string[] }`. Resets ONLY on `callId` change (call-scoped; flow resets do NOT touch it).
- **Archive on flow close** (stale-flow expiry / new-flow open over a dead one / call end): push the
  flow's `flowRecap` (if synthesis ran) into `archivedFlows`; always merge the flow's `linesGiven` into
  `allLinesGiven`. Short flows that never synthesized archive lines only (verbatim lines ARE the
  essential no-repeat payload; strategic learnings exist only where synthesis ran). OPEN for plan-review:
  optionally fire ONE background close-out synthesis for a ≥2-beat flow that has no recap yet (bounded:
  one ~500-tok Sonnet call per multi-beat flow, in dead time, never at press).
- **Payload (bounded, cached):** new optional prompt segment `EARLIER OBJECTION EXCHANGES THIS CALL` —
  last 3 recaps (~700 chars each) + `allLinesGiven` capped like the route (last 12 × 400). Total ≤ ~2.5k
  chars ≈ ~700 tok, STABLE within a flow (changes only between flows) → cached prefix, pre-computed in
  background → ~zero press-time latency. Sent on beat-1 AND threaded beats.
- **Server:** kb-signal reads + caps a `call_memory` field; builder gets an optional param; single-shot
  with no memory stays byte-identical. Doctrine line: "exchanges already worked this call — do NOT repeat
  those lines; if the same objection resurfaces, acknowledge it's back and ADVANCE, don't restart."
- **Eval:** fixture where an objection resurfaces after an archived flow → the card must not repeat an
  archived line and must not restart at square one.

---

## HARDENED STEP 2 (rev 4, post plan-review) — supersedes D/E/F details above where they differ

Plan-review verdict on D/E/F as sketched: NEEDS REVISION — 3 blockers. All resolved below. Implement
Step 2 from THIS list. **6 files** (adds `flow-synth/route.ts`).

**Blockers found + resolutions:**
1. **D contradicted ratified D3 (cache).** The recap is rewritten every synth tick; placing it inside the
   cached "EXCHANGE SO FAR" region busts the whole history cache each tick. FIX — new segment layout,
   ordered by mutation frequency:
   `seg1 EARLIER OBJECTION EXCHANGES THIS CALL (call_memory, cache:true, FIRST — changes only on flow
   archival) → seg2 CALL MEMORY (frozen belief, cache:true) → seg3 EXCHANGE SO FAR = verbatim(recapCursor→
   lastMove) (cache:true, append-only BETWEEN synth ticks) → seg4 tail = OBJECTION FLOW RECAP (rewritten)
   + MOVES + beat + gap + latest (cache:false).` The recap lives in the VOLATILE TAIL — a rewrite costs
   only the tail re-encode. **AMENDMENT to D3's claim:** cache holds flat BETWEEN synth ticks; each synth
   tick (recapCursor advance) pays one seg3 re-encode (~every 40s). Not literally flat — bounded.
2. **Stale synth response = silent state corruption.** The synth is async (~2–5s); the flow/call can die
   mid-request. FIX — synth response writes ONLY if `callIdAtSynth === callIdRef.current && isActive &&
   flow still open && anchor unchanged` (same guard class as the done-branch). Plus `isSynthesizingRef`
   mutex (one in flight, mirrors `isSummarizingRef`). Synth writes ONLY `flowRecap`+`recapCursor`; the
   done-branch writes ONLY `linesGiven`/`beatNumber`/`lastMoveCursor` — disjoint fields, field-level
   mutation only, never whole-object replace (two async writers).
3. **recapCursor gap-cover.** `lastMoveCursor` advances while a synth is in flight. FIX — freeze
   `synthAbsorbedTo = clamp(recapCursor, lastMoveAtRequest − RECENT_TAIL(1500), lastMoveAtRequest)` at
   REQUEST time; on valid response set `flowRecap` + `recapCursor = synthAbsorbedTo` atomically. Never
   recompute at response time. Cursor is monotonic; region synthAbsorbedTo→now stays verbatim → no hole,
   no double-cover.
4. **Last-flow archive loss (F).** "Flow close" is 3 code sites, 2 of which destroy the thread in the
   same statement. FIX — `archiveCurrentFlow()` (read dying thread → push recap if present, merge lines)
   runs BEFORE every reset: stale-expiry, isActive→false, callId change (archive → reset thread → THEN
   reset call memory on callId only). Close-out synth for a ≥2-beat recap-less flow fires ONLY on the
   stale-expiry / new-flow-open paths (live call, dead time) — NEVER at call-end (races teardown). The
   final flow of a call keeps its LINES but may lose its recap — accepted until DB persistence (cross-call
   prospect-memory track, out of scope, flagged).
5. **Cost bounds (was unbounded).** Client cadence 40s + `SYNTH_THRESHOLD` 3000 chars + **MAX_SYNTH_TICKS
   ~20/flow** + server 30s/user rate floor on the new route + `max_tokens: 200` (~700 chars, matches the
   archive slot). ≈ $0.01/tick ⇒ ≤ ~$0.20 for a pathological 30-min single objection; $0 for short/medium
   (the threshold check precedes any fetch). Rolling + close-out both ratified WITH these bounds.
6. **Honest payload math (F).** call_memory re-capped: recaps last 3 × 700 + linesGiven last **8 × 200**
   ⇒ ~3.5k chars ≈ ~1000 tok (not "700 tok"), cached, front-positioned. Beat-1 with call_memory present is
   NO LONGER byte-identical to the shipped single-shot (true from objection #2 on) → covered by a new eval
   fixture (below). Objection #1 (no memory, no thread) stays byte-identical.
7. **Eval gate must be comparative (E).** The current judge is boolean-only — it cannot measure "as sharp
   as." FIX — A/B judge: generate card_full (full verbatim) AND card_synth (real synth prompt on the
   middle + composed recap+tail) for the SAME long fixture, feed both blind/randomized, "which better
   handles the latest response, or tie"; gate fails if card_synth loses beyond margin across repeat runs.
   Fixture source: mine a real multi-turn grind from `knowledge-base/objection-transcripts/live-calls/`
   (13 real closer transcripts — JP Egan grinds objections across many turns) — no new data needed.
   Also: extend `assertMarkersInSync()` to the two new segment markers; add the call_memory-on-beat-1
   fixture (no repeated archived line, no square-one restart); DRY=1 prints the new composed shape.
8. **New route decided:** `POST /api/wingman/flow-synth` (NOT a mode on summarize) — own rate-limit Map,
   own caps (slice ≤2500, prior recap ≤1500, belief ≤4000), no DB write, keeps synth risk out of the
   load-bearing summarizer's blast radius. Auth + ownership check copied from summarize.

**File-by-file (implement in this order):**
- **A `src/hooks/useWingmanPoller.ts`** — synth timer lives HERE beside the summarize loop (one cleanup
  path via the `[isActive, callId]` effect): refs `flowRecapRef`/`recapCursorRef`/`isSynthesizingRef`/
  `synthIntervalRef`/`flowActiveRef`; `setFlowSynthContext({active, anchorCursor, lastMoveCursor})` called
  by DashboardClient on open/advance/reset (ledger stays single-owned in DashboardClient);
  `getFlowRecap()`/`getRecapCursor()` accessors; `executeFlowSynth()` mirroring `executeSummarize`
  (mutex, 25s timeout, request-time freeze, response guard per blockers 2–3); tick body gates on
  flowActive && threshold && tick-cap.
- **B `src/app/api/wingman/flow-synth/route.ts` (NEW)** — auth + ownership, 30s floor, caps, Sonnet 4.6,
  max_tokens 200, the SYNTHESIS_PROMPT (fixed-size template from section D; belief-ladder discipline;
  focus on EXCHANGE DYNAMICS — angles tried→reactions, dead angles, trajectory, concessions — do NOT
  re-derive the Belief Ladder), returns `{ recap }`, no DB write.
- **C `src/lib/wingman/objection-prompt.mjs`** — segment reorder per blocker 1; builder accepts
  `flowRecap?` + `callMemory?`; objection-#1 single-shot byte-identical when both absent.
- **D `src/app/api/wingman/kb-signal/route.ts`** — read/cap `call_memory` (3×700 + 8×200) + `flow_recap`
  (≤900); pass through; extend the D2 8k backstop to include them (trim history first, never linesGiven,
  never call_memory); TIMING log `beat= hist= recap= mem=` lengths only.
- **E `DashboardClient.tsx`** — `callObjectionMemoryRef` (reset on callId only); `archiveCurrentFlow()`
  before every reset site (blocker 4); close-out synth trigger on stale-expiry/new-flow-open only;
  `setFlowSynthContext` wiring at open/advance/reset; press-time: `history_transcript =
  verbatim(recapCursor→lastMove)` (falls back to anchor→lastMove exactly when no synth ran, since
  recapCursor===anchorCursor), send `flow_recap` + `call_memory` on beat-1 AND threaded beats.
- **F `scripts/objection-threading-eval.mjs`** — comparative A/B long-flow gate (fixture mined from
  live-calls/), call_memory-on-beat-1 fixture, extended desync guard, DRY support.

**Step-2 open decisions (recommendations inline):**
- Fixture: mine from `live-calls/` (recommended — real closer data already in repo, no new data needed).
- Close-out synth: ACCEPT (bounded, ~fractions of a cent per multi-beat flow).
- Last-flow recap loss: ACCEPT for now; revisit with DB persistence in the prospect-memory track.
- MAX_SYNTH_TICKS 20 @ 40s cadence: ACCEPT (hard cost ceiling ~$0.20/pathological flow).

### Sequencing (both land in Phase B — synthesis is NOT deferred)
- **Step B2/B3 + C** (threading core + no-silent press): thread ledger, route plumbing, deferred press.
  Overflow uses the interim pin-head/keep-tail verbatim cap as a SAFE fallback. Live-testable.
- **Step D + E** (rolling synthesis + eval gate): layer the background recap, replacing the interim cap.
  Own plan-review + the long-flow eval gate.
- **Step B4**: similarity retry-guard.
Split = reviewable increments + an isolated quality gate for the crux prompt, NOT deferral.

---

---

## B4 (rev 5) — Echo guard: prevention + streaming early-abort retry

**Sebastian's constraints (2026-07-02):** no ~4s cards — the retry must not double latency; forced-
different is NOT the goal (ship the better card); threshold LOOSE (catch echoes, allow sharpened
escalations like a payment-trade refinement… though the judge treats same-lever-reworded as a repeat,
so tune against the fixtures).

**Layer 1 — Prevention (DONE, measuring):** sharpened doctrine — "check your line against EACH move;
same opener / same ask / same lever with new words = repeat → pick an UNUSED lever." If this alone
turns the circle-back fixtures green, the guard becomes a rarely-firing backstop.

**Layer 2 — the guard (client, streaming-aware early abort):**
- **`src/lib/wingman/line-similarity.mjs` (NEW, shared TS+eval like the prompt modules):**
  `isEchoOfPrior(candidate, priorLines)` — normalized tokens (lowercase, strip punctuation, drop
  stopwords), Jaccard overlap vs each prior line; plus an early-partial mode (first ~8-10 content
  words vs each prior line's opening). Conservative thresholds; unit-tunable offline against the
  fixtures' known echo/non-echo pairs (deterministic — no API).
- **DashboardClient SSE loop (threaded beats ONLY):** once `textSoFar` ≥ ~8 content words, run the
  early check ONCE per stream. On echo: quietly abort the fetch (NOT via fail()— no retry pill),
  wipe the partial reveal (existing `abort` phase), keep the pill thinking, re-fetch ONCE with
  `echoed_line: <matched prior line>` + a fresh seq. `retriedRef` per press — max one retry, then
  ship whatever comes (even if still similar — better-of-two, never dead air). At `done`, if an echo
  slipped the early check: LOG only, never morph an already-revealed card.
- **Server (`kb-signal`):** read `echoed_line` (cap 400, threaded-only); pass into thread; builder
  (`objection-prompt.mjs`) appends a retry nudge to the volatile tail: "Your previous draft repeated
  the move '<X>' — do NOT use that angle at all; pick a different lever." Single-sourced in the
  builder. **Rate-limit carve-out:** the retry lands ~1s after the original → would 429. Allow ONE
  request with `echoed_line` per user per 10s window (separate small map) — bounded, can't be spammed.
- **Latency budget:** early check ≈ 0ms (local math); echo caught ~0.3-0.5s in → abort + warm retry
  → flagged beat ≈ +1s (not +2). Unflagged beats: zero added.
- **Eval (production-faithful):** circle-back fixtures run generate → `isEchoOfPrior` → if echo,
  regen once with the nudge (exactly production's path) → grade the FINAL line. Gate: advance-money-2
  + advance-doubt green with the guard on (todo.md B4 acceptance). Cross-check with the GPT judge
  (`JUDGE_PROVIDER=openai`, newest strong model available on the key).

---

## B4 (rev 6 — FINAL DESIGN) — Lever declaration + server-side invisible retry
**Supersedes rev 5 entirely** (text-similarity rejected: repeats are lever-level not word-level; pace
openers false-positive; and rev-5's client-side retry had 3 blockers — rate-limit 429, terminal-owner
collision, eval blindness — all of which this design STRUCTURALLY avoids: no second HTTP request, no
client streaming changes, no fuzzy thresholds).

**Product rules (Sebastian, 2026-07-02 — load-bearing):**
- NOT a blocklist. Closers legitimately re-run plays (double tie-down; returning to the trade). The
  memory we feed is "plays run + how he reacted," and the judgment rule is: *return to a play ONLY if
  something changed or you're escalating it decisively; NEVER re-run the play that just failed,
  unchanged.* The guard fires ONLY on consecutive-same-lever (the one always-wrong pattern).
- `direct-close` is EXEMPT from the guard (re-closing on deep beats is doctrine — the honest move when
  angles are exhausted).
- Retry is invisible: caught before any text paints; if attempt 2 insists on the same lever, ship it
  (humility valve — it may be a deliberate escalation).

**Key discovery:** `decodeLineStream` locates the line via `indexOf('"line"')` — a preceding field is
transparent to it. So `{"lever":"<id>","line":"..."}` streams through the EXISTING decoder unchanged;
we only ADD a sibling `decodeLeverStream()`. The 91-test streaming path is untouched. Single-shot
(beat 1, no thread) keeps today's `{"line":...}` envelope byte-identical — the lever field is
instructed ONLY in the threaded doctrine section.

**Mechanics of a threaded beat:**
1. Prompt (threaded): output `{"lever":"<one of the taxonomy>","line":"<words>"}`. Context gains
   `PLAYS YOU'VE RUN (in order)` + a pointed line: *"your LAST play was <X> and it hasn't landed —
   don't re-run it unchanged: escalate decisively or switch."* (Reactions come free: raw exchange on
   short flows, the recap's angle→reaction grades on long flows. No new AI call.)
2. Server (`streamObjectionCard` wrapper): as raw accumulates, parse the lever (complete within ~10
   output tokens, BEFORE the first line char → before any delta is emitted). If `lever ===
   lastLever && lever !== "direct-close"` and this is attempt 1: abort upstream Sonnet (~10 tokens
   burned, negligible), regenerate ONCE with the escalate-or-switch nudge appended to the volatile
   tail (cached prefix hits → warm retry). Attempt 2 streams whatever it produces.
3. `done` event gains `lever`; client stores it in the ledger (`leversUsed[]`, order-preserving)
   and sends `levers_used` on the next press. Call-level memory archives levers with lines.

**Latency:** unflagged beats +~0.1s (the label tokens). Flagged beats: pill runs ~1–1.5s longer,
nothing paints till the good card streams. No wipes, no flicker, no client retry.

**LEVER_TAXONOMY (single source, shared by card prompt + synth recap + guard + eval):**
`pace-tie-down · why-probe · name-the-pattern · cost-of-inaction · fear-magnify · analogy ·
permission-reframe · financial-trade · identity-future-self · consistency-anchor · direct-close`

**Files:**
- `objection-prompt.mjs` — export `LEVER_TAXONOMY`; threaded doctrine: envelope shape, plays-run list,
  last-play rule, `leverToAvoid` retry-nudge param (volatile tail; single-sourced); marker into
  `assertMarkersInSync`.
- `json-line-stream.ts` — ADD `decodeLeverStream(raw)` (pure, sibling fn; existing fn untouched) +
  unit tests incl. split-at-arbitrary-byte cases.
- `objection-signal.ts` — `ObjectionThread.leversUsed?: string[]`; guard wrapper around the stream
  attempt (max 2 attempts, one AbortController per attempt, timers per attempt via the existing
  per-call structure); `done` yields `lever`; non-streaming `generateObjectionCard` gets the same
  guard non-streamingly (parse lever from the full parse).
- `kb-signal/route.ts` — read/cap `levers_used` (last 12, each ≤30 chars, must ∈ taxonomy else drop);
  `done` SSE frame includes `lever`. NO rate-limit changes (retry is in-process).
- `DashboardClient.tsx` — ledger `leversUsed[]`; store lever from done payload (additive field read);
  send `levers_used`; archive levers into call memory. No streaming-path changes.
- `objection-threading-eval.mjs` — fixtures gain `lastLever`; production-faithful guard sim (generate →
  lever===lastLever → regen with nudge → grade FINAL); assert lever ∈ taxonomy; judge gains
  `lever_matches` (label honesty); circle-back fixtures must go green with guard on; GPT cross-judge.

---

## B4 rev 7 — HARDENED (post plan-review; implement from this)
Rev-6 verdict: NEEDS REVISION — foundation confirmed (decoder transparency real; rev-5 blockers
structurally gone), 3 blockers fixed below. Decisions: totalTimer = ONE shared 20s budget across both
attempts (ttfb re-arms per attempt); humility valve confirmed (attempt 2 insists → ship, bounded to one
retry/press); taxonomy protected by a gate assertion (every id rendered as `"lever":"<id>"` must not
contain `"line"`), not frozen.

1. **Guard fires only when a real line is coming** — decision point = the first inner `delta` (or
   resolve). `abstain` → yield immediately, guard NEVER evaluates (blocker 2).
2. **Wrapper structure:** extract the current single-attempt streaming body into an inner generator
   (own controller/ttfb/finally); `streamObjectionCard` = thin 2-attempt loop that WITHHOLDS events
   until the guard decision; on retry it stops consuming attempt 1, swallows the AbortError internally,
   yields NOTHING to the route (blocker 3a). Fresh rawModel/emittedLen/sawFirstText/lever per attempt
   (free via fresh inner call).
3. **Degradation rule:** at first-line-char, `decodeLeverStream` unresolved/absent/non-taxonomy →
   NO-guard, replay withheld delta, stream normally. Missing lever can never error or dead-air (3b).
4. **decodeLeverStream** = pure sibling in json-line-stream.ts; `{"line"` reached with no lever →
   `{status:"none"}` (deterministic decision point). decodeLineStream UNTOUCHED. Unit tests: lever-
   prefixed line/abstain/split-bytes + taxonomy-collision assertion (also in assertMarkersInSync).
5. **Non-streaming parity:** `parseObjection` reads `p.lever` (validate ∈ taxonomy); `ObjectionCardResult`
   line-variant gains `lever?`; `generateObjectionCard` gets the same 2-attempt guard → the eval sim
   tests the real path (HIGH 5).
6. **leversUsed is FLOW-scoped** — reset with linesGiven at every thread reset; archived copy feeds only
   the earlier-exchanges doctrine, NEVER the consecutive-lever guard (HIGH 7). Stored in the done branch
   inside the dead-call guard only.
7. Lever instruction lives ONLY in the threaded builder branch — single-shot byte-shape guard must stay
   green. `done` SSE frame gains `lever` (route + client read additive). Cost claim corrected: flagged
   beat ≈ +1 cached-input encode + ~10 output tokens + one full output — bounded, ≤2 attempts.

## Test steps (live — `npm run electron:dev`, real Zoom/Meet)

1. Raise an objection, ↑↑ → card 1. (Thread opens on done — verify via a temporary console log of the ref.)
2. Push back, ↑↑ → advances, does NOT repeat card 1's line; watch `[kb-signal] TIMING beat=2`.
3. Push back 3–4× → each new; leans toward close as beats climb; `beat=N` climbs.
4. Deep beat (6+): references earlier exchange, never repeats an earlier line; latency ≈ beat 1 (cache).
5. Switch to a genuinely different objection (no pause) → prompt treats as new (no recycled lines).
6. Press again after a ~50s pause → `gap_flag` true → re-diagnoses instead of forcing the old thread.
7. Silence 2+ min → next ↑↑ is a fresh beat-1 (stale-flow reset).
8. End call mid-flow → thread resets; next call starts clean (callId reset).
9. Regression: a lone objection with no follow-up behaves byte-identically to today (single-shot).
10. Resolve an objection, chit-chat ~20s, then raise a DIFFERENT objection and press (< 40s, no gapFlag)
    → confirm the card handles the NEW objection and does not repeat a prior line / force a close.
11. End call mid-stream (press, then end before the card lands) → confirm NO thread is armed for the
    next call (the done-branch guard rejects the dead-call mutation).
