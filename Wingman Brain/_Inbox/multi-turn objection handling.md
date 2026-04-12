# Multi-Turn Objection Handling

## The Follow-Up Problem (Nerd with a Pickup Line)
Wingman currently helps with the first objection handle, but sales reps get stuck if the prospect pushes back again. The pattern is like a nerd with a pickup line: the first line gets a response, but if the other person hesitates or counters, the interaction falls apart unless the rep can keep the conversation alive with a follow-up that matches the new objection.

The real product gap is not the first rebuttal. It is staying present through the full 3-4 turn exchange, where the prospect keeps shifting the reason for hesitation and the rep has to keep tracking the thread without losing the frame.

## Why This Matters
This is the difference between Wingman acting like a notetaker and acting like a co-pilot.

A notetaker can capture what happened after the fact. A co-pilot helps during the live exchange, keeps the conversation state in memory, and suggests the next best move as the objection evolves.

If Wingman can track the whole objection chain instead of only the first objection, it becomes useful in the exact moment reps usually lose momentum. That means better closes, less fumbling, and a much stronger sense that Wingman is participating in the sale rather than just documenting it.

## Case Study: High-Ticket Close (4 Turns)

### Turn 1 — Identity
PROSPECT: "I don't want to do it on this call. Like if I wanted to think about it as I drive home, can I do that as well?"
REP: [Identity Reframing/Pattern Interrupt] "...That woman — do you think she would figure out how to make it work or continue that path of indecisiveness?"

### Turn 2 — Reframing
PROSPECT: "No I feel pressured."
REP: [Reframing Pressure] "...that's good pressure because that means you're actually taking the steps to change."

### Turn 3 — Logic
PROSPECT: "I think I just feel pressured that I have to make a big payment right now."
REP: [Financial Logic/Palatable Pieces] "...would you be ready to take that step to make the commitment to being who you want to be?"

### Turn 4 — Accountability
PROSPECT: "I think I definitely could. Yes. I just feel so much pressure to do it right now on this phone call."
REP: [Accountability/Hard Close] "...It starts with looking the discomfort and the fear in the eyes... what most doctors do is split it down the middle..."
PROSPECT: "Okay."
REP: "So are you excited?"
PROSPECT: "Excited enough to go get my credit card now."

## Technical Implementation Idea
Wingman should maintain conversational state across objection turns, not just surface a one-shot response.

Possible approach:
- Track the active objection thread as a lightweight state machine.
- Save the last objection category, the rep's last response type, and whether the prospect has accepted, resisted, or redirected.
- Use turn tracking so the assistant knows when it is in Identity, Reframing, Logic, or Accountability mode.
- Surface suggestions based on the current phase of the exchange, with follow-up prompts that build on the prior turn rather than restarting the conversation.
- Keep the state alive until the prospect either commits, stalls, or introduces a new objection branch.

This would let Wingman support the full objection sequence instead of dropping context after the first reply.