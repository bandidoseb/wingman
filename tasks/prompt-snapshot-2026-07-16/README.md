# Prompt Snapshot — 2026-07-16 (before the Confrontationalness Dial)

**Why this exists:** a historical, human-readable record of Wingman's live signal-card prompts
exactly as they were *before* we added the confrontationalness dial. Belt-and-suspenders backup
(git already preserves every version — see the commit below — but this is a copy you can just open
and read).

**Captured at git commit:** `52f5ace14d65138bd6972f0fc88e505ef5a83682`
(branch `feat/live-hub-waveform`).

## What's here (byte-for-byte copies, `.txt` so nothing runs them)
| File | What it is |
|---|---|
| `objection-prompt.mjs.txt` | The ↑ **objection** card system prompt (`OBJECTION_SYSTEM_PROMPT`) + user-message builder. This is the ~8/10 "Direct" doctrine that becomes the DEFAULT level. |
| `dig-prompt.mjs.txt` | The ↓ **dig deeper** card system prompt (`DIG_SYSTEM_PROMPT`) + builder. |
| `close-readiness.mjs.txt` | The → **close readiness** chip. NOTE: this is **deterministic scoring logic, not an AI prompt** — it turns the Belief Ladder into a Ready/Not-Ready chip with no model call. The confrontationalness dial does **not** touch it. |

## The revert guarantee
The dial does NOT edit these prompts. The new "Direct" level *returns these exact strings,
untouched* — and an automated test (`scripts/confrontation-eval.mjs`) asserts
`buildObjectionSystemPrompt('direct') === OBJECTION_SYSTEM_PROMPT` byte-for-byte on every CI run.
So "go back to normal" = set a rep to Direct (or clear the setting) → they get precisely what's
recorded here. Nothing in this folder is ever deleted or overwritten by the feature.
