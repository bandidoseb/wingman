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

## 4. Query Distiller — Model, Timeout, Output Cap (Phase 3.5)

| Field | Value |
|---|---|
| **Model** | Groq `llama-3.1-8b-instant` (upgrade path: `Llama 3.3 70B` only if 8B misreads real calls) |
| **Timeout** | 1,500 ms — on timeout the route degrades to the raw-chunk search (card still comes) |
| **Output cap** | `max_tokens: 100` + a 160-char phrase cap in the parser |
| **Code location** | `src/lib/wingman/query-distill.ts` (prompt + timeout) · tuning sandbox: `scripts/test-distill.mjs` |

**Why:** Locked 2026-06-11 via the offline harness — 5/5 on the pre-registered answer key (`scripts/test-transcripts/EXPECTED-DISTILL.md`), including the no-objection reverse trap and the hidden-objection judgment test. Measured 137–975 ms per distill (mostly 250–550 ms).

**What to watch:** the `[kb-signal] TIMING distill=` value and the `branch=` field. If `branch=raw-fallback` shows up often, Groq is timing out — raise the timeout or check Groq status. If reps get nudges when a real objection was live (false NONE), the prompt is too strict — tune in the harness FIRST, then lift the prompt verbatim into `query-distill.ts`.

**Cost:** ~$0.00002/press. Free tier covers beta.

**Scale plan (2026-06-11):** free tier = 30K tokens/min ≈ **~23 presses/min across ALL users** (one press ≈ 1.3K tokens). Breaks around 100–150 simultaneous live calls. **Flip to Groq's paid dev tier before beta scale** — orders-of-magnitude higher limits, ~$10/mo at 1,000 daily users. A rate-limited press already degrades gracefully (Groq 429 → raw search path → card still comes), so hitting the limit is invisible to reps. The 2026-06-11 dashboard spike to 71% was the offline tuning harness (30 calls in one minute), not live presses.

---

## 5. Distilled-Query KB Threshold (Phase 3.5)

| Field | Value |
|---|---|
| **Current value** | 0.60 (distilled queries only — the raw path keeps 0.65) |
| **Code location** | `src/app/api/wingman/kb-signal/route.ts` → `DISTILLED_SIMILARITY_THRESHOLD` |

**Why 0.60:** Probes on 2026-06-11 showed honest matches for distilled objection phrases landing at 0.60–0.75 while wrong-technique noise sat at ≤0.54. The old 0.65 guillotined real matches (partner objection 0.648, fear-of-follow-through 0.617). The distilled query has earned a lower bar because it only exists when Groq confirmed a real objection.

**What to watch:** cards built from an off-topic technique → raise to 0.62. Too many `branch=fallback-grounded` (KB misses on objections the KB clearly covers) → consider 0.57, but check the matched technique names in logs first.

---

## 6. Nudge Card — Haiku Pointer Timeout + Size (Phase 3.5)

| Field | Value |
|---|---|
| **Timeout** | 3,000 ms → on timeout the static text ships ("Nothing to handle in the last 2 min — keep going.") |
| **Output cap** | 60 tokens (lowered from 100 on 2026-06-11 — dev test showed 3/8 nudges hitting the 3s timeout; less streaming = fewer timeouts) |
| **Input** | last ~800 chars of transcript (~60s) — a one-sentence pointer doesn't need the full 120s buffer |
| **Code location** | `src/lib/wingman/knowledge-signal.ts` → `generateNudgeCard` |

**What to watch:** if pointers come back truncated/garbled (JSON cut off at 60 tokens → static fallback ships), nudge quality is degrading silently — check the `[generateNudgeCard]` parse-fail logs. If the pointer is consistently generic or slow even after this tune, drop the AI pointer entirely and ship static-only — the nudge's job is honesty, not brilliance.

---

## 7. Pipeline Warm-up + Connection-Cooling Probe (Phase 3.5 / #38)

| Field | Value |
|---|---|
| **Warm-up** | At call start: 1 embed ping → 1 pgvector RPC ping, 1 Haiku token, 1 Groq token (parallel, 4s timeouts, <$0.001/call) |
| **Code location** | `src/lib/wingman/pipeline-warmup.ts`, fired from `session/route.ts` POST |
| **Cooling probe** | `[kb-signal] TIMING ... idleGap=` — seconds since the user's previous press |

**The open question (Sebastian, 2026-06-11):** do long quiet stretches re-cool connections? **Measure before building.** If TIMING lines show high `total=` correlating with high `idleGap=` (e.g. presses after 20+ min idle are 2–3× slower), build the periodic keep-warm ping and set its interval just under the observed cooling threshold. Until the data says so, do NOT build it.

**Warm latency goal:** 1.5–2s press-to-card on 2nd+ presses. First press after warm-up may still run ~2.5–3s (Groq's first real completion etc.) — don't read one cold sample as failure.

---

## How to Use This File

After each batch of live calls, revisit the values above. If something feels off — cards are stale, missing context, or the scorecard is being cut short — this is the first place to look. Each entry has the code location and the cost impact so you can make the change in 30 seconds.

None of these are architectural decisions. They're dials.
