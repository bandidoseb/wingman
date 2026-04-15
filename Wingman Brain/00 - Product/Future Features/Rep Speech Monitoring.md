---
name: Rep Speech Monitoring — Proactive Rep Behavior Signal Cards
type: feature
status: schema-ready, pipeline-not-built
logged: 2026-04-10
---

[[Architecture]] | [[Objection Sequences (Option A)]] | [[KB Visual Brain]]

# Rep Speech Monitoring

## What It Is
Wingman listens to the REP's speech (not just the prospect's) and fires directional signal cards when the rep is about to make a behavioral mistake.

These are NOT coaching cards about what to say to the prospect. They are internal behavioral nudges — the rep's inner voice telling them to check themselves.

## Examples of Rep-Triggered Cards
| Rep behavior detected | Card fires |
|---|---|
| Rep has been talking 90+ seconds straight | "Go quiet. Listen." |
| Rep revealed price and kept talking | "Stop. Let it breathe." |
| 12+ minutes in, no pain question asked | "Dig into the pain." |
| Rep asked a closed question in discovery | "Open it up." |
| Rep skipped transition before pitch | "Bridge first." |
| Rep sounds defensive on an objection | "Slow down. Agree first." |

## UX Design
- **Toggle in Settings** — user can turn rep monitoring ON or OFF
- When OFF: Wingman only reacts to prospect speech (default behavior)
- When ON: Wingman also fires directional cards based on rep patterns
- Rep cards are HEADLINE ONLY (no subtext) — they're quick behavioral corrections, not full technique guidance
- Rep cards use a different visual indicator (subtle — not the same urgency as objection handle cards)

## Schema Design (Already Future-Proofed in KB)
Each `kb_entries` row has:

```
trigger_speaker       TEXT — "prospect" or "rep"
rep_trigger_pattern   TEXT — description of the rep behavior that triggers this
                             e.g., "rep_monologue_duration > 90s"
                             e.g., "no_open_question_in_last_300s"
                             e.g., "price_revealed_and_rep_speaking"
rep_trigger_condition TEXT — the detection condition type:
                             "duration_threshold" | "pattern_absence" | "sequence_violation"
```

## How Detection Would Work (When Built)
Unlike prospect triggers (semantic similarity), rep triggers are mostly **behavioral/temporal**:
- Rep monologue timer: track consecutive rep speech seconds
- Question type classifier: detect if rep asked open vs. closed question
- Stage gate checks: verify rep covered required topics before advancing
- Price reveal + speech: detect if rep spoke within 3s of mentioning price/investment

Some rep triggers would still use semantic similarity against rep speech (e.g., detecting defensive language, detecting "feature dumping" during pitch).

## What's NOT Built Yet
- Rep speech isolation in the transcript stream (need to identify rep vs. prospect lines)
- Rep behavior tracking logic in useWingmanPoller.ts
- Rep trigger extraction in the ingestion pipeline
- Settings toggle UI

## Notes
- Rep monitoring cards should feel like a silent coach, not a critic
- Never fire a rep card and a prospect card simultaneously
- Rep cards should be rarer than prospect cards — maybe max 1 per stage
- Start with the 5-6 highest-impact behavioral patterns before expanding

## Build Session Notes
When building this, start a fresh session with this file as context.
This feature has a dependency on reliable speaker identification in the transcript stream.
Confirm `repSpeakerRef` in useWingmanPoller.ts is working correctly before building rep monitoring.
