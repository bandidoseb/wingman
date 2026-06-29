/**
 * objection-eval-compact.mjs — thin, production-like belief-ladder summaries.
 *
 * The first eval fed the card a RICH discovery dump as "call memory," which already
 * contained every qualitative anchor — so the structured anchor library looked
 * redundant (no lift). Production's live summary is COMPACT and CAPPED (belief states
 * + weakest link + maybe a quote; it drops older specifics). These compact summaries
 * mimic that: who + current revenue (confirmed) + belief state + weakest link + the
 * objection — and DELIBERATELY DROP the rich specifics (history, why, goal, final
 * straw, exact quotes). Those only come back via the anchor library.
 *
 * Run:  COMPACT=1 node scripts/objection-eval.mjs
 * Then the A(v1,no anchors) vs D(v1,+anchors) gap is the real test of whether the
 * anchor library earns its place when the summary is thin. Judge still grades against
 * the FULL ground truth (corpus context + anchors), so fabrication is still caught.
 *
 * No shaky digits here (confidence fix already applied) — keeps this a clean test of
 * anchor VALUE, not the number-leak question (already settled: 0 leaks).
 */

export const COMPACT = {
  1: "Stage: Close. Prospect: Jenna, solo bookkeeper, ~$6k/mo.\nBelief ladder: pain + money locked — she's affirmed it fits and she can afford it.\nWeakest link: readiness — the stall is fear of change, not logic.\nJust raised: \"I need to think about it.\"",
  2: "Stage: Close. Prospect: Andre, landscaping company owner, ~$30k/mo.\nBelief ladder: pain locked (overworked, plateaued); money belief at-risk.\nWeakest link: he's framing the price as an expense, not ROI.\nJust raised: \"It's too expensive.\"",
  3: "Stage: Close. Prospect: Priya, newer coach, ~$3k/mo.\nBelief ladder: pain + desire locked; money is a genuine, real constraint (not a smokescreen).\nWeakest link: actual cash — respect it.\nJust raised: \"I don't have the money.\"",
  4: "Stage: Close. Prospect: Marcus, co-owns an agency, ~$40k/mo.\nBelief ladder: he's sold; support belief open — a partner (Dave) is a real approval gate.\nWeakest link: support / who decides.\nJust raised: \"I need to talk to my business partner.\"",
  5: "Stage: Close. Prospect: Tom, HVAC owner, ~$60k/mo. Money fine.\nBelief ladder: pain locked; he's overwhelmed.\nWeakest link: 'too busy' is the symptom of the exact problem the program fixes.\nJust raised: \"I'm too busy.\"",
  6: "Stage: Close. Prospect: Dana, fitness coach, ~$8k/mo. Money fine.\nBelief ladder: offer belief locked; she doubts herself, not the program.\nWeakest link: self-belief / identity.\nJust raised: \"What if it doesn't work for me?\"",
  7: "Stage: Close. Prospect: Luis, e-commerce owner, ~$25k/mo. Money fine.\nBelief ladder: trust at-risk — burned by past programs, now comparing.\nWeakest link: differentiation / why you.\nJust raised: \"What makes you different?\"",
  8: "Stage: Close. Prospect: Rachel, agency owner, ~$35k/mo. Money fine.\nBelief ladder: warm all call, then cooled at the price reveal.\nWeakest link: 'send info' is cover for a real, unspoken concern.\nJust raised: \"Send me some information.\"",
  9: "Stage: Close. Prospect: Kev, technical founder, ~$20k/mo. Money fine.\nBelief ladder: doubt belief at-risk — he believes he can do it himself.\nWeakest link: his own history shows self-directed hasn't worked; gap = accountability.\nJust raised: \"I can do this myself.\"",
  10: "Stage: Close. Prospect: Marie, owns two salons, ~$45k/mo. Can afford it.\nBelief ladder: trust at-risk — gun-shy from a past bad investment.\nWeakest link: trust / been burned.\nJust raised: \"I've been burned before.\"",
  11: "Stage: Close. Prospect: Sam, trades owner, ~$30k/mo. Money fine.\nBelief ladder: desire there, but he doesn't believe the result is realistic for HIM.\nWeakest link: belief the outcome is achievable for him specifically.\nJust raised: \"This sounds too good to be true.\"",
  12: "Stage: Close. Prospect: Bianca, e-commerce, ~$18k/mo. Money fine.\nBelief ladder: pain + desire locked; stalling on timing (busy season ahead).\nWeakest link: 'later' costs her the very season she's worried about.\nJust raised: \"The timing isn't right.\"",
  13: "Stage: Close. Prospect: Jordan, Shopify brand owner, ~$22k/mo. Money fine.\nBelief ladder: he's sold; support belief open — partners with spouse on big spends.\nWeakest link: support / who decides.\nJust raised: \"I need to talk to my spouse.\"",
  14: "Stage: Close. Prospect: Derek, agency owner, ~$50k/mo. Money not tight.\nBelief ladder: he's sold; using process as a gate.\nWeakest link: the accountant is a logic gate to defer his own decision.\nJust raised: \"I need to check with my accountant.\"",
  15: "Stage: Close. Prospect: Alyssa, course creator, ~$12k/mo. Money fine.\nBelief ladder: trust at-risk from a past program.\nWeakest link: trust, but partly her own non-implementation last time.\nJust raised: \"I tried something like this before and it didn't work.\"",
  16: "Stage: Close. Prospect: Tony, contractor, ~$28k/mo.\nBelief ladder: basically sold — he said he wants to do it.\nWeakest link: none really — this is a terms conversation, get the decision.\nJust raised: \"Can you do a payment plan or a discount?\"",
  17: "Stage: Close. Prospect: Nina, consultant, ~$30k/mo. Money fine.\nBelief ladder: open — she has a coach already, but it's stalled.\nWeakest link: differentiation + a little loyalty guilt.\nJust raised: \"I'm already working with a coach.\"",
  18: "Stage: Close. Prospect: Greg, info-product owner, ~$40k/mo, mid-launch. Money fine.\nBelief ladder: sold; stalling on timing.\nWeakest link: the program makes the launch bigger, not a competing task.\nJust raised: \"Let me finish my current launch first.\"",
  19: "Stage: Close. Prospect: Carla, coach, ~$15k/mo. Money fine but cautious.\nBelief ladder: risk-averse; needs certainty.\nWeakest link: put the certainty question back on what she controls — doing the work.\nJust raised: \"I need to see proof or a guarantee.\"",
  20: "Stage: Close. Prospect: Hassan, e-commerce, ~$35k/mo. Money fine.\nBelief ladder: sold on the offer; nervous on timing.\nWeakest link: fear dressed as macro logic — downturns are when competitors pull back.\nJust raised: \"The economy is too uncertain right now.\"",
  21: "Stage: Close. Prospect: Beth, SaaS founder, ~$45k/mo. Money fine.\nBelief ladder: sold; analysis paralysis.\nWeakest link: she's been researching the same problem for a year with no movement.\nJust raised: \"I want to do more research and compare options.\"",
  22: "Stage: Close. Prospect: Omar, agency owner, ~$20k/mo. Money workable.\nBelief ladder: sunk-cost frustration with past purchases.\nWeakest link: what those buys lacked was accountability — the difference here.\nJust raised: \"I've already spent a lot on this kind of thing.\"",
  23: "Stage: Close. Prospect: Sofia, medical-billing agency, ~$25k/mo. Money fine.\nBelief ladder: special-snowflake doubt — thinks her niche is too unique.\nWeakest link: the bottleneck (her, no systems) is universal.\nJust raised: \"My niche is unique — a general program won't fit.\"",
  24: "Stage: Close. Prospect: Trent, fitness studio owner, ~$18k/mo. Money fine.\nBelief ladder: commitment-shy.\nWeakest link: fear of being locked in = fear it won't work; the six months IS the point.\nJust raised: \"I don't want to be locked into a contract.\"",
  25: "Stage: Close. Prospect: Maya, newer coach, ~$5k/mo, recently quit her job.\nBelief ladder: desire locked; fear + a genuine money stretch (be honest, no slick reframe).\nWeakest link: fear plus a real-ish cash constraint.\nJust raised: \"I want to but I'm scared to invest right now.\"",
  26: "Stage: Close. Prospect: Victor, 12-person agency owner, ~$70k/mo. Money fine.\nBelief ladder: sold; defers decisions.\nWeakest link: it's his call — running it by the team is avoidance.\nJust raised: \"I need to run it by my team.\"",
  27: "Stage: Close. Prospect: Renee, coach, ~$10k/mo. Money fine.\nBelief ladder: sold; waiting to feel 'ready.'\nWeakest link: 'ready' is fear — nobody feels ready.\nJust raised: \"I'm just not sure I'm ready.\"",
  28: "Stage: Close. Prospect: Reggie, trades owner, ~$32k/mo. Money fine.\nBelief ladder: trust at-risk — cynical about online coaching.\nWeakest link: trust / authority — wants substance, not hype.\nJust raised: \"How do I know you're not just another guru?\"",
  29: "Stage: Close. Prospect: Grace, faith-driven coach, ~$8k/mo. Money workable.\nBelief ladder: sold; wants to pray on it (genuine value — respect it).\nWeakest link: respect the value, gently check if anything else is also holding her back.\nJust raised: \"I need to pray on it.\"",
  30: "Stage: Close. Prospect: Diego, contractor, ~$16k/mo, off a brutal slow season.\nBelief ladder: desire locked; money genuinely tight right now (be real).\nWeakest link: real cash-timing constraint.\nJust raised: \"Money's really tight right now, but I want this.\"",
};
