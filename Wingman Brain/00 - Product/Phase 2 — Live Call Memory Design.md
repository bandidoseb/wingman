# Phase 2 — Live Call Memory Design (LOCKED 2026-06-02)

**Status:** Design locked. Not yet built. This is the canonical spec for Phase 2 of the hotkey model.
**Supersedes:** the scout-based parts of the Hotkey Model Build Plan's Phase 2. Read this doc as the source of truth for the live call memory; the build plan's phase order still stands.
**Context:** Worked through live with Sebastian over a long design session. Every decision below was reasoned to the ground and simplified deliberately.

---

## The essence in one paragraph

During a call, a smart AI (**Sonnet** — see the Model choice lock below) keeps a short, living **summary of the call** — a fill-in-the-blanks "Belief Ladder" form. It updates that summary **on a timer** by reading only the new transcript since last time. When the rep **presses an arrow**, ONE fast AI call generates the card from two inputs: the pre-digested summary (the whole call's story) + the **live last ~90 seconds** (word-for-word). A hard rule tells the model the recent words win if they ever disagree with the summary. That's the entire mechanism. No autonomous pop-ups, no scout, no constant AI burn.

---

## The two layers of memory (this is the whole model)

| Layer | What it holds | How fresh | Job |
|-------|---------------|-----------|-----|
| **Rolling summary** (Belief Ladder) | The whole call's story, compressed | Updated on a timer (~every 2 min) | Long-term memory — remembers what was said 30 min ago |
| **Live buffer** | Raw last ~90 seconds, word-for-word | Always current (sent at press time) | Short-term memory — what *just* happened |

The two cover different time horizons. Recent stuff is never stale because the raw buffer is sent live on every press. The summary's only job is the older stuff that's fallen out of the 90s window.

---

## The card generation = ONE fast call (speed + correctness solved together)

When the rep presses an arrow:

1. One Haiku call goes out carrying: **the picked action + the pre-digested summary + the live ~90s buffer + (retrieved KB techniques as examples)**.
2. A hard instruction sets the precedence:
   > **RECENT TRANSCRIPT (last ~90s, word-for-word) = the most current truth. It OVERRIDES the summary on any conflict.**
   > **ROLLING SUMMARY = use for what's not in the recent transcript.**
3. Card comes back. One inference. Fast.

**Why this is the design:**
- **Speed:** the model reads a tiny summary + short clip, not the whole call. The expensive "understand everything" work was already done in the background. → fast.
- **Correctness (the conflict case):** if a belief was locked in the last 60s but the summary lags, the model sees it in the raw clip and trusts the clip. No wrong card. This is a **prompt-design requirement, not an accident** — without the precedence rule, Haiku may over-trust the tidy summary over messy transcript. Lock the rule in.
- **No two-step penalty:** we do NOT "summarize then generate" on press (that would double the wait). Freshness comes from the buffer being *inside* the one generation call.

---

## The summary updater (the background job)

- **Trigger:** a timer. Update at most once per ~60s, and at least once per ~2 min. (No scout — see below.)
- **Mechanism:** **Sonnet** call (model locked 2026-06-05 — see Model choice). Input = **[current summary] + [only the new transcript since last update]**. Output = updated summary. It does NOT re-read the whole call — the current summary is the running compression of everything older. That's what keeps it cheap.
- **Cost is bounded:** rate-limited to at most ~once/minute → at most ~60 tiny updates/hour → pennies. Cannot run away.
- **Vercel-safe (important):** the timer is **client-triggered** — the rep's app pings a `/summarize` endpoint every ~2 min; each call is one short job that finishes immediately. This works on Railway today AND on Vercel later (serverless kills long-lived server-side timers). Build it this way from day one so the Vercel migration needs zero rework here.
- **Persistence (added 2026-06-05):** the updated summary is **saved to `calls.live_summary`** on each tick (the `/summarize` route writes it). The app *also* holds it in memory for instant press-time reads — **app copy = speed, DB copy = durability.** The DB copy is the keystone for two things: **drop-resume** (rejoin a dropped call → reload the last saved summary) and **cross-call prospect memory** (the post-call job rolls it up). The live hot path (press → card) never reads the DB. Full design: `00 - Product/Call Continuity + Prospect Memory Design.md`.

---

## Scout = CUT for v1

The "scout" (demoting `keyword-triggers.ts` to a silent tagger) is **removed from v1.**

- **What the scout was:** a hardcoded list of ~9 phrase groups in code, checked with simple text-matching (like Ctrl+F). Not AI, not trained, no database. Its only proposed job was to trigger summary updates *faster* when a known phrase hit.
- **Why we cut it:** it's a *responsiveness* optimization, not load-bearing. The summary already stays fresh on the timer, and the live buffer already covers recency at press time. The scout added mental + build complexity for marginal benefit.
- **When to revisit:** only if, on real calls, the ~2 min summary lag ever causes a visibly stale card (unlikely, because the live buffer covers the recent window). If so, re-add it then. Parked, not deleted from the idea space.
- **Note:** the current autonomous keyword *cards* are removed regardless (the hotkey model fires nothing unsummoned). `keyword-triggers.ts` becomes dormant/removable in cleanup.

---

## The Belief Ladder template (the "LIVE CALL MEMORY" form)

This is the single template Haiku fills in by reading the transcript. There is only ONE template — it holds both the belief map AND the rich human detail (emotional anchors, exact words). It is NOT two files, and NOT a code list of situations — it's a fill-in-the-blanks form; the intelligence is in Haiku.

```
LIVE CALL MEMORY
Stage: <stage> · Elapsed: <m>m · Syntax: <problems-first | goals-first>
▸ THE GAP (the engine of the sale)
  Current "hell":  <where they are now — numbers + specifics>
  Desired "heaven": <what they want> · $GOAL <number> · why that #: <reason>
  Final straw / emotional why: <their line-in-the-sand moment>
  Core driver: <Certainty | Significance | Growth | Variety | Connection | Contribution>
▸ BELIEF LADDER  (✅ locked · 🟡 partial · ⬜ open · ⚠️ at-risk/objection)
  1 Pain            <state> — <one-line evidence>
  2 Doubt (can't DIY) <state> — <…>
  3 Cost (of inaction / why now) <state> — <…>
  4 Desire          <state> — <…>
  5 Money           <state> — <resources? willingness?>
  6 Support         <state> — <who else decides / spouse>
  7 Trust (why you) <state> — <vs past attempts>
▸ THEIR EXACT WORDS  (verbatim, for tie-downs)
  • "<quote>"
  • "<quote>"
▸ OPEN OBJECTIONS: <none | money / spouse / think-about-it … + handled?>
▸ WEAKEST LINK → <the belief(s) to shore up before closing>
```

**The 7 beliefs map to Wingman's existing 7 pillars:** Pain=core_problem · Doubt=cant_diy · Cost=cost_of_waiting · Desire=dream_outcome · Money=investment_readiness · Support=whos_involved · Trust=why_you.

**WEAKEST LINK** gives the "what am I missing?" framework-check for free — no separate feature needed.

### The "Syntax" line — auto-detected, NOT a dashboard setting
`problems-first` vs `goals-first` describes the order the rep runs the call (pain-first vs dream-first). It is **auto-detected by Haiku** from the transcript — just another blank it fills. It is explicitly **NOT** a rep-configured setting (that would violate "Wingman learns silently, the rep never configures it"). It's the least important line — keep it as a free auto-tag, or cut it with near-zero loss (the summary already holds both pain and goal).

---

## Prompt quality = the #1 lever (added 2026-06-05)

**The prompt is the steering wheel — the single highest-leverage artifact in Phase 2, more than the model choice.** A phenomenal prompt can make a cheap, fast model (Haiku) punch far above its weight, possibly making Sonnet unnecessary. Treat the summarizer prompt as first-class, not an afterthought. Everything below is a build requirement.

### The task has two layers
- **Extraction** — pull explicit facts + verbatim quotes. Easy; Haiku handles it.
- **Judgment** — is pain *really* locked? is there hidden hesitation? what's the weakest link? Hard. This is where a smarter model *or* a sharper prompt earns its keep. The Belief Ladder is mostly judgment, so the prompt must carry an **elite-closer lens**, not just a fill-in form. It is *grading* belief, not transcribing.

### What the prompt MUST contain
1. **Elite-closer lens.** Reason like a Cole Gordon–level sales coach assessing the call. The judgment lives in the prompt, not just the template format.
2. **An explicit bar per belief status**, each with an evidence threshold:
   - ✅ **locked** — the prospect *themselves* affirmed it in their own words (not the rep asserting it, not an inference). Cite the evidence.
   - 🟡 **partial** — touched but not confirmed; some signal, not a clear yes.
   - ⬜ **open** — not yet addressed. Leave it open; never fill from assumption.
   - ⚠️ **at-risk / objection** — the prospect raised hesitation, pushback, or a contradiction on this belief.
3. **Hard-truth + exact-words rules.**
   - Record ONLY what was actually said. No flattering inferences, no filling gaps to look complete. An honest ⬜ open beats a hallucinated ✅.
   - Unaddressed beliefs stay open.
   - Quotes are **verbatim** — press-time tie-downs depend on the prospect's exact words; paraphrase breaks them.
4. **Tight update semantics.**
   - Update fields **in place** — a running scorecard, not an append log.
   - **Recent overrides stale** — if a belief changed (budget $5k → $10k), replace; don't keep both.
   - Keep it **compact + fixed-size** — the template caps length by design; the summary must NOT grow with call length (it rides along on every press → bloat = cost + latency + signal dilution).
5. **Few-shot examples (usually the single biggest quality jump for structured extraction).** Include 1–2 worked examples: a messy real transcript snippet → the correct scorecard update. Show it handling ambiguity right — e.g., a rep *asserting* pain ≠ the prospect *confirming* it → stays 🟡, not ✅.

### Model choice — LOCKED: Claude Sonnet 4.6 (decided 2026-06-05)
**The summarizer runs on Sonnet 4.6. The live press-time card (Phase 3) stays on Haiku** — Sonnet is only for this background judge.

- **What decided it:** a 5-transcript trap test (planted failure modes + a pre-registered answer key — `scripts/test-transcripts/EXPECTED.md`) scored **Sonnet 5/5, Haiku 2 slips** (enthusiasm-as-desire; a muddied hidden objection). Both handled extraction + the rolling-memory mechanics (contradiction override, long-call recall); the gap was pure *judgment* — which is most of what the Belief Ladder is.
- **Speed is a non-issue** — the summarizer is background (~90s/2-min cadence), never on the arrow-press hot path, so Sonnet's latency costs nothing live.
- **Cost reality (the earlier "~20¢" was measured on tiny test transcripts and was wrong):** ~1,800 in / ~620 out tokens per tick, **flat per tick**; tick count scales (~30 on a 45-min call) → un-optimized Sonnet **~44–59¢/call** (Haiku ~15–20¢). Real, not trivial, at 3–4 calls/day.
- **Cost levers — LOCKED into the build (quality-neutral):** (1) prompt-cache the system prompt (1h TTL, −90% cached input); (2) cap output ~400 tok (output @ $15/M dominates); (3) update every ~2 min not 90s (~25% fewer ticks; the live buffer covers recency); (4) skip ticks with no new meaningful speech. → brings Sonnet to **~20–25¢/call** with judgment intact.
- **Margin is solved by PRICING, not the model** — see `06 - Finance/Tier Pricing Proposal + Unit Economics.md`. (2026 research: AI-native gross margins avg ~52%; model access isn't the moat; inference falls ~10×/yr; the fix for AI COGS is tiering/caps.) Keep the summarizer **model-agnostic** (one-line switch) to re-evaluate as prices move.

### Calibrate, don't ship-and-pray (per the 2026-04-13 KB lesson)
You **cannot** judge an extraction prompt by reading it — only by running it and reading the output. (The KB-ingestion prompts looked solid but produced third-person triggers, offer-specific scripts, and non-sales content — only visible in real output.) So:
- Treat the **first real-transcript runs as the tuning phase**, not a final result.
- Iterate the prompt against real messy calls until the scorecard is honest and useful, BEFORE wiring it into the live pipeline or persisting it.
- This is exactly why the build order is **prompt-first: summarizer → side-by-side offline quality test → persist to DB.**

---

## Prompt caching plan

**Cache (stable for the whole call):** the system prompt (rules, card format, the recent-wins precedence rule) + the offer / Sales DNA / rep profile (loaded once at call start).

**Do NOT cache (changes every press):** the live ~90s buffer, the current summary, the KB techniques retrieved for that specific press, the picked action.

- **TTL = 1 hour** (not the 5-min default). Presses can be 20+ min apart; the 5-min cache would expire between them and silently re-charge full price. The 1-hour cache survives the whole call.
- **Warm at call start:** fire a tiny request when the call begins so even the first press is fast/cheap.
- **Keep-warm (Sebastian's idea):** a background ping every ~50 min re-warms the cache before the 1-hour TTL expires, so it never goes cold mid-call even on a 90-min call. One tiny request; basically free. (Presses also reset the TTL, so keep-warm only actually fires during long quiet stretches — exactly the gap it's meant to cover.)

### ⚠️ CRITICAL caveat — verify the cached block clears the minimum size
Anthropic only caches a block above a minimum token count (~1–2k depending on model). If our stable block is under it, **caching silently does nothing and we pay full price every time.** This must be verified at build time — NOT assumed.
- **Good news — it's measurable, not silent on our end:** the API response reports `cache_creation_input_tokens` and `cache_read_input_tokens`. Run one test call, read those numbers, confirm the cache actually engaged. If zero, pad/restructure the stable block to clear the minimum. **Flag this loudly in the caching build task.**

---

## Speculative pre-generation — DEFERRED (back-pocket lever)

Idea: since we know an objection just landed, pre-generate the likely card *before* the rep presses, so it's instant (0 wait).
- **Deferred** because it means paying to generate cards that may never be summoned, and we haven't measured that press-time latency is actually a problem.
- **Pull this lever only if** (a) real calls feel laggy AND (b) margins are healthy enough to spend a few % to buy speed. Sebastian's framing: "if speed is decent and margins are really high and we can lose ~5% margin to make it quicker, maybe we consider it."
- Parked, identified, ready if needed.

---

## Speed / Intelligence / Cost — the scorecard

- **Speed:** one light call at press time (tiny summary + short clip), heavy work pre-done in the background. ~1s for a freshly generated line. Pre-gen in reserve if we need faster.
- **Intelligence:** every card sees the whole call (summary) + the live moment (buffer), reconciled with recent-wins. Grounded in the prospect's exact words. Rich human context (emotional anchors, the gap, the why).
- **Cost:** no always-on *card* AI. The background Sonnet summarizer runs ~every 2 min (rate-bounded; **~20–25¢/call optimized** — see Model choice). Press-time cards only when the rep asks (a few/call, Haiku). Dominant costs: Recall.ai (~$0.50/hr) + the summarizer. Pricing is **tiered** (Free / Core $149 / Pro $299) — see `06 - Finance/Tier Pricing Proposal + Unit Economics.md`.

---

## What this means for the phased build

- **Phase 2 simplifies:** build the timer-driven summary updater (client-triggered, Vercel-safe, rate-bounded) + the Belief Ladder template/system-prompt. **No scout.**
- **Phase 3+ unchanged in shape:** the press → single-call generation with recent-wins precedence; caching + warm + keep-warm folded into the generation/session work.
- **Caching caveat** must be an explicit checklist item with the measure-the-token-counts verification.
