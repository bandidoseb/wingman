---
name: Objection Handling Sequences — Multi-Turn Signal Cards
type: feature
status: schema-ready, pipeline-not-built
logged: 2026-04-10
---

# Objection Handling Sequences

## The Problem This Solves
Current Wingman behavior: one card fires on an objection, then Wingman goes silent.
Real objection handling is multi-turn:
1. Prospect raises objection
2. Rep acknowledges + handles (Card 1 fires ✅)
3. Prospect responds — pushes back, asks a follow-up, or goes quiet
4. Rep needs continued guidance (Card 2 should fire — currently doesn't ❌)
5. Rep closes the loop on the objection

Sebastian's analogy: "It's like giving a nerd a pickup line and then abandoning him. He goes up, says it, she responds, and he shits his pants because he has no direction."

## Schema Design (Already Future-Proofed in KB)
Each `kb_entries` row has:

```
sequence_id            UUID (nullable) — links entries in the same objection sequence
sequence_step          INTEGER (nullable) — which step: 1, 2, 3
sequence_total_steps   INTEGER (nullable) — how many steps in this sequence
sequence_follow_up_triggers TEXT — what the prospect says AFTER the rep delivers this step,
                                   triggering the next step. Newline-separated.
```

## Example Sequence: Price Objection
```
Step 1 (sequence_step: 1)
  prospect_triggers: "this is too expensive", "that's a lot", "I can't afford that"
  exact_script: "If price wasn't a factor, would this be the obvious next step for you?"
  sequence_follow_up_triggers: "I don't know", "maybe", "I still just can't justify it", "I guess so"

Step 2 (sequence_step: 2)
  prospect_triggers: (from step 1's sequence_follow_up_triggers)
  exact_script: "What part feels like the biggest stretch — is it cash flow right now, or are you not fully convinced on the ROI?"
  sequence_follow_up_triggers: "I just need to think about it", "I need to talk to someone"

Step 3 (sequence_step: 3)
  prospect_triggers: (from step 2's sequence_follow_up_triggers)
  exact_script: "What would need to be true for you to feel fully confident moving forward?"
```

## How the Live Pipeline Works (When Built)
- When a sequence step fires, Wingman enters "sequence mode" for that sequence_id
- Sequence mode: a 45-second window where Wingman watches for the next step's triggers
- If next trigger detected → fire next step card
- If no trigger detected in 45s → exit sequence mode, return to normal
- Cooldown rules still apply between sequence steps (minimum 20s)

## Extraction Implication
During ingestion, Claude extracts sequences as linked groups, not isolated techniques.
The extraction prompt asks: "Is this technique part of a multi-turn exchange? If yes, extract all steps as a linked sequence."

## What's NOT Built Yet
- Sequence mode tracking in the live call pipeline (useWingmanPoller.ts)
- Sequence-aware card firing in kb-signal/route.ts
- Sequence linkage in the extraction prompt

## Build Session Notes
When building this, start a fresh session with this file as context.
Key files to modify:
- `src/hooks/useWingmanPoller.ts` — add sequence mode state + timeout logic
- `src/app/api/wingman/kb-signal/route.ts` — sequence-aware retrieval
- `knowledge-base/ingest.js` — extraction prompt to detect and link sequences
- Supabase: sequence columns already in schema (schema-ready)
