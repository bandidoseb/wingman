# tasks/todo.md — ARCHIVED CONTENT (as of 2026-07-09)

> ⚠️ **RECOVERED 2026-07-30 during the context cleanup.**
>
> This is the content `tasks/todo.md` held until it was reused for the dashboard-rebuild
> plan. The old content was overwritten without being archived, and survived only as an
> **uncommitted change inside a throwaway git worktree** (`.claude/worktrees/silly-albattani-3751dc`).
> It was never committed anywhere. One `git worktree remove` would have destroyed it.
>
> **This file is load-bearing.** These shipped source files cite `tasks/todo.md` by path for
> engineering invariants that live in THIS content, not in the current `tasks/todo.md`:
>
> | Source file | What it cites |
> |---|---|
> | `src/lib/wingman/objection-prompt.mjs:150` | "See tasks/todo.md (SEV-A)" → **§ Prompt-caching structure**, below |
> | `src/lib/wingman/live-tail.ts:18` | "Invariants (plan rev 2 — tasks/todo.md)" → **§ Multi-Turn Objection Threading rev 2** |
> | `src/lib/wingman/kb-memory.ts:32,186,303` | "SCALE / GRADUATION honest ceilings", binary-snapshot loader |
> | `src/app/api/wingman/kb-signal/route.ts:27` | periodic keep-warm, Phase 3.5 plan |
> | `src/lib/wingman/pipeline-warmup.ts:17` | periodic keep-warm |
>
> Contains, in order: the **Billing vocab purge** plan (Core $149 / Pro $299 — never built,
> still awaiting Sebastian's approval) · **#41 Partial-Tail Merge** (built) · **#41 Partials
> measurement build** (done, PR #36) · **Multi-Turn Objection Threading rev 2** (the SEV-A
> prompt-caching structure).

---


# Billing vocab purge — setter/SDR → two-tier `core`/`pro` (2026-07-09) — PLAN, awaiting Sebastian's "yes to edit"

**Decisions (Sebastian, 2026-07-09):** Core $149 / ~75 calls · Pro $299 / unlimited · delete Assist · remove top-offs entirely.
**Live DB check (read-only):** all 5 profiles `subscription_plan = NULL` → **no data migration**, code-only.
**Invariant:** `subscription_plan` only ever holds `"core"`, `"pro"`, or `null`.
**Leave alone:** `Role` type (`closer`/`setter` = sales job, NOT billing), `assist_enabled` toggle, `entitlements.ts` (Phase 4a — this makes the strings it reads consistent: `plan === "pro"` → no `calls` field → unlimited).

## Files (7)
1. **src/lib/stripe.ts** — `PLANS = { core:{name:"Core", priceId:STRIPE_CORE_PRICE_ID, price:"$149/mo", calls:75}, pro:{name:"Pro", priceId:STRIPE_PRO_PRICE_ID, price:"$299/mo"} }` (pro has NO `calls` → unlimited). Delete `assist`. Delete `TOPOFF_PACKAGES`. Add `export type PlanKey = keyof typeof PLANS;`.
2. **src/app/api/stripe/create-checkout/route.ts** — remove the `type === "topoff"` branch + `TOPOFF_PACKAGES` import; validate `planParam` against `PLANS`, default `"core"`; use `PlanKey`.
3. **src/app/api/stripe/webhook/route.ts** — remove `type === "topoff"` branch (keep a defensive early-break so a stray topoff event isn't mistaken for a subscription); **validate `metadata.plan` against `PLANS` keys before writing — write `null` if unknown** (enforces the invariant at the Stripe boundary).
4. **src/app/api/wingman/session/route.ts** — two `keyof typeof PLANS` casts → `PlanKey`. Logic unchanged: Core cap 75; Pro no `calls` → `callLimit` null → unlimited (existing `"calls" in planData` guard handles it). `extra_calls_remaining` reads stay (dormant, always 0 now — harmless).
5. **src/components/dashboard/SettingsTab.tsx** — label map → `{core:"Core", pro:"Pro"}`; `plan` cast → `PlanKey`; **remove** the top-off purchase UI + `TOPOFF_PACKAGES` import; checkout href → `?plan=core`.
6. **src/components/ui/PaywallModal.tsx** — replace role→plan map; default paywall to Core ($149); `?plan=core`. (Real Core-vs-Pro chooser = follow-on paywall/entitlements work — flagged, not built here.)
7. **src/components/dashboard/Sidebar.tsx:317** — `checkoutHref` → `?plan=core` (was role-derived).

## Env vars (Sebastian — Stripe dashboard + Railway; I never touch .env.local)
Create Core ($149) + Pro ($299) recurring products → set `STRIPE_CORE_PRICE_ID`, `STRIPE_PRO_PRICE_ID`. Delete `STRIPE_CLOSER/SETTER/ASSIST_PRICE_ID` + all `*_TOPOFF_*`.

## Verify
`tsc` gate green (web+electron) · re-run the read-only plan query (still all NULL) · grep: zero `closer`/`setter`/`assist` in the 7 billing files (Role refs elsewhere untouched).

---

# #41 FIX — Partial-Tail Merge at Press Time (2026-07-03) — ✅ BUILT (plan rev 2, all 6 must-fixes in)

**Evidence at build:** 124/124 unit tests · both tsc green · wingman-reviewer APPROVE (0 findings) ·
3 new GATED live-tail fixtures 3/3 under Claude judge AND gpt-4o cross-judge (rescue-threaded,
rescue-beat1, abstain-midword) · marker-leak assertion wired into evaluate() for every fixture.
`advance-trust-2` red is PRE-EXISTING flakiness, proven by A/B: 3/6 with the LIVE TAIL paragraph,
4/6 without (statistically identical ~50-60% coin; failure mode = circle-back diagnosis repetition,
the known B4 residual — lever guard catches same-lever, not same-diagnosis-reworded). Long-flow
best-of-3 red = documented parity sampling noise (2026-07-02 lesson; diff doesn't touch flow-synth).
**Remaining:** live-verify on a dev call (abstain-on-press should become a card) · desktop release
to ship the Electron side to packaged apps.

## Rev-2 hardening (from plan review — all six MUST land)
1. **`hotPartialAgeMs()` empty-state = `Number.POSITIVE_INFINITY`** (load-bearing: old packaged apps
   with no partial IPC must get ZERO settle wait + byte-identical requests). Poller subscription
   guarded: `if (window.wingman?.onTranscriptPartial)`. Unit-tested.
2. **Settle-wait insertion point is EXACT:** between `lastSummonAtRef.current = Date.now()` (DC:689)
   and the threading-decision block (DC:691) — so `thr`/`isThreaded`/beat are read POST-settle (a flow
   idle-expiry during the sleep must not send a stale threaded payload). Set `isGeneratingRef = true`
   AND send the "thinking" pill BEFORE the sleep (flow-mode single-↑ has no compass flash — the pill
   is its only press ack; 350ms of dead air is unacceptable). After the sleep: re-check `isActiveRef`;
   on bail → `sendSummonState(idle)` + reset `isGeneratingRef`. EVERY early-return between sleep and
   fetch resets both.
3. **Cap order:** live tail is appended AFTER `capLatest`/`getRecentTranscript` capping, and is itself
   capped (~500 chars, tail-kept → ≤~125 tokens, not the earlier ~40 estimate). Dedup target = the
   tail actually being sent: threaded `latestResponse`, beat-1 `getRecentTranscript()`.
4. **Dedup = STRICT normalized substring** (entire partial contained in finals tail → suppress).
   Never fuzzy/token-overlap — a false-positive silently defeats the whole feature. Fixtures both ways.
5. **Live-tail map reset in the `[callId]` effect (poller ~187)** + swept on every update (drop
   entries >5s, cap size) so Zoom display-name churn can't grow it across a 2-hour call.
6. **Gated eval fixtures (the crux risk — marker vs "mid-thought → abstain" fight):**
   (a) finals end truncated + live tail completes the objection → MUST yield a line, not abstain;
   (b) genuinely-still-talking (live tail itself visibly mid-thought, no complete objection) → abstain;
   (c) stale-partial-after-final → suppressed by dedup; (d) no generated line ever contains "[live".
   Prompt marker text explicitly: "the [live] fragment may end mid-word due to transcription lag —
   that alone does NOT mean the prospect is still talking; judge completeness from the words above it."

**Evidence (2 measured calls):** finals lag speech ~500ms median (p90 1–2.8s, max 4.1s); partials lag
just **126ms median** (p90 291ms). At presses, finals-only missed 76 words; partials already held 68%.
Every live "no objection detected" abstain mapped to missing prospect words. Deepgram stays (its
partials beat AssemblyAI's claimed ~300ms); reconciliation rule = merge freshest partial at press +
short settle wait for the last word(s).

## Design

**A. Electron → renderer partial feed**
1. `electron/recall.ts` — `RecallOptions.onPartial?: (chunk: string) => void`; in the partial branch
   (after measurement logging, before the early return) call `options.onPartial?.("Speaker: text")` —
   same line format as finals. Live finals path untouched.
2. `electron/main.ts` — `onPartial: (chunk) => mainWindow?.webContents.send("transcript:partial", chunk)`
   (mirror of `transcript:chunk` at main.ts:582).
3. `electron/preload.ts` — expose `onTranscriptPartial` next to BOTH `onTranscriptChunk` surfaces
   (lines ~111 + ~280); mirror the existing unsubscribe pattern.

**B. Renderer live-tail state (pure module + poller wiring)**
4. NEW `src/lib/wingman/live-tail.ts` — pure, unit-testable:
   `updatePartial(state, speaker, text, now)` · `clearSpeaker(state, speaker)` (called when that
   speaker's FINAL arrives — Deepgram's final closes the interim segment; a later partial belongs to
   the next utterance and simply repopulates) · `getLiveTail(state, finalsTail, now)` → for each
   speaker with a partial aged ≤5s whose normalized text is NOT already contained in the (normalized)
   finals tail, emit `Speaker [live — still being transcribed]: text`; else nothing. Also
   `hotPartialAgeMs(state, now)` → age of freshest partial (for the settle decision).
5. `src/hooks/useWingmanPoller.ts` — subscribe `onTranscriptPartial`; keep state in a ref (map is
   per-speaker, tiny, cleared on call start/end like the other refs); on each FINAL chunk in addChunk,
   `clearSpeaker` for that chunk's speaker(s). Expose `getLiveTail()` + `hotPartialAgeMs()` from the
   hook (read-only, no re-renders — refs only).

**C. Press-time merge + settle wait**
6. `DashboardClient.tsx` `handleMenuPick` (objection branch only): after the throttle gate,
   **settle rule** — if `hotPartialAgeMs() < 1500` (speaker likely mid-utterance) `await sleep(350)`
   then re-check `isActiveRef` (mirror the deferred-press guard) before proceeding. If no fresh
   partial → zero added latency (press after a real pause stays as fast as today).
   Then build context exactly as now and append `getLiveTail()` to `transcriptToSend` (threaded AND
   fresh beat-1). Tail is part of `latest response` → lives in the VOLATILE uncached segment → no
   cache-prefix bust (threading speed promise intact).
7. Durable records stay finals-only: fullTranscriptRef, chunkBuffer (DB saves), summarize buffer,
   anchors/cursors NEVER include partials — cursor math never sees live text (it's appended only to
   the outgoing request string, after capLatest).

**D. Prompt + eval gates**
8. `src/lib/wingman/objection-prompt.mjs` — short addition: a `[live — still being transcribed]`
   line is the freshest unfinalized speech; treat it as the prospect's latest words; last 1–2 words
   may be slightly rough; the "cut off mid-thought → wait" rule still applies only when it genuinely
   ends mid-thought.
9. Re-run BOTH gates (prompt changed): `objection-eval` + `objection-threading-eval` (3× — stochastic).
   Add live-tail fixtures (tail-only response, tail completing a truncated final, stale-partial
   excluded). Promote the 3 advisory #41 fixtures to gated (they should flip green).

**E. Rollout + verification**
- Old packaged apps: no partial IPC → `getLiveTail()` empty → behavior byte-identical (verified by
  the settle rule requiring a fresh partial). Web deploy is safe alone; full fix needs the next
  desktop release (bundle with Phase C chrome).
- Live verify in dev: same solo-call drill; abstain-on-press should turn into cards; measurement log
  + analyzer re-run to confirm recovery at press.

**Follow-on (separate PR):** contextual abstains — `{"line": null, "reason": <6-tag enum>}` +
HUD directive chips ("They're ready — close now." etc.) + eval update. Sebastian approved 2026-07-03.

---

# #41 Partials — MEASUREMENT BUILD (2026-07-03) — ✅ DONE (PR #36)

**Goal:** quantify the stale-objection-tail gap (press right after an objection → card misses the
last 1–3s of it) before choosing the reconciliation rule. Decided 2026-06-15, priority-locked 2026-07-02.

**Plan (approved by Sebastian 2026-07-03):**
1. ✅ `recall-upload-token/route.ts` — subscribe `transcript.partial_data` alongside `transcript.data`.
2. ✅ `electron/measurement-log.ts` (NEW) — per-call JSONL log in `<userData>/partials-measurement/`;
   opened after `startRecording` confirms, closed in `stopRecallAI()`; fs failures can never touch the call.
3. ✅ `electron/recall.ts` — log partials + finals (speaker, text, word timing); partials return early —
   live pipeline stays finals-only, byte-for-byte.
4. ✅ `electron/main.ts` — log presses (summon / double-tap / flow-up / compass-pick / flow-direct).
5. ✅ `scripts/analyze-partials.mjs` + 15 unit tests — arrival lag per stream, partial lead time,
   press-by-press missed-tail + recovery-%; CLI smoke-tested on synthetic log.

**Next:** Sebastian runs ONE real call in dev (`npm run electron:dev`) — doubles as the Phase B+C live
test — then `node scripts/analyze-partials.mjs <printed log path>`. Optional second call with the
provider line flipped to `assembly_ai_v3_streaming` for the Deepgram-vs-AssemblyAI A/B (immutable
~300ms transcripts would delete the reconciliation layer entirely). Data picks the fix.

---

# Multi-Turn Objection Threading ("Objection Flow") — Hardened Plan (rev 2)

**Goal:** After the first objection card, the rep enters a live **Objection Flow** — a single ↑
per beat gives the NEXT move, never a restart, never a repeat. Wingman carries the FULL
micro-context of the exchange (every line it gave + every prospect turn since the objection opened),
stays near-instant even 8 beats deep via prompt-caching, and adapts the angle dynamically.

**Design source:** `Wingman Brain/_Inbox/multi-turn objection handling.md` + the 2026-07-01 design +
2 plan-reviewer passes. Re-press threading, NOT an autonomous auto-listener (rejected — #1 robot-risk).

---

## The flow (what the rep experiences)

1. `↑↑` (summon → objection) → **card 1**. **Objection Flow Mode opens.**
2. Combined card: blue **"Objection Flow active"** header, **beat counter** top-right, the spoken line,
   **"Press up arrow for next move"** footer.
3. **Single ↑** per beat → next move. Card **replaces in place** (one-card-at-a-time holds). Beat counter
   climbs; texture deepens (Beat Doctrine). Compass is NOT reachable during a flow (↑ = next beat); the
   other 3 arrows are Phase 4 anyway.
4. **2 min of silence** → Mode resets; next ↑ = full compass again. Also resets on call end / resolved /
   new objection. **A card dismiss does NOT reset the flow** (Sebastian) — Mode stays armed to the timer.

---

## Two decoupled concepts

- **Mode** = the gesture (single-↑). **Owned by `main.ts`** (see C1). Opens on card 1, closes on 2-min
  idle / call-end / explicit exit.
- **Thread / Flow Ledger** = the context we feed Sonnet. Resets independently — on abstain, a genuinely
  new objection, call-end, OR a per-press gap check (see B2). Decoupling lets Mode stay conveniently
  armed while Thread context stays correct.

---

## The Flow Ledger (micro-context engine)

Opened when card 1 lands; **append-only** until the flow ends:

1. **`linesGiven[]` — every line handed to the rep, verbatim.** We generated them → they never fall out
   of a buffer. Passed each beat with: *"you already tried these — do NOT repeat; new angle."* Direct
   kill for beat-6-repeats-beat-1.
2. **Anchored transcript — the whole exchange since the objection opened** (from an anchor cursor set at
   flow start, NOT the sliding 120s). Requires a NEW backing store — see B1 (the poller does NOT keep
   this today).
3. **`beliefSnapshot`** — Belief Ladder **frozen at flow start** (macro context + cache stability + one
   consistent read; the live summary mutates every ~2 min via the summarize timer, so freezing is
   load-bearing for the cache).

---

## Prompt-caching structure (corrected — SEV-A)

Caching = stable prefix + small fresh tail. Layer order per beat, top→bottom:

| Layer | Stability | Cache |
|---|---|---|
| Doctrine (system prompt) | never changes | cached |
| Belief Ladder (frozen snapshot) | frozen for the flow | cached |
| `linesGiven[]` + anchored transcript **up to the last-move cursor** | append-only, **no marker inside** | cached (breakpoint HERE) |
| `--- the prospect's latest response ---` marker + newest turn(s) | volatile, moves each beat | **fresh, uncached** |

**Critical:** the "latest response" marker must live in the UNCACHED TAIL, never inside the cached
history — a marker that moves each beat would shift bytes and bust the prefix, making cost *rise* with
depth. With it in the tail, the history is a true append-only prefix: each beat the cached prefix grows,
the fresh tail stays ~one turn → **deeper beats get cheaper + prefill faster → beat 8 ≈ beat 1.** Uses
≤3 of 4 breakpoints. Default 5-min TTL (verified) covers a 2-min flow → no heartbeat. Honest caveat: a
single beat where the prospect talks >5 min straight cold-misses and self-heals (rare, graceful).
Cost est.: ~0.9¢/beat uncached → ~0.3¢/beat cached; ~4¢ per 10-beat objection.

---

## Beat Doctrine (dynamic, not a script)

- **Beat 1:** head-on / isolate — pace → tie-down ("that aside, do you feel this gets you there?") →
  make them say WHY → isolate if it's even real.
- **Beats 2+:** pick the angle for their rebuttal + the weak belief (analogy, cost-of-inaction,
  fear-magnify, permission-reframe, financial trade) — NOT a rote order.
- **As beats climb:** lean toward the trade/close, not endless reframes. Beat counter = depth; prospect's
  words + weak belief = the angle. Grounded in `knowledge-base/objection-transcripts/LIVE-CALL-FINDINGS.md`.

---

## Rollout — 3 phases

### Phase A — Intelligence — ✅ DONE + VERIFIED (2026-07-01 Session 2)
**Shipped (offline, wired-but-single-shot; NOT committed/pushed — local, awaiting review):** threading
doctrine + `buildObjectionUserSegments` (shared, cache-aware) + generator wiring (`buildUserContent`,
`cache_control`, `ObjectionThread` param) + a real threading eval (`scripts/objection-threading-eval.mjs`,
19 fixtures across every objection type, Claude + optional GPT cross-judge, `advisory` known-limits,
desync guard). **Single-shot user message is byte-identical; tonality 5.00 (no regression).**
**Findings (accepted):** threading is strong on all major objection types + switches + continue + clear-echo
abstain. ONE real, non-harmful weakness — **repeat-on-circle-back** (~40-60%: Sonnet rewords an angle when
the prospect circles back to one already used; both judges agree on the clearest case). **Fix = the
similarity retry-guard, planned into Phase B (B4).** Known advisory limits (measured, not gated):
mid-turn press detection (needs #41 partials) and beat-9 exhaustion (a 9-beat objection is a stall → close).
Full narrative: `Wingman Brain/01 - Build Log/2026-07-01.md` (Session 2).

The original Phase A spec (for reference):
- **`src/lib/wingman/objection-prompt.mjs`** — ledger doctrine: advance-don't-restart; do-NOT-repeat the
  `linesGiven` (new angle); no prospect response below the marker → abstain (SEV-6); restart if genuinely
  new objection; dynamic angle + escalate-to-close as beats climb.
- **`src/lib/wingman/objection-signal.ts`** — `buildUserMessage()` gains optional `linesGiven[]`,
  `historyTranscript` (up to last-move cursor), `latestResponse` (fresh tail), `beatNumber`; assemble so
  the `cache_control` breakpoint sits AFTER history and BEFORE the marker+latestResponse (A1). Add
  `cache_control` on doctrine + frozen belief. Thread params through `generateObjectionCard` / `streamObjectionCard`.
- **`scripts/objection-eval*.mjs`** — fixtures fed through the REAL marker mechanics (marker at the
  recorded cursor, incl. a no-response fixture where nothing follows it): (a) advances not repeats,
  (b) never re-emits a `linesGiven` line, (c) thread-switch → fresh, (d) no-response → abstain. Green 3×.

### Phase B — Live threading on `↑↑` (single-press comes in C; testable on a real call)
- **`src/hooks/useWingmanPoller.ts` (SEV-B — the real work):** add an append-only in-memory transcript
  accumulator, **never trimmed, never cleared on save**, that starts accumulating at flow-open and resets
  on Thread reset + `callId` change. Expose `getTranscriptSince(cursor)` + a monotonic cursor getter
  reading from THAT buffer. Do NOT use `recentTranscriptRef` (2,400-char front-trimmed, lines 363–368) or
  `chunkBufferRef`/`summarizeBufferRef` (cleared every save/summarize tick) — none can serve an anchor.
- **`src/app/(dashboard)/dashboard/DashboardClient.tsx`** — `objectionThreadRef =
  {linesGiven, beatNumber, anchorCursor, lastMoveCursor, beliefSnapshot, lastPressAt}`. On card 1 `done`:
  open ledger (snapshot belief, set anchor). On a continuing press: send `linesGiven` + history (anchor→
  lastMoveCursor) + latestResponse (lastMoveCursor→now) + beatNumber. **Append line / beat++ inside the
  `done` event branch ONLY (SEV-E), never in `release()`/`finally`** (release runs on every exit incl.
  abort). **Per-press gap check (SEV-1b, B2 — DECIDED "re-evaluate, don't assume"):** if >~40s since
  `lastPressAt`, still send the history but set a `gapFlag` so the prompt tells Sonnet *"there was a gap —
  decide if this is still the same objection or a new one; if new, start fresh at beat 1."* Preserves
  continuity if the same objection resurfaces; won't force a close-lean onto a genuinely new one. Reset
  Thread on abstain/nudge, `isActive` false,
  `callId` change, 2-min idle. On 8k overflow (SEV-C): pin the opening, elide the oldest middle turns with
  a `--- earlier exchange omitted ---` marker; NEVER `slice(-8000)`; omit rep lines from the transcript
  slice (already verbatim in `linesGiven`) to push the cap out.
- **`src/app/api/wingman/kb-signal/route.ts`** — read + cap the new fields (`lines_given` count/len,
  `history_transcript` + `latest_response` ≤8k combined, `beat_number` 0–20); pass through; wire `cache_control`.
- **B4 — Similarity retry-guard (the permanent fix for repeat-on-circle-back, decided 2026-07-01):**
  after a threaded card resolves (`done`), compare the new line to `linesGiven[]`; if it's too similar to
  one already given (cheap check — normalized token overlap / Jaccard over a stop-worded shingle set, or a
  short embedding cosine — pick the simplest that works; NO extra model call for the check itself),
  regenerate ONCE with an added nudge ("you already said `<X>` — give a genuinely different angle"). Bound
  it: at most ONE retry (never loop), and only on threaded beats (single-shot can't repeat). Fits the
  streaming path — the retry is a second quick generation, warm+cached so it's fast. If the retry is still
  too similar, ship the better of the two rather than nothing. Add a threading-eval assertion that a
  known circle-back fixture (advance-doubt / advance-money-2) now passes with the guard on.

### Phase C — Single-↑ hotkey + combined card
- **`electron/main.ts` (SEV-D/F):** Mode state + the 2-min idle timer live in MAIN, mirroring
  `menuOpen`/`menuAutoFadeTimer` (lines 64–66, 142). Renderer sends `flow:open` (card 1 `done`) /
  `flow:close` (Thread reset); main sets its own `flowModeOpen` + owns the `setTimeout`. Bare-↑ routing
  reads main's OWN flag synchronously in the key handler (like `menuOpen` at line 159) — no cross-process
  read in the hot path. Kills the stale-Mode-fires-unintended-objection race + renderer-throttle timer drift.
- **`electron/preload.ts`** — `flow:open` / `flow:close` IPC.
- **`electron/hud/index.html`** — combined card (blue header + beat counter + line + "Press up arrow for
  next move"); replaces in place; verify auto-fade fires the dismiss path; **dismiss clears the visible
  card but does NOT reset `objectionThreadRef`** (C3, paired with B2 so it's not a stale-context source).
- **`DashboardClient.tsx`** — drive `flow:open`/`flow:close` + the affordance state.

---

## Plan Review Loop — failure modes and answers (2 passes)

- **Beat N repeats an earlier handle (Sebastian's #1 fear)** → `linesGiven[]` + "don't repeat, new angle"; never scrolls off.
- **Micro-context lost as the 120s window scrolls past the opening** → anchored append-only transcript (B1).
- **Wrong-anchor (advances the wrong response)** → marker at the last-move cursor, in the uncached tail.
- **Cache busts as depth grows (SEV-A)** → marker OUT of the cached region; history is a clean append-only prefix.
- **`getTranscriptSince` has no backing store (SEV-B)** → new flow-scoped append-only accumulator in the poller.
- **Silent-resolution-then-new-objection inside 2 min (SEV-1b)** → per-press gap check (B2 / open decision).
- **No prospect response yet** → no-response abstain doctrine; 3s throttle for the immediate double-press.
- **Ledger records a line the rep never saw (SEV-E)** → append in the `done` branch only, never in `release()`.
- **8k overflow amputates the opening or busts cache (SEV-C)** → pin opening + elide middle; never slice the front.
- **Single-↑ IPC race fires the wrong thing (SEV-D)** → Mode owned by main; synchronous flag read in the hot path.
- **2-min timer stretches when dashboard backgrounded (SEV-F)** → timer owned by main (not renderer-throttled).
- **Cache invalidated mid-flow by a Belief Ladder update** → frozen snapshot at flow start.
- **90s cooldown core rule** → governed autonomous firing (retired); rep-gated + summoned → moot; rides 3s throttle.
- **User-visible failure** → unchanged: retry pill. No new dead-air path.

---

## Out of scope (V1)
Autonomous auto-listener; keep-warm heartbeat (5-min cache covers a 2-min flow); the other 3 compass
arrows (Phase 4); adaptive Mode timeout (ship fixed 2 min, tune later — one constant).

---

## Test steps

**Phase A (offline) — ✅ done:**
- `node scripts/objection-threading-eval.mjs` — 19-fixture threading gate (gated fixtures pass; 3 borderline
  circle-back cases are the accepted soft-spot → B4; advisory = mid-turn/deep-beat known-limits).
- `JUDGE_PROVIDER=openai node scripts/objection-threading-eval.mjs` — GPT cross-check (disagreements = eyeball).
- `DRY=1 node scripts/objection-threading-eval.mjs` — see the exact assembled message, no API.
- `LIMIT=12 node scripts/objection-eval.mjs` — single-shot tonality regression (held at 5.00, ≥4.7 gate).

**Phase B/C (live):** `npm run electron:dev`, real Zoom/Meet call:
1. Raise an objection, `↑↑` → card 1, Flow opens.
2. Push back, ↑ → advances, no repeat.
3. Push back 3–4× → each new; texture deepens; leans to close; beat counter climbs.
4. Deep beat (6+): references the earlier exchange; never repeats an earlier line.
5. Switch to a genuinely different objection → starts fresh.
6. Silence 2+ min → next ↑ gives the full compass (Mode reset).
7. Deep beats feel as fast as beat 1 — watch `[kb-signal] TIMING` (cache working).
