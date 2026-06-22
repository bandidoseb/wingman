# Roadmap

> ⚠️ **Updated 2026-06-21:** "KB/RAG-sourced cards" is no longer a goal — the KB is **cut from live objection cards** (kept for the Wingman Coach). Live objection card = context-driven prompt on Sonnet. Self-host embeddings is now mostly moot for live cards. See Decisions Log 2026-06-21 + Current Sprint.

Last updated: 2026-04-09

---

## V1 — The Finish Line (Pre-Beta)

V1 is not the "full product." V1 is the minimum set of features that delivers a complete, valuable experience. A rep can use Wingman on a real call, get coaching, review their performance, and get better over time. That's the bar.

### Live Call Mode ✅ (keyword signal cards confirmed working on real calls)
- One-click start from tray popover
- Recall.ai captures audio invisibly
- Stage bar tracks call progress
- Signal cards fire at the right moments
- 90-second cooldown enforced (bypassed for keyword/objection triggers)
- "How'd it go?" card fires at call end
- Rep logs outcome in one tap

**Status:** Keyword-triggered signal cards confirmed firing on real calls (v0.1.19). Prospect said "this is too expensive" → card fired correctly. KB/RAG-sourced cards not yet firing (semantic mismatch in KB entries — needs re-ingestion with prospect_trigger field). Playbook page not yet built.

### Flight Log ✅
- Call list with outcome filter
- Per-call debrief: grade, one win, one fix
- Framework coverage (which stages were hit)
- "Ask Wingman" transcript chat per call

### Mission Intel ✅
- KB-powered coaching bubbles
- Close rate trend
- Top objections with frequencies

### Offer Brain ✅
- Silent background learning
- Loads at call start
- Updated after every call
- Reset flow with warning

### Playbook Setup 🔲 (not yet built)
- Rep configures call framework once
- Three tiers: locked core, default-on toggleable, custom
- Used internally — never shown as live HUD checklist

### Objection Vault ✅
- Populated from real calls only
- No pre-seeded data

---

## V2 — After Beta Proves the Core

These features are planned but gated behind: (1) a functioning V1, and (2) real user feedback that these are the right things to build.

### Stage-by-Stage Performance Heatmap
After each call, show how the rep performed at each stage — time spent, objections handled, signals fired. Visual breakdown, not just a text debrief.

**Why V2:** Requires enough call data to be meaningful. 2 calls has no patterns. 50 calls does.

### Playbook Framework Post-Call Review (inline, per stage)
Show which framework items were covered at each stage, not just overall coverage.

**Why V2:** Technically complex (requires stage-level transcript segmentation). Not necessary for first value.

### Trigger Classifier Upgrade
Replace keyword-based pattern matching with a proper classifier (fine-tuned or few-shot Haiku). Catch nuanced triggers the pattern matcher misses.

**Why V2:** The current keyword classifier is good enough for beta. Real call data will reveal what it misses. Don't over-engineer before we have data on failure modes.

### Session Memory (Redis)
Replace in-memory session context with Redis so session state persists across Railway restarts and scales to concurrent users.

**Why V2:** In-memory is fine for beta (<10 concurrent users). Redis becomes necessary at scale.

---

## Future — Vision, Not Promise

These are real ideas that belong in Wingman's long-term future. They're not on the roadmap because V1 isn't done yet. Log them here so they don't get lost.

### ElevenLabs Voice Coaching Tier
Premium tier: Wingman whispers coaching in the rep's ear via an earpiece using real-time TTS. No reading required.

**Why future:** Hardware dependency (earpiece), setup friction, TTS latency risk. The text card is simpler and proven. Voice is a premium upsell after core product is proven.

### Team Dashboard (Manager View)
Managers can see aggregate performance across all reps on their team. Leaderboards, trends, framework coverage by rep.

**Why future:** Different buyer (manager, not rep). Requires multi-seat accounts, permissions model, team-level reporting. This is a year-2 enterprise feature, not a V1 concern.

### CRM Sync (Salesforce, HubSpot)
Write call outcomes, debrief, and grade back to the rep's CRM automatically.

**Why future:** Each CRM is a separate integration project. The target user often doesn't use a CRM. Build when demand is proven.

### AI Roleplay Mode
Let reps practice their pitch against an AI prospect before live calls.

**Why future:** Different use case (practice vs live), different session architecture. Hyperbound already does this. Wingman's advantage is live-call context — don't dilute.

### Multi-Language Support
Signal cards in Spanish, Portuguese for Latin American sales markets.

**Why future:** The beachhead is English-speaking US closers. Global expansion is a growth-phase decision.

### Minimum Call Duration Before Usage Counts
Don't count a call toward the usage limit (or subscription call counter) unless it's at least X minutes long (e.g. 2–3 minutes). Protects against accidental deploys, test calls, and calls that end immediately due to wrong meeting or tech failure.

**Why future:** No billing is live yet, so there's no urgency. Decide the right threshold once real usage data shows how often short accidental calls happen.

### Wingman API
Let other sales tools (dialers, CRMs) integrate Wingman's signal card engine.

**Why future:** Platform play. Year 3+. First build the product people want, then let others build on top of it.

---

## What "Done" Means for V1

V1 is done when a rep can:
1. Open Wingman and click Deploy
2. Wingman listens live on their sales call
3. Signal cards pop up at the right moments
4. Stage bar tracks them through stages
5. Call ends → "How'd it go?" card fires → outcome logged
6. Post-call job fires automatically
7. Rep sees Flight Log with transcript, debrief, grade, framework coverage
8. Rep can chat with "Ask Wingman" about any call
9. Objections from the call appear in Objection Vault
10. Offer Brain updates silently in the background
11. Rep sets up their Playbook framework once → Wingman uses it every call

That's the finish line. Everything else is V2.
