# Beta Tuning Parameters

These are educated guesses for v1 beta. None are set in stone. Everything in this file is a lever — it can be turned up or down based on what real call data shows. Each entry documents the current value, why we picked it, what to watch for, and how to change it.

---

## 1. Belief Ladder — Output Token Cap

| Field | Value |
|---|---|
| **Current value** | 600 tokens |
| **Changed from** | 400 (raised 2026-06-06) |
| **Code location** | `src/lib/wingman/belief-ladder.ts` → `BELIEF_LADDER_MAX_TOKENS` |

**Why we raised it:** Live call logs showed Sonnet outputting 397–400 tokens on almost every tick — it was hitting the ceiling. The end of the template (Open Objections, Weakest Link) was likely getting truncated. Weakest Link is the most important field for Phase 3 signal cards and can't be cut off.

**What to watch after a few live calls:** Check the `[summarize]` log lines for the `out=` value. If output is still consistently hitting 580–600, the cap is still too tight — raise to 700 or 800. If output settles at 450–500, we have enough room and can leave it.

**Cost per 100 extra tokens:** ~$0.003/call (17 ticks × 100 tok × $15/M Sonnet output rate).

---

## 2. Live Transcript Buffer (Phase 3 — Hotkey Signal Cards)

| Field | Value |
|---|---|
| **Current value (designed)** | 120 seconds of raw transcript |
| **Original spec value** | ~90 seconds |
| **Changed from** | 90s → 120s on 2026-06-06 |
| **Code location** | Not built yet — this is the Phase 3 buffer sent to `kb-signal` at hotkey press time |

**Why 120 seconds:** The original 90s design was a reasonable starting point, but real sales calls have long-winded prospects who take 2–3 minutes to make a single point. 120s (2 minutes) ensures the full exchange — rep's last move + prospect's full response — is captured verbatim. Beyond 2 minutes, the Belief Ladder scorecard (which updates every 2 minutes) already covers the older context in compressed form.

**What to watch after a few live calls:** Do signal cards feel like they're missing context about what the prospect just said? If yes, bump to 150–180 seconds. Do they feel irrelevant or unfocused? If yes, the buffer might be too long and diluting Haiku's attention — drop back to 90 seconds.

**This is a first-guess number. Treat it as adjustable.** The two-tier design (scorecard = full call history, live buffer = raw recency) means the buffer only needs to cover the gap since the last scorecard update. 120s is a safe middle ground for beta.

**Cost per extra 30 seconds of buffer:** Negligible. Haiku input is ~$0.80/M tokens. An extra 30s of speech ≈ 500 chars ≈ ~83 tokens × $0.000000800 = **$0.000066 per card press.** Not a cost lever — tune purely for quality.

---

## 3. Belief Ladder — Summarizer Cadence

| Field | Value |
|---|---|
| **Current value** | Every 120 seconds (2 minutes) |
| **Code location** | `src/hooks/useWingmanPoller.ts` → `SUMMARIZE_INTERVAL_MS` |

**Why 2 minutes:** Balances scorecard freshness against Sonnet cost. Too frequent = expensive. Too infrequent = scorecard is stale when the hotkey fires. 2 minutes was modeled to produce ~20–25¢/call on a typical 30–45 min call.

**What to watch:** If reps report that signal cards feel "behind" (the scorecard hasn't caught up to a key moment the prospect said 2.5 minutes ago), consider dropping to 90 seconds. Cost impact: +~35% per call (more ticks). If cost becomes a concern, push to 150 seconds.

---

## How to Use This File

After each batch of live calls, revisit the values above. If something feels off — cards are stale, missing context, or the scorecard is being cut short — this is the first place to look. Each entry has the code location and the cost impact so you can make the change in 30 seconds.

None of these are architectural decisions. They're dials.
