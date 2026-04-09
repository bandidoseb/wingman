# Feature Decisions

Last updated: 2026-04-02

This file tracks what is in V1, what is deferred, and why. Every deferred feature has a reason. If the reason changes, update this file.

---

## V1 — What Ships

These features define the minimum complete product. A user can't have a valuable Wingman experience without every one of these.

### Live Call Mode
The core product. One-click start from the tray popover. Recall.ai captures audio. Signal cards fire at the right moments. Stage bar tracks progress. Call ends → "How'd it go?" card fires → rep logs outcome in one tap.

**Why it's in V1:** This is the product. Without this, nothing else matters.

### Flight Log
A list of every call with: outcome, call grade, debrief summary, one win, one fix, and a full transcript chat ("Ask Wingman"). Individual call entries show which framework items were covered.

**Why it's in V1:** Without a feedback loop, reps can't improve. The Flight Log is what makes Wingman a coaching tool, not just a call assistant.

### Mission Intel
Daily coaching tab with: close rate trend, top objections (with frequencies), overall performance score. KB-powered coaching bubbles that answer questions about the rep's calls.

**Why it's in V1:** Shows reps they're getting better over time. This is the retention flywheel — reps who see their close rate improve don't leave.

### Offer Brain
Silent background learning. Loads at call start. Updated after every call. Never manually configured. Reset button with warning.

**Why it's in V1:** The moat. The thing that makes Wingman personalized. Without it, signal cards are generic. With it, they're surgical.

### Objection Vault
A library of every objection raised on real calls, with what was tried and whether it worked. Only populated from real calls — no pre-seeded data.

**Why it's in V1:** Reps facing the same objection repeatedly want to know what other reps did. This is organic institutional memory.

### Playbook Page
Pre-call framework setup. Rep configures their call checklist once. Wingman uses it internally to decide when to fire cards — never shown as a live HUD checklist.

**Why it's in V1:** Without a framework, signal cards have no structure. The Playbook is the skeleton Wingman hangs cards on.

---

## V2 — Explicitly Deferred

### Stage-by-Stage Performance Heatmap
After each call, show a visual breakdown of how the rep performed at each stage — time spent, objections handled, signal cards that fired.

**Why deferred:** Requires a significant amount of call data to be meaningful. A rep with 2 calls has no patterns worth heatmapping. V2 makes sense after the user base is established and has enough call history.

**What we're doing instead in V1:** Simple call grade (A/B/C/D) + one win + one fix. Gets the rep the feedback they need without the complexity.

### Playbook Framework Review (inline, per stage)
Show the rep which framework items were covered at each stage, not just overall.

**Why deferred:** Technically complex (requires stage-level segmentation of the transcript) and not necessary for first value. Post-call debrief covers the gap.

### Multi-Offer Profiles
Let a rep run multiple Offer Brains — one per offer they sell.

**Why deferred:** The target user (high-ticket commission closer) almost always sells one offer. Multi-offer is an enterprise/agency use case. Adds complexity now for a user we're not targeting yet.

---

## Future (Not Dated)

### ElevenLabs Voice Coaching Tier
Instead of text signal cards, Wingman whispers coaching in the rep's ear via an earpiece using ElevenLabs TTS.

**Why not now:** Hardware dependency (earpiece), setup friction, and TTS latency add risk. The text card is simpler, faster, and invisible. Voice tier is a premium upsell after the core product is proven.

**When to revisit:** When a rep tells us the text card is distracting and they'd rather have audio.

### Team / Manager Dashboard
Managers can see aggregate performance across all reps on their team.

**Why not now:** Requires multi-seat accounts, permissions model, team-level reporting. Completely different buyer persona (VP Sales vs individual closer). This is a year-2 enterprise pivot, not a V1 feature.

### CRM Integration (Salesforce, HubSpot)
Write call outcomes, debrief, and grade back to the rep's CRM automatically.

**Why not now:** Each CRM integration is a small project. The target user (high-ticket phone closer in info products) often doesn't use a CRM at all — they use spreadsheets or a simple Notion board. Don't build for infrastructure they don't have.

### AI Roleplay Mode
Let reps practice their pitch against an AI prospect before live calls.

**Why not now:** Different use case (practice vs live), different session architecture, and competes with tools like Hyperbound that are already good at this. Wingman's advantage is live-call context — don't dilute it.

### Windows / Linux Support
Recall.ai Desktop SDK is Apple Silicon only. No path to Windows until Recall.ai ships a Windows SDK.

**Why not now:** Hard technical constraint. Not Wingman's decision to make.
