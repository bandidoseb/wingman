# Task #1 — HUD Quick Wins (Wingman Design Language)

Scope locked with Sebastian 2026-07-14:
- **Objection + Dig only.** ← answer and → close arrows are Phase 4, separate sessions.
- **No quotation marks anywhere** — generated spoken lines AND directive/instruction cards.
- **One card format** for the cards that exist today (collapse the old two-tier directive chips).
- Plain-English pass + verify compass.
- Quick-wins only. No new features.

Key shipping fact: **this entire session ships via Railway (web/server) — no desktop release needed.**
- Quote-strip is server-side in the stream decoder → reaches even already-installed apps.
- The format collapse happens in the web layer (stops sending `header`); the existing packaged HUD
  already renders the single-line "headless" path whenever `signal.header` is absent.

---

## Files to touch (web/server — no electron release) — HARDENED after plan-reviewer

1. `src/lib/wingman/objection-prompt.mjs` — **unquote the 5 few-shot example lines (50–54)** (ROOT
   CAUSE) + add one fence line to the output contract.
2. `src/lib/wingman/dig-prompt.mjs` — add the same one fence line to its output contract.
3. `src/lib/wingman/json-line-stream.ts` — add + export pure `stripWrappingQuotes()`; apply inside
   `decodeLineStream` (belt). The ONE server-side place both streamed objection AND dig decode.
4. `src/lib/wingman/objection-signal.ts` — apply `stripWrappingQuotes` at the 3 `parseObjection`
   return points. (NOT `dig-signal.ts` — it has no non-stream parser; decoder alone covers dig.)
5. `src/app/api/wingman/kb-signal/route.ts` — directive-card copy → single merged plain line, emitted
   in the **text field with empty/absent `header`** at all 4 response points (2 SSE nudges + 2 JSON
   too-early). Route-only collapse → existing client + packaged HUD render headless automatically.
6. `src/app/(dashboard)/dashboard/DashboardClient.tsx:1274` — dig `beliefTag` id→label DISPLAY map
   ONLY (wire value stays the taxonomy id). This is the ONLY DashboardClient change.
7. `tests/wingman/json-line-stream.test.ts` — new decoder unit cases (see Gates).

(Deferred to the next batched desktop release, NOT this session: any `electron/hud/index.html`
changes. The two-tier branch is NOT dead — the poller's `currentSignal` path (DashboardClient
664-671) still forwards `header` — so leave it. Compass labels + TYPE_MAP already plain English.)

---

## Steps

### A. Kill quotation marks — ROOT CAUSE first, then belt
- **A1 (root cause):** in `objection-prompt.mjs` **unquote example lines 50–54** (they're already
  delimited by `- ` bullets). The model imitates its own quoted few-shots — a "no quotes" fence over
  quoted examples is contradictory. Add fence: *"Output the line as plain text — the words
  themselves, with NO surrounding quotation marks of any kind (straight or curly). The examples above
  are shown without quotes on purpose."* Same fence line into `dig-prompt.mjs`.
- **A2 (belt, streaming):** `stripWrappingQuotes()` = remove AT MOST ONE balanced leading+trailing
  quote pair (`" ' “ ”`). In `decodeLineStream`:
  - streaming partial: replace the `^\s+` strip with a single anchored `^\s*["'“”]?\s*` consume of
    `out` (optional ws, at most one leading quote, optional ws) **before** the empty→pending check.
    Fixes the quote-then-space "card opens on a blank" bug. Leading only mid-stream (monotonic-safe).
  - final `"line"`: run `stripWrappingQuotes(out.trim())` (balanced pair — trailing stripped ONLY if
    a leading was), THEN the truthy check → empty-after-strip falls to `abstain`.
  - Touch only the emission of `out`/`line`. NEVER the null/error/structural control flow (shared by
    the lever/belief decoders).
- **A3 (belt, non-stream):** apply `stripWrappingQuotes` at all 3 `parseObjection` return points,
  preserving deliberate-null→abstain vs unparseable→error (empty-after-strip → abstain).
- Known accepted edge (document, don't fix): if the fence ever fails, one streaming delta may briefly
  show a trailing `."` before the `done` frame repaints it clean. Transient, strictly better than today.

### B. One card format — collapse the directive chips (ROUTE-ONLY)
Every client nudge site already does `header = d?.header ?? ""` and the HUD branches on
`if (!signal.header)` (empty string is falsy → headless). So emit the merged line in `text`/
`signal_text` with `header:""` in the route → all client sites + installed HUD render headless, zero
client changes. Merged plain-English copy (proposed — confirm):
  - No objection: **"No objection right now — keep going."**
  - Too early to dig (zero transcript — rep pressed ↓ before anyone spoke): **"Start the conversation."**
    (Deliberate exception to the always-a-question dig doctrine: only the pre-conversation edge, where
    there's no speech to build a question from. In-flow dig always surfaces a real question. Sebastian-locked 2026-07-14.)
  - Take the close (a listed stop-state — directive is intended): **"They're ready — go for the close."**
Behavior note: collapsed nudges now ANIMATE (type-on reveal) instead of instant paint — Sebastian OK'd.

### C. Plain-English pass (web-side only)
- Dig `beliefTag` display map (DashboardClient:1274), DISPLAY only, wire value = raw taxonomy id:
  Pain→Core Problem · Doubt→Can't DIY · Cost→Cost of Waiting · Desire→Dream Outcome ·
  Money→Investment · Support→Who's Deciding · Trust→Why You. (Confirmed vs belief-ladder.ts +
  FlightLogTab.tsx — do NOT rename the taxonomy ids; the decoder + `readBelief` + dig-eval depend on them.)
- Directive copy handled in B. Compass labels / TYPE_MAP / flow chrome audited = already plain, no change.

### D. Verify compass
- Confirm compass renders + 4 arrows correct. Verification only. Also verify `currentStage` is null
  live (else the tag would show a stage name over "DIG · …") — HUD-side, note only.

---

## Gates before "done"
- `tsc` web + electron green (Stop hook), `npm test` green.
- New decoder unit tests: leading-strip · quote-then-space · balanced trailing on final only ·
  all-quotes→abstain · internal-quote preserved · no-quote byte-identical.
- Re-run `scripts/objection-eval.mjs` + `scripts/dig-eval.mjs` + `scripts/objection-threading-eval.mjs`
  (prompt changed + decoder shared) — no tonality/fabrication regression; no fixture depends on wrap quotes.
- `wingman-reviewer` on the full diff.
- Exact manual test steps for Sebastian (real-call press of ↑ and ↓).

## Cost / invariants (reviewer-confirmed)
- No new API calls; strip is pure CPU. Prompt edit busts the cache once (one-time, negligible) +
  invalidates the pipeline-warmup prime. No `isRunning`/`callActive`/`stopRecallAI`/schema touched.
  Railway-only, no desktop release.
