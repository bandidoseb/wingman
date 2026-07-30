---
name: project-offer-aware-moat
description: "The Offer-Aware Wingman \"Sales DNA\" moat — capture offer+discovery, inject into live cards; Phase 1a shipped, 1b next"
metadata: 
  node_type: memory
  type: project
  originSessionId: 2527411b-a495-40db-9e34-44cd63f049d1
---

**Offer-Aware Wingman (THE MOAT)** — the retention play no competitor is building. Capture each rep's offer + discovery process ("Sales DNA") → inject into the live signal cards so they're offer-specific, adaptive, in the rep's voice (not generic). Started 2026-07-10 S2.

**Canonical design:** `Wingman Brain/07 - North Star/Sales DNA Capture — Design.md`. **Build plan:** `tasks/todo.md` (decomposed 1a→1d + fast-follow). Grounded in the 3 Cole Gordon PDFs (Sales First Principles, Belief Ladder, Closer Crash Course) on Sebastian's Desktop.

**The scientific model:** 7 beliefs (Pain/Doubt/Cost/Desire/Money/Support/Trust) are the universal skeleton — **internal tags only, NEVER surfaced** (IP: plain words safe, branded "7 Beliefs/Belief Ladder" is Cole's). Offer-specific = how each belief *manifests* + the **ONE root everything ladders to** (Sebastian's insight: "quit my job" → chunks to monthly cash-flow → money, because cash creation is his offer's root).

**Locked product decisions (Sebastian):**
- **Quality is NEVER gated.** Free/Core/Pro ALL get offer-aware cards at full quality — gating quality churns users before they taste Pro; the wow must land in the trial. Pro = unlimited calls + premium adds (prospect memory, AI voice setup, talk-with-Wingman, analytics). Blurred-teaser upsell repoints at THOSE, not Sales DNA. (Reverses the original moat-doc "Pro-only page" plan.)
- **Deploy gate (UPDATED 2026-07-11 — overrides the essentials-only version):** can't Deploy until **EVERY Sales DNA question is answered** (core + discovery, all 11 — not just essentials). Sebastian accepts possible drop-off; free-trial card quality wins ("Wingman has to be shown off during the trial to convert"). Nuances: `guarantee` gets an explicit "we don't offer one" option; `syntax:"unsure"` counts as answered — complete = every question ADDRESSED. Same all-questions `salesDnaComplete` helper = 1b's inject threshold AND 1c's gate (zero drift). Gate framing = honest explanation ("Wingman needs context on what you sell / who you sell to / how you run calls or it can't do a good job"), never a naked wall. Incentive idea kept on file (+5 trial calls for completion) — gate chosen instead, could layer later.
- **Activation (1c, Granola-inspired — Sebastian 2026-07-11):** onboarding must include a "Try a demo meeting" equivalent — short onboarding/explanation video + demo video + a **fake sales call on computer audio** so new users deploy Wingman and trigger cards risk-free before a real call. "If you can't teach people to use your software correctly, they churn." Captured in `tasks/todo.md` Phase 1c.
- **No "upload past calls"** — bad rep's bad discovery poisons the baseline. Wingman asks the questions.
- Page renamed Personalize → **"Sales DNA"**; sections "The Core" + "Your Discovery". URL box = reference-only overview (memory-jogger), NOT auto-fill, never feeds cards.

**Phase 1a SHIPPED (PR #41, branch feat/sales-dna-1a):** capture+storage ONLY. `profiles.sales_dna jsonb` (SQL run). Also fixed a **pre-existing security hole**: `/api/profile/update` had no allowlist + service-role write → any user could self-upgrade to Pro; added allowlist + sanitizer. Nothing reaches calls yet.

**Phase 1b (NEXT):** inject `buildSalesDnaBlock()` into the **belief-ladder SUMMARIZER** (the chokepoint every card reads — making it offer-aware feeds the objection card for free) + the dig prompt (cached, ordered before the volatile summary); pass sales_dna client→kb-signal (no hot-path DB read); anti-fabrication fence + adversarial eval traps in dig-eval AND test-belief-ladder. Related: [[feedback-status-lives-in-git]].

**Phase 1d (QUEUED — surfaced by the voice/flow grind 2026-07-19): extend offer-awareness to the OBJECTION card + payment-terms configurator.** The objection card gets the (offer-aware via 1b) live_summary but NOT the raw Sales DNA block — only the DIG card takes `buildSalesDnaBlock` (`buildObjectionUserSegments` has no salesDna param; verify at session start). Two gaps: (1) **money-anchor specificity** — the objection card should name the offer's promised outcome + the prospect's stated goal ("gets you to $30k months" / "builds your land-flipping business"); needs Sales DNA (offer outcome) + [[project-prospect-anchor-capture]] (prospect's actual goal) BOTH wired in. (2) **PAYMENT-TERMS CONFIGURATOR** — a Yes/No + list-your-terms field in Sales DNA that conditionally rewrites the objection prompt: no-terms rep → the `financial-trade` lever is SUPPRESSED (never floats "would you join if we split it up?"). MUST be added to the Sales DNA capture PAGE when it's built. Design: `Wingman Brain/07 - North Star/Sales DNA Capture — Design.md` fast-follow #3 + `Wingman Brain/00 - Product/Objection Flow — Doctrine + Cole-Jeremy Lens.md` open-Q#1.
