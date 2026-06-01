# JEPA Intelligence Upgrades

Created: 2026-05-05  
Source: Yann LeCun JEPA video (37 min) — transcript reviewed with Claude  
Status: Planned — not yet built

---

## Why This Matters

LeCun's core insight in JEPA: **don't predict in raw space when you can predict in abstract representation space.** The canonical example is a dashcam generative model wasting 80% of its capacity predicting the random motion of leaves on trees — noise that is technically unpredictable and totally irrelevant to driving.

Wingman has the same problem in three places. These upgrades fix them.

---

## Upgrade 1 — Semantic Embedding Trigger Detection

**Problem:** `keyword-triggers.ts` matches literal phrases. It catches "too expensive" but misses "the investment feels steep for where we're at right now." Any paraphrase of an objection that doesn't contain the exact keyword is a miss. Every miss is a signal card that never fired.

**Fix:** Replace (or augment) keyword matching with cosine similarity against a library of objection prototype embeddings.

How it works:
1. Define ~15–20 "objection prototype" phrases — one canonical phrase per objection type (price, think about it, need to talk to partner, not the right time, etc.)
2. Pre-embed all prototypes with `text-embedding-3-small` at startup — store in memory
3. On each new transcript chunk, embed the chunk (one API call, ~$0.00000002)
4. Compute cosine similarity against all prototype embeddings
5. If any similarity score exceeds threshold (suggested: 0.72), fire that trigger type

**File to change:** `src/lib/wingman/keyword-triggers.ts`

**Cost impact:** Adds one embedding call per chunk (~fractions of a cent). Saves Haiku calls by improving precision — fewer false negatives means the KB search fires on real moments, not just literal keyword matches.

**Expected improvement:** Catches paraphrased objections. In high-ticket sales, "too expensive" is the least common way a price objection gets expressed.

**Do not attempt alongside Upgrade 2 or 3 — separate session.**

---

## Upgrade 2 — Token Redundancy Reduction

**Problem:** Wingman's ~1,300 token prompt budget is being wasted on:
- Filler transcript content ("yeah," "right," "mm-hmm," "uh," "um") — adds token count, zero signal
- Redundant context between system prompt and Offer Brain (both describe the offer and the rep)
- KB results that are only 60% relevant padding the prompt

**Fix:** Two independent sub-fixes:

**Sub-fix A — Strip transcript filler before sending to Claude:**
- Before embedding or sending a transcript chunk, run a lightweight regex strip on common filler words and short affirmations
- Target: reduce chunk token count by ~15–20% with zero information loss

**Sub-fix B — Audit system prompt + Offer Brain for duplication:**
- Read both `system-prompt.ts` and the Offer Brain JSON format side by side
- Identify any field that appears in both (offer description, rep name, etc.)
- Remove from whichever source is lower priority (usually system prompt)
- Target: save ~100–150 tokens per call, compounding across every single Haiku and Sonnet call

**Files to change:** `src/lib/wingman/system-prompt.ts`, `src/hooks/useWingmanPoller.ts` (chunk prep)

**Cost impact:** Direct, predictable. Every token saved compounds across every inference call. At current architecture (~444 calls per Haiku call), even 150 tokens saved = meaningful reduction.

**Do not attempt alongside Upgrade 1 or 3 — separate session.**

---

## Upgrade 3 — Session Memory as Lightweight Next-State Predictor

**Problem:** Wingman's KB search is reactive — it fires after an objection is already spoken. By the time the signal card appears, the rep may have already started fumbling a response.

**JEPA insight applied:** A world model predicts the *next state* given the *current state + action*. Applied to a sales call: given the current call stage + the last 2–3 prospect responses, we can predict which objection type is *most likely coming next* and pre-warm the KB search before it lands.

**Fix:**
1. Track last 2–3 prospect utterances + current stage in session memory
2. After each chunk, run a lightweight "what's likely coming next?" classification — either a small Claude Haiku call or a pattern-based heuristic (if stage = Close and prospect just said "I need to think about it," pre-fetch price objection KB entries)
3. Store the pre-fetched KB results in session state
4. When the actual trigger fires, the KB results are already ready — signal card latency drops

**Files to change:** `src/app/api/wingman/session/route.ts`, `src/hooks/useWingmanPoller.ts`, `src/lib/wingman/knowledge-search.ts`

**Cost impact:** Small additional Haiku call or heuristic per chunk. Offset by: (a) faster signal card delivery, (b) potential reduction in redundant KB calls when the same objection type fires twice in sequence.

**Latency impact:** Signal card delivery goes from reactive (~480ms after trigger) to near-instant (KB results already cached).

**Do not attempt alongside Upgrade 1 or 2 — separate session.**

---

## Implementation Order

1. **Upgrade 2 first** — lowest risk, no architectural change, directly measurable cost reduction. Can verify via token count before/after.
2. **Upgrade 1 second** — replaces a single file, testable with the transcript tester tool before going live.
3. **Upgrade 3 last** — highest complexity, touches session state and polling architecture. Do after Pusher migration is stable and tested.

---

## What These Won't Do

- They will not replace Claude Haiku or Sonnet. These upgrades make the pipeline smarter *around* the LLM calls — better inputs, less waste, earlier retrieval.
- They are not a JEPA implementation. JEPA is a training architecture for physical world models. These are the *philosophy* of JEPA (predict in abstract space, reduce noise, anticipate next state) applied to a language pipeline.
- They will not fix signal card quality problems. Quality issues are a KB and prompt problem — separate work.

---

## Notes

- Do not attempt all three in one session. Each is a standalone improvement with testable output.
- Before building Upgrade 1, source one week of production logs to understand current false-negative rate on keyword triggers. That data will confirm whether this is a 5% improvement or a 30% improvement.
- Before building Upgrade 3, confirm Pusher migration is fully tested live (Current Sprint item 0b).
