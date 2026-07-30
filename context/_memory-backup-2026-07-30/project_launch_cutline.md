---
name: project-launch-cutline
description: "The launch scope contract and the \"does this block a Test Pilot?\" rule — read tasks/launch-plan.md before proposing any work"
metadata: 
  node_type: memory
  type: project
  originSessionId: 036deeff-d2d0-4187-a039-1ad2f2c2e777
  modified: 2026-07-28T19:11:05.181Z
---

**`tasks/launch-plan.md` is the scope contract until Wingman launches. Read it before proposing ANY work.**

Written 2026-07-26 in response to Sebastian's real problem: *"every time I sit down to work on Wingman I find more things to build… it feels never-ending"* — 3–4 months in, ~15 queued projects. The cause was partly the working method: every session minted 2–3 new projects.

**THE RULE, in force until launch:** before building anything, ask — *"does this block a Test Pilot from using the 4 arrows?"* If no → Parking Lot, and don't discuss it further. **Hold this line even when the idea is good. ESPECIALLY when it's good** — good ideas are how the 15-project backlog happened.

- **Track 1 — Test Pilot beta (~2 weeks):** ship backlog ✅ (v0.1.29) · **dashboard rebuild (1b)** · replay harness · voice grind · prospect anchors · ← Answer arrow · cost guardrails · dogfood · security · launch.
- **Track 2 — public paid (~2 weeks after):** website · Stripe.

**⚠️ AMENDED 2026-07-28 — the one deliberate exception.** Sebastian pulled the **full dashboard rebuild OUT of the Parking Lot into Track 1 Session 1b**, widening it from "Flight Log redesign." Claude flagged the cutline; Sebastian reaffirmed with a method: Claude builds the foundation while Sebastian sweeps the dashboard and reports what sticks out (`tasks/dashboard-sweep.md`). What justified it: the rebuild turned out to be **mechanical, not aesthetic** — the Design Language's own Rollout step 2 ("tokens into the app") had never been done, so `globals.css` had zero tokens and the dashboard carried **662 hardcoded color literals across 41 unique values**. That absence *is* the "Frankensteined" feeling. Plan: `tasks/todo.md`. Discipline retained: one screen per PR, `DashboardClient.tsx` data/polling logic off-limits.
- **Beta = FREE, called "Test Pilots"**, capped 5 → 10, time-boxed + reciprocal ("free through [date], then $149 — feedback is the price"). No credit card: friction kills recruitment, and paying users churn silently while free ones tell you what's broken.
- **Frozen:** confrontation dial, A/V notetaker, summarizer tuning, calendar detection, voice-AI onboarding, owner cockpit, positioning demo, iMessage funnel. *(dashboard rebuild un-frozen 2026-07-28 — see amendment above)*

**Measured economics (not estimates — from Flight Recorder telemetry):** ~**$1.25 per recorded hour** (Recall $0.50 + transcription $0.15 + summarizer ~$0.51 + cards ~$0.05 + post-call ~$0.07). 30-min call ≈ $0.63. **Margins 75–80% on a typical user**, ~55% maxed-out. Prompt caching is ALREADY shipped everywhere and the summarizer sends only the transcript delta, so cost is flat per hour.

Related: [[project-recall-replacement-shadow-mode]] · [[project-positioning-gutter-moments]] · [[feedback-status-lives-in-git]]
