# Assumptions Ledger

Last updated: 2026-04-02

Every product is built on assumptions. This file makes ours explicit. When real data contradicts an assumption, update the confidence level and add a note. Never delete old assumptions — mark them as invalidated with evidence.

Confidence levels: **High** (we've seen evidence for this), **Medium** (reasonable but unverified), **Low** (a bet we're making, could easily be wrong).

---

## Core Product Assumptions

### Closers will use a Mac desktop app
**Confidence:** Medium
**Basis:** High-ticket closers in info products tend to be Apple-forward. Zoom and Google Meet on Mac is the dominant stack. The Recall.ai SDK constraint means Apple Silicon only anyway — so this isn't a choice we're making, it's a constraint we're living with.
**What would invalidate this:** Consistent user reports that their team is on Windows or that the Mac requirement is a deal-breaker.
**Watch:** If we see a meaningful segment of interested prospects who are Windows-only, we need to know.

---

### Signal cards firing ~8 times per hour is the right frequency
**Confidence:** Low
**Basis:** Internal estimate. No live call data yet. The 90-second cooldown + trigger threshold was designed to produce roughly this frequency on a typical 60-minute call.
**What would invalidate this:** Beta testers saying cards fire too much (breaks immersion, feels scripted) or too little (they forgot Wingman was running).
**Update required:** First call data from beta testers will immediately tell us if this is right.

---

### $149/month is within budget for a commission-based closer
**Confidence:** High
**Basis:** A single closed deal typically generates $1,000–$15,000 in commission. $149/month = $1,788/year. If Wingman helps close even one additional deal per year, it pays for itself many times over. ROI math is clear and the closer population understands ROI math.
**What would invalidate this:** Consistent price objections specifically citing "$149 is too much" combined with users who are genuinely not closing enough to justify it (new closers, struggling closers). In that case, the product may not be for beginners.

---

### Cole Gordon's network is the right beachhead community
**Confidence:** Medium
**Basis:** Cole Gordon / Closers.io has trained thousands of high-ticket closers. They're online, organized, and have a culture of investing in tools that improve performance. They're pre-sold on the ROI frame for training and tools.
**What would invalidate this:** Low engagement from that community or discovery that the community is more "want to be closers" than "active closers." Also if Gordon doesn't engage or promote — the beachhead requires some level of community buy-in from respected figures.
**Watch:** Response rates from outreach to Closers.io alumni. Number of beta applications from that community.

---

### The Offer Brain creates enough switching cost to retain users
**Confidence:** Medium
**Basis:** After 20–30 calls, the Offer Brain has learned the rep's offer, their top objections, and what responses worked. A competitor would have to start from zero. That's a real switching cost.
**What would invalidate this:** If users don't perceive the Offer Brain's impact — i.e., if signal cards don't feel meaningfully more personalized over time. If a user on call 50 gets cards that feel just as generic as call 1, the Offer Brain isn't working.
**Test:** Interview users at call 30. Do they feel Wingman "knows them"? Are the signal cards feeling more precise over time?

---

### Post-call analysis is more valuable than real-time feedback for most stages
**Confidence:** Medium
**Basis:** Real-time signal cards are highest-value during objection handling and closing (stages 6–8). For the earlier stages (Discovery, Press, Confirm), reps often know what to do — they just need a reminder. Post-call debrief catches the "you skipped Press entirely" pattern more cleanly than a real-time card can.
**What would invalidate this:** Beta testers saying they wish they'd been warned mid-call during Discovery that they were moving too fast, and that the post-call debrief was too late.
**Watch:** Stage coverage data from post-call analysis. Are reps consistently missing the same stages despite Wingman running?

---

### Reps won't feel like they're reading AI suggestions if cards are rare and surgical
**Confidence:** Medium
**Basis:** The core product philosophy. Cards fire ≤8 times per hour with a 90-second cooldown. At that frequency, a card feels like a flash of intuition, not a script.
**What would invalidate this:** A beta tester telling a prospect "hang on, Wingman says to ask you about the cost of waiting." That's the product failure scenario. If even one rep in beta is reading cards verbatim out loud, the frequency might be too high or the card language too prescriptive.
**Rule:** Cards should read like a reminder of something the rep already knew, not a script they're following.

---

### Deleting raw transcripts after post-call processing is enough for user trust
**Confidence:** High
**Basis:** Users aren't asking "where is my transcript stored" — they're asking "are you recording the prospect?" The answer is: we capture audio live (Recall.ai), transcribe it, and then delete the raw text. We keep only the extracted insights (grade, debrief, objections). This is a reasonable and defensible position.
**What would invalidate this:** A legal or privacy challenge specifically around the fact that transcription (even temporarily) happened without prospect consent. Worth getting legal opinion on before scaling.

---

## Growth Assumptions

### Free-to-paid conversion will happen at the moment of first close
**Confidence:** Low
**Basis:** The iMessage funnel is designed to trigger exactly when Wingman detects a close on a free-tier call. The theory: the emotional peak of a closed deal is the best moment to ask someone to pay for the tool that helped them close it.
**What would invalidate this:** Low conversion from the iMessage trigger because (a) reps attribute the close to themselves not Wingman, (b) the iMessage feels spammy or intrusive, or (c) the free tier is too generous and reps just stay on it.

---

### Affiliate marketing (Cole Gordon-style) will be a meaningful acquisition channel
**Confidence:** Low
**Basis:** The Cal AI playbook — pay creators a recurring 20% commission for as long as the customer they referred stays subscribed. This creates a strong incentive for the creator to keep promoting. Works well when the product is already good and the creator has an audience that trusts them.
**What would invalidate this:** Creators in the closer space don't trust the product yet (expected for pre-launch), or the 20% commission isn't compelling enough at $149/month ($29.80/month per referral).
**Note:** Affiliate only works after the product is proven. Don't try to use affiliates as a substitute for product validation.
