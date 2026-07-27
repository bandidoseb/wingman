# Card Voice Rework — Game Plan

The process for killing AI tics in the base objection/dig card voice. The BAR + training data live in
`tasks/card-voice-spec.md`; this doc is the PROCESS. Read both before building.

North star: a card so natural Cole Gordon reads it and thinks "this is legit," and a new closer runs
with it in their own words. The card is a NUDGE, not a script — directionally-right + short beats
"perfectly worded" (a too-perfect line stumps reps into robotic recitation → Core Rules #10/#11).

---

## Roles
- **Sebastian — the final tonality judge.** Reads each card, green-lights (✓ I'd say it) or red-lights
  (✗ wrong / rewrite) and says WHY. He is the reward signal — no LLM metric overrides him.
- **Claude — the engineer.** Generates batches, encodes his rewrites into few-shot anchors + the tic
  gate, edits the doctrine, compresses (eval-gated), and proves no regression.

## Why not an LLM "humanness" scorer
The AI tonality judge scored our tic-ridden cards 4.8/5 and could NOT feel the AI-ness. So the judge
stays a SOFT signal only. The trustworthy scorer is (a) the deterministic tic gate for mechanical tics
and (b) Sebastian for everything subtle. This is RLHF in miniature: golden exemplars + human reward +
a deterministic filter for the always-wrong stuff.

---

## Two-tier training data (why "only 7 anchors" is fine)
- **Full critique corpus** — grows to hundreds over the grind. Lives offline in the spec / batch files.
  Trains the gate and teaches the pattern.
- **Shipped few-shot anchors** — a curated ~10–15, chosen for COVERAGE (one per situation-type), that
  ride in the live prompt. Grown-and-pruned every round for quality. Not everything ships.

## Token strategy (decided 2026-07-17)
The system prompt is prompt-CACHED, so a longer prompt is nearly free per call. The real cost of length
is MODEL FOCUS, not tokens. Therefore:
- **Doctrine (instructions):** write for clarity now, don't count tokens. COMPRESS at the end — then
  re-run the eval + gate to PROVE the compressed version produces identical-quality cards (validated by
  eval, never by eye). Zero-regression compression.
- **Anchors (examples):** grow-and-prune continuously; keep only the best/most-diverse. Never bloat.

---

## The loop (one round)
1. **Generate** — Claude produces a fresh batch (situations × levels) in an easy-to-critique format.
2. **Judge** — Sebastian marks each card: ✓ (I'd say it) / ✗ (wrong move, kill) / rewrite + why.
3. **Encode** — Claude ingests: rewrites → candidate anchors + new gate rules; ✗ patterns → doctrine
   fixes. Nonsense/parse failures → doctrine, not just a tic ban.
4. **Verify** — Claude updates doctrine + anchors + gate, re-runs the eval, confirms the gate catches
   every known tic and no good line is falsely killed.
5. **Repeat** — until a fresh, unseen batch green-lights at a high rate and Sebastian can't find a tic.

---

## Phases
- **Phase 0 — next session (build):** rip the permission-ask doctrine (keep "disarm before challenge"
  as a one-line concept, no canned phrasings), strip "come on" from the challenger modifier, wire the 7
  gold rewrites as anchors, build the precise tic gate, generate the first fresh batch in an
  easy-critique surface. Run the concrete edit through plan-reviewer before writing code.
- **Phase 1 — the grind (several days):** run the loop over and over across all situations + edge
  cases. Grow the corpus, tune the voice. This is the real work.
- **Phase 2 — compress + prune:** compress the doctrine (eval-gated, zero regression); prune anchors to
  the curated shipped set.
- **Phase 3 — re-enable the dial:** the confrontationalness dial multiplies the nailed base voice.
  Only after the voice is locked.

## Done criteria
- A fresh, unseen batch green-lights at a high rate (target ~90%+).
- Zero mechanical tics (gate is clean) and every card parses / makes literal sense.
- Compressed doctrine proven identical-quality by the eval.
- The dial layers cleanly on top without reintroducing tics.

---

## Coverage checklist (situations the grind must cover)
Objection: money-tight · money-anchor · think/stall · trust-burned · fear/big-decision · partner ·
timing/next-quarter · send-info · diy/do-it-myself · competitor · "you're running tactics on me" ·
logistics-with-worry-underneath · genuine no-objection (return null). Each × 4 levels (consultative /
balanced / direct / challenger). Plus dig cards (separate prompt, same loop).
