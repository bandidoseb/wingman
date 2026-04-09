# Bubble Discipline

Last updated: 2026-04-02

This is the philosophy and ruleset governing when signal cards fire. This document exists because the most common failure mode for a product like Wingman is signal cards that fire too often. When that happens, reps ignore them. When reps ignore them, the product is dead — it's just a notification machine they've learned to dismiss.

Read this before building any feature that touches when or how cards fire.

---

## The Two UI Elements

Wingman has two visible elements during a live call. They are emotionally different. This difference is not cosmetic — it's the product's core mechanic.

### Stage Bar
A quiet presence. Always visible in the corner of the screen. Tracks which stage of the call the rep is in. It says: *"I'm here. I'm with you."*

The Stage Bar is passive. It doesn't demand attention. Reps glance at it the way a driver glances at a speedometer — briefly, automatically, without breaking focus. It provides orientation without interruption.

**Emotional message:** "You're being seen. Keep going."

### Suggestion Bubble (Signal Card)
A rare intervention. Only fires when it matters. When it appears, it demands attention — because it's supposed to. It says: *"Stop. This moment matters. Here's what to do."*

The contrast between the passive Stage Bar and the active Suggestion Bubble is what gives the bubble its power. If the Stage Bar fired constantly, reps would ignore the bubble. The bubble works *because* it's rare.

**Emotional message:** "This moment is costing you money if you miss it."

The signal card is not a notification. It's an alarm. Alarms that go off constantly get ignored. Alarms that go off rarely get acted on immediately.

---

## The 5 Non-Negotiable Bubble Rules

These are architectural constraints, not preferences. They do not get adjusted in response to feature requests without a serious conversation.

### 1. One bubble at a time. Always.
No queue. No "next card waiting." If a trigger fires while a card is already showing, the new trigger is discarded. The rep is already handling a moment. Don't stack.

*Why:* Two cards on screen means the rep has to choose which to read. That cognitive load breaks their flow. One card, handled, then the next moment — that's the rhythm.

### 2. Only fire when silence would cost money.
This is the test before every trigger fires: "If the rep said nothing here, would it cost them the deal?" If the answer is yes — fire the card. If the answer is maybe, probably not, or you're not sure — don't fire.

*Why:* False positives (cards that fire when they shouldn't) are far more damaging than false negatives (moments where a card should have fired but didn't). A rep who gets a card that doesn't match the moment loses trust in Wingman. A rep who misses a card and still closes learns nothing new.

### 3. Stage-based suppression.
**Rapport stage: almost nothing fires.** The rep is building connection. Any interruption during Rapport signals to the rep that Wingman doesn't understand what they're doing, and it breaks the energy they're trying to create.

Cards fire most during: Discovery (if rep rushes past pain), Press (if rep skips it entirely), Confirm (if rep jumps to pitch), Close/Objections (the primary use case).

*Why:* Wingman is built on the Cole Gordon / Jeremy Miner framework. That framework says Rapport is about slowing down and matching energy. Interrupting it with AI suggestions is the opposite of what the methodology prescribes.

### 4. 90-second minimum cooldown between cards.
After a card fires and is dismissed, no new card can fire for 90 seconds. No exceptions.

*Why:* 90 seconds is enough time for the rep to use the suggestion, evaluate the prospect's response, and re-establish the conversation's rhythm. Back-to-back cards destroy the rep's ability to feel like they're in control of the call — Wingman starts to feel like it's running the conversation.

### 5. Use tie-down language — the prospect's exact words.
When a card references the prospect's problem, it uses the exact words the prospect used to describe it. Not a summary. Not a cleaned-up version. The exact words.

*Why:* This is the most powerful technique in consultative sales — reflecting back someone's own language creates instant connection and bypasses defensiveness. A prospect who said "I feel like I'm spinning my wheels every morning" hears something completely different when the rep says "you mentioned spinning your wheels every morning" versus "you mentioned feeling stuck." The exact words carry the emotional weight. The summary doesn't.

---

## Stage-by-Stage Fire Discipline

| Stage | Card Frequency | What Cards Fire For |
|-------|---------------|---------------------|
| Rapport | ~0 | Almost never. Warmup questions, pleasantries, match energy. |
| Pre-frame / Agenda | Very rare | Only if rep skips setting the agenda entirely |
| Situation | Rare | Rep rushing through fact-finding, missing key context questions |
| Pain / Problem | Moderate | Rep not going deep enough, pivoting too fast, prospect volunteering pain rep isn't pursuing |
| Desired Outcome | Rare | Rep about to pitch before confirming prospect's stated goal |
| Transition / Bridge | Moderate | Rep trying to pitch without summarizing pain first |
| Pitch | Moderate | Rep going too long, feature-dumping instead of connecting to pain |
| Close + Objections | High | Price objections, "I need to think about it," "I need to talk to my spouse," silence after price reveal |

*Note: "High" here still means rare in absolute terms. Even in the Close stage, the 90-second cooldown and single-card rule apply.*

---

## The Core Philosophy

> **Wingman speaks only when silence would cost you money.**

This is the product in one sentence. Everything else — the RAG pipeline, the trigger classifier, the cooldown logic, the stage suppression — is infrastructure that enforces this sentence.

Wingman is bowling alley bumpers. The rep bowls the ball. Wingman only activates when the ball is about to go in the gutter. Between those moments, Wingman is silent. The rep is in control. Wingman is watching.

The highest-performing closers in the world will judge this product harshly if it makes reps sound scripted. "I'm just reading what Wingman told me to say" is a product failure. "I felt like I knew exactly what to say right when I needed it" is the product working perfectly.

The difference is frequency. Rare and surgical = intuition. Common and mechanical = script.

---

## What Breaks This

Log anything here that threatens Bubble Discipline:

- Feature requests for "more cards" without evidence that current frequency is too low
- Trigger classifier that's too sensitive (low specificity = too many false positives)
- Session memory not working (cards fire for things already covered)
- Cooldown logic breaking due to race conditions
- Cards queuing instead of being discarded when one is already active
