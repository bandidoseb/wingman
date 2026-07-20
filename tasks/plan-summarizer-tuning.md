# Session Brief — Summarizer (Belief Ladder) Tuning

**Pick this up cold.** Self-contained scope for a dedicated summarizer-tuning session. All items touch the LIVE belief-ladder summarizer — the chokepoint EVERY live card reads — so every change is **eval-gated** (`scripts/test-belief-ladder.mjs` must be GREEN to ship) and goes through **plan-reviewer** (it's the RAG/summarizer pipeline). Do NOT drive-by edit this prompt outside this session.

## Why this session
The belief-ladder summarizer (`calls.live_summary`) feeds the objection card, the dig card, and the close-readiness chip. During the 2026-07-19 voice/flow grind, Sebastian stress-tested the scorecard design (as Cole Gordon) and confirmed a set of refinements. This session encodes them behind the eval gate.

## Files
- `src/lib/wingman/belief-ladder.ts` — the summarizer SYSTEM PROMPT + `BELIEF_LADDER_MAX_TOKENS` (1200). **The thing you edit.**
- `scripts/test-belief-ladder.mjs` — the HARD eval gate (currently ~7 scenarios). Must stay GREEN; EXPAND it with the new traps below. Run: `node scripts/test-belief-ladder.mjs`.
- `src/lib/wingman/close-readiness.mjs` — client-side readiness scoring off the ladder (the chip). Audit item #3.
- `src/lib/wingman/sales-dna.mjs` — `buildSummarizerDnaSystemBlock` (offer-aware block appended by the route; don't break un-briefed byte-identity).
- `src/app/api/wingman/summarize/route.ts` — assembles the summarizer call.

## Scope

### CONFIRMED by Sebastian (2026-07-19) — do these
1. **Relabel ⚠️ "at-risk/objection" → "objected" (or "contested").** Rationale: an unlocked belief is a LATENT objection (⬜/🟡 are ALSO "at risk"), so "at-risk" is ambiguous — it reads predictive when it's reactive (already FIRED). New framing: ⬜/🟡 = loaded-not-fired (BUILD before pitch); ⚠️ objected = fired (HANDLE now). ⚠️ **DOWNSTREAM CHECK (do first):** grep every consumer of the summary for the literal string(s) — the WEAKEST LINK line + ladder statuses are read by the objection/dig prompts and close-readiness. `grep -rniE "at-risk|at risk" src/ scripts/` and make sure the relabel doesn't break any parser or prompt instruction. Update the legend, the ladder lines, the WEAKEST LINK ordering note, and the worked example consistently.
2. **Raise the ✅ bar to EMOTIONAL ownership on the emotion beliefs (Pain, Desire, Cost).** Don't lock ✅ on a logical concession ("yeah I should fix this") — lock only when said with conviction/heat. NOT a new state; a stricter grading bar on those 3. Add a worked example (logical-yes → 🟡, emotional-yes → ✅) to the prompt AND a trap to the eval.

### QUEUED / consider (same session or fast-follow)
3. **Close-readiness audit** (`close-readiness.mjs`): does it weight ⬜/🟡 as hard as Cole would — i.e. does the chip actually STOP a rep from pitching with unbuilt beliefs, especially QUALIFICATION beliefs (Support = who decides, Money = can they afford)? Any ⚠️ already blocks green; confirm ⬜ on a qualification belief also holds the rep back from "Ready to Pitch." (See `Objection Flow — Doctrine + Cole-Jeremy Lens.md` open-Q#4/#5.)
4. **Money line captures RESOURCES, not just the price reaction.** Belief 5 (Money) = means/capacity. Instruct the summarizer to record what discovery learned about ability to invest ("has savings, said $8k is a stretch but doable"), not only "flinched at $8k." Ties to [[project-prospect-anchor-capture]] + the money-qualifier naming (capital they HAVE vs income they WANT).
5. **(optional, low priority) Emoji + word inline** — ladder status words live only in the legend; each line shows just the emoji + evidence. Repeating the word inline ("⚠️ objected — …") removes all ambiguity. Marginal; only if it doesn't complicate the eval.
6. **Expand `test-belief-ladder.mjs` with nuance traps** — the emotional-vs-logical lock (#2), the relabel (#1), plus general nuance traps (hedged numbers already covered by NUMBER CONFIDENCE; add polite-yes-is-not-locked, regression/un-lock, qualification-belief-open-at-close). Goal: the gate catches a summarizer that inflates belief.
7. **Model A/B — Sonnet 5 vs 4.6 for the summarizer** (original project scope). Build the eval-gated model-UPGRADE process: run the expanded gate on both, compare, only upgrade if strictly better. Ties to the owner-dashboard model registry (#44).
8. **Verify the token cap (Known Issue #48).** Cap is 1200 (raised from 600 when it was truncating WEAKEST LINK). On a real call, confirm output lands ~700–900 (complete-but-not-bloated). If pinned at 1200 every tick, TIGHTEN the prompt rather than raise the cap.

## Acceptance criteria
- `node scripts/test-belief-ladder.mjs` GREEN with the EXPANDED trap set.
- `grep` confirms NO downstream parser/prompt breaks on the ⚠️ relabel (objection card, dig card, close-readiness all still read the summary correctly).
- Un-briefed (no Sales DNA) summarizer output stays byte-stable where it should (the DNA block is additive).
- plan-reviewer + (if touching live pipeline) wingman-reviewer PASS.
- Typecheck green.

## Context / provenance
- Full rationale + Cole-lens audit: memory `project_summarizer_tuning_session.md` (this session's appends).
- Belief-state philosophy (unlocked = latent objection; keep 4 states; qualification vs persuasion): `Wingman Brain/00 - Product/Objection Flow — Doctrine + Cole-Jeremy Lens.md` open-Q#4/#5.
- Related builds: [[project-prospect-anchor-capture]] (the ANCHORS section feeds off the same summarizer), #4 offer-aware objection card.
