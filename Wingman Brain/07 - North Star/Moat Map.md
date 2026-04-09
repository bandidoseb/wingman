# Moat Map

Last updated: 2026-04-02

An explicit map of Wingman's defensibility over time. Competitive advantage isn't binary — it builds or decays. This file tracks what we're building that gets harder to replicate over time.

---

## The Current Moat (Day 1)

**The Offer Brain.**

Every Wingman user has an Offer Brain — a JSON object that grows smarter with every call. After 30 calls, it knows:
- The specific offer being sold (price, delivery, positioning)
- The archetypes of prospects who typically appear
- The top 5 objections and what worked to handle each
- The price reveal patterns this prospect base shows
- The average timing from intro to close

A competitor can clone the UI. They can build a real-time overlay. They can even use the same RAG architecture. But they cannot clone 30 calls of learned context about this specific rep and this specific offer. That context is Wingman's and the rep's — built together over time.

**Switching cost:** A rep who has been using Wingman for 60 calls and then switches to a competitor starts with a blank Offer Brain. Every signal card they get from the competitor is generic. Their Wingman cards were personalized. The difference is immediately felt.

---

## The Moat at 100 Users

At 100 users, Wingman has collective intelligence across:
- Multiple offer types (fitness, investing, biz op, land)
- Multiple sales styles (aggressive close, consultative, NEPQ)
- Multiple prospect archetypes

**New moat layer: cross-user pattern detection.**

If 80% of closers selling fitness coaching programs get "I need to think about it" at the moment of price reveal, and Wingman sees this pattern across 100 users, it can weight signal cards for that trigger heavier for a new fitness closer from day 1 — before their Offer Brain has any data.

**This requires a product decision:** Does the Offer Brain learn only from the individual user, or from all users in similar categories? This is the cross-user intelligence question. If we go there, the moat deepens significantly.

---

## The Moat at 1,000 Users

At 1,000 users, Wingman has:
- Tens of thousands of signal card data points (trigger → card → outcome)
- Close rate data correlated with which cards fired vs which were dismissed
- Objection handling pattern data across every common offer type

**New moat layer: outcome-correlated coaching.**

Which signal cards actually lead to closes? Which are dismissed? Which are used but don't help? At 1,000 users, this data exists and can be used to:
1. Rank KB entries by effectiveness (not just semantic similarity)
2. Weight signal card generation toward patterns that have historically preceded closes
3. Flag KB entries that generate cards but no positive outcomes (bad content)

**This is a true data moat.** A competitor starting from zero in year 2 can't replicate a dataset of thousands of calls with close outcome correlation.

---

## What Threatens the Moat

1. **A well-funded competitor builds the same thing faster.** Risk: Medium. The RAG + Recall.ai architecture isn't secret. A well-capitalized team could build a similar product in 6 months. Counter: First-mover in this specific community matters. If Wingman owns the Cole Gordon / Closers.io relationship, the community's trust becomes the moat.

2. **Recall.ai gets acquired or pivots.** Risk: Low-Medium. If Recall.ai changes its SDK or pricing dramatically, the entire live audio layer is at risk. Counter: Monitor Recall.ai's trajectory. The relationship with them is strategic, not just technical.

3. **LLMs get so good that generic coaching becomes as good as personalized coaching.** Risk: Low near-term, Medium long-term. If Claude or GPT-5 is so capable that even a zero-context signal card is as good as an Offer Brain-enhanced one, the personalization moat weakens. Counter: The Offer Brain isn't just improving generic coaching — it's using the rep's own history as evidence. That's a different trust signal than generic AI advice, regardless of model capability.

4. **The closer community doesn't have enough supply.** Risk: Low. There are hundreds of thousands of high-ticket closers in the US alone. The beachhead is Cole Gordon's network, not the entire market.

5. **Reps don't trust AI in their ear.** Risk: Medium. If closers fundamentally don't believe AI coaching improves their performance, no amount of engineering solves it. Counter: The product must produce a clear, attributable win early (the aha moment). If a rep can say "Wingman told me to go silent and I closed a $5k deal," the trust problem solves itself.

---

## What We're Building That Gets Harder to Replicate

| Asset | Today | At 100 Users | At 1,000 Users |
|-------|-------|-------------|----------------|
| Offer Brain data per user | Small | Meaningful | Deeply personalized |
| Cross-user pattern library | None | Early signal | Statistically significant |
| Close rate correlation data | None | None | Powerful |
| Community trust (Cole Gordon network) | Early | Established | Entrenched |
| KB quality (419 entries) | Good | Better (more ingestion) | Best |
| Brand recognition in closer community | Zero | Growing | Dominant |

---

## The Moat That Doesn't Depend on Scale

One moat that doesn't require user scale: **methodology alignment.**

Wingman is built specifically on the Cole Gordon / Jeremy Miner NEPQ / Alex Hormozi framework. The KB is built from content by these creators. The stage structure reflects their methodology. A closer trained by Cole Gordon picks up Wingman and it immediately speaks their language.

A generic AI coaching tool built by engineers who've never sold anything doesn't have this. It doesn't know that "the Press stage" is the most skipped stage. It doesn't know that "I need to think about it" almost always means there's an unstated objection. It doesn't know that going silent after price reveal is more powerful than defending the price.

This methodology depth is a moat that comes from knowledge and conviction, not just code.
