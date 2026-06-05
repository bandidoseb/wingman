# Stripe and Billing

Last updated: 2026-04-02

Current pricing model, how Stripe is configured, where Price IDs live, how Rewardful connects, and the affiliate payout structure.

---

## Current Pricing Model

**Product:** Wingman monthly subscription
**Price:** $149/month (directional — not yet finalized for launch)
**Billing:** Monthly recurring subscription via Stripe
**Free tier:** Limited number of calls (exact limit TBD) — triggers iMessage conversion funnel at the close moment

**No annual plan yet.** Annual billing is a V2 consideration after monthly is proven.

**No tiered pricing yet.** One plan. One price. Closers don't want to read a pricing table.

---

## Stripe Configuration

**Products setup:**
- One product: "Wingman Monthly"
- One price: $149/month recurring
- Price ID: (set in Stripe dashboard, copied to Railway environment variables)

**Where Price IDs live:**
- Stripe dashboard → Products → copy the Price ID (looks like `price_xxxxxxxxxxxxx`)
- Add to Railway environment variables
- Referenced in `src/app/api/stripe/` routes

**Webhook events handled:**
- `customer.subscription.created` → mark user as subscribed in Supabase
- `customer.subscription.updated` → update subscription status
- `customer.subscription.deleted` → mark user as churned, revoke access

**Webhook secret:** `STRIPE_WEBHOOK_SECRET` — Railway only. Used to verify that webhook events are genuinely from Stripe.

---

## Stripe Routes (Implemented, Not Fully Tested)

| Route | Purpose | Status |
|-------|---------|--------|
| `/api/stripe/checkout` | Create a Stripe Checkout session | Built, not E2E tested |
| `/api/stripe/portal` | Customer billing portal (cancel, update card) | Built, not E2E tested |
| `/api/stripe/webhook` | Handle subscription events from Stripe | Built, not E2E tested |

**Status:** Routes exist and are structured correctly, but the full checkout → webhook → Supabase update flow has not been end-to-end tested with a real payment.

---

## Rewardful — Affiliate Tracking

**What Rewardful does:**
- Generates unique referral links for each affiliate
- Tracks which subscriptions came through which affiliate link
- Calculates commissions based on Stripe revenue
- Handles payouts (via Stripe or PayPal)

**Commission structure:**
- Rate: ~20% of monthly subscription revenue
- Type: Recurring — affiliate earns as long as the referred customer stays subscribed
- Payout: Monthly

**At $149/month:**
- Per referred subscriber: ~$29.80/month to the affiliate
- 10 active referrals = ~$298/month to the affiliate (recurring)

**Integration:**
- Rewardful provides a script to add to the Wingman landing page
- Tracks referral cookies
- Integrates with Stripe via API to attribute subscriptions to affiliates

**Status:** Not yet set up. Planned for Phase 3 of distribution.

---

## Subscription Access Control

When a user is subscribed:
- `profiles.subscription_status` = `'active'`
- ⚠️ **Tiered as of 2026-06-05 (was "all features / unlimited"):** **Core $149** = live copilot + Flight Log + Sales DNA, soft-capped ~75 calls + overage; **Pro $299** = everything + calendar / prospect memory / briefings / deal coach + unlimited. Billing not yet wired to tiers — update when built. See `06 - Finance/Tier Pricing Proposal + Unit Economics.md`.

When a user is on free tier:
- `profiles.subscription_status` = `'free'`
- Limited to free tier call count
- iMessage conversion funnel triggers at the close moment

When a subscription lapses (payment failure or cancellation):
- `profiles.subscription_status` = `'inactive'`
- Access revoked to premium features
- User directed to billing portal to reactivate

**How access is checked:** Every API route that requires a paid subscription checks `profiles.subscription_status` after validating the Supabase auth session.

---

## What's Needed Before Billing Goes Live

- [ ] End-to-end test: create checkout session → complete payment → webhook fires → Supabase updates → user gets access
- [ ] Test subscription cancellation flow: cancel → webhook fires → access revoked
- [ ] Test failed payment flow: payment fails → Stripe retries → if still fails → access revoked after grace period
- [ ] Add Rewardful tracking script to landing page
- [ ] Set up affiliate dashboard access for first affiliates
- [ ] Confirm Price ID is correct and matches what Railway has in environment variables
- [ ] Test webhook signature validation (the `STRIPE_WEBHOOK_SECRET` check)
