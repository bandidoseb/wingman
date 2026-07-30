# Plan — Objection Card Production Build (HARDENED after plan-reviewer, 2026-06-28)

Backed by the offline eval (`scripts/objection-eval.mjs`, results in `tasks/kb-ab-test/`) AND a fresh-context
plan-review that corrected several premises. Build **serially**; each phase ends at a **live-call gate**.

## Honest read of the data (corrected)
- **Prompt:** keep the current (2026-06-21) prompt's TONALITY — but it LACKS the explicit no-fabrication +
  confidence-number rules, which live only in the v2 rewrite. → ship a **merge** (v1 tonality body + v2's
  accuracy/number section), re-run the eval on that exact string, port THAT. Not "v1 verbatim."
- **Number safety:** scrub UNCONFIRMED digits at the summarizer (storage) layer. Sound — but the gate that
  "proves" it (`test-belief-ladder.mjs`) currently has **zero assertions** and a duplicated prompt copy, so
  it proves nothing until fixed.
- **Anchors:** NOT the settled win I claimed. Across the two runs the v1±anchors delta was −0.50 (full) and
  +0.30 (compact) — within judge noise — and the ONLY fabrication in either run came from an anchor arm
  (#27 C, invented "$30k/$50k/$100k"). Real wins exist on specific scenarios (#15, #25) but the aggregate is
  break-even with a fabrication tail. → re-scope Phase 3 as a **guarded experiment**, gated on a variance
  re-run + the fabrication fence being in the shipped prompt.

---

## PHASE 0 — De-risk the premises (no card code yet)
1. **Re-run the eval 3–5×** (`node scripts/objection-eval.mjs`, `COMPACT=1 …`); look at A/B/C/D run-to-run
   variance. This is the anchors go/no-go input — a decision for Sebastian, not a guess.
2. **Decide the production prompt string:** merge V1 tonality body + V2's `<using_their_details>` (no-fabrication
   + `[confirmed]/[shaky]` number rules). Re-run the eval on that exact merged string; confirm tonality didn't
   regress. Port THAT verbatim in Phase 1.
3. **Make the belief-ladder harness a REAL gate** (`scripts/test-belief-ladder.mjs`): import
   `BELIEF_LADDER_SYSTEM_PROMPT` from the lib (delete the duplicate copy at ~lines 77–129), add fixture
   assertions — a number stated once → must NOT appear as digits; a confirmed/echoed number → MUST appear;
   exit non-zero on violation. Prerequisite for Phases 2 & 3.

---

## PHASE 1 — Objection slot on Sonnet, single-line card (4 files + types)
**Goal:** ↑ objection card = the merged prompt on Sonnet, ONE spoken line, HUD shows a small "OBJECTION" tag +
the line. KB cut from the objection slot (Coach untouched). Uses existing `live_summary` as-is.

1. **NEW `src/lib/wingman/objection-signal.ts`** — `generateObjectionCard(transcriptChunk, liveSummary?, distilledObjection?)`.
   - **Drop `currentStage`** (the eval never feeds a stage line — don't carry an unused param).
   - Model `claude-sonnet-4-6`, **`max_tokens: 120`** (the line is ~40 tokens; 400 only paid to generate prose
     we throw away, and inflates the p95 tail).
   - User message mirrors the harness `buildUserMessage` exactly. Hardened JSON parse identical to
     `objection-eval.mjs` (first `{...}`, then `"line"` regex, else null). 10s AbortController; null on
     timeout/parse-fail/!apiKey.
2. **MODIFY `src/app/api/wingman/kb-signal/route.ts`** — objection branch ONLY:
   - Distiller stays as the nudge gate: `!found` → `generateNudgeCard`; `found` →
     `generateObjectionCard(chunk, summary, distilled.phrase)`; `null` → `generateObjectionCard(chunk, summary)`.
   - Remove the KB **calls** in the objection branch only — **keep the shared imports** (answer/dig/close still
     use `generateSignalCard`/`generateFallbackCard`).
   - **Success contract:** `{ ok:true, signal_type:"Objection", signal_text:<line>, signal_header:"" }`.
     **Failure sentinel stays** bare `{ ok:true }` (so success ≠ failure — see the gate fix below).
3. **MODIFY `src/app/(dashboard)/dashboard/DashboardClient.tsx`** — ⚠️ THE LOAD-BEARING FIX. Today the delivery
   gate is `if (data.signal_header)` (~line 524); with the new `signal_header:""` success shape that gate is
   FALSY → the card is treated as failure → retry pill → **the rep never sees an objection card.** Change to:
   `const card = slot === "objection" ? data.signal_text : data.signal_header;` then `if (card) sendSignal(...)`
   else error pill. Pass `header: data.signal_header ?? "", text: data.signal_text ?? "", type: data.signal_type ?? "Handle"`.
4. **MODIFY `electron/hud/index.html`** — (a) add `'Objection': { cls:'suggest', label:'Objection' }` to
   `TYPE_MAP` (~921) — else the tag renders "SUGGEST" (no "Objection" key → falls through to Nudge→"Suggest",
   and stage sync is gone so the tag can't come from `currentStage`); (b) in `showSignal` (~1419), render a
   `header:""`,`text:line` card at the intended **conversational size** (decide: keep the 22px headline slot or
   a smaller style — a ~25-word line in 22px/700 wraps to 3–4 heavy lines). Full `electron:dev` restart +
   re-stage + grep `electron-dist/hud/index.html` (no hot reload — lesson 2026-06-05).
5. **MODIFY `src/types/index.ts`** — add `"Objection"` to `SignalType` (else the typecheck Stop-hook blocks the turn).

**Live gate:** ↑ → compass → a real single-line card tagged **OBJECTION** (not SUGGEST); failure/empty/
rate-limit → retry pill, never dead air; Coach still returns KB answers; press-to-card ~2–3s (tail tolerated).
**Cost note for Sebastian:** Sonnet/press ≈ 2–4× Haiku; realistic 5–20 presses/call ≈ a few cents; bounded by
the 3s/user rate limit. `max_tokens:120` keeps both cost and tail down.

---

## PHASE 2 — Confidence-aware summarizer (gated by the real harness from Phase 0.3)
- Edit `belief-ladder.ts`: record a number's digits ONLY if stated clearly AND echoed/repeated; else keep the
  meaning, drop the digit. Confirmed currents/quoted spends stay.
- **Gate:** the now-real harness must exit 0. No schema change, no `recall.ts` change.
- **Live gate:** a goal number said once does NOT appear as digits in `live_summary` or on a card; a
  confirmed/echoed number still does.

---

## PHASE 3 — Anchor library — GUARDED EXPERIMENT (not a settled win)
- **Precondition:** Phase 0.1 variance re-run shows anchors help reliably, AND the shipped prompt already
  carries the v2 fabrication fence. Otherwise DEFER (the fabrication in the eval came WITH anchors).
- **Schema (needs Sebastian's explicit YES):** `calls.anchors JSONB DEFAULT '[]'`, separate from the
  fixed-size `live_summary`. Also back-fill a migration file capturing `live_summary` + `anchors` (both were
  added out-of-band; the repo currently has no migration for `live_summary` → schema drift).
- **Merge safely:** append/dedup/cap (N≤40) in a **single SQL statement** (or make `flushSummarize` await the
  in-flight tick) — read-modify-write in JS lets the call-end flush and a timer tick lost-update each other.
- **Summarizer** emits anchors as a SEPARATE block/second pass (not folded into fixed-size `live_summary`) →
  re-run the harness on the output change.
- **Client:** hold anchors in-memory AND add them to the `callId` reset block in `useWingmanPoller.ts` (~127–138)
  so call 2 doesn't inherit call 1's anchors.
- **Live gate:** a detail given early in a long call (aged out of the recent buffer) shows up correctly later.

---

## Open decisions that need Sebastian
1. **Anchors go/no-go** after the variance re-run (product + cost call). My earlier "worth it, zero downside"
   was overstated — it's break-even-with-tail-risk on current data.
2. **The shipped prompt string** — approve the v1-tonality + v2-safety merge (he's the final tonality judge —
   reads the eval lines on the merged string).
3. **Schema** — approve `calls.anchors` JSONB + the back-fill migration (Phase 3 only).
4. **Card visual size** — does the spoken line render big-bold (current headline slot) or smaller/conversational?

## Sequencing
Phase 0 → (decisions 1,2) → Phase 1 → wingman-reviewer → typecheck gate → live gate → PR (closes the original
`wiring-objection-prompt.md`). → Phase 2 (harness gate) → live gate → PR. → Phase 3 only if decision 1 = go
(+ schema approval) → own review → live gate → PR. After Phase 1: flip CLAUDE.md/Brain "wiring pending" → shipped;
log the eval + decisions in the Decisions Log.

## Out of scope (named)
Streaming card reveal (separate gated PR — the real Sonnet latency mask); answer/dig/close → headless + own
generators (Phase 4); Deepgram word-confidence capture in `recall.ts` (hardening if text-based judgment proves weak).
