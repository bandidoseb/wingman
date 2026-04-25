# Unit Economics Model

Last updated: 2026-04-25
⚠️ **All numbers are model assumptions. No real user data yet. Revisit after first 10 beta users.**

---

## Target Customer Profile

- High-ticket closers working for other people's offers
- Earn ~10% commission per close
- Call volume: ~4–5 scheduled calls/day, 5–6 days/week = **~100–130 calls/month**
- Average call length assumption: **45–60 minutes**
- Income range: $6,000–$20,000+/month depending on offer price and close rate
- Price sensitivity: low — $149–$199 is a rounding error if it improves close rate by even 1 deal/month

---

## Cost Stack Per User (With WebSocket Push + Recall.ai Launch Plan)

**Variables:**
- Recall.ai Launch plan rate: **$0.0075/min** ($0.45/hr)
- Anthropic with push: **~$0.37/call at 60 min** (scales with call length)
- Post-call Sonnet job: **~$0.03/call** (fixed)
- Fixed overhead (hosting, Pusher): **~$5/user/month**

**Formula per user:**
```
Recall cost = calls × avgMinutes × $0.0075
Anthropic cost = calls × (avgMinutes/60) × $0.34 + calls × $0.03
Total = Recall + Anthropic + $5
Margin = (revenue - total) / revenue
```

---

## Key Scenarios

### Average user (65 calls/month, 45 min avg)
| Cost component | Amount |
|---|---|
| Recall.ai | $21.94 |
| Anthropic (push) | $21.00 |
| Fixed | $5.00 |
| **Total** | **$47.94** |

| Price | Gross Margin |
|---|---|
| $149 | 67.8% |
| $179 | 73.2% ✓ |
| $199 | 75.9% ✓ |

### Heavy user (130 calls/month, 60 min avg) — worst case
| Cost component | Amount |
|---|---|
| Recall.ai | $58.50 |
| Anthropic (push) | $48.10 |
| Fixed | $5.00 |
| **Total** | **$111.60** |

| Price | Gross Margin |
|---|---|
| $149 | 25.1% |
| $179 | 37.7% |
| $199 | 43.9% |

---

## Pricing Direction

**$179/month, unlimited calls** — current working hypothesis.

Rationale:
- Under $200 psychologically — feels like a tool, not a budget line item
- "Under $200" is the threshold for individual closer budget approval without manager sign-off
- Average user margin: 73% (investor-grade)
- Worst-case user margin: 37.7% (still profitable — heavy users subsidized by average users)
- Value prop: one extra close/month at $500 commission = 2.8x ROI

No per-call caps. Target users do 100+ calls/month and will churn the moment they hit any ceiling.

---

## Recall.ai Pricing

| Plan | Rate | Notes |
|---|---|---|
| Pay-as-you-go | $0.0083/min ($0.50/hr) | Current default 2026 rate |
| Launch plan (quoted) | $0.0075/min ($0.45/hr) | 6,000 hrs over 12 months, white-glove Slack support |
| Enterprise | Custom | Volume discounts, SLA, SSO |

**Before signing Launch plan:** Ask overage rate above 6,000 hours and whether 3,000-hour starter exists.

At 6,000 hours/year (500 hours/month = 500 calls × 60 min):
- That covers **5 fully-active users** at 100 calls/month × 60 min
- Fine for early beta; will need to scale up as user count grows

---

## Interactive Calculator

`margin-calculator.html` (project root) — open in browser, drag sliders.
Inputs: price, calls/month, avg call length, Recall.ai rate.
Outputs: per-user cost breakdown (polling vs push), gross margin, at-scale profit table, Recall.ai negotiation targets.

---

## Assumptions Ledger

Track when real data contradicts these assumptions:

| Assumption | Value | Source | Status |
|---|---|---|---|
| Avg calls/month | 65–130 | Estimated from "4–5 calls/day, 5–6 days/week" | Unvalidated |
| Avg call length | 45–60 min | Estimated for high-ticket sales calls | Unvalidated |
| Anthropic cost/call (push) | $0.37 at 60 min | Calculated from token counts + model pricing | Unvalidated |
| Recall.ai Launch plan rate | $0.0075/min | Quoted by Recall.ai sales rep Apr 2025 | Awaiting contract |
| % heavy users (130+ calls) | Unknown | No data | Unvalidated |
| Blended avg user cost | ~$48–$112 | Model only | Unvalidated |
