# Plan — Phase 4a: ↓ Dig Deeper — single-shot → Dig Flow → experimental auto-advance

**Status:** v3 FINAL 2026-07-07 — three plan-reviewer passes complete. Pass 1 (W1–W8, single-shot draft), pass 2 (W9–W14, flow rework), pass 3 (W15–W24, UX surface — verdict: fold these in and it clears the bar; all folded below). Ready for Sebastian's 4a.1 build go-ahead. One decision pinned as RECOMMENDED pending confirmation: canonical top-tier plan string = `"pro"` (W21).

> ### Third pass — what it caught (W15–W24, folded in)
> - **W15/W16 (BLOCKER) — pill/card layout collision:** the thinking pill and the signal card share the SAME anchor (`top:64px; left:50%`), pill z-index higher — a persistent pill reusing that box would paint OVER the card's first line. Fix: dedicated non-overlapping layout slots, table below.
> - **W17 (BLOCKER) — stale Down-key closure across a flow-type switch:** the flow direct keys are closures; a dig→objection switch without teardown+re-register leaves ↓ firing "dig" into an objection flow (and re-registering a held key NO-OPs — the Phase C lesson). Fix: type-switch tears down + re-registers direct keys with the Phase C ordering discipline.
> - **W18 (BLOCKER, then SIMPLIFIED by Sebastian 2026-07-07) — pendingSwitch cleanup + Esc:** the confirm countdown clears on just three things — confirm, Esc/natural-3s-timeout, and **call-end** (hygiene: don't leave a global key grab or floating pill after a call). Flow-idle-timeout mid-countdown is deliberately NOT special-cased (Sebastian: overengineering — the countdown just plays out; the outcome is sensible either way). No "refuse while generating" logic — the confirm press drops on the existing `isGeneratingRef` guard. Esc bound ONLY while a confirm is pending.
> - **W19 — ← mid-dig promised 4b behavior:** the client short-circuits ← to "coming soon" and 4a.2 doesn't change that. Fixed: contract table now says so honestly; the answer-card display-slot handoff moves to 4b's plan.
> - **W20 — server-side auto breaker added** (~40/call backstop above the client's 30; in-memory like the rate-limit map — a bug-storm guard, not a billing meter).
> - **W21 — plan-string chaos:** `subscription_plan` has no canonical vocabulary in the codebase (`"closer"|"setter"` in SettingsTab vs Free/Core/Pro in pricing docs). Pinned: canonical = `"pro"` (RECOMMENDED — confirm), `entitlements.ts` is the ONE mapping point, DB values verified before wiring.
> - **W22 — single-authority pill invariant:** main (which owns the idle timer) emits the pill state at its own `openFlowMode`/`closeFlowMode` choke points — pill on screen ⇔ main's armed state, no second code path to forget.
> - **W23 — breathe timer discipline:** single owned interval, cleared on pill-hide/flow-end/toggle-off/call-end; never double-animates with the existing `pillPulse`.
> - **W24 — file lists completed:** `preload.ts` + the main flow-state relay + `SettingsTab.tsx` were certain edits missing from the lists; `sendFlowState`'s payload growth named explicitly.
**Source decisions:** Decisions Log 2026-07-07 (Dig Flow + experimental auto-advance) · 2026-07-06/07 session decisions (take-the-close, bundled release, confirm-switch, flow pill) · Cole Gordon PDFs (Belief Ladder / First Principles / Closer Crash Course).
**Gate to done (each stage):** offline eval green (Claude + gpt-4o) → wingman-reviewer APPROVE → tsc + tests green → live call.

---

## The arc — three stages, one engine

Rep presses **↓** → Wingman reads the live Belief Ladder + transcript → the exact first-person question to ask next. Keep pressing ↓ → Wingman chunks down with them (a **Dig Flow**, twin of the shipped Objection Flow). Top-tier users can flip on **auto-advance** (experimental): inside an armed flow, the next probe surfaces on the prospect's turn-end with no re-press.

| Stage | What ships | Trigger |
|---|---|---|
| **4a.1** | Single-shot Dig card — quality locked offline first | press |
| **4a.2** | Press-driven Dig Flow + persistent flow pill + confirm-to-switch | press |
| **4a.3** | Auto-advance — EXPERIMENTAL, top-tier, off-by-default toggle + breathe indicator | turn-end |

**Load-bearing engineering rule:** all beats route through one `fireDigBeat(trigger: "press" | "auto")` built in 4a.2; 4a.3 is a trigger flip + gating + turn-end plumbing, NOT a rebuild. Same playbook as the objection card (3.6a single-shot → A/B/C threading): lock question quality before thread complexity.

---

## Design doctrine (Sebastian-locked — the prompt and UX are built to this)

1. **Press #1 = belief-gap scan.** First ↓ reads the Belief Ladder, finds the untouched/weakest belief (⚠️ at-risk → ⬜ open → 🟡 partial) and tees a context-aware OPENING question for it ("20 minutes in, what haven't I touched?").
2. **Chunk-down ladder press #2+** (same belief, one layer deeper per beat): surface ("tell me more") → clarify ("when you say X, what do you mean exactly?") → quantify → emotionalize ("what's the worst part?" / "take me back to the day…") → widen the gap.
3. **Cards are FIRST-PERSON spoken words, never instructions.** Only-money-left → the money-qualifier question verbatim. Sole instruction-shaped cards: take-the-close and the final transition-to-pitch.
4. **Chrome names the belief:** `DIG #N · <BELIEF>`.
5. **Coverage = ALL 7 beliefs** (not "enough"), **money last**, **never hammer a locked/heavily-dug belief**.
6. **Order-aware, soft:** bias problem→desired→current→doubt/cost→support, money/support late + pre-framed; never a money/spouse probe while Pain is wide open; follow the conversation if it organically jumped.
7. **Stop states:** belief locked / dug 3–4 layers → next open belief's opener (chrome flags the switch) · only Money open → the money question verbatim · all locked / prospect closing themselves → take-the-close nudge (`{"line":null}`) · truly-empty transcript → static "Too early — let them talk first" (server-owned copy).
8. **No Belief Ladder exists for the first ~2 min of every call (the COMMON case, not an edge):** degrade to a generic opening discovery question grounded only in the raw transcript.
9. **No-fabrication fence** (copied from objection prompt) + explicit: a `⬜ open` belief is un-discussed — ask an OPENING question, never assert a fact/number/quote they haven't said (highest fabrication risk in the slot).
10. **One card visible at a time (Core Rule #1), but the FLOW ≠ the card.** The armed flow (thread, beat counter, belief) survives whatever is painted; the persistent flow pill (below) makes that survival visible.
11. **Never left guessing:** every armed/auto state has a visible signal (flow pill; breathe pulse). Every timed dismissal has a visible countdown (draining bar).

---

## Stage 4a.1 — Single-shot Dig (quality first)

### Files (7 — Hard Rule #4; carries all W1–W8 fixes)
1. **`src/lib/wingman/dig-prompt.mjs`** *(new)* — `DIG_SYSTEM_PROMPT` + `buildDigUserSegments({liveSummary, latestResponse})`. Single source of truth for prod + eval. Objection-style JSON envelope + a `belief` field (`{"line":"…","belief":"Pain"}`), tolerant parse (missing/unknown belief → no tag, never an error). Encodes ALL doctrine above.
2. **`src/lib/wingman/dig-signal.ts`** *(new)* — `streamDigCard(transcriptChunk, liveSummary?, signal?)`: async generator `{kind:"delta"|"nudge"|"done"|"error"}`. Mirrors `streamObjectionAttempt` minus threading/levers/B4/callMemory; reuses `parseSSEBuffer` + `decodeLineStream` (decoder `abstain` → `nudge`); belief-field reader modeled on `decodeLeverStream`. Sonnet 4.6, ~150 max tokens, TTFB 12s / total 20s, `signal` wired, objection-verbatim `finally` discipline.
3. **`src/app/api/wingman/kb-signal/route.ts`** *(edit, additive)* — `if (activeSlot === "dig") { …SSE… }` before the JSON fallback, mirroring the objection branch. `DIG_NUDGE_*` copy constants (take-the-close + too-early). Empty-transcript arm returns the too-early static nudge, NOT `{ok:true}`. No objection lines change.
4. **`electron/hud/index.html`** *(edit)* — add `'Dig'` to `TYPE_MAP` (:949) (else the tag falls back to "SUGGEST"). 4a.1 chrome = `DIG · <BELIEF>` tag (the `#N` counter arrives with the flow). **HUD-side → packaged apps get it via the bundled desktop release (with 4b/4c + Phase C chrome); until then live-test in dev.**
5. **`src/app/(dashboard)/dashboard/DashboardClient.tsx`** *(edit)* — route `direction === "dig"` to `handleDigPick`: reuses the SAME shared refs (`isGeneratingRef`, `lastSummonAtRef`, `pendingPressRef`, `pendingTimerRef`, `streamAbortRef`, `seqCounterRef` — no parallel copies); identical throttle+coalesce+pill contract; KEEPS the #41 settle-wait; sends `type:"Dig"` on **every delta AND the done frame** (the objection stream hardcodes `type:"Objection"` on its `sendSignalDelta` calls — reuse would flash "OBJECTION" mid-reveal); NO flow IPC / thread ledger / belief-freeze / live-tail merge in 4a.1. Objection branch untouched.
6. **`scripts/dig-eval.mjs` + `scripts/dig-prompts.mjs`** *(new)* — fixtures: belief-gap-scan correctness · ⚠️ at-risk · ⬜ open (zero-fabrication assert) · 🟡 partial · all-locked → take-the-close · prospect-closing-themselves → take-the-close · only-money → money question verbatim first-person · **early-call/no-summary → generic opener (the common case)** · **order-awareness (Pain wide open + early → must NOT surface money/spouse)** · first-person assert on every card. Claude + gpt-4o cross-judge.
7. **`tests/wingman/dig-signal.test.ts`** *(new)* — `{"line":null}`→nudge, belief-field parse (present/missing/garbage), truncation→single error frame, empty-summary path, timer cleanup on abort.

### 4a.1 acceptance
Eval green (both judges) · tsc + tests green · wingman-reviewer APPROVE · objection path byte-identical in route/generator (grep-confirm + objection eval green) · `handleDigPick` shares refs / no flow IPC (grep-confirm) · live (dev): ↓ in first 30s → sensible opener; ↓ mid-call → right gap, belief-named tag; ↓ on a closing prospect → take-the-close; rapid ↓↓↓ never double-bills/wedges the pill; ↓ never disturbs an armed objection flow.

---

## Stage 4a.2 — Press-driven Dig Flow + flow pill + confirm-to-switch

Mirror of the objection flow architecture. The dig generator/prompt/thread are parallel new code — but shipped Phase C infrastructure MUST grow (verified reviewer findings W9/W10/W13; all additive, all listed, all gated by objection eval + manual objection regression). **Acceptance standard: objection BEHAVIOR unchanged** (not "byte-identical" — the shared teardown sites genuinely grow).

### 4a.2 file list (Hard Rule #4 — every file, numbered)
1. **`electron/main.ts`** —
   - `flowModeOpen: boolean` → add `flowType: "objection" | "dig" | null`; `flow:open` IPC gains `{type}`; the bare-↑-while-armed handler routes by the ARMED flow's type.
   - **`pendingSwitch: {to, timer}` (confirm-to-switch owner — main owns key routing + timers; renderer timers throttle when backgrounded).** First cross-press (↑ mid-dig / ↓ mid-objection) does NOT switch: main sends the HUD a `switch-confirm` event + starts the **3s timer**. Same key within 3s → confirmed: notify renderer to archive-and-switch. Otherwise the 3s **runs its natural course** and the pill auto-fades — no special handling. Esc cancels early (below). **Clearing (KEEP-IT-SIMPLE per Sebastian 2026-07-07):** pendingSwitch clears on exactly three things — confirm, Esc/natural-timeout, and **call-end** (`unregisterCallHotkey` → `clearPendingSwitch()`, hygiene: never leave a global key grab or floating pill after a call). **Flow-idle-timeout mid-countdown is NOT special-cased** (Sebastian was right — it was overengineering): if the dig flow's 2-min idle expires while the confirm is up, the countdown just plays out; a following ↑ opens objection anyway (= what ↑↑ does regardless), so the outcome is sensible either way. The only cost is a ≤3s cosmetic pill that self-fades. No mutate-after-archive risk because the confirm press is a normal press → it drops on `isGeneratingRef` if a stream is mid-flight (existing guard), so no extra "refuse while generating" logic is needed either.
   - **Esc binding (W18):** Esc is registered ONLY while a pendingSwitch is active (registered on open, unregistered by `clearPendingSwitch()`) — narrowest possible OS-wide capture; flow mode otherwise has no Esc binding today and gains none.
   - **Type-switch key hygiene (W17 — BLOCKER):** a confirmed flowType switch **tears down and re-registers the flow direct keys** so no stale slot closure survives (the `Down` closure would otherwise keep firing "dig" into an objection flow). Apply the Phase C openFlowMode-closes-compass-first ordering discipline; the held-key NO-OP case (the confirming key is still physically down when re-register runs) is explicitly live-tested.
   - **Single-authority pill feed (W22):** main emits the flow-pill state (`{active, type, beat, belief}` — beat/belief supplied by the renderer at press-time) from its own `openFlowMode`/`closeFlowMode` choke points. **Pill on screen ⇔ main's armed state** — the paths that clear `flowModeOpen` clear the pill by construction; no second code path to forget.
2. **`electron/preload.ts`** *(W24 — was missing)* — `sendFlowState` bridge grows from `{active, move?}` to `{active, type, beat, belief?, autoAdvance?}`; new `switch-confirm` + flow-pill bridge methods (early-event buffering pattern per house rules); `src/types/index.ts` bridge types updated (typecheck-gate).
3. **`DashboardClient.tsx`** — `handleDigPick` + `fireDigBeat`; the three reset sites (`isActive` effect, `callId` effect, `onFlowExpired`) each archive+reset `digThreadRef` too (else the dig thread LEAKS into call 2); archive-and-switch handler for confirmed switches.
4. **`electron/hud/index.html`** —
   - `handleFlowState` branches on the grown payload. **Invariant: a payload without `type` renders the objection chrome byte-identically** (back-compat during the un-bundled window).
   - **Persistent flow pill** — `DIG #3 · PAIN` / `OBJECTION · MOVE #2`, no "paused" language, appears on arm, survives card fades and ← interludes, gone on close/expiry. Retroactively fixes the shipped objection flow's invisibility (chrome lives only on the card today, [hud/index.html:1614](electron/hud/index.html:1614)). Pure display — no mouse capture (stays out of the Issue #32/#35 pass-through machinery).
   - **Switch-confirm pill** — instant, zero-AI ("Switch to objection? Press ↑ again" / mirrored) with the **reverse draining bar** (3s deplete → fade; pure CSS).
   - **⚠️ LAYOUT — NEVER OVERLAP (W15/W16 fix, Sebastian's HUD philosophy 2026-07-07).** Hard rule (Sebastian): **no two HUD pieces ever overlap — you can't stack things.** Every HUD element is its **OWN independent piece**, individually positionable — the user drags each one wherever they want via the planned Card Placement Studio (`_Inbox/2026-06-30 Card Placement Studio + Notch Mode.md`). NOT a cluster that moves as a unit — each element moves on its own. The invariant is a **constraint** (no collisions), not a grouping.
     - Today's code violates this: the thinking pill and the card share `top:64px; left:50%` (pill z-index higher). Because they're currently time-exclusive it never shows — but the persistent flow pill WILL coexist with the card, so it needs its own place.
     - **4a.2 gives each element its own non-overlapping DEFAULT position** (the persistent flow pill defaults to a slot that never touches the card/thinking-pill/confirm-pill positions). Each is an independent element the Placement Studio can later move separately. **No-overlap enforcement (can't drop one piece onto another) is the Placement Studio's job** — flag it there; 4a.2 only needs sane non-colliding defaults, not collision code.
     - The flow pill is NOT subject to the `hidePill()` calls at hud:1516/1548 (those only clear the transient elements). Unique keyframe names throughout (Issue #40 lesson: duplicate names silently override).

### Keypress contract inside an armed flow (the load-bearing UX table)
| Key | Objection Flow armed | Dig Flow armed |
|---|---|---|
| **↑** | continue objection (today's behavior) | **confirm-to-switch**: pill + draining bar; ↑ again within 3s → archive dig, open objection |
| **↓** | **confirm-to-switch** (mirrored): ↓ again within 3s → archive objection (existing close-out synth), dig beat #1 | continue dig (next beat) |
| **← →** | direct picks (Phase C, unchanged) | **in 4a.2 these still resolve to the "coming soon" pill** (the client short-circuits non-objection/non-dig slots — W19); the dig flow stays ARMED underneath and the flow pill persists, next ↓ resumes the thread. The real answer-card-takes-the-display-slot handoff ships with **Phase 4b** (its plan inherits the rule: one card visible, flow armed beneath, no confirm — one-shots aren't destructive) |
| **Esc** | cancels a pending switch-confirm ONLY (Esc is bound solely while a pendingSwitch is active — flow mode has no other Esc semantics today and gains none) | same |
The archive-and-switch itself executes in the **renderer** (it owns both thread ledgers); main only tracks armed type + pendingSwitch + idle timer. The deliberate user is unharmed: a rep who genuinely needs objection help presses ↑↑ fast — the second ↑ IS the confirmation (degrades into the existing double-tap pattern, ~zero added latency).

### Ref discipline (the split, explicit)
- **SHARED single instances (race-critical, never duplicated):** `isGeneratingRef`, `streamAbortRef`, `seqCounterRef`, `lastSummonAtRef`, `pendingPressRef`, `pendingTimerRef`.
- **PER-FLOW ledgers (separate):** `digThreadRef` — `{questionsGiven[], historyTranscript, beatNumber, targetBelief, beliefsDug[], depthOnTarget}` — alongside `objectionThreadRef`. **No synth/recap machinery for dig v1** (dig call-memory = questions asked + beliefs dug; no close-out Sonnet call); `onFlowExpired` for a dig flow must NOT invoke the objection `closeOutSynth` path.

### The rest of 4a.2
- **`fireDigBeat(trigger: "press" | "auto")`** — 4a.2 only ever calls `"press"`.
- **Beat semantics:** beat #1 = belief-gap scan; beat #2+ = chunk-down on `targetBelief` off what the prospect said since the last beat. `type:"Dig"` + `belief` ride delta/done frames (chrome never flashes "OBJECTION" mid-reveal).
- **Anti-repeat = DEPTH-ADVANCE rule, prompt-first (the #46 lesson):** the prompt forbids re-probing a layer already covered in `questionsGiven` — advance the ladder or switch beliefs. Text-similarity is the backstop, not the primary guard (the objection B4 lever guard missed reworded repeats → Known Issue #46).
- **Eval threading fixtures:** depth progression across 3 beats · belief-switch after depth ceiling · **the #46-shaped fixture: prospect ANSWERS beat N's probe → beat N+1 must ADVANCE the ladder, not re-ask the same layer reworded — gated `REPEAT=6`, ≥5/6, gpt-4o cross-judge** · flow expiry → fresh beat-1 · both switch directions.

### 4a.2 acceptance
Threaded eval green (incl. the REPEAT-gated depth-advance fixture) · flow arm/expiry/call-end teardown verified · **objection BEHAVIOR unchanged** (objection eval green + manual regression: ↑↑ → Move #2 → expiry → fresh; objection still sends `{active, move}` and renders identically after the payload type widens) · confirm-to-switch: accidental single cross-press changes NOTHING (flow intact after fade), confirmed double-press switches cleanly BOTH directions, Esc cancels while pending, pendingSwitch cleared on call-end (no dangling key grab / floating pill) · **after a confirmed dig→objection switch and back, ↓/↑ route to the currently-armed flow's semantics (stale-closure check, held-key case included — W17)** · dig thread never leaks across calls (2 back-to-back calls) · flow pill: appears on arm, persists through card fades and a ← "coming soon" interlude, disappears on expiry/close, **never orphaned** (force an expiry → pill gone within one IPC tick — W22) · **flow pill + a fully-streamed dig card simultaneously visible with ZERO overlap (screenshot-verified — W15)** · live: ↓↓↓ walks a belief down the ladder then switches beliefs, pill counting beats.

---

## Stage 4a.3 — Auto-advance (EXPERIMENTAL · top-tier · off by default)

**Spike FIRST (½ day):** confirm Recall forwards Deepgram's `UtteranceEnd` when `utterance_end_ms` is added to the transcription config ([recall-upload-token/route.ts:85](src/app/api/wingman/recall-upload-token/route.ts:85) — same surface as the #41 `interim_results` fix). **Fallback if not:** a **NEW main-process prospect-turn-end detector** fed by the existing partial/final IPC stream (NOT "reuse live-tail" — live-tail is pull-based, no gap events). Spike must confirm: (a) main can see **per-speaker** partials with the REP filtered out (rep identity = `savedZoomName`, currently renderer-side — needs an IPC sync or main-side mirror); (b) the ~1.2s gap timer lives in **main** (renderer throttling); (c) teardown on every stop path (Invariant 3 discipline). Zero new providers either way.

- **Behavior:** Dig Flow armed + toggle on → **PROSPECT** turn-end fires `fireDigBeat("auto")` through the SAME path — including the abstain gate (silent on turns with nothing worth digging; no teleprompter). Manual ↓ still works anytime. **The rep's own speech NEVER triggers a card.**
- **The `trigger:"auto"` contract (what a press provides implicitly that auto must handle explicitly):**
  1. **In-flight:** an auto-fire during ANY in-flight stream hits `isGeneratingRef` and **drops silently — never queues**.
  2. **Throttle:** auto-fires respect `SUMMON_THROTTLE_MS` AND update `lastSummonAtRef` (so a following manual press computes a sane `sinceLast` and doesn't false-trip the 2-min stale reset).
  3. **Settle-wait:** skipped by construction (turn-end ⇒ partials just went quiet). Do NOT add one.
  4. **Pill:** auto-fires are **silent-until-card** — no unbidden "thinking" pill (no keypress to acknowledge; ghost pills violate feels-like-intuition). The auto path must not call `sendSummonState("thinking")`.
- **Visibility (Sebastian-locked):** while auto-advance is active in an armed flow, the **persistent flow pill breathes** — a braille-cell "breathe" pulse (inspired by the shadcn Braille Loader). The HUD is vanilla HTML/JS (no React) → implement the breathe natively (~10 lines, Unicode braille glyphs cycling; unique keyframe names). The **real** shadcn `BrailleLoader` component is installed for the dashboard Settings toggle row (exact `npx shadcn@latest add …` command provided at build time per house rules). Pill static = flow armed, manual. Pill breathing = flow armed, Wingman auto-listening. Pill gone = no flow.
- **Guards:** min-**PROSPECT**-words-since-last-beat floor (rep backchannel never counts — rides the speaker filter) · ~5s debounce · max ~6 auto-fires per flow, then require a manual ↓ (pacing brake) · **per-CALL circuit breaker: 30 auto-fires client-side — trips loudly in logs, quietly stops auto-firing for the rest of the call (manual ↓ unaffected). Purpose = bug/noise-storm protection, NOT a usage limit** (napkin: ~1¢/fire → heavy legit use ≈ 30¢/call ≈ ~$22/mo at 75 calls vs a $299 plan) · **PLUS a server-side backstop (W20): a per-`callId` auto-fire counter in the route (~40, above the client's 30 so the client trips first; same in-memory-map pattern as the existing rate limit, same pruning) — when exceeded, `trigger:"auto"` requests quiet-resolve without billing Sonnet. The client cap is UX; the server cap is the wallet. In-memory = resets on Railway redeploy; acceptable for a bug-storm guard (the 3s rate limit still floors the absolute rate) — documented limitation** · 2-min idle expiry unchanged · auto-advance NEVER opens a flow, only continues one.
- **Gating + entitlements (Sebastian-locked):** NEW **`src/lib/wingman/entitlements.ts`** — ONE server-side helper answering "what can this user do" (`unlimitedCalls`, `autoAdvance`, …) from `profiles.subscription_plan`; every tier-differentiated route reads IT, never inline plan-string comparisons (the #44 scattered-model-IDs lesson applied to billing). **⚠️ Plan-string reality (W21): the codebase carries the DEAD setter/SDR vocabulary** (`lib/stripe.ts` PLANS = `closer`/`setter`/`assist`; `SettingsTab.tsx:50` types `"closer"|"setter"`; the Stripe webhook writes whatever metadata carries). **Sebastian LOCKED 2026-07-07: two tiers — base = `"core"`, top = `"pro"`.** `entitlements.ts` maps `plan === "pro"` → `{unlimitedCalls:true, autoAdvance:true}`; `"core"` → base. It is the SINGLE mapping point (the #44 lesson). Actual DB values verified in Supabase before wiring; Sebastian's row set to `"pro"` manually for testing. **The stale `closer`/`setter`/`assist` cleanup across Stripe/webhook/SettingsTab is a SEPARATE task (billing blast radius) — NOT part of the dig build;** `entitlements.ts` just needs the `core`/`pro` strings to exist as the forward vocabulary. The kb-signal request carries `trigger:"auto"|"press"`; **the route checks `autoAdvance` ONLY when `trigger==="auto"`** (manual dig = all tiers; a tampered client lying `"press"` gets manual-equivalent behavior — all-tiers anyway — and the server breaker still bounds volume). SettingsTab toggle **"Auto-Advance (Experimental)"** + tooltip: beta, may occasionally mistime a card, only gets better, top-tier exclusive, **"Currently capped at 30 auto-advances per call while in beta."** Billing not live yet; wires to Stripe later.
- **Cost telemetry:** log every auto-fire AND auto-abstain with token counts → per-call `[dig] auto-advance cost=` line. Real usage/cost/margin data decides the cap's future — numbers, not vibes.
- **Breathe timer discipline (W23):** the braille breathe is a **single owned interval** — cleared on pill-hide, flow-end, toggle-off, and call-end (the existing `clearPillTimers` discipline). Static pill = no interval running; breathing = interval running; the transition clears the prior state; the breathe element never also carries the existing `pillPulse` animation (no double-pulse jitter).

### 4a.3 file list (Hard Rule #4 — W24)
1. `src/lib/wingman/entitlements.ts` *(new)* — the plan→capability map (single source of truth).
2. `src/app/api/wingman/kb-signal/route.ts` *(edit)* — `trigger` field parse; entitlement check on `"auto"`; per-callId auto-fire backstop counter.
3. `electron/main.ts` *(edit)* — turn-end plumbing (UtteranceEnd relay OR the new prospect-turn-end detector + its stop-path teardown); auto-fire dispatch to the renderer; `autoAdvance` rides the flow-pill state.
4. `electron/recall.ts` *(edit — only if the spike lands on the detector path)* — per-speaker partial forwarding for the rep filter.
5. `src/app/api/wingman/recall-upload-token/route.ts` *(edit — only if the spike lands on UtteranceEnd)* — `utterance_end_ms` in the Deepgram config.
6. `electron/preload.ts` + `src/types/index.ts` *(edit)* — turn-end / auto-fire bridge additions.
7. `src/app/(dashboard)/dashboard/DashboardClient.tsx` *(edit)* — `fireDigBeat("auto")` wiring + the auto contract (drop-in-flight, throttle update, no thinking pill).
8. `electron/hud/index.html` *(edit)* — breathe animation in the flow pill (native braille glyph cycling, owned interval).
9. `src/components/dashboard/SettingsTab.tsx` *(edit)* — the Experimental toggle + tooltip (real shadcn `BrailleLoader` in the row; exact `npx shadcn@latest add …` command provided at build time).

### 4a.3 acceptance
Spike answered (UtteranceEnd vs main-side detector, documented) · entitlement gate correct server-side (auto blocked for non-top-tier even with a forged client toggle; manual unaffected) · auto-fire respects abstain/min-words/debounce/per-flow cap/per-call breaker · rep speech never triggers · pill breathes only while auto-armed · manual press coexists cleanly · cost line verified on a real call · live gate on Sebastian's own calls — **ship/hold by observed behavior** (Decisions Log 2026-07-07).

---

## Blast radius / standing risks
- Shared client state: single-in-flight guard + idempotent terminal + pill contract shared with objection; cross-slot presses drop on `isGeneratingRef`.
- Cost: press = 1 bounded Sonnet call (aborts on disconnect/dismiss/call-end). Auto = per-flow cap + per-call breaker + server entitlement check.
- 2nd/5th/10th run: both ledgers reset on expiry/call-end/callId-change; pendingSwitch cleared on all teardown paths; no timers/listeners survive a beat; back-to-back calls start clean.
- HUD chrome (TYPE_MAP, flow pill, confirm pill, breathe) + Electron flow-type work ride the SAME bundled desktop release.
- Deferred (own Inbox notes): ← answer clickable sources (2026-07-07 note) · answer-card/dig interplay beyond the display-slot rule.

## Build sequence
`phase-4a1-dig`: prompt+eval FIRST → dig-signal → route → HUD tag → client → tests → wingman-reviewer → PR → live (dev) → merge.
Then `phase-4a2-dig-flow` (threading eval first; main.ts flowType + pendingSwitch; pill + confirm pill; reset sites).
Then the 4a.3 spike → `phase-4a3-auto-advance` (detector or UtteranceEnd; entitlements.ts; toggle + breathe; telemetry).
Each stage its own PR; serial (shared live-pipeline state). Desktop release bundled at the end with 4b/4c + Phase C chrome.
