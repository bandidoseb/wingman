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
1. **Syntax auto-detect — ✅ BUILT 2026-07-11 (post-call SELF-UPDATE, Sebastian's model).** Correction from the first cut: reps fill this at onboarding with 0 calls and won't revisit the page, so a page-load suggestion never fires. Right model (Sebastian): "not sure" flags the account → after real calls the **post-call job self-updates it** → the page explains what was found. Implementation: post-call `route.ts` step 6d — for an "unsure" rep only, regex-parse the `Syntax:` line out of their last 10 `live_summary` blobs via `detectSyntax()` (`src/lib/wingman/syntax-detect.ts`, 9 unit tests; needs ≥3 readable signals + ≥60% agreement) and MERGE-write `sales_dna.syntax = detected` (never clobbers the blob; never touches a deliberate pick; independent + non-blocking like 6a–6c). The Sales DNA page re-derives the same detection to EXPLAIN it: a passive "📊 Based on your last N calls, Wingman noticed you open X-first — set for you, change anytime" note, plus a fallback confirm-chip for the brief window before post-call catches up. `/api/wingman/detect-syntax` (GET) powers the page note. Detector unit-tested; the post-call self-update + live note need a rep with ≥3 real calls to verify end-to-end (no seeded data yet). **RACE FIXED (reviewer-flagged, 2026-07-11):** the write is an atomic single-key `jsonb_set` via the `set_sales_dna_syntax_if_unsure` Supabase RPC (guarded on `sales_dna->>'syntax' = 'unsure'` + `p_syntax in ('problems','goals')`, `security invoker` so RLS protects cross-user calls), so a concurrent whole-blob save from the client can't clobber it and vice-versa. **DEPLOY DEP: the SQL function must exist in Supabase — Sebastian ran it 2026-07-11.** Known imperfection (acceptable): the passive note also shows for a rep who MANUALLY picked a syntax their calls confirm — harmless/true; a persistent auto-vs-manual marker would refine it later.
2. **Mic brain-dump** on every field (record → transcribe → discard audio). Highest-lift single piece; can trail the text-first capture.
3. **Payment-terms / discount configurator (Sebastian 2026-07-19) — gates the objection card's `financial-trade` lever.** Wingman must never float a payment plan or discount to a rep who doesn't sell that way (reads as "that's not how I sell"), and must know the ACTUAL terms when they do. Add a **conditional configurator** to Section 1 — Your Offer:
   - **"Do you offer payment plans, discounts, or flexible terms? Yes / No."**
   - If **Yes** → free-list every plan/term ("2-pay, 3-pay, 10% PIF discount, first-month-then-monthly…"). Wingman can then offer a REAL trade in its own words.
   - If **No** → Wingman **suppresses** the `financial-trade` lever entirely and re-points that beat to a value/terms-neutral reframe instead of "would you join if we split it up?"
   - Mechanism = a toggle/field that **conditionally changes the objection prompt** (DB field → prompt injection) — the first real "Sales DNA configurator" where a captured answer rewires an instruction. Ties to the objection flow: `00 - Product/Objection Flow — Doctrine + Cole-Jeremy Lens.md` (open question #1). This is what Wingman "leans on" for the trade — the rep's actual offer, not a guess.
4. **Logistics / FAQ capture (brainstorm — Sebastian 2026-07-19, don't over-engineer).** Late-call factual questions ("how many calls/week? how often with my coach? what's the guarantee?") currently live in the ← answer slot. Consider a lightweight "common logistics questions + your answers" capture so Wingman can feed the answer — weigh value vs. capture burden. Related: the ONE-continuous-flow / ↑↔← handoff problem (Objection Flow doc, open question #2).

## Injection (how it reaches the card)
Compile the Sales DNA (offer core + discovery map) into a compact **SALES DNA** context block (like `buildRepProfile`), inject as a cached content block into the ↓ Dig generator (`dig-signal.ts`) first, then Objection + the summarizer. Prove with the dig eval (`scripts/dig-eval.mjs`) before shipping: offer-aware beats generic, 0 fabrication regression.

## Storage (proposed)
`profiles.sales_dna jsonb default '{}'` holding the new discovery fields (flexible — question edits need no migration). Reuse existing `ideal_client` / `unique_differentiator` / `guarantee`. Completeness for the gate derived from the essential keys (source of truth = the data). Apply via Supabase SQL (schema drift is expected here). Details in `tasks/todo.md`.

---

## Capture-method evolution — "Wingman interviews the rep like a prospect" (Sebastian, 2026-07-11)

Surfaced when Sebastian filled the questionnaire live to test Phase 1b. His own answers exposed the
weakness of a static form AND pointed at the fix.

**What his answers revealed:**
1. **Q4 (problems vs. goals) doesn't fit reality → LOCKED FIX (Sebastian 2026-07-11): FOUR options, not three.**
   `Problems first` · `Goals first` · `I read the room` · `I'm not sure`. Rationale: this is high-level sales
   training — some reps are *trained* problems-first, some goals-first, some adapt, and **some genuinely don't
   know the framing exists.** "I read the room" is a CONFIDENT adaptive answer (not indecision); "I'm not sure"
   is the real don't-know. They differ downstream: "I'm not sure" should trigger the Syntax auto-detect
   fast-follow; "I read the room" should NOT (it's intentional). CODE IMPACT: `SalesSyntax` type gains a 4th
   value (e.g. `"read_room"`) + `SYNTAX_LABEL` / `VALID_SYNTAX` / PersonalizeTab options. Not yet built.
2. **Beliefs bleed across boxes.** His "cost" answer folded into his "desire" answer — a real closer thinks in
   connected arcs, not isolated fields. A form fights that; a conversation wouldn't.
3. **The richest context came UNPROMPTED.** He chunked down on himself because he knows how. A typical rep
   writes "cash flow" and moves on — the depth that makes cards sharp never gets captured by a passive form.

**The idea (sharpens the already-planned "AI voice-call later" / 1d mic brain-dump):** don't make the voice
AI a passive transcriber — **make it RUN A DISCOVERY PROCESS on the rep, chunking down on their answers the
way a closer digs a prospect.** Rep says "cash flow" → Wingman asks "cash flow to do what? for who? what does
hitting that unlock for them?" Wingman already knows how to dig (it's the whole product) — point that skill at
the REP to pull their own offer out of them. Onboarding call could be with Sebastian OR a voice AI.

**Full flow (Sebastian 2026-07-11):** an onboarding **discovery CALL** on every user via voice AI.
1. The voice AI walks the questions and **keeps chunking down on each answer while it senses there's more
   context to get.** ("cash flow to do what?" → "what would that free you up for?" → …)
2. When it judges it has *enough* on that question, it **moves on to the next** — collecting far more than a
   form ever would.
3. When it has everything, it **tells the rep what to do next**, and **auto-fills the entire Sales DNA page
   itself** from the conversation.
4. The rep opens the Sales DNA page, **sees everything already filled in, and can edit** anything.
Bonus: it's a **data goldmine** — running a real discovery on every user teaches Wingman about offers,
objections, and how top closers actually talk. Two wins: the rep gets a far richer DNA with zero effort,
and Wingman gets a corpus no competitor has.

**Why it matters:** the moat's quality is capped by how much real context the rep gives. A form gets "cash
flow"; a chunk-down interview gets the full belief map. This is the difference between a shallow DNA and a
DNA that makes every live card feel like it was written by someone who knows the offer cold.

**Status:** future — extends 1d (mic brain-dump) into a conversational, chunk-down capture. Build the
text questionnaire (1a, shipped) + mic brain-dump (1d) first; layer the interviewing voice AI on top when
the capture surface is proven. Live-demo evidence that the moat works on a real offer: this session
(2026-07-11), Sebastian's land-investing offer — offer-aware dig chunked "I want out" → "what would you need
to be making to leave?" with zero fabrication.
