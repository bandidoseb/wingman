# Tier Pricing Proposal + Unit Economics

**Status:** PROPOSAL — written 2026-06-05, pending Sebastian's approval. Not locked. Amends the 2026-05-31 pricing decision (10 free → $149/mo unlimited, no cap).
**Why now:** Locking Sonnet for the summarizer (the godly judge) raises per-call AI cost. The right fix — per the 2026 research (YC/Altman, ICONIQ, Hormozi) — is **pricing/packaging, not a cheaper model.** This models the numbers at Sebastian's *real* usage and proposes a tier structure that keeps the product godly AND the margins healthy.

> ⚠️ **All numbers are ESTIMATES.** We have zero real usage data yet. Treat these as a model to pressure-test, not truth. Update the Assumptions Ledger when beta data lands.

---

## The reality check that triggered this
Sebastian's **typical** user is a daily closer: **3–4 calls/day × 5–6 days/week ≈ 65–105 calls/month.** That's what earlier modeling miscalled a "heavy" user. So the typical user runs near the high end — exactly where a flat unlimited plan bleeds margin.

---

## Per-call COGS (45-min substantive call)

| Component | Notes | Optimized |
|---|---|---|
| **Recall.ai** | 0.75 hr × $0.50/hr (launch rate $0.45 → $0.34) | **$0.375** |
| **Summarizer (Sonnet 4.6)** | ~1,800 in / 620 out per tick; ~22 ticks @ 2-min cadence + caching + ~400-tok output cap | **$0.20** |
| **Post-call job (Sonnet)** | one full-transcript pass: grade, debrief, pillars, stages, deal-memory rollup | **$0.06** |
| **Press-time cards (Haiku) + KB embeddings** | ~5 presses/call, cheap | **$0.02** |
| **Transcript saves / DB** | no AI | ~$0.00 |
| **TOTAL / call (optimized)** | | **≈ $0.65** |

- **Un-optimized** (90s cadence, no caching, long output) the summarizer alone is ~$0.44 → total ~$0.90/call. The 4 locked cost levers are what get us to $0.65.
- **No-show overhead:** short *uncounted* calls (no-shows / instant bails — see the call-counting rule below) still cost a few cents of Recall each but don't consume an allowance slot, so **effective COGS per *counted* call is ~$0.70, not $0.65.** Shifts margins ~1–2 points — negligible, and the right fairness trade.
- Payment processing (~3% Stripe) is on top of COGS at the subscription level (~$4.50 on $149, ~$9 on $299).

---

## The problem: flat $149 unlimited at real usage

| Usage / mo | Monthly COGS (@ $0.65) | Margin @ flat $149 (incl. ~3% Stripe) |
|---|---|---|
| Light (40) | $26 | **~80%** ✅ |
| **Typical (80)** | $52 | **~62%** ⚠️ |
| Heavy (120) | $78 | **~45%** 🔴 |
| Super-heavy (160) | $104 | **~27%** 🔴 |

The people who use Wingman *most* — the daily closers who are the core market — drag margin **below the AI-native floor (~60–65%)**, some far below. Unlimited-on-flat is a structural loss on power users (the 2026 industry consensus). This is the thing to fix.

---

## Proposed structure (3 tiers)

### 🆓 Free — 10 calls (unchanged)
The trial / taste. Live copilot only. Converts to Core.

### 🎯 Core — $149/mo — "the call"
- Live in-call copilot (hotkey cards), Flight Log, per-call debrief + grade, Sales DNA.
- **Included: 75 substantive calls/mo** (no-shows / instant DQs don't count). Above that: **$2/call** overage *or* upgrade to Pro. **Soft cap — never a hard block.**
- Does NOT include: calendar, prospect/deal memory, pre-call briefings, deal-coach chat.

### 🚀 Pro — $299/mo — "the pipeline" (the godly tier)
- Everything in Core + **unlimited calls** + calendar connect + prospect/deal memory + pre-call briefings + the deal-level "coach that knows everything" chat.
- This is where the AI-heavy, moat-grade features live — priced to carry their cost.

---

## Call-counting rule — what counts toward the allowance (DECIDED 2026-06-05)
A call counts against the included allowance (Free 10 / Core 75) **only if it was a real call:**

> **Counts only if the call ran ≥ ~10 minutes AND the prospect actually spoke.**

- **No-show** (prospect never joins → no non-rep speech) → free, doesn't count — even if the closer waited 15 min.
- **Instant bail / wrong-number / tech-check** (< 10 min) → free.
- **Real conversation** (≥10 min, prospect spoke) → counts. A genuine short DQ where they actually talked counts (fair — it was a real call).

**Why duration + transcript, NOT the disposition button:** objective, automatic, ungameable — billing must never depend on the rep remembering to tap "No Show" (the disposition card is user-facing and can be fragile). The "No Show" disposition still exists for the rep's *own* stats; billing uses the objective signal (we already capture call duration + the saved transcript).

**Implementation:** at call-end, only increment `calls_used` if the call clears the bar. Threshold (~10 min) is tunable with beta data.

---

## Margins under the proposed structure

| Tier / usage | Revenue | COGS (incl. Stripe) | **Margin** |
|---|---|---|---|
| Core @ 75-call cap | $149 | ~$53 | **~64%** |
| Core overage (per extra call) | +$2 | +$0.65 | margin-positive |
| Pro — typical (80 calls) | $299 | ~$69 | **~77%** |
| Pro — heavy (120) | $299 | ~$95 | **~68%** |
| Pro — super-heavy (160) | $299 | ~$121 | **~60%** |

Everyone lands **at or above the ~60–65% AI floor**, and most serious users (Pro) sit **68–77%** — approaching good-SaaS territory — *with the godly Sonnet experience intact.*

---

## Why this is the right move (the strategy, backed by the research)

1. **Self-selection does the work.** The heaviest users (highest COGS) are *exactly* the ones who most want Pro's pipeline-memory features (a daily closer juggling many deals needs the calendar + cross-call memory most). So the people who cost the most to serve pay $299 — cost concentrated in the tier priced for it. Elegant alignment.
2. **It's literally Sebastian's own 2026-05-31 instinct.** He said then: *"the margin lever is price, not caps… if they want more they can buy more… a higher tier for heavy users."* This **is** that — Pro is the higher tier; overage is "buy more." The only new wrinkle is a **soft** cap on Core (overage, never a hard wall), which the 2026 data says is required to avoid structural loss. The "no hard caps, just pay or upgrade" spirit is fully preserved (unlimited lives on Pro).
3. **Hormozi:** Pro is a *category of one* — no competitor (Cluely, Gong) does live-summon coaching + cross-call prospect memory for closers. Premium price *creates* premium perception. For a closer earning six figures in commissions, $299/mo that closes one extra deal is trivial. Price to value, not to cost.
4. **Future-proof:** inference falls ~10×/yr, so these margins only improve. We can later raise the Core cap or stack more value without re-architecting.

---

## Assumptions to validate (no real data yet)
- **Avg call length** (assumed 45 min) — shorter calls are cheaper; real distribution unknown.
- **Recall rate** ($0.50/hr; $0.45 launch) — confirm final contract.
- **Optimized summarizer cost** (~$0.20/call) — depends on the 4 levers landing; *measure on a real call* (read `cache_read_input_tokens`).
- **Real usage distribution** — the biggest unknown. The founder-network beta is the instrument; this is where we learn if "typical" is 60 or 100 calls/mo.
- **Willingness to pay $299** for Pro — beta will tell us; could be $249–399.
- ~~**"Substantive call" definition**~~ — RESOLVED 2026-06-05: counts only if **≥~10 min AND the prospect spoke** (see the Call-counting rule above). Threshold tunable with beta data.

---

## Open decisions for Sebastian
1. **Core included cap** — 60 (→ ~70% margin) / 75 (→ ~64%, more generous) / other — and overage rate ($2/call?).
2. **Pro price** — $249 / **$299** / $349 (validate vs willingness to pay).
3. **Does Core get *any* premium features**, or stay pure live-copilot? (Recommend pure — clean "call vs pipeline" line.)
4. **Annual option** — ~2 months free (Core $1,490/yr, Pro $2,990/yr) for cash + retention?
5. **Keep 10 free calls**, or adjust the trial?

---

## One-paragraph recommendation
Build with **Sonnet** (godly), ship **three tiers** — Free (10 calls) → **Core $149** (the live copilot, soft-capped ~75 calls + overage) → **Pro $299** (unlimited + calendar + prospect memory + briefings + deal coach). The heaviest users self-select into Pro (they want the memory features anyway), which carries their COGS and lands the business at **68–77% margin** on serious users — above the AI-native average (52%) and the floor (60–65%) — without cutting a single corner on product quality. This is exactly what the YC/ICONIQ/Hormozi playbook prescribes: **best product, margin solved in packaging.** Pending your sign-off on the open decisions above.
