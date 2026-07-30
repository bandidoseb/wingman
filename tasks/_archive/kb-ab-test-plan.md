# KB A/B Test — Does the Knowledge Base earn its place in the live card?

## The question
When the rep presses ↑ on a real objection, is the KB-retrieved card actually BETTER
than a card where Claude just reasons it out (optionally "in the style of" a named
closer)? If it's not clearly better, cut the KB from the live press path.

## The arms
Same objection, same transcript context, same model (Haiku), same token budget.
The ONLY thing that changes between arms is the prompt / whether the KB is used.

- **A — KB (status quo):** real `searchKnowledge` → `generateSignalCard`. Forced to
  compress the retrieved script ("base your headline directly on that script").
- **B — Free reasoning (status-quo fallback):** real `generateFallbackCard`. No KB.
  Claude reasons, grounded in the distilled objection.
- **C — "Like Jeremy Miner / NEPQ":** no KB. Prompt tells Claude to channel the
  methodology. [included if selected]
- **D — "Like Cole Gordon":** no KB. Same idea, different closer. [included if selected]

## Why it's a fair test
- Every arm gets the IDENTICAL transcript chunk + context. The objection is the constant.
- A & B call the REAL production functions — this tests reality, not a reimplementation.
  C/D mirror B's exact scaffolding (same model, max_tokens, system prompt) and add only
  the "like [expert]" instruction. **Live code is not touched.**
- Grading is BLIND: cards shown in randomized order per objection, no labels, KB entry
  hidden until after grading.
- The KB only "counts" when it actually fires (similarity >= 0.60). The harness reports
  hit/miss per objection, so grading focuses on the hits — the only cases where the KB
  changes the card at all.

## Directly answers the "there could be shit in the 419 entries" fear
At REVEAL (after you've graded), for every KB hit the harness prints the matched
technique name, its similarity score, and the actual retrieved script. You see exactly
which entries are firing for common objections. The worst offenders surface themselves —
no need to read all 419 by hand.

## Steps
1. Build a corpus of 18 realistic objection scenarios (objection + ~120s lead-up
   transcript + short context line). Source per your pick below. You review before we run.
2. Build `scripts/kb-ab-test.ts` — runs every arm per scenario through the real code
   paths, captures card + latency + KB hit/entry, writes a blind grading sheet and a
   hidden answer key.
3. You grade blind (pick the best card per objection — takes ~15 min).
4. I reveal: tally wins per arm, break down by objection type, show the KB entries that
   fired, and give a flat recommendation — keep the KB / cut it / cut it and replace with
   the expert-prompt approach.

## Blast radius
- Touches NO live code. New files only: corpus, `scripts/kb-ab-test.ts`, output files
  under `tasks/kb-ab-test/`. Zero production risk.
- Cost: ~18 x (1 Groq distill + 1 embed + 3-4 Haiku calls) ~= a few cents total.

## Decisions needed before I build (asking now)
1. Objection source: I draft (you review) vs you provide real ones.
2. Expert arm: Jeremy Miner / Cole Gordon / both.
