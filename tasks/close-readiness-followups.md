# Close-Readiness & Surface-Agreement — follow-ups (logged 2026-07-22)

These came out of the summarizer "grades harder" discussion (2026-07-20 → 07-22). They all touch the **→ close-readiness surface** and how the live cards (chip · dig · objection) agree with each other. Group them into ONE focused session (same surface → one desktop release), plan-reviewed + eval-gated, do NOT fragment.

## Hard requirement (Sebastian, 2026-07-22) — NEVER leave the rep wondering
> "if all we tell users is 'you're not ready,' they're going to be sitting there like, well what makes me ready? Confirm a user is never left wondering."
Confirmed already true in code: `close-readiness.mjs` → HUD (`electron/hud/index.html:2093`) always renders EITHER the named gap ("Haven't covered: X, Y") + a ↓ Dig CTA, OR the cold-start note ("Discovery hasn't started yet"). A bare "not ready" with no reason can't render. This requirement must survive any future change to the chip.

## 1. "See what's missing ▾" dropdown (replaces the top-2-only gap)
**Problem:** the chip names only the top-2 weakest beliefs. Rep covers those two, re-presses, sees TWO MORE, feels misled ("I thought I only had those two").
**Fix:** keep the chip minimal (label + #1 priority) but add a collapsed **"See what's missing ▾"** control that expands to the FULL list of not-yet-covered items, in priority order (⚠️ objected → ⬜ open → 🟡 partial). Collapsed-by-default preserves the "Wingman is not a live checklist" product rule (minimal by default, complete on demand).
- `close-readiness.mjs`: expose the full ordered missing list (today `buildGap` slices to 2) without breaking the existing top-2 `gap` the chip line uses.
- HUD: render the expander; plain-English names only.
- Naming ruling (Sebastian + Claude 2026-07-22): do NOT rename "beliefs". It's not Cole IP (belief-selling is generic), and the user never sees the word — labels are already plain English (Core Problem, Can't DIY, Cost of Waiting, Dream Outcome, Investment, Who's Deciding, Why You). Dropdown header = "Still to cover", no category noun. Keep "beliefs" internal in code (no rename sweep — CLAUDE.md forbids cleanup refactors).
- Gate: extend `test-close-readiness.mjs`.

## 2. TEST: is the emotional-ownership ✅ bar too strict?
The 2026-07-20 change requires EMOTIONAL heat (not a logical "yeah I should fix that") to lock ✅ on Pain/Cost/Desire → the chip is now stricter (stays "Continue Discovery" where it used to say "Ready to Pitch"). Sebastian: intended, but watch it. **Action:** on real calls, confirm it isn't telling reps NOT to pitch when they legitimately could. If over-strict, relax the bar. Log outcomes before changing.

## 3. Premature buying signal → the "defer + redirect" card (the real gap)
**The case:** prospect says "how do I start?" / "how much is it?" 5–15 min in, discovery still thin. Buying signal ≠ pitch-ready.
**Methodology (confirmed):** Jeremy Miner (NEPQ) — presenting before the problem is developed is a cardinal sin; acknowledge + redirect with a question, never pitch early. Cole Gordon — don't present until the case is built (gap + cost + can-pay + can-decide); enthusiasm doesn't skip the case. Both DEFER + loop back.
**Sebastian's line (on-target):** "Yeah, we'll definitely touch on that — I just want to learn a bit more about what you need so I offer the best solution. We'll get to how to start, then loop back." → this is the redirect card's target voice.
**The insight — a THIRD move we don't produce:** not "pitch" and not "keep digging silently" → **acknowledge + defer + redirect.** And the current dig-card rule ("READINESS OVERRIDES A SOFT BELIEF → ready prospect asking to move forward → TAKE THE CLOSE", `dig-prompt.mjs`) is too aggressive: correct when the CASE IS BUILT, wrong at min 10 with thin discovery. Make the override conditional on case-built, not on buying-signal-detected.
**Ties to:** the momentum→chip work below (momentum reads the buying signal; the ladder reads the case; combine to distinguish "case built + eager → close" from "case thin + eager → redirect").

## 4. Surfaces must AGREE (the umbrella)
Today the dig card's readiness-override and the chip's ladder-score can DISAGREE (dig says "take the close" on a buying signal while the chip says "Continue Discovery"). Root: the chip scores the ladder only and can't see buying signals; nothing consumes the new MOMENTUM line yet. **Fix:** feed MOMENTUM into a SHARED readiness definition that the chip, the dig card, and the new redirect card all read — so all arrows agree. This is the close-readiness audit worth doing (supersedes the earlier "make ⬜ qualification beliefs punish harder" idea — Sebastian ruled "Almost Ready · <gap>" is honest, not misleading, so don't just make it harsher).

## Sequencing note
1 (dropdown) is contained and shippable alone. 3 + 4 are the same shared-readiness engine and should ship together. All three are the SAME HUD surface → bundle into one desktop release. Not started; needs its own session + plan-reviewer.
