# Financial Model

Last updated: 2026-04-02

A narrative of Wingman's financial structure. Update this monthly as real data comes in.

---

## Revenue Model

**Single revenue stream:** Monthly subscription at $149/month per user.

**No other revenue streams currently:**
- Affiliate commissions (from Rewardful) are the only planned secondary revenue — but those are revenue share paid OUT, not revenue coming IN.
- No annual plans yet (V2).
- No team/enterprise pricing (not our market).

---

## Monthly Cost Structure

These are the variable costs that scale with active users. Fixed costs (domains, tools) are minimal.

### Variable Costs Per Active User Per Month (Estimates)

| Cost Component | Estimate | Basis |
|---------------|----------|-------|
| **Recall.ai transcription** | ~$3–8/user | ~100–200 min/day × ~20 working days = 2,000–4,000 min/month. Recall.ai pricing is per recording minute. |
| **Anthropic Claude (Haiku)** | ~$0.50–1.50/user | ~8 signal cards/call × 1.3K tokens/card × Haiku pricing. 5 calls/day × 20 days = 100 calls/month. |
| **Anthropic Claude (Sonnet)** | ~$1–3/user | Post-call analysis per call. Sonnet pricing × transcript length. |
| **OpenAI embeddings** | <$0.01/user | Negligible at current scale. |
| **Supabase** | ~$0.05/user | Scales with database queries. Near-zero at current user count. |
| **Railway** | ~$0.50/user | Scales with compute. Estimate at current Railway pricing. |
| **Total variable cost** | **~$5–13/user/month** | Wide range due to Recall.ai variability |

### Fixed Costs Per Month

| Cost | Amount |
|------|--------|
| Railway (base) | ~$5 |
| Supabase (base) | $0 (free tier) or $25 (Pro) |
| GitHub | $0 (free) |
| Domain | ~$2 |
| **Total fixed** | ~$7–32 |

---

## Gross Margin Target: 70%+

At $149/month revenue and ~$5–13/month variable costs:

| Scenario | Revenue | Variable Cost | Gross Margin |
|---------|---------|--------------|--------------|
| Light user (2 calls/day) | $149 | ~$5 | **~97%** |
| Average user (5 calls/day) | $149 | ~$9 | **~94%** |
| Heavy user (10 calls/day) | $149 | ~$13 | **~91%** |

**The margin holds even for heavy users.** The biggest risk is a user who runs Recall.ai for very long calls without many trigger moments — paying the transcription cost without generating much value (and therefore churning). Monitor call duration vs signal cards fired.

---

## User Milestone Math

At $149/month, each new subscriber adds $149/month in MRR.

| Users | MRR | ARR |
|-------|-----|-----|
| 10 | $1,490 | $17,880 |
| 25 | $3,725 | $44,700 |
| 50 | $7,450 | $89,400 |
| 100 | $14,900 | $178,800 |
| 200 | $29,800 | $357,600 |
| 500 | $74,500 | $894,000 |

---

## The Affiliate Cost

When the affiliate program launches at 20% recurring commission:

- Every referred subscriber costs $29.80/month to the affiliate
- Net revenue per referred subscriber: $149 - $29.80 = $119.20/month
- Net margin per referred subscriber (vs $9 avg variable cost): ~$110/month = ~92%

Even with affiliates, the economics are excellent.

---

## What to Watch Monthly

1. **Average Recall.ai cost per user** — biggest variable. If a segment of users uses Recall.ai for 3-hour calls twice a day, costs blow up. Set alerts.
2. **Churn rate** — at $149/month, losing a subscriber is painful. What's the pattern of churned users? (Call frequency? First-call experience?)
3. **MRR growth vs cost growth** — as users scale, fixed costs amortize but variable costs scale linearly. Model should hold above 70% GM throughout.
4. **Claude API costs** — monitor token spend per user. If post-call transcripts are very long, Sonnet costs could spike.

---

## Current MRR

**Pre-revenue.** Beta is launching now. First paid subscribers TBD.

*Update this field monthly once billing is live.*
