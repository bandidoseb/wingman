# Plan — Phase 3.5: Distillation + Thinking Pill + Latency (FINAL — reviewed)

**Status:** PLANNING. Awaiting Sebastian's approval. No code written.
**Reviewed by:** `plan-reviewer` (fresh context) — initial verdict NEEDS REVISION, 3 BLOCKERS + 4 MAJOR + 4 MINOR; **all findings folded in below.**
**Branch:** `feat/phase-3.5-distill-pill` — one PR. **No DB schema changes.**
**Gate to done:** Sebastian's live Zoom call (script at the bottom). Diagnostics (hudLog + DevTools auto-open) stay in through the live test; stripped in a separate tiny follow-up PR.

## Sebastian's locked answers (2026-06-11)
1. **Empty ↑ press** → honest card: fixed headline ("No objection caught") + ONE pointer grounded in the recent conversation. **The word "belief" (or any Cole Gordon / internal framework term) must NEVER appear in on-screen card text** — new hard prompt rule, applies to ALL cards.
2. **Slow cards deliver late** (up to the existing 12s client timeout). The thinking pill shows a **live seconds counter** ("Handling objection… 3s").
3. **Pill copy is action-specific:** "Handling objection…" / "Answering that…" / "Digging deeper…" / "Reading the close…".
4. **Warm latency goal: 1.5–2s** press-to-card (measured on 2nd+ press; the FIRST press after warm-up may still run ~2.5–3s — don't read the first sample as failure).

## Decisions baked in (from plan review — not re-litigating)
- **Prompt cache (`cache_control`) is OUT of 3.5.** The kb-signal system prompt is ~350 tokens; Haiku's minimum cacheable block is 2048 — it physically cannot engage. Evaluated and removed, not forgotten. The real latency levers are connection warm-up + the short distilled query. (The Belief Ladder summarizer's caching is already live and unaffected.)
- **←/↓/→ presses show a brief "Not ready yet — coming soon" pill (~2s)** instead of today's silent nothing. Dead air = the bug class 3.5 kills. (Sebastian can veto — one-line change.)
- **Groq-down degraded mode skips the 60s search cache** (the raw-chunk cache key can serve a previous objection's technique for a new objection within 60s — skip it rather than compound wrongness).

---

## STEP 1 — Offline distiller harness (prompt-first; no app code)
- New `scripts/test-distill.mjs` (mirrors `test-belief-ladder.mjs`) + new pre-registered answer key `scripts/test-transcripts/EXPECTED-DISTILL.md` (per transcript: the objection it should extract, or NONE).
- Distiller: `POST https://api.groq.com/openai/v1/chat/completions`, model `llama-3.1-8b-instant`, temperature 0, max_tokens 60, strict JSON `{"objection": "<first-person, ≤25 words, prospect's own words>"}` or `{"objection": null}`. Prompt errs toward extraction (pushback/hesitation/concern all count) to minimize false NONEs.
- **Gate (two parts):** (a) 5/5 vs the answer key (tune prompt until clean, document misses); (b) **retrieval comparison** — for each transcript, run KB search with distilled-phrase vs raw-chunk and confirm distillation actually improves top-match quality. This justifies the ~300ms serial hop. If it doesn't, stop and rethink before touching the route.

## STEP 2 — Server: distillation + nudge + prompt hardening
- New `src/lib/wingman/query-distill.ts`: `distillObjection(chunk)` → `{found:true, phrase}` | `{found:false}` | `null` (Groq error/timeout). AbortController ~1.5s; defensive JSON parse (strip fences). `GROQ_API_KEY` already in .env.local + Railway.
- `kb-signal/route.ts` — objection slot only:
  - **found** → `searchKnowledge(distilledPhrase)` (correct cache key = the distilled phrase) → match → `generateSignalCard(results, FULL 120s chunk, summary)` — card still written from the full buffer; **no KB match** → `generateFallbackCard` with the distilled objection injected as known-objection context (grounded, no longer guessing).
  - **not found** → nudge: fixed headline "No objection caught" + Haiku-written pointer (new `generateNudgeCard`, 3s timeout) grounded in recent transcript + summary; **if Haiku fails → static subtext "Nothing to handle in the last 2 min — keep going."** The nudge branch ALWAYS returns `signal_header` — it can never fall through to a bare `{ok:true}`. `signal_type:"Nudge"` (verify `TYPE_MAP['Nudge']` exists in the HUD — it's referenced as the fallback at hud/index.html:1233).
  - **null (Groq down)** → today's raw-chunk search path, **with cache skipped** (degraded mode). Card still comes.
  - Other slots unchanged (Phase 4).
- `knowledge-signal.ts`: hard rule added to `SIGNAL_CARD_SYSTEM_PROMPT` + the nudge prompt: never output "belief", "Belief Ladder", "pillar", or any internal framework name. `generateFallbackCard` gains optional `distilledObjection` param.
- `knowledge-search.ts`: optional `skipCache` param (degraded mode only).
- Structured timing log: `[kb-signal] TIMING distill=Xms embed=Yms search=Zms generate=Wms total=Tms branch=kb|fallback-grounded|nudge|raw-fallback` — the #38 warm-number instrument.
- Unit tests (Vitest): distill parse / NONE / timeout / fence-stripping; nudge fallback ladder.

## STEP 3 — HUD/IPC: green flash + action pill + counter + error state
**IPC channel inventory (machine-check with `comm`/`diff` before done — the #39 lesson, never visual scan):**

| Channel | main.ts | preload bridge | consumer | types |
|---|---|---|---|---|
| `wingman:pick-flash` (main→HUD) | send in `registerPick` + double-tap-Up branch | `hud.onPickFlash` | HUD | none (HUD is untyped JS) |
| `wingman:summon-state` (renderer→main) | **`ipcMain.handle("wingman:summon-state")`** relays to HUD | `wingman.sendSummonState` | DashboardClient | **MUST add to `WingmanBridge`** (tsc gate) |
| `hud:summon-state` (main→HUD) | send from the relay above | `hud.onSummonState` | HUD | none |

- **Flash (main-driven, instant):** on pick, send `pick-flash(direction)` to hudWindow FIRST, then close the menu with a flag that suppresses ONLY the `menu-close` IPC send — `menuOpen=false`, `teardownMenuKeys()`, and `menuAutoFadeTimer` clear STILL run (state must never desync). **The HUD `onPickFlash` handler owns the full compass teardown on the pick path:** green-flash class on the picked arrow ~0.5s, other three hidden, fade, then a full DOM reset (remove flash class, un-hide arrows, remove `visible`/`hiding`) so the 2nd+ summon is pristine. Esc/auto-fade keep the existing plain `menu-close` path (no flash; `hideCompassMenu` unchanged).
- **Pill (renderer-driven, single source of truth) — explicit HUD state machine:** one `setInterval` (counter) + one `setTimeout` (15s failsafe), both owned by the pill module.
  - `summon-state:"thinking"` → clear both, start both fresh, show action label + counter.
  - `hud:signal` (card arrival) → **first action: clear both + hide pill**, then show card — so a deliver-late card replaces an error pill, and a retry's card is never stomped by a stale failsafe.
  - `summon-state:"error"` → clear both, show "Couldn't pull that — tap ↑ to retry" ~4s fade.
  - `summon-state:"unsupported"` → "Not ready yet — coming soon" ~2s fade.
  - `onCallEnd` → clear both, hide pill.
- **DashboardClient `handleMenuPick` — no silent path after "thinking":** guards unchanged (in-flight → send nothing; existing pill keeps counting). After guards: `sendSummonState("thinking", slot)`. Then EVERY outcome resolves the pill: card (`signal_header` truthy → `sendSignal`) | `!res.ok` → "error" | **`res.ok && !data.signal_header` → "error"** (today this case is a silent no-op — that's BLOCKER 1) | catch/abort → "error". `direction !== "objection"` → `sendSummonState("unsupported")` instead of the silent return.

## STEP 4 — Warm-up (#38)
- `session/route.ts` POST: **after the call row insert succeeds**, fire-and-forget `warmUpPipeline()` — `Promise.allSettled` of 4 independent pings (each with own timeout + try/catch), whole call wrapped in `.catch(()=>{})`: (1) tiny OpenAI embed, (2) `search_kb_by_trigger` RPC with that embedding, (3) 1-token Haiku ping, (4) 1-token Groq ping. Warms TLS/connection pools + Postgres so the first press isn't the cold sample. Railway persistent Node = safe (same proven pattern as the post-call fire-and-forget); Vercel caveat in a comment. Cost <$0.001/call, once per call start (a session-create retry may warm twice — bounded, acceptable).
- Latency math to the 1.5–2s goal (warm): distill ~250–400 + embed ~150–300 (short phrase) + pgvector ~100–300 + Haiku ~600–900 ≈ **1.1–1.9s**. Levers if over: MATCH_COUNT down, top-2 KB block, max_tokens 120.
- **Connection-cooling watch (Sebastian, 2026-06-11):** long quiet stretches may re-cool connections (idle keep-alive closure). MEASURE FIRST: the TIMING line also logs `idleGap=` (seconds since the previous kb-signal request, or since warm-up for the first press). If slow presses correlate with long gaps, that tells us cooling is real AND the threshold — then build the periodic keep-warm ping (re-warm every ~N min during a live call) as a follow-up. Do NOT build the keep-warm in 3.5; instrument only.

## STEP 5 — Verify + ship
- `npx tsc --noEmit` (web + electron) + `npm test` green (Stop hook enforces). Bridge `comm`/`diff` machine-check. `wingman-reviewer` on the full diff (mandatory Pass 2). Extend `tasks/compass-preview.html` with flash + pill preview.
- Docs: Beta Tuning Parameters (Groq model/timeout/window + nudge dials), Known Issues #38 update, Current Sprint.
- PR → CI + Security Review → Sebastian approves → merge.

## LIVE GATE (Sebastian, real Zoom call)
1. Real objection on the call → ↑↑ → green flash → "Handling objection… 1s 2s…" → grounded card. 2nd+ press TIMING line = **1.5–2s warm**.
2. Press ↑ with NO recent objection → "No objection caught" + a true pointer; **no "belief" anywhere on screen.**
3. Press ← / ↓ / → → flash + "coming soon" pill.
4. Kill Wi-Fi, press ↑ → error pill at ~12s; Wi-Fi back, press ↑ → recovers.
5. End call mid-generation → pill cleared, arrows released, end-of-call chain clean.

**After the live gate passes:** separate tiny PR strips the #39 diagnostics (hudLog checkpoints + DevTools auto-open).

## Files touched
`scripts/test-distill.mjs` + `scripts/test-transcripts/EXPECTED-DISTILL.md` (new) · `src/lib/wingman/query-distill.ts` (new) · `src/app/api/wingman/kb-signal/route.ts` · `src/lib/wingman/knowledge-signal.ts` · `src/lib/wingman/knowledge-search.ts` · `src/app/api/wingman/session/route.ts` · `src/app/(dashboard)/dashboard/DashboardClient.tsx` · `electron/main.ts` · `electron/preload.ts` · `electron/hud/index.html` · `src/types/index.ts` · `tests/wingman/query-distill.test.ts` (new) · docs

## Cost
Groq ~$0.00002/press (free tier covers beta) · nudge Haiku only on empty presses · warm-up <$0.001/call · no new per-minute or unsummoned costs.

---
---

# Plan — Hotkey Signal-Card Model (#1) — HARDENED

**Status:** PLANNING ONLY. No code written. Awaiting Sebastian's approval.
**Source spec:** Decisions Log 2026-05-31 "Signal cards become hotkey-summoned, not autonomous."
**Reviewed by:** plan-reviewer subagent (fresh context) — verdict was NEEDS REVISION; all findings folded in below.
**Gate to done:** live testing on a real call — only Sebastian can do this.

---

## The pivot in one line
Today Wingman decides *on its own* when to pop a card (keyword hit → fire, + a paid Sonnet poll every 8–90s). New model: Wingman fires **nothing** on its own. Rep presses **Up Arrow** → a 4-arrow compass menu (↑ objection · ← answer · ↓ dig · → close) → picks a direction → Wingman generates that one card. Clean call = **$0 in live AI** (but NOT $0 backend — see D4).

---

## ⚠️ The critical catch (why the review mattered)
`/api/wingman/poll` is not just the Sonnet stage poll — its lines 143-165 are the **only place the live transcript is written to `call_transcript`.** It's the transcript heartbeat. If we just "stop calling poll" (my original Phase 0), then on the very first call:
- Post-call Sonnet job → "no transcript, skipping" → **no debrief, no objections, no pillar coverage**
- Flight Log transcript view → empty · Ask Wingman → dead · Objection Vault → never populates
- And the "move stages to post-call" fix → has no transcript to derive stages from

**So before we remove the poll, we must build a no-AI transcript-save endpoint to replace the heartbeat.** That's now Phase 0.

---

## Risks + mitigations (all verified against code)
- **CRITICAL — transcript persistence** (above). Mitigation: new `POST /api/wingman/transcript` (no AI), persists the buffer on a ~25s cadence + final flush, BEFORE the poll is removed.
- **A — Hotkey teardown (Invariants 2–5).** Up Arrow via `globalShortcut` is consumed OS-wide → register on `call:start` success, unregister on all 3 `callActive=false` paths (`autoStopCall`, `call:end`, `call:start` rollback). Idempotent helpers. Menu-direction keys (Left/Down/Right) also torn down on pick/dismiss/timeout/**call-end**.
- **B — Menu keys on a never-focused overlay.** `main` captures Left/Down/Right via `globalShortcut` while the menu is open (Up is already held as the summon key); HUD stays pure display. Silent ~5s auto-fade + Esc (no visible countdown).
- **C — Killing the poll breaks IntelTab + more.** `call_stages` (read by IntelTab heatmap, FlightLog, Ask-Wingman, calls API, dashboard) currently comes from the poll. Mitigation: derive the 6 stages in the **post-call Sonnet job** and insert `call_stages` there. Stage names MUST be exactly `Rapport|Discovery|Press|Confirm|Pitch|Close` (IntelTab silently drops unknown names). Strip `stages` from BOTH client PATCH sites (`handleEndCall` + `handleAutoEnd`) and remove the dead `completedStages` plumbing.
- **D — Generate-on-pick must always return a card.** `generateSignalCard` currently returns `null` when there's no KB match — needs a real plain-Haiku fallback branch. Add an in-flight guard so a double-press doesn't double-bill Haiku.
- **E — Drop Pusher from the hot path.** The card is now returned in the `kb-signal` HTTP response (renderer awaits → `window.wingman.sendSignal` → HUD). Removes the untested-Pusher dependency. BUT: tag the card `source:"summoned"` (new) so the 90s cooldown in `fireSignal` doesn't mute a 2nd summon within 90s.
- **IPC plumbing (typecheck-gate blocker).** Every new channel needs `electron/preload.ts` (use the early-event buffering pattern at preload.ts:24-27) + `src/types/index.ts` `WingmanBridge` + the HUD window type, or `tsc` blocks the turn. Enumerated per phase below.
- **Tests.** `tests/wingman/keyword-triggers.test.ts` asserts `checkKeywordTriggers`'s shape — keep it or update tests in the same PR.

---

## Spec open questions — resolved
1. **Input = the 4 ARROW KEYS as a directional picker** (decided 2026-06-01 — eyes-free "D-pad," cleaner than number keys; perfect fit since Search is deferred → exactly 4 actions for 4 arrows):
   - **↑ Up = Handle objection** (Up is also the summon key → double-tap Up = instant objection help without looking)
   - **← Left = Answer their question**
   - **↓ Down = Dig deeper** ("down = dig" mnemonic)
   - **→ Right = Close it / ask for the sale** (LOCKED 2026-06-01)
   - Menu rendered as a **cross/compass matching the physical keys** so it teaches the thumb. Mapping stays stable forever once reps learn it.
   - **Dismiss = silent auto-fade after ~5s + a small "esc" hint. NO visible ticking countdown** (adds pressure to an already-loaded rep). Esc closes anytime.
2. **Buffer:** rolling, capped by time (~90s) AND size (~1,500 chars).
3. **Free heuristic stage sense:** DROP for v1.
4. **Session state:** in-memory for v1 (Known Issue #6 accepts this).

## Decisions for Sebastian
- **D1 / D5 — RESOLVED (2026-06-01):** Default = **Up Arrow** (keeps the "findable by touch" rationale). The Settings override ships in the **same phase (Phase 3)** so any rep with a conflict can change it from day one. Needs a `profiles.call_hotkey` column — Sebastian approved the direction; **show the migration SQL before running it.**
- **D2 — "Answer their question" v1:** generate from the most-recent prospect question, no confirm sub-step (simpler). Recommend yes.
- **D3 — "Search" slot:** defer (free-text needs a focusable input — its own problem). Recommend yes.
- **D4 — Backend cost honesty.** "$0 live AI on a clean call" is no longer exact. Two cheap background costs remain: (a) transcript saves to DB every ~25s (no AI), and (b) the **rolling call summary** (Haiku, tiny updates) ≈ a few cents/call. Still negligible vs the old ~$2/call — keep the marketing honest.
- **D6 — Intel methodology shift.** New calls' stage scores will be Sonnet-derived from the full transcript (arguably more accurate) vs old calls' live-tracked scores — they'll sit side-by-side in the same Intel charts. Heads-up, no schema change.
- **D7 — Right-arrow action — RESOLVED (2026-06-01): → Right = Close it / ask for the sale.** The #1 thing closers freeze on (research-backed), zero dependency, simple to build. "What am I missing?" dropped as a dedicated arrow — the rolling Belief Ladder's WEAKEST LINK line already gives the framework check for free. Mapping stays stable once reps learn it. **All 4 arrows now LOCKED: ↑ objection · ← answer · ↓ dig · → close.**

### Right-arrow (Close) output — readiness-aware, 3 states (LOCKED 2026-06-01)
On Right press, compute a close-readiness score from the live Belief Ladder (which of the 7 are locked; weight Pain/Desire/Money highest) → show a **COLOR (red→green gradient) + a 2–3 word STATE + the MOVE for that state.** Always pair color with words — never a bare gauge or raw %:
- 🟢 **Green "Close now"** — all/nearly all beliefs ✅ → the assumptive close in the prospect's exact words + their number (e.g., "…get you to that $30K month — start today or Monday?").
- 🟡 **Amber "Almost — lock <gap>"** — ~1 belief open → names the single highest-leverage gap + the exact question to close it (e.g., support not confirmed → the spouse question).
- 🔴 **Red "Too early"** — multiple beliefs open → names the biggest hole + the discovery question to build it.
Protects against the two biggest close mistakes at once: closing too early (red) and never asking (green). Readiness shown **ON-DEMAND only** (on Right press) — do NOT color the ambient dot (peripheral status = the distraction we removed the stage bar to avoid).
> Note (Sebastian, 2026-06-01): the *quality of the suggested lines* will need live fine-tuning on real calls; the structure/idea is what's locked here.

## Competitive note — Cluely (researched 2026-06-01)
Cluely's live copilot = objection handling, doc/battlecard answers, and **auto-prompts that fire as you speak** ("magical teleprompter"). That autonomous push is exactly the model Wingman rejects (Core Rules 10 & 11 — don't make reps sound like they read AI). **Wingman's on-demand/summon model is the deliberate differentiator vs the category leader** — not a gap. Their in-call help validates our top 2 (objection + answer-question) and the "next question" family (dig deeper). They do NOT do a framework/"what am I missing" check — that's Wingman-specific.

---

## Context architecture — rolling call summary (added 2026-06-01, Sebastian's call)
Problem: a ~90s buffer alone loses what the prospect said 20–30 min ago. Can't fix by sending the full transcript on every press (cost + latency + signal dilution — "context quality beats quantity").
Fix: maintain a **rolling, distilled call summary**, updated in the background (cheap Haiku, tiny in/out, every ~90–120s or when the scout sees meaningful new material). Small (~150–200 tokens) so it rides along with EVERY arrow press.

**Structure = a live Cole Gordon "Belief Ladder" scorecard** (from his training docs, read 2026-06-01). KEY INSIGHT: his 7 Beliefs ≈ Wingman's existing 7 pillars (Pain=core_problem · Doubt=cant_diy · Cost=cost_of_waiting · Desire=dream_outcome · Money=investment_readiness · Support=whos_involved · Trust=why_you). Template the background Haiku keeps filled:
```
Stage · Elapsed · Syntax(problems-first|goals-first)
THE GAP: Current "hell" (numbers+specifics) | Desired "heaven" + $GOAL + why-that-# | final straw/emotional why | core driver (Certainty/Significance/…)
BELIEF LADDER (✅locked 🟡partial ⬜open ⚠️objection): 1 Pain · 2 Doubt(DIY) · 3 Cost(why-now) · 4 Desire · 5 Money · 6 Support(spouse/DM) · 7 Trust(why-you) — each w/ one-line evidence
THEIR EXACT WORDS (verbatim, for tie-downs): 2–3 quotes
OPEN OBJECTIONS: … + handled? | WEAKEST LINK → belief(s) to shore up before close
```
Powers all arrows from ONE doc: ↑objection→maps to the ⚠️ belief, handles root in their words; ↓dig→goes to the ⬜ weakest; ←answer→full situation; →close→if all ✅ close assumptively w/ their number+words. **"WEAKEST LINK" = the live answer to "what am I missing?" → framework check baked in free** (no separate feature). Maintained by background Haiku: [current summary]+[new transcript]→[updated summary]; fixed field structure lives in its system prompt so it stays consistent + compact.
→ Every card = **live moment (~90s, exact tie-down words) + rolling full-call summary + offer/content + technique library.** REPLACES the `prospect_anchors` emotional memory lost when the Sonnet poll dies. Cost ≈ a few cents/call (D4). Build into the core (Phase 2 scout/session state).

## Left arrow — source hierarchy for "Answer their question"
1. The rep's OWN ingested content (premium feature below) — most accurate/on-brand.
2. Manual offer fields (guarantee, differentiator, offer, Flight Plan, crawled offer page).
3. General LLM knowledge — LAST resort, clearly weakest. **Hard guard against confident-but-wrong facts** (esp. tax/legal/financial). If no grounded answer, hand the rep a MOVE ("great question — here's how to turn it around"), never a hallucinated fact.

## Future / premium — "Wingman content clone" (logged 2026-06-01)
Idea (Sebastian, inspired by Delphi.ai, which he uses on live calls): let a rep ingest their own YouTube channel / blog / docs into a PRIVATE per-rep content KB; "Answer their question" searches it first → answers in their/the founder's actual voice.
- **Infra already exists:** `knowledge-base/ingest.js` already does YouTube→transcript→embeddings (built the 419-entry technique KB). Point it at the rep's own channel → per-user content KB (separate table from the shared technique KB + the manual offer fields).
- **Cost (estimated 2026-06-01):** WITH free YouTube captions + chunk/embed only (skip heavy extraction): ~2,000 videos ≈ embedding ~$0.15–0.50 + pennies/mo storage ≈ **~$1–5 one-time.** WITHOUT captions (must Whisper the audio): ~**$150 one-time** for 2,000 videos — price into the upsell. Query-time = cheap vector search + Haiku, same as other arrows. (Cost is low; the per-user ingestion pipeline is the real build.)
- **Delphi's ingestion (researched):** paste a YouTube channel / website URL → auto-crawl/scrape (up to ~4 links deep, RSS auto-sync, Twitter handle) OR manual file upload. Not hand-loaded per video; uses a transcription service for audio.
- **Positioning:** strong UPSELL + moat (ingested brain = switching cost). Free = type your offer; premium = ingest your content. = "Sales DNA is the moat," concrete.
- **Sequencing:** fast-follow / premium tier AFTER the core hotkey model is live + tested. Do NOT bolt onto the v1 hotkey critical path.

---

## Phased build plan (resequenced — nothing load-bearing removed before its replacement exists)

### Phase 0 — Decouple transcript persistence from the poll (KEYSTONE, do first)
- **New `src/app/api/wingman/transcript/route.ts`** — auth + insert buffer into `call_transcript` (lift the split/insert logic from `poll/route.ts:143-165`). No Sonnet, no Pusher.
- `useWingmanPoller.ts` — repoint the existing interval + `flushBuffer` to `/transcript` (~25s cadence); keep the clear-then-restore-on-failure logic.
- **Accept:** call → speak → end → `call_transcript` has rows → Flight Log shows transcript → post-call debrief writes. **Must be green before Phase 1.**

### Phase 1 — Stages → post-call; retire the live Sonnet poll
- `post-call/route.ts` — Sonnet also emits the 6 stage labels + status; insert `call_stages` (`{call_id, name, status, display_order}`).
- Remove the `/poll` call + the Sonnet stage polling. Strip `stages:` from `handleEndCall` (DashboardClient:248-252) AND `handleAutoEnd` (:303-307); remove dead `completedStages`/`sendStage` plumbing.
- HUD: hide `#stageBar`, keep `#ambientDot`.
- **Accept:** call → ambient dot only, no pop-ups → Flight Log complete → IntelTab heatmap populated from post-call stages.

### Phase 2 — Rolling Belief Ladder memory (no UI) — SIMPLIFIED 2026-06-02
> Full spec: `Wingman Brain/00 - Product/Phase 2 — Live Call Memory Design.md`. **Scout CUT for v1.**
- **NO scout.** (`keyword-triggers.ts` autonomous cards removed regardless; the tagger idea is deferred — the timer + live buffer make it unnecessary for v1.)
- Rolling buffer (time+size capped) + context loaded once at call start (rep-profile / flight plan / objections).
- **Rolling Belief Ladder summarizer (the live call memory):** a background Haiku call keeps the structured Belief Ladder scorecard updated ([current summary]+[only new transcript]→[updated summary]); fixed field structure lives in its system prompt. **Timer-driven** (at most ~once/60s, at least ~once/2min), **rate-bounded** (pennies/call), and **client-triggered** (the app pings a `/summarize` endpoint — Vercel-safe, no server-side long-lived timer).
- The summary is the full-call context every arrow reads. At press time the card = ONE call: summary + live ~90s buffer + action, with **"recent transcript OVERRIDES summary"** as a hard precedence rule (lock in the prompt).
- **Accept:** logs show the Belief Ladder summary filling correctly over a call (gap · 7 beliefs · exact quotes · weakest link); zero UI change.

### Phase 3 — Hotkey + 4-arrow compass menu + the objection slot end-to-end (highest risk, the milestone)
- `main.ts` — `registerCallHotkey()`/`unregisterCallHotkey()` (idempotent); register the summon key (default **Up Arrow**) on `call:start` success, unregister on all 3 stop paths. Summon toggles `menuOpen`; on open, register the other 3 arrows (**← ↓ →**) + `Esc` and start a **silent ~5s auto-fade**; tear those down on pick/dismiss/timeout/call-end. (Up doubles as the objection pick → double-tap Up = instant objection help.)
- `preload.ts` + `types/index.ts` — `window.wingman.onMenuPick` + `window.hud.onMenuOpen/onMenuClose` + bridge types. Add `"summoned"` to `WingmanSignal.source`.
- `hud/index.html` — the **4-arrow compass menu** (↑ objection · ← answer · ↓ dig · → close), laid out to match the keys; silent fade + small "esc" hint; reuse `#signalBubble` for the result card.
- `DashboardClient.tsx` — `onMenuPick(dir)` → assemble context (**rolling Belief Ladder + last ~90s + offer/content + KB**) → `await fetch('/kb-signal',{slot,context})` → `window.wingman.sendSignal(card)` tagged `source:"summoned"`.
- `kb-signal/route.ts` + `knowledge-signal.ts` — `slot` param; implement the **↑ objection** slot first; ALWAYS return a card (fallback branch); in-flight guard.
- **Settings override (D5):** `profiles.call_hotkey` column (show SQL first) + a SettingsTab control (small preset list: Up Arrow / Right Arrow / a function key) + IPC sync to `main` (mirror `zoomNameSet`) so `registerCallHotkey()` uses the chosen key.
- **Accept (live):** Up → compass menu → Up again (or double-tap) → objection card < ~1s, built from the Belief Ladder memory. Dismiss (esc / fade) works. End call → arrows do nothing. Nothing ever fires unsummoned. Changing the key in Settings re-binds on the next call.

### Phase 4 — The other three arrow slots
- **← Answer their question** — source order: rep's own ingested content (premium, later) → manual offer fields → general LLM (guarded last resort; never invent facts — fall back to a "how to handle this" move).
- **↓ Dig deeper** — KB discovery / NEPQ question, aimed at the ⬜ weakest belief in the Belief Ladder.
- **→ Close it** — the **readiness-aware 3-state** output (reads the Belief Ladder): 🟢 "Close now" + assumptive close in their words/number · 🟡 "Almost — lock <gap>" + the question · 🔴 "Too early" + the move to build the missing belief. Color + state + the move (no bare gauge, no raw %). On-demand only (never on the ambient dot).
- NOTE: "What am I missing?" is **not** a slot — the Belief Ladder's WEAKEST LINK gives it for free. "Search" is **dropped from the core** (no 4th-arrow room; free-text needs a focusable input — revisit later as a non-arrow access if ever needed).

### Phase 5 — Settings override, onboarding, cleanup, docs
- *(Settings hotkey override moved up to Phase 3.)*
- Onboarding: ADD an Up-Arrow step (leave the Ctrl+Shift+W deploy step — not broken).
- Remove dead code: `/poll` route, `POLL_INTERVALS` timing (keep `getStagesForRole`/`getDefaultStage`), dormant Pusher live-card path, unused `LiveScorecard`/`StageBar`/`SignalCard`/`SignalLog`/`LiveCallView` (confirmed no importers).
- CLAUDE.md: reconcile Core Product Rules (90s cooldown obsolete — rep-summoned) + add the new invariant.

---

## Architectural Invariant to add (CLAUDE.md)
> The call-scoped hotkey and its menu-selection shortcuts are registered only while `callActive` is true, and torn down on every path that sets `callActive=false` (`autoStopCall`, `call:end`, `call:start` rollback). Menu direction-key shortcuts (← ↓ →) are additionally torn down on pick, dismiss, and timeout. A global accelerator that outlives the call swallows that key OS-wide.

---

## Test / acceptance
- Per-phase accept criteria above. Each phase: `npx tsc --noEmit` (web+electron) + `npm test` green (gate enforces).
- Phase 3+4 real gate = **live call** (Sebastian): summon, blind arrow-pick, card quality/latency, clean teardown (arrows released after call), nothing fires unsummoned.
- Serial build (shared live-pipeline state). Branch → PR → CI + Security Review → merge.
