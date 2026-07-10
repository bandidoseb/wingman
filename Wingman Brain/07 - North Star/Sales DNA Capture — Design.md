# Sales DNA Capture — Design (Offer-Aware Wingman, Phase 1)

**Status:** Design LOCKED with Sebastian 2026-07-10. This is the canonical spec for HOW we capture each user's Sales DNA and turn it into offer-aware live cards. Build plan lives in `tasks/todo.md`. Parent vision: `Offer-Aware Wingman — The Moat.md`.

**Grounded in:** Cole Gordon 7-Figure Selling Academy docs read in full 2026-07-10 — `2.1 Sales First Principles.pdf`, `2.2 The Belief Ladder.pdf`, `Sales Training 1o1 - Closer Crash Course.pdf` (on Sebastian's Desktop/Cole Gordon).

---

## The scientific principle (do not lose this)
- The **7 beliefs are the universal skeleton** of every high-ticket discovery: Pain, Doubt, Cost, Desire, Money, Support, Trust. (Internal tags ONLY — see Naming risk.)
- What is **offer-specific** is (a) **how each belief manifests** in a prospect's words, and (b) **the ONE root everything ladders down to.**
- Cole's own flow proves it: a biz-opp offer drills "monetary goal → why that number → financial qualifier"; First Principles swaps that axis to "current vs desired weight" for fitness. Same belief, different root.
- Sebastian's insight = the magnet: "I want to quit my job" is meaningless to generic AI. Offer-aware Wingman chunks it → *the monthly cash-flow number that makes quitting real* → **money**, because cash creation is his offer's root. Capture the root + manifestations → every Dig card aims there, adaptively, in the rep's voice.

## Card behavior (locked)
Adaptive, NOT static. Each ↓ press generates a FRESH question off the live transcript, aimed at the rep's root, phrased in the rep's angle, echoing their saved language when it fits. Never verbatim-static. No fabrication of specifics the prospect didn't say (same fence as the existing dig/objection prompts).

Before → after (Sebastian's example), prospect: *"honestly I just want to quit my 9-to-5":*
- Generic: *"Gotcha — what's the goal you're working toward?"*
- Offer-aware: *"Love that — so what would you need to be pulling in every month for walking away from the job to actually feel safe?"*

---

## Tiering (locked — CHANGED from the original moat doc)
**Quality is NEVER gated. Offer-aware Sales DNA cards go to Free, Core, AND Pro at full quality.** The moat is trust-through-quality; gating quality would churn users before they ever taste Pro, and the "wow" must land during the free trial (it IS the conversion event).
- **Free** = full quality, ~10-call trial wall.
- **Core** = full quality, call cap (~75).
- **Pro** = full quality + **unlimited calls + premium features** (prospect memory, AI voice-call setup, "talk with Wingman" coach, analytics — built later).
- The **blurred-teaser upsell UX doesn't die** — it repoints at genuinely Pro-only surfaces (prospect memory, analytics, voice setup), NOT Sales DNA.
- Consequence: Phase 1 needs NO Pro-gate around the moat. Offer-aware is simply ON for anyone who filled out their Sales DNA. (`isPro`/Stripe gating is only for the later premium features.)

## Deploy gate (locked)
**You can't Deploy until your Wingman is "briefed"** — framed as onboarding ("study the mission before takeoff"), not a wall. Gate on the ESSENTIAL fields only. "Filled out" = the field has *something* (a brain-dump counts — Wingman structures it). A weak first call is fatal; a couple of setup bounces are acceptable (Sebastian's call).

## Naming risk (locked)
- Plain belief words (pain, desire, cost…) = zero IP risk, but **keep them internal tags only — never surface a "7 Beliefs" / "Belief Ladder" label on any page** (that named framework is Cole's branding).
- Dashboard tab: **"Sales DNA."** Sections: **"Your Offer"** + **"Your Discovery."** (No subsection re-named "Sales DNA" — circular.)

---

## The capture — 11 questions (wording LOCKED 2026-07-10, Sebastian may still micro-edit)
Every field: rotating **ghost-text examples** (3 offer types each, so reps see it's for them) + a **brain-dump invite** ("The more you dump here, the smarter your Wingman gets — don't hold back, we'll make sense of it") + a **🎤 mic button** to dictate (transcribe → text → discard audio; never stored).

**UNSKIPPABLE (the deploy gate):** offer name+price, Q1 transformation, Q2 root driver, Q5 pain, Q6 desire.
**Skippable** (tiny "skip for now" + "Highly recommended — the more you give Wingman, the sharper it gets"): Q3, Q4, Q7, Q8, Q9, Q10, Q11.

### Section 1 — Your Offer
1. **What do you sell, and what changes for someone after working with you?** *(transformation)*
   ghost: "Coaches go from running every call themselves to a team that closes for them" · "Busy dads drop 30 lbs and get their energy back" · "People go from stuck at a W2 to doing land deals full-time"
2. ⭐ **Boil it all down — what's the ONE thing every client is really chasing?** *(root driver — the magnet)*
   ghost: "A monthly cash-flow number that replaces their job" · "Losing the weight and keeping it off for good" · "Enough passive income to walk away from the 9–5"
3. **Underneath the numbers, what are they really after?** *(emotional root — 6 human needs)*
   ghost: "Certainty — sick of not knowing where the next client comes from" · "Freedom — being their own boss" · "Respect — proving it to their family"

*(Offer name + price captured by the existing offers table / YourOffer step. Existing offer-intelligence fields — ideal_client, unique_differentiator, guarantee — pre-fill where they map.)*

### Section 2 — Your Discovery
4. **On a call, do you open on their problems or their goals first?** *(syntax)*
   subtext: "Some reps start with what's going wrong ('what's not working right now?'). Others start with the dream ('where do you want to be?'). Both work — we just want to match how you run it."
   toggle: **Their problems · Their goals · Not sure yet**
   → "Not sure yet" triggers the syntax auto-detect fast-follow (below).
5. **What's the problem almost everyone comes to you with?** *(pain)*
   ghost: "Grinding on sales calls themselves and can't scale" · "Tried every diet, nothing sticks" · "Keep buying courses but never close"
6. ⭐ **People say their goal in different ways. What are the common ones — and what do they really come down to for you?** *(desire + chunk-down logic — the key one)*
   ghost: "'Quit my job,' '$10k months,' 'more freedom' — it all comes down to consistent monthly cash flow" · "'Fit my old jeans,' 'keep up with my kids' — all of it is losing the weight for good"
7. **If nothing changes, what does staying stuck cost them?** *(cost — LIST SEVERAL)*
   subtext: "There's never just one cost — it's all over the board depending on the person. List a handful you hear a lot."
   ghost: "Never retiring comfortably" · "Staying buried in debt" · "Stuck at a job they hate for years" · "Never getting the freedom they came for"
8. **Why can't they just fix this themselves? What've they usually already tried?** *(doubt)*
   ghost: "Bought courses and watched YouTube but never had a coach in their corner" · "Diets and gym stints, but always fall off without accountability"
9. **Why is your way different from everything else they've tried?** *(trust — pre-fill from unique_differentiator)*
   ghost: "Everyone teaches theory — we build the system with you and roleplay it live" · "Most programs are cookie-cutter; ours adapts to your body and schedule"
10. **How do you know a prospect can actually afford your offer?** *(money = resources; price already captured)*
    subtext: "Money really comes down to whether they've got the means. What do you ask or look for so Wingman can tell a real money block from just nerves?"
    ghost: "I ask 'do you have money set aside to get a land business going?' then probe the range so I've anchored it before the pitch" · "Already making good money, just wants out of the 9–5" · "$4k isn't a stretch — they've spent more on stuff that didn't work"
11. **Who else is usually in on the decision, and how often does it come up?** *(support)*
    ghost: "Almost always a spouse — I ask early if they're on board" · "Usually just them, sometimes a business partner"

---

## Fast-follows (noted so they don't get lost — Sebastian 2026-07-10)
1. **Syntax auto-detect after ~5 calls.** If a rep picks "Not sure yet" on Q4, aggregate the `Syntax:` field the live Belief-Ladder scorecard ALREADY tags on every call → after ~5 calls, set (or suggest) their default problems-first / goals-first. Signal already exists in `belief-ladder.ts` output; only the aggregation is new. MUST be wired — do not ship "Not sure yet" as a dead end.
2. **Mic brain-dump** on every field (record → transcribe → discard audio). Highest-lift single piece; can trail the text-first capture.

## Injection (how it reaches the card)
Compile the Sales DNA (offer core + discovery map) into a compact **SALES DNA** context block (like `buildRepProfile`), inject as a cached content block into the ↓ Dig generator (`dig-signal.ts`) first, then Objection + the summarizer. Prove with the dig eval (`scripts/dig-eval.mjs`) before shipping: offer-aware beats generic, 0 fabrication regression.

## Storage (proposed)
`profiles.sales_dna jsonb default '{}'` holding the new discovery fields (flexible — question edits need no migration). Reuse existing `ideal_client` / `unique_differentiator` / `guarantee`. Completeness for the gate derived from the essential keys (source of truth = the data). Apply via Supabase SQL (schema drift is expected here). Details in `tasks/todo.md`.
