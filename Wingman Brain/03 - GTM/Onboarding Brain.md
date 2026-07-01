# Onboarding Brain

Last updated: 2026-04-02

Everything known about the first 10 minutes of a new user's experience. The goal: get them to their first "aha moment" as fast as possible.

---

## The Aha Moment

> **The first time a signal card fires on a real call and it's exactly right.**

Not a demo. Not a simulation. A real call, a real prospect, a real objection — and Wingman fires a card that says exactly what the rep needed to hear in that moment.

That's the moment the product sells itself. Everything before it is removing friction. Everything after it is retention.

---

## The Ideal First Session (What We Want)

1. Rep installs the app (downloads .dmg, drags Wingman to Applications, opens it — no quarantine command needed; the build is notarized as of 2026-07-01)
2. Signs up with email, completes onboarding flow
3. Connects their call platform (Zoom / Google Meet)
4. Configures their Playbook framework (what they sell, their call structure)
5. Starts their first real call with Wingman running
6. Gets 2-3 signal cards that feel precise and useful
7. Ends the call → logs outcome → sees the debrief
8. Opens Flight Log, reads their grade and coaching notes
9. Thinks: "I want this on every call."

**Time to first value:** Ideally within their first call, same day as installation.

---

## Current Onboarding Flow (Implemented)

Multi-step onboarding modal that collects:
- What offer they sell
- Their current close rate range
- Platforms they use (Zoom / Google Meet / Teams)
- Acknowledgment of system requirements (Apple Silicon, macOS 13+)
- Zoom display name setup (required before deploying)

**Status:** Implemented in `src/components/onboarding/`. Working.

---

## Where Users Currently Get Confused

*[Populate from beta feedback — these are hypotheses until confirmed by real users]*

**Hypothesis 1: The quarantine removal step. — ✅ ELIMINATED 2026-07-01.**
This used to be real friction: the app wasn't notarized, so users hit a macOS security warning and had to run a Terminal command (`xattr -dr com.apple.quarantine …`). **Notarization is now enabled** (v0.1.27+), so the app opens cleanly with no warning and no Terminal step. This drop-off point is gone — do NOT reintroduce the command in onboarding.

**Hypothesis 2: "Deploy Wingman" button.**
The button is in the tray popover. Users need to find the tray icon in the menu bar, click it, and then click Deploy. This requires them to know to look in the menu bar — which Mac-native users will, but newer Mac users might not.

**Mitigation:** Onboarding email with screenshots. Consider an in-app walkthrough that points to the tray.

**Hypothesis 3: Nothing happens on the first call.**
If the trigger classifier doesn't fire (because the call is pure rapport or the rep doesn't hit a trigger moment), the first session produces zero signal cards. The rep might conclude "it doesn't work."

**Mitigation:** Stage bar should be visually engaging even when no cards fire. "Wingman is listening" state should feel reassuring, not absent. Consider a welcome card on first call start that explains Wingman only speaks when it needs to.

---

## Onboarding Email Sequence (Working Draft)

**Email 1 — Immediately after signup:**
Subject: "Welcome to the beta — read before your first call"
Content:
- How to install (download .dmg, drag to Applications, open — notarized, no quarantine command needed)
- Note: app auto-updates itself from here on (as of 2026-07-01) — no manual re-downloads
- Finding the tray icon
- The 3-minute setup before your first call (Playbook, Zoom display name)
- What signal cards look like
- What to do if you have questions

**Email 2 — 24 hours after signup (if no call started):**
Subject: "Ready for your first Wingman call?"
Content:
- Simple reminder
- "Takes 3 minutes to set up, here's how"
- What to expect on your first call

**Email 3 — 48 hours after first call:**
Subject: "How'd your first session go?"
Content:
- Request for feedback (2 questions max)
- Link to schedule a call with Sebastian
- Invite to leave a testimonial if they loved it

---

## Questions New Users Ask

*[Populate from actual beta support questions — these are hypotheses until confirmed]*

**Expected common questions:**
- "I don't see any signal cards — is it working?" (Most likely: they haven't hit a trigger moment yet, or the call is still in Rapport)
- "How do I know what stage I'm in?" (Stage bar shows this)
- "Can I see the transcript of my call?" (Yes — in the Flight Log after the call ends)
- "How do I update my offer details?" (Settings tab)
- "What if a signal card fires at the wrong time?" (Dismiss it, one tap)
- "Does my prospect know this is running?" (No — it's invisible to them)

---

## What Success Looks Like at Day 7

A rep who has used Wingman for a week:
- Has run at least 3 calls with Wingman
- Has dismissed at least one signal card (means they're engaging with them)
- Has checked their Flight Log at least once
- Can explain what Wingman does to a fellow closer without being prompted

If a rep hits all four of those by day 7, they're likely to stay.

---

## Retention Risk Factors

*[Hypotheses — validate with data]*

- No calls in first 3 days → at risk (they signed up but haven't started)
- First card fires, rep ignores it → at risk (disengaged from the product)
- App crashes during first call → high churn risk (first impression broken)
- Onboarding too complex → rep gives up before first call
