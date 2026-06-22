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

---

# 📌 SESSION-READY BRIEF — added 2026-06-20 (PINNED — own dedicated session)

**Read this section first to pick up the back-and-forth build cold.** Everything below was decided
in the 2026-06-20 session where we cut the KB and built the new objection prompt.

## Where we are right now (what's already done)
- **KB is being cut from the live objection path.** A blind A/B test (12 objections, KB vs Claude-free
  vs "like Miner"/"like Gordon") showed the KB added no distinguishable value, and its forced-script
  rule (`base your headline directly on the retrieved script`) was actively dragging cards toward
  mediocre guru scripts. KB stays only for the **Wingman Coach / Mission Intel** (post-call).
- **New objection prompt is built + validated.** Distilled from 7 Cole Gordon + Matthew Ryder
  transcripts into `knowledge-base/objection-transcripts/PLAYBOOK-SYNTHESIS.md`. Prompt lives in
  `scripts/objection-prompt-test.mjs` (`OBJECTION_SYSTEM_PROMPT`); results that proved it in
  `tasks/kb-ab-test/objection-prompt-results.md`. It diagnoses the weak **belief** (Pain/Doubt/Cost/
  Desire/Money/Support/Trust — already tracked live in `belief-ladder.ts`), defaults to **uncertainty
  first**, and anchors every line to the prospect's own words. Output = ONE first-person line.
- **Not yet wired to production.** Still to do (separate from THIS feature): port prompt → a prod TS
  module, cut KB from the objection slot in `src/app/api/wingman/kb-signal/route.ts`, and ship the
  card-UI change (kill the headline → tiny "Objection handle" tag + the line).
- **This multi-turn back-and-forth = its own session.** That's what this brief is for.

## The decision (2026-06-20)
Support the rep through the WHOLE objection exchange (pace → tie-down → isolate → handle → trade is
3–4 turns, never one move — see the case study above). But do it WITHOUT the autonomous auto-listener.

## Recommended direction: **Objection threading (context-aware re-press)**
Keep it rep-triggered. When the rep re-presses mid-objection, that press KNOWS:
- an objection card just fired, **which card / which belief**, and
- **what the prospect just said back**,
…so it returns the NEXT move in the sequence (isolate → handle → trade), not a restart. The rep
presses exactly when they hit the wall — which *is* the "silence costs money" moment — so they stay
human and in control, and we cover the full exchange with no autonomous firing.

## Rejected (for now): armed auto-listener that auto-pops a card each prospect turn
Three concrete reasons (not just "we parked it before"):
1. **#1 product-failure risk.** A card every turn = rep reading AI on every beat = robotic, and (per
   Cole + Ryder) the rep STOPS truly listening — the exact thing that loses the sale. Could make reps
   *worse*. Violates the bowling-bumpers / never-a-script core rules.
2. **End-of-turn detection is unsolved** — same Deepgram/partials problem already in the latency
   roadmap (Issue #41). Don't bet the feature on a dependency we haven't cracked.
3. **Re-opens the retired Phase-1 autonomous-firing model** — cost per turn, and a *wrong* card
   mid-close is the worst possible time to be wrong.
Door left open: IF clean end-of-turn detection lands via the partials work, revisit a *tasteful*
opt-in armed-assist — but only on top of the threading foundation, never as a turn-by-turn feeder.

## Speed (the real concern behind the auto-listener idea)
After an objection card fires, enter a short **"objection mode"** that PRE-WARMS the pipeline and
pre-reads the latest transcript, so the next re-press is near-instant. Gets the speed without
auto-firing.

## Forward-compatibility (good news)
Today's prompt already takes `CALL MEMORY (belief ladder) + the objection`. Threading is an ADDITIVE
change: add a `PREVIOUS MOVE YOU GAVE + WHAT THEY SAID BACK` block to the user message, plus one
doctrine line ("if a previous move is shown, give the NEXT step in the sequence — don't restart").
The sequence (pace→tie-down→isolate→handle→trade) is already in the prompt. So this is an extension,
not a rewrite.

## Dependencies
- **End-of-turn / partials** (Issue #41) — only needed if we ever do the armed version; NOT needed for
  the re-press threading.
- **Live Belief Ladder summary** — already built (`belief-ladder.ts`, `summarize/route.ts`); it tracks
  the 7 beliefs + gap + emotional why + verbatim quotes + weakest link + open objections. This is the
  state the threader reads.

## Core-rules tension to respect (CLAUDE.md)
- "One signal card at a time. Never queue." · "90-second cooldown between cards." · "Bowling-alley
  bumpers, not a script." · "Never make reps robots."
- **Design Q:** the 90s cooldown almost certainly needs an "objection mode" override (you can't make a
  rep wait 90s mid-objection). Decide how objection mode interacts with the cooldown + the one-card
  rule without becoming a turn-by-turn feeder.

## Open design questions for the session
1. State machine shape: track {active belief, last move type, prospect's last response: accepted /
   resisted / redirected / new-objection}. (The existing note's Identity→Reframing→Logic→Accountability
   maps onto pace→tie-down→isolate→handle/close.)
2. Thread vs new objection: how does a re-press know it's continuing the SAME thread vs a fresh
   objection? (Re-distill each press + compare to the last card's belief? time window? open-objection
   state in the summary?)
3. When does the thread END / reset? (commit, stall, or a genuinely new objection branch.)
4. How many beats before it feels robotic — is there a soft limit / nudge?
5. Cooldown + one-card-rule interaction during objection mode (see tension above).
6. Cost: re-press is rep-gated so cost is bounded; confirm.
7. UX of the re-press during a heated exchange (cognitive load of pressing — is there a lighter
   gesture for "next move in this thread"?).

## First steps when this session starts
1. Read this brief + `PLAYBOOK-SYNTHESIS.md` + `tasks/kb-ab-test/objection-prompt-results.md`.
2. Read `belief-ladder.ts` (the live state) + `kb-signal/route.ts` (where the card is generated).
3. Run the **Plan Review Loop** (and the `plan-reviewer` subagent) — this touches the firing model +
   state machine + latency, exactly the kind of change that needs the full treatment before any code.
4. Present the threading design to Sebastian; build only after approval.