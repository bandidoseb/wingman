---
date: 2026-06-12
status: idea — save for later (needs a solid developer + real scale)
priority: low now (zero users) → phenomenal at 1,000+ users
---

# Future Build: App-Wide Cross-User Objection Cache

## The Idea (Sebastian, 2026-06-12)
Objections are universal across high-ticket sales — "too expensive," "need to think about it," "talk to my spouse" get said on every rep's calls. So instead of every rep paying to embed/search the same objection over and over, keep **one app-wide shared cache** keyed by the distilled objection phrase:
- Cache `distilled objection phrase → embedding` (and, since the KB is global, `→ KB search result` too).
- The **first** rep anywhere to hit a given objection pays the cost; **every rep after that, fleet-wide, gets it for free (≈0ms)**.
- Use **PostHog** (roadmap item 0c) to measure the *real* most-common objections from actual usage → keep a rolling top-~100 permanently warm.

## Why It's Deferred (the honest reason)
- **It only pays off at scale.** With 0–100 users the hit rate is near zero, so it does nothing yet. It becomes phenomenal at 1,000+ reps taking thousands of calls/day.
- **It's largely redundant with self-hosted embeddings** (which we ARE doing now). Local embedding is already ~10–50ms for everyone from user #1. A shared cache would shave that to ~0ms — an imperceptible ~30ms win — for the cost of Redis infra + cross-instance invalidation. Not worth it until scale makes the compute itself meaningful.
- So: self-host now (helps from user #1, no scale dependency); build this cache later, when there's a fleet to cache from and a developer to own the Redis layer.

## What It Would Require (when built)
- A shared store (Redis) — module-level in-memory won't work once Railway runs multiple instances.
- Cache key = the **distilled/normalized** objection (Groq output), never raw transcript (too variable to ever hit).
- Cache the **generic phrase → embedding/result** only. NOT who said it, NOT call content → it's generic sales language, not PII. Keeps it clean privacy-wise.
- PostHog event on every compass objection press logging the distilled phrase → frequency analytics → the rolling top-100 warm set.
- Invalidation hook when the KB is re-ingested (cached KB results go stale).

## Notes
- This is the *scaled* version of "precompute common objections." Same idea, powered by real fleet data instead of a hand-picked list.
- Do NOT build before there are enough users for a real hit rate. Self-hosted embeddings cover the latency need until then.
- Related: PostHog analytics (Current Sprint item 0c), self-hosted embeddings (the active embedding-latency work).
