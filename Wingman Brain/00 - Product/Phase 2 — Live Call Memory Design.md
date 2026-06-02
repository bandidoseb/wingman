# Phase 2 — Live Call Memory Design (LOCKED 2026-06-02)

**Status:** Design locked. Not yet built. This is the canonical spec for Phase 2 of the hotkey model.
**Supersedes:** the scout-based parts of the Hotkey Model Build Plan's Phase 2. Read this doc as the source of truth for the live call memory; the build plan's phase order still stands.
**Context:** Worked through live with Sebastian over a long design session. Every decision below was reasoned to the ground and simplified deliberately.

---

## The essence in one paragraph

During a call, a smart AI (Haiku) keeps a short, living **summary of the call** — a fill-in-the-blanks "Belief Ladder" form. It updates that summary **on a timer** by reading only the new transcript since last time. When the rep **presses an arrow**, ONE fast AI call generates the card from two inputs: the pre-digested summary (the whole call's story) + the **live last ~90 seconds** (word-for-word). A hard rule tells the model the recent words win if they ever disagree with the summary. That's the entire mechanism. No autonomous pop-ups, no scout, no constant AI burn.

---

## The two layers of memory (this is the whole model)

| Layer | What it holds | How fresh | Job |
|-------|---------------|-----------|-----|
| **Rolling summary** (Belief Ladder) | The whole call's story, compressed | Updated on a timer (~every 2 min) | Long-term memory — remembers what was said 30 min ago |
| **Live buffer** | Raw last ~90 seconds, word-for-word | Always current (sent at press time) | Short-term memory — what *just* happened |

The two cover different time horizons. Recent stuff is never stale because the raw buffer is sent live on every press. The summary's only job is the older stuff that's fallen out of the 90s window.

---

## The card generation = ONE fast call (speed + correctness solved together)

When the rep presses an arrow:

1. One Haiku call goes out carrying: **the picked action + the pre-digested summary + the live ~90s buffer + (retrieved KB techniques as examples)**.
2. A hard instruction sets the precedence:
   > **RECENT TRANSCRIPT (last ~90s, word-for-word) = the most current truth. It OVERRIDES the summary on any conflict.**
   > **ROLLING SUMMARY = use for what's not in the recent transcript.**
3. Card comes back. One inference. Fast.

**Why this is the design:**
- **Speed:** the model reads a tiny summary + short clip, not the whole call. The expensive "understand everything" work was already done in the background. → fast.
- **Correctness (the conflict case):** if a belief was locked in the last 60s but the summary lags, the model sees it in the raw clip and trusts the clip. No wrong card. This is a **prompt-design requirement, not an accident** — without the precedence rule, Haiku may over-trust the tidy summary over messy transcript. Lock the rule in.
- **No two-step penalty:** we do NOT "summarize then generate" on press (that would double the wait). Freshness comes from the buffer being *inside* the one generation call.

---

## The summary updater (the background job)

- **Trigger:** a timer. Update at most once per ~60s, and at least once per ~2 min. (No scout — see below.)
- **Mechanism:** Haiku call. Input = **[current summary] + [only the new transcript since last update]**. Output = updated summary. It does NOT re-read the whole call — the current summary is the running compression of everything older. That's what keeps it cheap.
- **Cost is bounded:** rate-limited to at most ~once/minute → at most ~60 tiny updates/hour → pennies. Cannot run away.
- **Vercel-safe (important):** the timer is **client-triggered** — the rep's app pings a `/summarize` endpoint every ~2 min; each call is one short job that finishes immediately. This works on Railway today AND on Vercel later (serverless kills long-lived server-side timers). Build it this way from day one so the Vercel migration needs zero rework here.

---

## Scout = CUT for v1

The "scout" (demoting `keyword-triggers.ts` to a silent tagger) is **removed from v1.**

- **What the scout was:** a hardcoded list of ~9 phrase groups in code, checked with simple text-matching (like Ctrl+F). Not AI, not trained, no database. Its only proposed job was to trigger summary updates *faster* when a known phrase hit.
- **Why we cut it:** it's a *responsiveness* optimization, not load-bearing. The summary already stays fresh on the timer, and the live buffer already covers recency at press time. The scout added mental + build complexity for marginal benefit.
- **When to revisit:** only if, on real calls, the ~2 min summary lag ever causes a visibly stale card (unlikely, because the live buffer covers the recent window). If so, re-add it then. Parked, not deleted from the idea space.
- **Note:** the current autonomous keyword *cards* are removed regardless (the hotkey model fires nothing unsummoned). `keyword-triggers.ts` becomes dormant/removable in cleanup.

---

## The Belief Ladder template (the "LIVE CALL MEMORY" form)

This is the single template Haiku fills in by reading the transcript. There is only ONE template — it holds both the belief map AND the rich human detail (emotional anchors, exact words). It is NOT two files, and NOT a code list of situations — it's a fill-in-the-blanks form; the intelligence is in Haiku.

```
LIVE CALL MEMORY
Stage: <stage> · Elapsed: <m>m · Syntax: <problems-first | goals-first>
▸ THE GAP (the engine of the sale)
  Current "hell":  <where they are now — numbers + specifics>
  Desired "heaven": <what they want> · $GOAL <number> · why that #: <reason>
  Final straw / emotional why: <their line-in-the-sand moment>
  Core driver: <Certainty | Significance | Growth | Variety | Connection | Contribution>
▸ BELIEF LADDER  (✅ locked · 🟡 partial · ⬜ open · ⚠️ at-risk/objection)
  1 Pain            <state> — <one-line evidence>
  2 Doubt (can't DIY) <state> — <…>
  3 Cost (of inaction / why now) <state> — <…>
  4 Desire          <state> — <…>
  5 Money           <state> — <resources? willingness?>
  6 Support         <state> — <who else decides / spouse>
  7 Trust (why you) <state> — <vs past attempts>
▸ THEIR EXACT WORDS  (verbatim, for tie-downs)
  • "<quote>"
  • "<quote>"
▸ OPEN OBJECTIONS: <none | money / spouse / think-about-it … + handled?>
▸ WEAKEST LINK → <the belief(s) to shore up before closing>
```

**The 7 beliefs map to Wingman's existing 7 pillars:** Pain=core_problem · Doubt=cant_diy · Cost=cost_of_waiting · Desire=dream_outcome · Money=investment_readiness · Support=whos_involved · Trust=why_you.

**WEAKEST LINK** gives the "what am I missing?" framework-check for free — no separate feature needed.

### The "Syntax" line — auto-detected, NOT a dashboard setting
`problems-first` vs `goals-first` describes the order the rep runs the call (pain-first vs dream-first). It is **auto-detected by Haiku** from the transcript — just another blank it fills. It is explicitly **NOT** a rep-configured setting (that would violate "Wingman learns silently, the rep never configures it"). It's the least important line — keep it as a free auto-tag, or cut it with near-zero loss (the summary already holds both pain and goal).

---

## Prompt caching plan

**Cache (stable for the whole call):** the system prompt (rules, card format, the recent-wins precedence rule) + the offer / Sales DNA / rep profile (loaded once at call start).

**Do NOT cache (changes every press):** the live ~90s buffer, the current summary, the KB techniques retrieved for that specific press, the picked action.

- **TTL = 1 hour** (not the 5-min default). Presses can be 20+ min apart; the 5-min cache would expire between them and silently re-charge full price. The 1-hour cache survives the whole call.
- **Warm at call start:** fire a tiny request when the call begins so even the first press is fast/cheap.
- **Keep-warm (Sebastian's idea):** a background ping every ~50 min re-warms the cache before the 1-hour TTL expires, so it never goes cold mid-call even on a 90-min call. One tiny request; basically free. (Presses also reset the TTL, so keep-warm only actually fires during long quiet stretches — exactly the gap it's meant to cover.)

### ⚠️ CRITICAL caveat — verify the cached block clears the minimum size
Anthropic only caches a block above a minimum token count (~1–2k depending on model). If our stable block is under it, **caching silently does nothing and we pay full price every time.** This must be verified at build time — NOT assumed.
- **Good news — it's measurable, not silent on our end:** the API response reports `cache_creation_input_tokens` and `cache_read_input_tokens`. Run one test call, read those numbers, confirm the cache actually engaged. If zero, pad/restructure the stable block to clear the minimum. **Flag this loudly in the caching build task.**

---

## Speculative pre-generation — DEFERRED (back-pocket lever)

Idea: since we know an objection just landed, pre-generate the likely card *before* the rep presses, so it's instant (0 wait).
- **Deferred** because it means paying to generate cards that may never be summoned, and we haven't measured that press-time latency is actually a problem.
- **Pull this lever only if** (a) real calls feel laggy AND (b) margins are healthy enough to spend a few % to buy speed. Sebastian's framing: "if speed is decent and margins are really high and we can lose ~5% margin to make it quicker, maybe we consider it."
- Parked, identified, ready if needed.

---

## Speed / Intelligence / Cost — the scorecard

- **Speed:** one light call at press time (tiny summary + short clip), heavy work pre-done in the background. ~1s for a freshly generated line. Pre-gen in reserve if we need faster.
- **Intelligence:** every card sees the whole call (summary) + the live moment (buffer), reconciled with recent-wins. Grounded in the prospect's exact words. Rich human context (emotional anchors, the gap, the why).
- **Cost:** no always-on AI. Background summary updates are rate-bounded pennies. Press-time calls only when the rep asks (a few/call). Clean call ≈ near-zero live AI. Dominant cost stays Recall.ai (~$0.50/hr). This is what makes unlimited calls at $149/mo viable.

---

## What this means for the phased build

- **Phase 2 simplifies:** build the timer-driven summary updater (client-triggered, Vercel-safe, rate-bounded) + the Belief Ladder template/system-prompt. **No scout.**
- **Phase 3+ unchanged in shape:** the press → single-call generation with recent-wins precedence; caching + warm + keep-warm folded into the generation/session work.
- **Caching caveat** must be an explicit checklist item with the measure-the-token-counts verification.
