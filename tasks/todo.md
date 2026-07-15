# Plan — Design #2: Close-Readiness chip (Word-only + Expand)

**Goal:** When the rep presses → (Close), the HUD shows a shrink-to-fit readiness chip:
one color + a two-word label, and for not-ready states, a "Haven't covered: X, Y" line + a
"↓ Press to dig here" CTA. "Ready to Pitch" is a pure two-word chip (no gap, no CTA).

**Driven by the live Belief Ladder.** Scoring is deterministic (pure math). But on press we
**force a fresh belief-summary first** (Sebastian 2026-07-15) so a great last-2-minutes isn't
missed — reusing the existing `executeSummarize(force=true)`, which only calls Sonnet if there's
NEW transcript since the last tick (else instant no-op). So: instant when nothing changed, ~2–4s
(with the "Reading the close" pill) only when there's new material to score.

---

## Scoring model (Sebastian-locked weights, conservative bias)

7 beliefs from the Belief Ladder block, each with a status: ✅ locked · 🟡 partial · ⬜ open · ⚠️ at-risk.

- **GAT (core) = Pain · Can't-DIY · Cost-of-inaction · Desire** — must be LOCKED to earn the pitch.
- **Qualification = Money · Decision-maker** — must be confirmed (LOCKED) for "Ready".
- **Trust** — allowed to stay partial (it's built during the pitch).

**Guiding principle: false "Ready" is the expensive mistake.** The scale leans conservative —
hard to earn green, easy to stay amber.

State function (evaluated top-down) — **HARDENED per plan-review (W1 false-green fix):**
```
anyAtRisk  = ANY of the 7 beliefs is ⚠️        ← first guard (fixes the false green)
gatLocked  = # of GAT beliefs that are ✅
gatSignal  = # of GAT beliefs that are ✅ or 🟡
moneyOk    = Money is ✅
supportOk  = Decision-maker is ✅

anyAtRisk                                   → CONTINUE (🟠)  // a live objection ANYWHERE blocks green
READY (🟢 #3E8E5A "Ready to Pitch")         : gatLocked==4 && moneyOk && supportOk  (Trust may be 🟡/⬜, never ⚠️)
ALMOST (🟢 #7FA84E "Almost Ready")          : gatLocked==4 && !(moneyOk && supportOk)
NOT_READY (🔴 #C24338 "Not Ready")          : gatLocked==0 && gatSignal<=1
CONTINUE (🟠 #D98A3D "Continue Discovery")  : everything else
```
**Why the anyAtRisk guard (the bug the review caught):** the earlier draft only blocked at-risk on
GAT beliefs. But "Trust: any" let Trust ⚠️ (a live "why should I trust you" objection) still show
🟢 Ready; and Money/Support ⚠️ showed 🟢 Almost. ⚠️ exists to flag a live objection — it must never
coexist with a green chip. Any ⚠️ on any belief → Continue. This makes "never a false Ready" actually hold.

**Gap list (for the expand block):** beliefs that are not ✅, prioritized ⚠️ → ⬜ → 🟡, and within
a priority GAT (1–4) before qualification (5–6) before Trust (7). Show the top **2**. Empty for READY.
**Display names — REUSE the existing `BELIEF_DISPLAY` map** (DashboardClient L1217, also on dig tags
+ Flight Log — one vocabulary everywhere): Pain→Core Problem · Doubt→Can't DIY · Cost→Cost of
Waiting · Desire→Dream Outcome · Money→Investment · Support→Who's Deciding · Trust→Why You. Move
this map into the shared module so dig + readiness read ONE source (prevents drift).
Labels: Not Ready · Continue Discovery · Almost Ready · Ready to Pitch. Gap line: "Haven't covered:
<names>". CTA: "↓ Dig deeper". (Sebastian-confirmed 2026-07-15.)

**Fallbacks (conservative):** belief line missing / no status glyph → treat as ⬜ open. No BELIEF
LADDER block at all / no summary yet (early call) → all open → NOT_READY. Never infer LOCKED.

**Parse contract — HARDENED (W2/W3/W10):**
- Match ONLY lines whose first non-whitespace char is a digit 1–7 + whitespace + the expected
  belief name for that index (tolerant token: Pain / Doubt|DIY / Cost / Desire / Money /
  Support|decides / Trust). Validate name against number. This skips the legend line, THE GAP,
  WEAKEST LINK, OPEN OBJECTIONS, and bulleted quotes by construction.
- Read the status glyph ONLY from the region between the belief name and the FIRST " — " (U+2014).
  The evidence text is off-limits (it can contain "confirmed ✅ …" → would false-lock otherwise).
- Match glyphs by codepoint, stripping U+FE0F: locked ✅ (U+2705) ONLY; partial 🟡 (U+1F7E1);
  open ⬜/⬛ (U+2B1C/U+2B1B); at-risk ⚠ (U+26A0, ±VS16). Only exact ✅ = locked.
- Duplicate belief number (LLM restated a line) → keep the MIN (most conservative) status.

---

## Files touched (7)

1. **NEW `src/lib/wingman/close-readiness.ts`** — pure module. `scoreReadiness(summaryText?: string):
   { state: "ready"|"almost"|"continue"|"not-ready"; label: string; gap: string[] }`. No AI, no I/O.
   Parses ONLY the belief lines (skips the legend line in the header). Robust emoji matching
   (handles U+FE0F variation selectors). Exports display-name map + state labels.

2. **NEW `scripts/test-close-readiness.mjs`** — offline fixture gate. Must be GREEN to ship. Cases
   (incl. the plan-review regression guards):
   - full-ready · almost (qual pending) · continue (mid) · not-ready (empty + early).
   - **Trust ⚠️ → CONTINUE** (not Ready) · **Money ⚠️ → CONTINUE** · **Support ⚠️ → CONTINUE** (W1).
   - **evidence text contains ✅** (`4 Desire 🟡 — confirmed ✅ …`) → Desire = partial, not locked (W2).
   - legend line not parsed · bulleted quote `• "1 Pain…"` not parsed (W3).
   - VS16 variants of ⚠️/⬜ · missing glyph → open · **duplicate `1 Pain` diff status → min** (W10).
   - missing whole block → NOT_READY · gap ordering + 2-cap · ALMOST gap = Money/Support.

3. **`src/hooks/useWingmanPoller.ts`** — expose a `summarizeNow(): Promise<string | null>` wrapper
   around the existing `executeSummarize`. It must: (a) if a summarize is already in-flight, AWAIT
   that one (store the in-flight promise in a ref) rather than starting a second — avoids the
   timer-vs-press race; (b) else `await executeSummarize(true)`; (c) return the resulting
   `currentSummaryRef.current` (or null). Return it from the hook. `executeSummarize` already
   guards empty buffer + in-flight, restores buffer on failure, 30 s timeout — reuse as-is.

4. **`src/app/(dashboard)/dashboard/DashboardClient.tsx`** — add `handleClosePick` (sibling to
   `handleDigPick`), routed **after the `isGeneratingRef` guard** so a → close press while a card
   is streaming is dropped (W7). Flow:
   - Set `isGeneratingRef` + show the "Reading the close" pill (already exists) via
     `sendSummonState({state:"thinking",slot:"close"})`.
   - `const fresh = await summarizeNow();` → `const summary = fresh ?? liveSummary;` (fall back to
     cached if the summarize failed/timed out — better than nothing).
   - `scoreReadiness(summary)` → send chip.
   - **Feature-detect (W5):** `window.wingman?.sendReadiness ? sendReadiness({..., seq:
     ++seqCounterRef.current}) : window.wingman?.sendSummonState({state:"unsupported",slot:"close"})`.
   - Uses the **shared `seqCounterRef`** (W6). ~500 ms debounce ref, **cleared in the isActive-false
     effect + on unmount** (W8). Clear `isGeneratingRef` in a finally.

5. **`electron/preload.ts`** — new IPC method `sendReadiness({ state, label, gap, seq })` on the
   `wingman` namespace, and `onReadiness(cb)` on the `hud` namespace. Mirrors the existing
   `flow-state` / `summon-state` pattern exactly.

6. **`electron/main.ts`** — relay `hud:readiness` → `hud:update-readiness` to the HUD window
   (one handler, mirrors the flow-state relay). No key/accelerator changes.

7. **`electron/hud/index.html`** — new `showReadiness(payload)` render path + CSS. Colored dot +
   two-word label in the state color; if `gap.length`, a divider + "Haven't covered: <names>" +
   "↓ Dig deeper" (W9 — not "dig here"; ↓ digs the weakest link, not necessarily the named gap).
   4 state colors as new literals (matches design: colors live here).
   - **Reuses the single `signalBubble` element** (like headless/two-tier already do) so the
     one-card invariant is structural, not by convention (W6). Runs the same `currentRevealSeq`
     guard as `showSignal`, sets `currentRevealSeq`, calls `cancelReveal()` + `clearFlowChrome()`
     + `hidePill(false)`, manages `stageBar` glow + `ambientDot` like the other paths.
   - **Auto-hide timer + manual dismiss (Sebastian 2026-07-15):** ~6 s chip / ~9 s expanded (signal
     cards do NOT auto-hide — W4 verified — so readiness owns its own timer), PLUS a small × dismiss
     button on the chip (HUD already takes mouse input for the outcome-card pills; reuse that
     `setIgnoreMouseEvents` handling) and honor the existing card-dismiss hotkey. Timer cleared on
     any new card, on manual dismiss, in `hideSignal`, and on call-end.

---

## Blast-radius / edge cases (Plan Review Loop answers)

- **Shared state:** none new in Electron main (no timers/flags added; `close` key already registered
  from both compass + flow-direct paths — both reach the same renderer handler, so both work
  automatically). Client adds one debounce ref.
- **One-card invariant:** readiness renders through the HUD's existing single visible-card slot;
  it cannot stack with a signal card.
- **Runs twice / double-press:** debounce + seq dedupe in HUD (latest seq wins). Idempotent —
  re-rendering the same chip is harmless (no AI, no cost).
- **No summary yet (first ~2 min):** NOT_READY (honest — no discovery done).
- **Staleness:** chip reflects the last summarizer tick (~2 min cadence) — same data every other
  card uses. Belief state doesn't swing in seconds; accepted, not a bug. We do NOT trigger a fresh
  summarize on press (would kill the "instant" property).
- **Cost:** zero — no Recall/Anthropic/OpenAI call on this path.
- **Malformed model output:** parse degrades to ⬜ open (conservative) — never a false green.
- **Dig CTA:** it's instructional text pointing at the existing ↓ hotkey, NOT an interactive
  button (HUD isn't focusable mid-call). No new wiring — pressing ↓ runs the existing dig flow.

---

## Out of scope (this plan)
- Design #4 live-indicator — bundles into the SAME desktop release (both HUD chrome). The design
  doc lists an "ambient/live dot" as already-in-code; #4's exact delta is underspecified. Will
  scope it as a small add-on once this plan is approved, so #2 and #4 ship in one version bump.
- The route's dead `close` KB branch (kb-signal/route.ts ~L349–386) — left untouched (harmless;
  client never calls it). Not refactoring working code.

---

## Test steps (after build)
1. `node scripts/test-close-readiness.mjs` → all fixtures GREEN.
2. `npm run electron:dev` → on a live/simulated call, press → at various points; verify the chip
   matches the belief state (early = Not Ready; after locking GAT = Almost/Ready).
3. Verify expand shows correct gap names + the ↓ CTA on not-ready states; Ready = pure chip.
4. Verify only one HUD element shows (press ↑ objection then → close — objection card dismisses).
5. `wingman-reviewer` on the full diff before presenting as done.
6. Desktop release (bundled with #4) to reach packaged apps.
