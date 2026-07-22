# Session Brief — Summarizer (Belief Ladder) Tuning

> **2026-07-20: BUILD PLAN written — see "## BUILD PLAN" at the bottom of this file. It expands this brief's scope (Cole-brain redesign: anchors + commitments + momentum) per Sebastian's top-down session. The plan section is the source of truth for the build; this brief remains the provenance.**

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

---

## BUILD PLAN (2026-07-20) — "The Cole/Jeremy Brain" summarizer redesign

**Vision locked with Sebastian 2026-07-20:** the summarizer is the closer's brain — 5 layers, each captured because it drives a different kind of next move: (1) The Gap · (2) Belief states (the routing table) · (3) Anchors (verbatim ammunition) · (4) Qualification facts · (5) Momentum. Current summarizer = layers 1–2. This build adds 3–5 and sharpens 2's grading. Plus the **COMMITMENTS ledger** (stacked agreements / conditional yeses — Cole's close is assembled from these).

**Deepgram Audio Intelligence — evaluated + REJECTED** (streaming unsupported for sentiment/intent/topic/summarize; their sentiment is linguistic not acoustic; entity detection has no hedging judgment). Prosody spike jotted to `_Inbox/2026-07-20 Prosody-Tonality Research Spike.md`. Momentum stays Sonnet-read-from-words.

### Downstream-consumer audit (done 2026-07-20 — what reads the summary)
| Consumer | How it reads | Impact of this build |
|---|---|---|
| `close-readiness.mjs` | Parses ladder lines by **digit 1–7 + name-regex + GLYPH before the em-dash**. Never reads the word "at-risk". Legend/other sections skipped by construction. | ⚠️→"objected" relabel is **safe**. New sections (anchors/commitments/momentum) are skipped by the digit-prefix rule — safe. Verified by `test-close-readiness.mjs` (glyph-based). |
| `dig-prompt.mjs` | Prompt text references "WEAKEST LINK", "THEIR EXACT WORDS", and the phrase "⚠️ at-risk first" (line 35, 38). | Needs wording updates: "at-risk"→"objected"; "THEIR EXACT WORDS"→ the renamed anchors section. |
| `objection-prompt.mjs` / `flow-synth.mjs` | Receive the summary blob; **no** "at-risk"/section-name references (grep-verified). | New sections flow in automatically. No edits (voice Bundle A stays untouched). |
| `kb-signal/route.ts:208` | Defensive `live_summary.slice(0, 4_000)` chars. | Longer scorecard risks tail truncation (WEAKEST LINK is last!). Raise to 6_500 (matches new 1500-token cap ≈ ~6k chars worst case). |
| `syntax-detect.ts` | Regex on the `Syntax:` header line only. | Line unchanged — safe. Re-run its unit tests anyway. |
| `test-belief-ladder.mjs` | Reads prompt/model/cap from the lib at runtime (no drift). | Gets the new traps (below). |
| Dig/objection eval fixtures (`dig-eval-corpus.mjs`, `objection-eval-compact.mjs`) | Contain frozen synthetic summaries saying "at-risk". | Cosmetic drift only (cards read real summaries live; parsers use glyphs). **Defer** — update opportunistically at next dig/objection eval run. |

### Files touched (5)
1. **`src/lib/wingman/belief-ladder.ts`** — the prompt rework (all changes below) + `BELIEF_LADDER_MAX_TOKENS` 1200→1500.
2. **`scripts/test-belief-ladder.mjs`** — new hard traps.
3. **`src/lib/wingman/dig-prompt.mjs`** — wording only: "at-risk"→"objected", section-name update. NO voice/behavior changes.
4. **`src/lib/wingman/sales-dna.mjs`** — extend `buildSummarizerDnaSystemBlock` with the per-rep ANCHOR SPECIALIZATION paragraph (offer-shaped "what Desire/Pain/Money concretely look like for THIS offer"). No-DNA reps: block absent → base prompt only (additivity invariant holds).
5. **`src/app/api/wingman/kb-signal/route.ts`** — one line: defensive slice 4_000→6_500.

### Prompt changes (belief-ladder.ts) — in scorecard order
- **(a) ⚠️ relabel** "at-risk/objection" → "objected" everywhere (legend, grading rule, WEAKEST LINK priority note, worked example). Framing per doctrine Q#4: ⚠️ = objection FIRED (handle now); ⬜/🟡 = objection LOADED (build before pitch). Glyphs unchanged.
- **(b) Emotional-ownership ✅ bar** on Pain (1), Cost (3), Desire (4): a logical concession ("yeah, I probably should fix this") = 🟡; ✅ only on conviction/heat in their own words. Add a paired worked example (logical-yes→🟡 vs emotional-yes→✅).
- **(c) Money = RESOURCES**: belief 5 records capacity/means learned in discovery ("has ~$10k savings; said 8k is a stretch but doable"), not merely the price reaction. Still NUMBER CONFIDENCE-gated.
- **(d) ▸ KEY ANCHORS (their exact words)** — EVOLVES the existing "THEIR EXACT WORDS" section (not a new one — avoids duplicate quote real estate). Per-belief-labeled verbatim quotes, max 8, update-in-place, later sharper statements supersede vaguer ones. Bar: "would a great closer remember this and use it later?" Capture the number + WHY that number, the final straw, who burned them, what they've tried/spent, hard deadlines, repeated themes. VERBATIM ONLY — never sharpen or invent (NUMBER CONFIDENCE applies inside quotes too: quote the hedged line as said, don't promote it to a fact line).
- **(e) ▸ COMMITMENTS** — new section, max 3 lines: micro-agreements + **conditional yeses** with the condition named (`• "if it gets me clients, cost isn't an issue" (conditional yes — condition: proof it works)`). Only PROSPECT-said agreements — the rep proposing ≠ the prospect agreeing. "none yet" when empty.
- **(f) ▸ MOMENTUM** — one line: `<leaning in|neutral|guarded> — <the observable signal>`. Signals: buying/logistics questions, future-pacing self ("when I start…"), answer length/energy shifts, pronoun shifts. Text-only proxy; never invent.
- **(g) Section order** (truncation safety): Stage → GAP → LADDER → KEY ANCHORS → COMMITMENTS → MOMENTUM → OPEN OBJECTIONS → WEAKEST LINK. WEAKEST LINK stays last (dig-prompt convention) — protected by the cap+slice raise, and the "fixed-size, never grows" rule now applies per-section (anchors 8 / commitments 3 hard caps).

### Eval traps to add (test-belief-ladder.mjs — all HARD unless noted)
1. **Relabel conformance** — output ladder/legend says "objected", never "at-risk".
2. **Polite-yes trap** — logical concession on Pain graded 🟡 not ✅.
3. **Emotional-yes trap** — heat/conviction statement graded ✅ (the inverse; stops over-conservatism).
4. **Regression trap** — a ✅ belief contradicted in new transcript must downgrade (RECENT OVERRIDES STALE).
5. **Anchor capture** — the goal number + its WHY + a burn quote present, verbatim, correctly belief-labeled.
6. **Anchor no-fabrication** — vague statement must NOT be sharpened into a specific; hedged number stays hedged inside the quote.
7. **Commitment capture** — a conditional yes recorded WITH its condition.
8. **Commitment no-invention** — rep-proposed agreement without prospect assent must NOT appear.
9. **Money-resources** — savings/capacity fact from discovery lands on belief 5.
10. **Qualification-open trap** — Support never touched → ⬜ at close (existing conservatism, re-asserted with new prompt).
11. **Size guard (advisory)** — output token count logged; flag if pinned at the new 1500 cap.
Existing gates kept: NUMBER CONFIDENCE, DNA fabrication dual-judge (Claude+GPT), belief inflation.

### Order of work + gates
1. Prompt rework (a–g) + cap raise → 2. sales-dna.mjs anchor specialization → 3. dig-prompt wording + kb-signal slice → 4. expand eval → 5. `node scripts/test-belief-ladder.mjs` GREEN (iterate prompt until) → 6. `node scripts/test-close-readiness.mjs` + full unit tests + typecheck GREEN → 7. **wingman-reviewer** on the diff → 8. present to Sebastian with test steps (incl. a real-call check of output size vs the 1500 cap — Known Issue #48 follow-through).

### Out of scope (stays queued)
Close-readiness weight audit (reads the summary — tune source first) · Sonnet 5 vs 4.6 A/B · emoji+word inline (optional #5) · card prompts LEARNING to cite anchors/commitments explicitly (let them inherit passively first; explicit instruction = a voice-grind follow-up) · prosody spike (Inbox note).

---

## HARDENING (2026-07-20) — plan-reviewer verdict applied (9 required changes)

plan-reviewer ran the full loop and returned NEEDS REVISION. All fixes below are folded into the build; the plan above is superseded where they conflict.

1. **HONEST COST NOTE:** the real cost is not the output-cap bump — the summary ~doubles and is read as INPUT by every ↑/↓/→ press, the answer/close/nudge slots (`knowledge-signal.ts` — was MISSING from the audit table; added), and the summarizer itself (feeds its own prior scorecard back every ~2-min tick). Bounded ONLY by the hard per-section caps (anchors ≤8, commitments ≤3). Fleet-wide, still cents per call on Sonnet — but say it, don't hide it.
2. **WEAKEST LINK guard = HARD:** every fixture asserts a non-empty WEAKEST LINK line in the output (it's the dig card's routing input and was the original truncation victim). Add one deliberately content-HEAVY fixture (rich anchors + commitments) proving it survives at the 1500 cap. Trap #11 promoted from advisory to hard.
3. **MULTI-TICK ROLLING FIXTURE (new, HARD — the redesign's core risk):** roll ≥8 chunks of one call through the gate and assert (a) an early-call emotional anchor ("final straw" quote from tick 1–2) still present after the last tick; (b) anchors ≤8 / commitments ≤3 at EVERY tick; (c) a superseded vague anchor is gone once the sharper version lands. The current gate is single-shot; update-in-place retention was previously verified by NOTHING.
4. **CLOSE-READINESS COUPLING — surfaced, needs Sebastian's ruling:** the emotional-ownership ✅ bar makes Pain/Cost/Desire harder to lock → the chip gets STRICTER (stays "Continue Discovery" where it used to say "Ready to Pitch") without its code changing. RECOMMENDATION: this is the intended Cole doctrine (unbuilt belief = latent objection — don't pitch); accept the stricter chip + add a fixture documenting the new expected direction. The full close-readiness weight audit stays queued but the DIRECTION is ruled on now, not silently shipped.
5. **DNA boundary = HARD CONSTRAINT:** the anchor-specialization paragraph lives ONLY in `buildSummarizerDnaSystemBlock` — NEVER in the shared `buildSalesDnaBlock` (that's the dig card's cached prefix + warm-at-deploy prime; touching it silently invalidates the prompt cache → full-price billing on every dig press). Plus a dedicated DNA fixture: offer strongly implying a number + vague transcript → anchor quote stays vague, no offer-shaped specific (string assert + both judges).
6. **SECTION LINE FORMAT (load-bearing, now specified):** every KEY ANCHORS / COMMITMENTS line starts with `•` and NEVER with a digit 1–7 (a `5 Money: "…"` anchor would be misparsed as the Money belief row by close-readiness; non-`•` lines lose the number-confidence quote exemption in the existing gate). Gate assert: no anchor/commitment line matches /^\s*[1-7]\s/.
7. **GATE LIST EXPANDED:** because `dig-prompt.mjs` bytes change, run the dig eval + `confrontation-eval.mjs` too, and update `dig-eval-corpus.mjs` section headers ("THEIR EXACT WORDS" → the new name) in the SAME change — the dig prompt will instruct the model to read a section by name; fixtures must contain it. (`confrontation-eval` byte-gate reads the live constant, so it survives — the behavioral dig eval is the point.)
8. **SUMMARIZER-FREEZE PROTECTION (worst silent failure):** `summarize/route.ts:68` 400-rejects `current_summary` > 10k chars → one bloat bug would freeze the scorecard for the REST OF THE CALL (every card reads stale state, no error shown). Change to degrade-not-brick: raise the guard with clear margin AND/OR truncate-tail-preserving-structure instead of rejecting; log a size warning so a freeze is observable. (+ file #6: `src/app/api/wingman/summarize/route.ts`.)
9. **DE-FLAKE THE JUDGMENT TRAPS:** emotional-vs-logical fixtures written FAR from the boundary (unmistakably flat vs unmistakably hot), best-of-3 majority if still flaky. NEW HARD trap: momentum-fabrication — sparse/flat transcript → `neutral`, never an invented "leaning in".

**Files touched is now 6** (adds `summarize/route.ts` guard change; `knowledge-signal.ts` added to audit table as passive consumer, no edit).

**Open decisions for Sebastian (pre-build):**
- A. Stricter close-readiness chip = intended? (Recommended: YES — it's the Cole thesis.)
- B. Cap raise 1200→1500 + fleet-wide input increase = accepted? (Recommended: YES — cents/call, and the alternative starves the brain.) Known Issue #48's "tighten don't raise" discipline is consciously overridden here because we're ADDING sections, not fixing bloat; the real-call size check (step 8) still applies.
