---
name: project-summarizer-tuning-session
description: "Queued dedicated session — hardcore test + tune the Belief Ladder summarizer to perfection (nuance traps, state transitions, Sonnet 5 vs 4.6 A/B)"
metadata: 
  node_type: memory
  type: project
  originSessionId: 856e19fd-d7ca-4b0b-b01b-dfd8d3b5d408
---

Sebastian wants a **dedicated future session** (deferred 2026-07-15, NOT now) to test the Belief Ladder **summarizer** hardcore and tune/polish it to perfection for the live-help use case. The summarizer (`src/lib/wingman/belief-ladder.ts`, model currently `claude-sonnet-4-6`, run by `executeSummarize` in `src/hooks/useWingmanPoller.ts`) is the shared running scoreboard that powers the **dig card** and the new **close-readiness chip** ([[project-close-readiness-chip]]) — so its grading accuracy is the quality backbone for both.

**Scope of that session (the game plan to build):**
- Expand `scripts/test-belief-ladder.mjs` with **tons of nuance traps** — especially: belief **state transitions across a long call** (e.g. Trust objection at min 20 → warming "okay that makes me feel better" at min 40 → should flip ⚠️→🟡/✅); soft/ambiguous politeness ("yeah I guess that makes sense") NOT over-credited to ✅; buried/in-passing objections that must still register ⚠️; stale status carried one cycle too long; rep-asserted-but-not-prospect-confirmed beliefs.
- Build a real game plan to **catch failures, tune the prompt, and polish** grading accuracy for this exact use case.
- **A/B Sonnet 5 (`claude-sonnet-5`) vs Sonnet 4.6 (`claude-sonnet-4-6`)** on those traps — accuracy + cost + latency. Do NOT swap the model blindly: the current prompt was calibrated to 4.6 (locked 2026-06-05 after a 5-trap test), so a new model can regress cases 4.6 nails. The prompt + model are tuned as a pair. Ties into model-resilience #44.

**Build a bulletproof model-UPGRADE process (Sebastian 2026-07-15, explicit):** do NOT lock the summarizer permanently to Sonnet 4.6. Newer/better models ship constantly (expect ~10–20% gains/year), and we must be able to graduate/transfer/upgrade to them cleanly — not stay frozen on one model. The session must produce a REPEATABLE process, not a one-off swap: (1) the nuance-trap eval becomes the standing acceptance gate any candidate model must pass/beat before promotion; (2) a single source-of-truth model registry so a swap is one config change, not a code hunt (ties into Known Issue #44 model-resilience + the [[project-owner-dashboard]] model registry); (3) a deprecation canary (Anthropic Models API) so we're never surprised by a retired model; (4) an A/B/regression step (candidate vs incumbent on the full trap set: accuracy + cost + latency) before flipping. Goal: upgrading models is a routine, low-risk, evidence-gated procedure we can run whenever a better model lands — for the summarizer first, then generalize to every slot.

**Why:** the summarizer is judgment (an LLM), not a database — excellent on clear language, imperfect on ambiguous language. Sebastian's #1 product fear is mediocre/"mid" output; belief-grading accuracy is upstream of it. And model quality compounds over time — being unable to adopt better models cheaply is a slow-bleed competitive loss.

**How to apply:** this is DECOUPLED from building the close-readiness chip — the chip can ship on the CURRENT summarizer now (its conservative design tolerates imperfection: only exact ✅ = locked, any ⚠️ blocks green, under-crediting is harmless; and it's the same summarizer the dig card already ships on). This tuning session improves the dig card AND the readiness chip together, later. Don't block the chip on it.

**Scorecard-design notes (Sebastian QA 2026-07-19, from the flow-grind context):**
- **Money line should capture RESOURCES, not just the price reaction.** Belief 5 (Money) = means/capacity. The summarizer should record what discovery learned about their ability to invest ("has some savings, said $8k is a stretch but doable") — not only "flinched at $8k." Ties to [[project-prospect-anchor-capture]] (money-resource anchor) + the money-qualifier naming (capital they HAVE vs income they WANT). Consider adding to the belief-ladder prompt: for Money, note the resource/budget signal when surfaced.
- **Emoji+word hardening (optional):** ladder status words (locked/partial/open/at-risk) live only in the legend; each line shows just the emoji + evidence. Model reads emojis fine (tokens + legend + evidence text), but repeating the word inline ("⚠️ at-risk — …") would remove all ambiguity. Low priority.
- **Weakest-link ordering is ⚠️ at-risk → ⬜ open → 🟡 partial (already correct in the prompt).** Coaching insight worth surfacing: an ⬜ open belief at the CLOSE stage (e.g. Support never discussed) is a real discovery GAP — it ranks after a live objection but should not be silently skipped (a flow-batch fixture had skipped it).

**Close-readiness audit (Sebastian 2026-07-19 — the Cole "unlocked = latent objection" thesis):** every belief not ✅-locked in discovery is a LATENT objection that fires at the close (⬜/🟡 aren't neutral). Keep the 4 belief states (they drive dig-vs-handle), but AUDIT whether `close-readiness.mjs` weights ⬜/🟡 beliefs as hard as Cole would — the chip should tell the rep "you have N unbuilt beliefs, do NOT pitch/drop price yet," especially for QUALIFICATION beliefs (Support/Money). Full framing in `Wingman Brain/00 - Product/Objection Flow — Doctrine + Cole-Jeremy Lens.md` open-Q#4/#5.

**Belief-state labels — Cole-lens audit (Sebastian asked me to consult as Cole Gordon, 2026-07-19). Proposed refinements for THIS session (all touch the gated belief-ladder prompt → must re-run test-belief-ladder.mjs green):**
1. **KEEP all 4 states** (✅ locked / 🟡 partial / ⬜ open / ⚠️). 3 build-tiers + 1 resistance is the right granularity — they encode what to DO (build vs handle vs lean vs close). Do NOT add a 5th build-tier (over-instrumenting → unreliable grading). Do NOT remove.
2. **RELABEL ⚠️ "at-risk/objection" → "objected" / "contested" / "resisting."** Since unlocked = LATENT objection (⬜/🟡 are also "at risk"), calling only the pushed-back one "at-risk" is ambiguous — it reads predictive when it's reactive (already FIRED). New framing: ⬜/🟡 = loaded-not-fired (build); ⚠️ objected = fired (handle). This is the highest-value label fix.
3. **(optional) ⬜ "open" → "unbuilt"** — carries the latent-objection urgency better ("open" sounds neutral). Polish, not essential.
4. **Raise the ✅ bar to EMOTIONAL ownership on the emotion beliefs (Pain, Desire, Cost)** — don't lock ✅ on a logical concession ("yeah I should fix this"); lock it when said with conviction/heat. Not a new state — a stricter grading bar on those 3 beliefs. (People buy emotionally, justify logically.)
5. **PROTECT the ✅ = prospect-affirmed-in-their-own-words bar** (rep asserting ≠ locked). This is the load-bearing correctness of the whole scorecard — never weaken it.
