# Prospect Anchor Capture — in-call context for live cards (Design)

**Status:** DESIGN / VISION captured 2026-07-19 from a Sebastian rant. Not built. This is the "#4 context injection" track from the core-voice-rework session, expanded into its own feature. Needs its own build session (the summarizer-instruction design especially).

**One-line essence:** Wingman should silently remember every significant thing the prospect says across the whole call — the anchors an elite closer would hold in their head — and inject them into the live **dig** and **objection** cards, so the rep can run a great discovery without the background cognitive load of memorizing 10+ anchors and resurfacing them at the right moment.

---

## The problem it solves (Sebastian's framing)

A high-ticket discovery is 30–60 min of the rep asking tons of probing, chunk-down questions. But the elite closer is doing THREE things at once:
1. Asking excellent, present, well-timed questions.
2. Holding 10+ significant anchors in working memory (the goal number, *why* that number, how long they've been stuck, how close they've gotten, the final-straw moment, who burned them, what they've already spent/tried…).
3. Connecting those anchors back in later — mid-objection, mid-close — at the exact moment one wins the deal.

That background load is enormous and it **competes with being present**. Wingman's differentiated value: **take that load off the rep's mind.** Let the rep flow, be present, ask better questions — Wingman remembers the anchors and resurfaces the right one when it matters.

> "I want the sales rep to just go through their discovery… without the prospect [rep] having to take mental note of all these important anchor points… because Wingman can do that for the sales rep."

---

## How this differs from what we already have

| Layer | What it is | Scope | Already wired? |
|---|---|---|---|
| **Sales DNA** | The rep's OFFER (what it promises, the average prospect's archetype, what "quit my job" chunks down to for this offer) | Call-stable, same every call | Wired into the **dig** card only. NOT the objection card. |
| **Belief Ladder** (`calls.live_summary`) | The 7-belief scorecard — status of Pain/Doubt/Cost/Desire/Money/Support/Trust | This call, updated ~2 min | Wired into **both** dig + objection cards. |
| **Prospect Anchors** ← THIS FEATURE | The verbatim significant things THIS prospect said (their number, their why, their timeline, their burn) | This call, accumulated | ❌ Not captured, not injected. |
| **Cross-call Prospect Memory** (separate doc) | Carrying a *prior* call's context into a follow-up days later | Across calls | Separate design (`Call Continuity + Prospect Memory Design.md`) |

**Key insight:** Sales DNA is offer-level and generic. Anchors are THIS prospect, verbatim. The moat is both together — e.g. the money-anchor objection card should say *"money aside — do you honestly feel like this gets you to [their stated $30k, from anchors] / builds [the offer outcome, from Sales DNA]?"* Neither source alone produces that line.

---

## Where it plugs in (the plumbing is half-there)

The Belief-Ladder summary is ALREADY injected into both live cards. So the cleanest path is: **enhance the live summarizer to also emit an "IMPORTANT PROSPECT CONTEXT / ANCHORS" section inside the summary it already produces.** Then:
- The **dig** card already receives the summary → gets anchors for free.
- The **objection** card already receives the summary → gets anchors for free. (Also needs Sales DNA added — see #4.)
- **Answer** (←) and **Close** (→) cards: probably don't need anchors injected. Dig + objection are where anchors win deals.

So the build is mostly: (a) teach the summarizer WHAT to capture and how to write it, (b) make sure the objection card also gets Sales DNA, (c) manage the token budget.

---

## The anchor taxonomy — reverse-engineered from the 7 beliefs (+ beyond)

Sebastian couldn't enumerate every anchor up front (nobody can — it's judgment). So we reverse-engineer from the 7 beliefs a checklist of "things a great closer would remember," and instruct the summarizer to capture anything that clears that bar, verbatim where possible.

- **Pain** — what they currently do; why they hate it; how long they've been in it; the specific frustration; the final-straw / "enough is enough" moment.
- **Desire** — the goal in their words; the **specific number**; **why that number**; what hitting it changes (the dream); the timeline they want it by.
- **Cost (of inaction)** — how long they've been trying; how close they've gotten; what staying stuck has already cost (money, time, relationships, self-image).
- **Doubt (can't DIY)** — what they've already tried (courses, coaches, programs — by name if given); why it didn't work; how far it got them.
- **Money** — income now; what they've invested before; budget signals; who controls the money.
- **Support** — who else is in the decision; the relationship dynamic; prior "I need to ask ___" patterns.
- **Trust** — who/what burned them; the specific bad experience; what they said they'd need to feel safe.
- **Beyond the 7** — hard deadlines/events (a lease ending, a launch, a birthday, a baby coming); stakes they named (kids, health, a spouse's opinion of them); verbatim phrases with emotional charge; objections they pre-raised; anything they repeated (repetition = it matters to them).

**The bar (the instruction's north star):** *"Would a well-experienced closer remember this and use it later?"* If yes → capture it.

> ⚠️ **The taxonomy above is a SCAFFOLD, not a hardcoded checklist.** See "Per-rep tailoring" below — the specifics MUST bend to what each rep sells.

---

## Per-rep tailoring — CRITICAL (Sebastian, 2026-07-19)

The single biggest design constraint: **what counts as a significant anchor is sales-rep-specific.** We CANNOT hardcode "Desire = a number, look for the number." That's only true for some offers:
- **Business-opportunity / coaching** → Desire often IS a revenue number ($30k months), how long they've chased it, why.
- **Health / fitness** → Desire may be a **feeling or an image**, not a number (confidence, energy, fitting into something, being present for their kids) — the "number" (a weight) may or may not be the real anchor; the emotional outcome usually is.
- **Other offers** → the meaningful anchors shift again (a relationship outcome, a status outcome, a time-freedom outcome…).

If we instruct the summarizer generically ("find the number"), it will miss the real anchor for any rep whose offer isn't number-shaped — or worse, manufacture a number that isn't the point.

**The fix: parameterize the anchor instruction with the rep's Sales DNA.** We already capture what the rep sells, the offer, and what the average prospect's words chunk down to for that offer (that's exactly what Sales DNA is for). So the summarizer's "what to look out for" must be **specialized per rep from their Sales DNA** — Wingman reads the offer and *knows* whether Desire is a number, a feeling, a status, etc., and hunts for THAT. The 7-belief scaffold sets the categories; Sales DNA fills in what each category concretely looks like for THIS offer.

Implication: the anchor-capture instruction is **two-part** — a fixed 7-belief scaffold + a per-rep specialization derived from Sales DNA, injected at summarize time (Sales DNA is already loaded on the summarize tick — see `useWingmanPoller.ts` "reads the offer as an interpretive lens"). This also means anchor capture is genuinely gated by a good Sales DNA, same as the offer-aware cards.

---

## Summarizer-instruction design (the part that's its own session)

Open design questions to resolve in the build session:
- **WHAT to capture** — the taxonomy above, gated by the "a great closer would remember this" bar. Verbatim quotes preferred over paraphrase (tie-downs need their exact words).
- **WHERE to jot it** — a dedicated `IMPORTANT PROSPECT CONTEXT` section appended to the live summary (so it flows to cards automatically). Possibly a separate stored field if we want it queryable.
- **WHY / how to prioritize** — cap it (token budget ~??). Keep the highest-leverage anchors; a heavy number + its why beats ten trivia facts. Prioritize emotional + quantified anchors.
- **How it evolves over the call** — append-only vs. update-in-place; dedup; let later, sharper statements supersede vaguer earlier ones. Don't let it grow unbounded.
- **Verbatim safety** — same never-make-anything-up discipline as the cards: only capture what was actually said; never invent or sharpen a number.
- **Cost** — this runs on the ~2-min summarizer tick (already Sonnet); adding an anchors section is more output tokens per tick × every call. Budget it.
- **Eval** — extend `test-belief-ladder.mjs` to grade anchor capture (did it catch the number? the why? the burn?) — ties to the summarizer-tuning project.

---

## Why this is a big deal (product + positioning)

This is a **core differentiator vs. other sales-call tools.** Most tools transcribe or coach post-call. Wingman removing the *live cognitive load of anchor-tracking* — so the rep is more present and digs better in real time — is a value story that's hard to copy and easy to feel. Flagged for the **landing page** (see `Website Plan.md`) and the **content bank** (the cognitive-load-offload thesis).

---

## Sequencing
- Ties to **#4** (objection card needs Sales DNA) and the **summarizer-tuning** project (eval-gated summarizer changes).
- Prereq mindset: this changes the live summarizer, which feeds every card — so it goes through the plan-review loop + eval gate before shipping. A summarizer regression degrades every live card at once.
- Its own build session. This doc is the shape, not the spec.
