# Unit Economics

Last updated: 2026-04-02

Cost per user per month broken down by every variable component. This is the math behind the business.

---

## Key Assumptions (April 2026)

These assumptions drive the unit economics model. Update when real data is available.

| Assumption | Value | Confidence |
|-----------|-------|-----------|
| Subscription price | $149/month | Medium (not yet finalized) |
| Calls per working day (average) | 5 | Low (estimate) |
| Call duration (average) | 55 minutes | Low (estimate) |
| Working days per month | 20 | High |
| Signal cards per call (average) | 6 | Low (no live data yet) |
| Tokens per signal card prompt | ~1,300 | Medium |
| Tokens per signal card output | ~100 | Medium |
| Post-call transcript tokens | ~4,000 input + ~500 output | Low |

---

## Recall.ai Transcription Cost

**The biggest variable cost driver.**

```
5 calls/day × 55 min/call = 275 min/day
275 min/day × 20 days = 5,500 min/month
```

Recall.ai pricing: approximately $0.001–0.002 per recording minute (check current pricing in dashboard).

```
At $0.0015/min: 5,500 min × $0.0015 = $8.25/user/month
At $0.001/min: 5,500 min × $0.001 = $5.50/user/month
At $0.002/min: 5,500 min × $0.002 = $11.00/user/month
```

**Estimate: $5.50–$11.00/user/month for Recall.ai**

---

## Claude Haiku (Signal Cards)

```
6 cards/call × 5 calls/day × 20 days = 600 signal card generations/month
600 × 1,400 tokens (1,300 in + 100 out) = 840,000 tokens/month
```

Claude Haiku pricing (as of 2025): ~$0.25/million input tokens, ~$1.25/million output tokens

```
Input: 600 × 1,300 × $0.00000025 = $0.195
Output: 600 × 100 × $0.00000125 = $0.075
Total Haiku: ~$0.27/user/month
```

**Estimate: ~$0.27/user/month for Claude Haiku signal cards** (negligible)

---

## Claude Sonnet (Post-Call Analysis)

```
5 calls/day × 20 days = 100 post-call analyses/month
Each analysis: ~4,000 input tokens + ~500 output tokens
```

Claude Sonnet pricing: ~$3/million input tokens, ~$15/million output tokens

```
Input: 100 × 4,000 × $0.000003 = $1.20
Output: 100 × 500 × $0.000015 = $0.75
Total Sonnet: ~$1.95/user/month
```

**Estimate: ~$1.95/user/month for Claude Sonnet post-call analysis**

---

## OpenAI Embeddings (Runtime RAG)

```
600 signal card triggers/month
Each trigger: embed the trigger chunk (~150 tokens)
600 × 150 = 90,000 tokens/month
```

`text-embedding-3-small` pricing: $0.02/million tokens

```
90,000 × $0.00000002 = $0.0018/month
```

**Estimate: ~$0.002/user/month** (completely negligible)

---

## Infrastructure (Supabase + Railway)

At low user counts (<100 users), infrastructure is nearly fixed:
- Railway: ~$5–20/month total (not per-user meaningful)
- Supabase: $0–25/month total

At scale, per-user database costs become meaningful. At 100 users, add ~$0.20/user/month. At 500 users, revisit.

**Estimate: ~$0.20–0.50/user/month** (at early scale)

---

## Total Cost Per User Per Month

| Component | Low estimate | Average estimate | High estimate |
|-----------|-------------|-----------------|--------------|
| Recall.ai | $5.50 | $8.25 | $11.00 |
| Claude Haiku | $0.20 | $0.27 | $0.35 |
| Claude Sonnet | $1.50 | $1.95 | $2.50 |
| OpenAI embeddings | <$0.01 | <$0.01 | <$0.01 |
| Infrastructure | $0.20 | $0.35 | $0.50 |
| **Total** | **$7.41** | **$10.82** | **$14.36** |

---

## Margin Per User Per Month

| Scenario | Revenue | Cost | Gross Profit | Gross Margin |
|---------|---------|------|-------------|-------------|
| Low cost user | $149 | $7.41 | $141.59 | 95% |
| Average user | $149 | $10.82 | $138.18 | 93% |
| High cost user | $149 | $14.36 | $134.64 | 90% |
| With 20% affiliate | $119.20 | $10.82 | $108.38 | 91% |

**At $149/month, Wingman is a high-margin business even at the worst-case cost scenario.**

---

## Where Costs Could Spike

1. **Very long calls (2+ hours):** Recall.ai cost scales linearly with recording time. A rep who runs 2-hour calls doubles the transcription cost.

2. **Very high trigger frequency:** If the trigger classifier fires too often (false positives), Haiku and embedding costs multiply. Monitor signal cards per call.

3. **Very long transcripts for post-call:** If calls average 90 minutes instead of 55, post-call Sonnet input tokens increase ~63%.

4. **Anthropic price changes:** Claude pricing has been declining historically, but any increase directly hits margins.

---

## The Leverage Point

The unit economics improve dramatically as users become more efficient with Wingman. A rep who understands when to expect signal cards (and therefore doesn't need as many false-positive triggers to catch) generates lower AI costs while getting higher value. This is the opposite of a SaaS product where power users cost more — Wingman's power users (who've internalized the methodology and only need occasional nudges) cost LESS to serve.
