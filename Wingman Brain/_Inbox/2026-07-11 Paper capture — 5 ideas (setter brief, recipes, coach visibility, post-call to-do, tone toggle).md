# Paper capture — 5 ideas (2026-07-11, S3)

Sebastian's desk-paper brain-dump, captured verbatim-in-spirit so the paper can be thrown away. Each has Claude's quick take + where it connects to existing roadmap. None of these are committed work yet — this is the durable holding pen.

---

## 1. Setter → Closer briefing (SDR transcripts hand off to the closer)

**Idea:** On a team with setters + closers, when a setter books a prospect onto a closer's calendar, the setter's call notes brief the closer. Wingman should do this automatically: the setter's call transcript → a pre-call brief for the closer (who this is, suggested approach, what to touch on, what to dig into, what to confirm). "Would make Wingman extremely valuable for this niche."

**Claude's take:** Strong, and it's not really a net-new system — it's **cross-*rep* prospect memory**, a direct extension of the already-designed **Call Continuity + Prospect Memory** track (`00 - Product/Call Continuity + Prospect Memory Design.md`). That doc already does cross-*call* deal memory keyed on prospect email via the Recall calendar; this just links two different reps' calls on the same prospect/deal. So the hard infrastructure (prospect identity, deal object, calendar detection) is the same build. Two real adds: (a) a **team/multi-seat** concept (setter and closer are different accounts under one org) — Wingman is single-user today, so this needs an org/roles layer; (b) the setter→closer **brief generation** prompt. Team-tier / down-the-line — a genuine wedge into agencies/sales teams (a higher-ACV buyer than the solo closer).

**⚠️ Sebastian's key challenge (2026-07-11 S3) — this is THE hard part, not the prompt:** how do we get the setter's transcript INTO Wingman cleanly? Setter workflows are all over the board — HubSpot sales dialer, standalone dialers, some record + transcribe, some don't. If the setter isn't running Wingman on their own call, we have no transcript. **Two clean paths worth researching (Sebastian's instinct = go high-level, integrate with the CRM):**
  1. **CRM integration — pull transcripts directly.** HubSpot / Salesforce (+ Close, GoHighLevel, Aircall, Gong) increasingly store the call recording/transcript on the contact record. A read integration pulls the setter call by prospect identity → briefs the closer. Upside: works even when the setter never touched Wingman; meets teams where their data already lives. Downside: N integrations, each CRM's transcript API differs, and coverage depends on the team actually logging calls there.
  2. **Setter runs Wingman too** (both seats under the org) — cleanest data (our own Deepgram transcript, per-speaker) but requires the setter to adopt the app. Best for teams that go all-in on Wingman.
  **Reality:** probably support BOTH — Wingman-native when the setter's on it, CRM-pull when they're not. The CRM path is the unlock for "every sales team has its own process." Needs a real research spike on which CRMs expose transcripts via API and how uniformly. Depends on: calendar detection (queued) + prospect memory track + org/seats + CRM integrations.

## 2. Slash-command "Recipes" + Gmail/Calendar (fix next steps, generate emails/drafts/events/to-dos)

**Idea:** Copy Granola's **Recipes** — sharable slash-command prompts: `/write follow-up email`, `/call notes`, `/list my to-dos`, `/schedule follow-up meeting`. Connect the user's **Gmail** (read context + send) and **Google Calendar** (create events). Generate a Gmail draft or a calendar event straight from the call. Reference Granola heavily.

**Claude's take:** This is the **post-call action layer**, and the to-do list (idea #4) is one recipe inside it. Big, high-value, on-brand for the "close the loop" job. Key design notes for when we build it: (1) **DRAFT ONLY — never send on the rep's behalf** (Sebastian locked this 2026-07-11 S3: "we won't send emails on someone's behalf, we draft it for them just like Granola does"). That massively de-risks the Gmail piece — we generate the draft into their Gmail (or just show copy-ready text) and the rep hits send. Still needs OAuth scopes + token storage/refresh, but a **draft/compose scope**, not full send-on-behalf. Calendar events = create-with-confirm. (2) "recipes" = a **prompt library** — start with a fixed built-in set (follow-up email, to-dos, next-steps, notes), add custom/shareable later. (3) Runs on the retained transcript we already keep — no new data model for the content, only for the integrations. Sequence AFTER the live-card moat. **Granola is the reference — clean, draft-first.**

## 3. Wingman Coach — full visibility (all transcripts, call lengths, everything)

**Idea:** The Coach (Mission Intel) should see everything — every transcript, call length, etc. — not just one call.

**Claude's take:** Today the Coach reads a **single call's** transcript + KB. He wants it to reason across the rep's **whole history** — "where do I keep losing deals," "how long are my closes running," patterns across calls. Coherent with the "Coach = the KB's real home" direction (Sprint queue item #4 is re-deciding whether the KB stays for the Coach). He wants a **dedicated Coach page** ("Hi Sebastian, ask anything" — Granola-style; screenshot attached to the S3 thread) — chat over everything, no per-message limit that the user feels.

**Sebastian's question (S3): how does Granola do unlimited "ask anything over all my transcripts" on a $15/mo plan?** Answer — it's **retrieval (RAG), not brute force.** They do NOT stuff every transcript into the prompt. The mechanics:
  - Each meeting is **embedded + summarized once** at ingest (a cost they already pay). Chat then **retrieves only the few relevant chunks/summaries** for your question and sends *those* — so a query costs roughly the same whether you have 10 meetings or 10,000. Context stays small and flat.
  - **Cheap model for most turns** + **prompt caching** on the system/context → pennies per message.
  - **Economics work on the AVERAGE, not the ceiling.** Most users chat lightly; the heavy few are subsidized by the many who barely touch it. $15/mo easily covers a normal chat load when each turn is retrieval-scoped and cached. (This is the same reason our live-card unit economics work — cost per event is tiny, you price on the average.)
  - We already have every ingredient: retained transcripts, per-call Belief Ladder summaries + post-call debriefs (our per-meeting rollups), embeddings infra, prompt caching. **We can absolutely build the Granola chat experience** — the trick is retrieval discipline, never "load all transcripts."
  **Build path:** dedicated Coach page → embed+summarize each call at post-call time (mostly already done) → chat endpoint that retrieves relevant call-summaries/chunks by the query → cheap model + caching. Cheap first pass = retrieve over the **debriefs + call metadata** (length/outcome/stage coverage) before raw transcript chunks. Sits on top of the Sales DNA learning layer. Screenshot ref lives in the S3 conversation.

## 4. Replace "How'd it go?" with a post-call TO-DO / commitments list

**Idea:** The current end-of-call HUD card ("How'd the call go?" → Follow-up / No-show / Closed) is "a little annoying." Replace it with a **clean checklist of what the rep agreed to do on the call** — the things they promised to send/do — so that after 5 back-to-back calls they don't forget commitments. Check items off.

**Claude's take:** Best "feels like magic" idea on the page, and very achievable — the commitments are extractable from the transcript ("I'll send you the proposal," "I'll loop in my partner," "let's talk Thursday"). It's `/list my to-dos` (idea #2) surfaced automatically at call-end: a running list of what the REP promised to do.

**⚠️ Correction (Sebastian, 2026-07-11 S3) — my earlier "merge with the outcome card" was WRONG. These are two separate things:**
  - **(a) The post-call to-do list = the actual feature.** Auto-extracted **actionables from the call** → a clean checklist the rep checks off. NOTE (Sebastian, S3): it's NOT just the rep's promises — it's *any* actionable surfaced on the call (things to send, people to loop in, prospect to-dos, follow-ups, next steps). Anything the transcript implies needs doing. Solves the real pain: 5 back-to-back calls, a pile of loose ends on each, nothing written down. This is the value. Build it.
  - **(b) The outcome card is a SEPARATE, unrelated gripe — it's a UX problem, not a merge target.** Sebastian's issue isn't *what* it captures, it's *how it looks*: the "How'd it go?" HUD popup right after the call feels **vibe-coded, not clean, slightly off-center**. His instinct: **move outcome capture off the HUD and into the dashboard** (a cleaner surface) rather than a popup that ambushes you the second the call ends.
  - **Correction to my own "don't delete it" (Sebastian pushed back, S3 — he was right to):** I overstated the dependency. Precisely:
    - **Call-counting does NOT need the outcome card.** The pricing rule is "≥10 min AND prospect spoke" — that's call duration + whether the prospect talked, both derivable from the transcript itself. Nothing about Closed/Lost/No-show factors in. I was wrong to list it.
    - **Sales DNA doesn't strictly need it either — but the outcome is its single strongest LEARNING signal.** The post-call job already grades + extracts objections/patterns from the transcript with or without a disposition. What the outcome adds is the *label of what actually worked*: "this approach → **closed**" vs "→ lost." That's the most valuable training signal for the moat, and some of it (a no-show, or a deal that signs off-call days later) genuinely can't be inferred from the transcript — only the rep knows. So it's **valuable to keep, not load-bearing.**
  - **Net:** you CAN delete the HUD card. The only reason to keep *capturing* outcome (somewhere cleaner, e.g. the dashboard / Flight Log entry) is that it's the best label for Sales DNA — not because anything breaks without it. If we drop the immediate popup, add a gentle dashboard nudge on un-dispositioned calls so the learning signal doesn't quietly dry up.

  - **RESOLUTION (Sebastian, S3) — kill the card entirely; infer silently, don't ask the user.** The conversation walked all the way to the honest answer:
    - **Granola has no outcome concept at all** — it's a notes app, not a sales tool; it never asks "did you close?" So Granola isn't a reference here. Disposition is a CRM idea, and **we're not building a CRM** (Sebastian's point).
    - **The real value of an outcome is narrow:** (a) a background LEARNING label for Sales DNA ("this approach → closed vs lost" = the strongest training signal), and (b) eventually a rep-facing win-rate stat. Neither is core daily value (live cards + to-do list + Coach are). It is NOT a feature the rep should have to touch.
    - **Cost is a non-issue:** the post-call Sonnet job already reads the full transcript, so "classify the outcome" is one more field in a prompt we already pay for → ~$0 at any scale.
    - ~~DECISION: delete the HUD popup, infer silently as a weak Sales DNA signal.~~ **SUPERSEDED — see the metrics decision below.** ("Weak Sales DNA signal" was Claude over-stating: the outcome→winning-patterns learning loop DOESN'T EXIST today and needs real volume to matter, so an inferred outcome that nothing consumes = dead data. Sebastian: not building the winning-patterns learning now — "maybe down the line when I have a couple engineers." So silent inference for a non-existent consumer is itself overbuild. The ONLY real, present-day consumer of outcome is the homepage metrics — so the whole question collapses to "do we want the metrics," resolved next.)

## 4b. Homepage metrics redesign (2026-07-11 S3) — the outcome question, resolved through the metrics

**Context:** the homepage currently shows three stat cards — **Total Closes · Close Rate · Calls This Week** (screenshot in the S3 thread). Sebastian is split on them: doesn't want to overbuild low-value stuff, and — the real blocker — **doesn't trust that they're accurate.** "If we get them accurate, then sure."

**The ROI-proof framing got corrected by Sebastian (he's right):** "close rate went from X→Y since Wingman" mostly DOESN'T work as a value prop, because **most reps don't know their old close rate** — ask them and you get a guesstimate, not a real baseline. So there's no trustworthy before/after.

**What DOES have value (Sebastian's own better idea):** a close-rate **TREND CHART inside Wingman** — the rep doesn't need to know their old number, they just watch the line move over time. And the unlock: **"why did my close rate drop 10%?" → chat with Wingman.** The chart becomes a **hook into the Coach** (idea #3): see the dip → ask → the Coach reads your recent calls and explains what changed. That loop (metric → Coach → your own transcripts) is the differentiated, on-brand value — far more than a static stat.

**DECISION / design direction (still evolving, Sebastian leaning here):**
  - **Chart on top = the hero** (close rate over time), stat cards become secondary readouts beneath it.
  - **Drop "Total Closes"** — lifetime raw count only goes up, pure vanity.
  - Keep **Close Rate + Calls**, but make them **dynamic to a timeframe toggle** (Week / Month / Year, maybe All) that rescopes the chart AND both cards together. **NOT six static cards** (close rate this week / month / year × 2 = clutter + more build). One control, everything updates. **Skip the full calendar date-range picker for v1** (CRM-y, more work) — a simple segmented toggle covers ~95%; add custom ranges later only if asked.
  - **Chart pipes into the Coach** — clicking/asking about a dip opens a Coach chat scoped to that period's calls.
  - **HARD GATE = accuracy** (Sebastian's condition). The number is only honest if calls get dispositioned. So: capture outcome as a **one-tap mark in the dashboard** (Flight Log entry — NOT a HUD popup), **nudge un-dispositioned calls**, and compute close rate **only over dispositioned calls** with a visible "based on X of Y calls" so it never silently lies. **If we can't keep it accurate, don't show it.**
  - **Winning-patterns learning stays SHELVED** (Sebastian: not now; later, with engineers). So outcome's only job for now is powering this chart/metric — nothing else consumes it.

  So: **two workstreams.** (a) build the to-do list feature (daily-value, not tied to the live-card pipeline — good early prototype); (b) redesign/relocate the outcome card (a HUD-chrome / dashboard cleanup, cross-links to **Card Placement Studio** and the "app feels flimsy vs Granola" solidity sweep).

## 5. Tone setting for signal cards (and emails) — formal / casual / very casual / excited

**Idea:** A tone toggle (Wispr Flow has formal / casual / very casual / excited). Apply it to how **signal cards** are written, and to generated **emails**. A too-formal card makes a rep sound robotic/scripted when they read it — the tone control fixes that. "Would be fucking sick."

**Claude's take:** We already have this idea captured as **`_Inbox/2026-06-21 Tone register toggle (casual vs professional).md`** (PINNED). This paper note **reinforces and expands it**: (a) more than two registers — a 3–4-step scale (formal → casual → very casual → excited); (b) applies to the **email/recipe** output too, not just live cards. This is directly in service of Core Product Rules #10/#11 (never make reps sound scripted/robotic) — so it's not a nice-to-have, it's moat-adjacent. Cheapest implementation is a single tone knob injected into the card + email prompts (one setting, threaded into every generation prompt), NOT per-card. Natural fit to build alongside either the Sales DNA capture (it's a rep-preference, lives next to their DNA) or the email/recipe layer. **Merge this note into the existing tone-toggle note when that gets scheduled** so we don't fork the idea.

---

### Cross-idea shape

- #2 + #4 are the **same feature family** (post-call action layer / recipes) — build them together; #4 is the flagship recipe.
- #1 + #3 both ride the **prospect/cross-call memory + Sales DNA aggregate** infrastructure — neither is standalone.
- #5 already has a home note; this expands its scope to emails.
- Nothing here jumps the current line: the live-card **Offer-Aware moat** (Phase 1b→1c) stays #1. These are the "Wingman is also your assistant / your team's memory" expansion that comes after the live experience is proven.
