---
name: project-card-voice-rework
description: Core card-voice rework — kill AI tics in the base objection/dig prompts; THE next priority
metadata: 
  node_type: memory
  type: project
  originSessionId: b44b0cee-02cf-4f83-b2e8-b0db45ab866e
---

**Core card voice rework — the next priority (decided 2026-07-16 S2).** Signal-card quality is the
whole product. Sebastian (final tonality judge) read a 116-card batch and found the BASE objection +
dig card voice is full of AI tics the AI judge scored 4.8/5 and could NOT feel.

**Why:** Bar = "Cole Gordon reads a card and thinks *this is legit*." A new closer would say "okay,
good"; we need elite closers to vouch. Robotic cards = product-killing per Core Rules #10/#11.

**Banned tics (Sebastian's words):** "can I ask" / "can I ask you something (honestly)?" (nobody says
it + creates permission-ask-then-wait awkwardness); "come on" (esp. challenger, constant); forced
empathy clichés ("getting burned is real", "that feeling makes total sense", "that nervousness is a
good sign"); nonsensical lines. **Target voice:** acknowledge briefly then FLOW straight into the
question (one breath) — his connectors: "honestly," / "but honestly," / "I'm curious," / "I gotcha," /
"question —" / "for sure,". His verbatim feedback + gold rewrites (the training data) live in
`tasks/card-voice-spec.md`.

**The 3-part solution (agreed):** (1) encode Sebastian's rewrites as FEW-SHOT examples in the base
`objection-prompt.mjs` + `dig-prompt.mjs` (model imitates examples > rules; the current examples are
the permission-asky source of the tics — my old challenger modifier's "come on" examples made it
worse). (2) DETERMINISTIC tic-detector HARD gate in `scripts/confrontation-eval.mjs` (regex ban-list →
auto-fail; the AI tonality judge can't feel tics, so don't rely on it). (3) human-in-the-loop tuning
loop (generate batch → Sebastian reacts → encode → repeat; multi-session craft). This CHANGES the
shipped default prompt (deliberately better); snapshot at `tasks/prompt-snapshot-2026-07-16/` preserves
the old version. Ties to [[project-summarizer-tuning-session]] (eval-gated tuning discipline).

**ROOT CAUSE (found 2026-07-17):** the tics are in the DOCTRINE, not the examples. `objection-prompt.mjs`
line 19 literally COMMANDS the permission-ask ("BEFORE you reframe, ASK PERMISSION: 'can I share a
perspective?'…") and line 113 (challenger modifier) hands it "come on — be straight with me" verbatim.
The few-shot examples (lines 50–54) are already clean. So swapping examples alone won't fix it — the
doctrine lines must be edited too. **Doctrine decision (Sebastian):** first batch = rip out the literal
permission-ask phrasing but KEEP "disarm before you challenge" as a one-line concept (no canned
phrasings); decide empirically from the batch whether nuance returns. **Voice philosophy (Sebastian):**
the card is a NUDGE not a script — a good closer adds their own voice, so prefer directionally-right +
SHORT over "perfectly worded" (a too-perfect line stumps reps into robotic recitation → Core Rules
#10/#11). Full detail in `tasks/card-voice-spec.md`.

How to apply: start a FRESH session (Sebastian wants fresh energy). Read `tasks/card-voice-spec.md`
first. Plan-only agreed for the intake session; BUILD (doctrine edit → tic gate → generate batch) is the
next session. Run the concrete edit through plan-reviewer before writing code. Voice must be nailed
BEFORE resuming [[project-confrontationalness-dial]] (the dial multiplies the base voice).

**PROGRESS 2026-07-19 — Bundle A shipped, 2 grind rounds deep (all LOCAL on `feat/confrontation-dial`, NOT pushed).**
Encoded into `objection-prompt.mjs` + `dig-prompt.mjs` from Sebastian's marks:
- R1: acknowledger discipline (killed the "Yeah, totally" reflex — 0/14 openers now, was 8/14; verified stable across 3 samples, 0 hard tics in 66 gens), own-words/first-read (mirror their exact word, no "turning over" for "think about"), mirror-back on BS objections (diy/results-doubt/wishy-washy/send-info → point the mirror back, not a soft ask).
- R2: partner = Cole isolation-test-first ("if she said 'whatever you think, I trust you,' would you move today?"), no "gatekeeper" framing; fear = normalize via their BEHAVIOR not emotion-label + tie alternative to their specific pain; "I'm curious —" quick lead-in allowed (only long narrated wind-ups banned); cost dig + deepen-desire = simpler/natural phrasing.
Gates green each round: byte-identity (direct===shipped constant) ✅, tic-free ✅, typecheck ✅.
**Grind loop tooling:** `scripts/voice-batch.mjs` (DIRECT-only) now ALSO emits `tasks/voice-batch.gradesheet.html` — a clickable "fill out a test" grade sheet (Keep/Rewrite/Kill + why, auto-save, one-click Copy-results in voice-batch.md format). Published as a Claude Artifact (same URL on republish). Sebastian marks there → pastes the block back → Claude encodes. `tasks/voice-batch.MARKED.md` = his round-1 marks.
**SWING / flow grind (2026-07-19).** Verified in code that the multi-turn objection FLOW (Phase B/C) is built + wired end-to-end (rep re-presses ↑ → move N builds on prior moves, no-repeat, beat-scaled close-lean; `gap_flag` = 40s+ since last PRESS, not transcript silence; re-diagnosis adds ZERO latency — same streaming call). Built `scripts/voice-flow-batch.mjs` — plays FULL flows (move1→simulated-prospect-reply→move2→…→close) using the real threaded builders + a Sonnet prospect role-play; writes `tasks/voice-flow-batch.{md,gradesheet.html}` (⛳ conversation-style grade sheet: per-move Keep/Rewrite/Kill + whole-swing verdict). First run: 3/4 flows closed cleanly, 1 kept handling real hesitations (correct). **Doctrine doc: `00 - Product/Objection Flow — Doctrine + Cole-Jeremy Lens.md`** — the closer's LOOP (disarm→isolate→reopen→tie-down→close, loop back on new belief), Cole-vs-Miner analysis, and open questions. **Prompt change 2026-07-19: objection doctrine now FAVORS QUESTIONS over statements (NEPQ — a move should end on a question, use reframes/analogies sparingly and land them on a question).** Gates green. Content Topic Bank + Website Plan got the "objection loop = elite-closer-grade, not a generic LLM" credibility beat.

**Structural items surfaced by the grind (each its own session):** #4 = wire Sales DNA into the OBJECTION card (only dig has it) for money-anchor specificity; #6 = dig belief-selection bug (support/money-qualifier probe an open belief while ignoring what the prospect JUST said → non-sequitur; also money-qualifier naming = capital-they-have vs income-they-want); [[project-prospect-anchor-capture]] = the big context feature. Voice grinding continues in parallel.

**Flow-grind round 1 → the CONTEXT-VACUUM insight (Sebastian 2026-07-19).** Grading swing flows in a vacuum failed on TWO counts: (1) Sebastian couldn't judge cards without knowing the offer (does it have coaching? a guarantee? payment plans?) or the discovery facts; (2) cards FABRICATED offer features (said "you're not buying a course that sits there" with no idea if the offer has accountability). FIX: `voice-flow-batch.mjs` fixtures now bake full CONTEXT into `liveSummary` — OFFER (incl. coaching/support/guarantee/payment terms) + WHAT THEY TOLD YOU IN DISCOVERY + belief ladder — rendered atop each flow so grading is fair and fabrication is visible. This mirrors what the offer-aware summarizer + [[project-prospect-anchor-capture]] inject in production, so it also previews that work. **PRINCIPLE: all future grind batches (incl. the move-1 `voice-batch.mjs`) should carry real context — a context-free card can't be graded.** Also: sim now continues PAST the first direct-close (6-beat cap + commit-phrase detection) so the full swing incl. post-ask re-diagnosis is visible.
**Encoded from flow round 1:** PARTNER doctrine had a LOGIC BUG (backwards isolation-test branches) — fixed: a YES to "if she trusted your call, would you move today?" = deflection → GO FOR THE DECISION (don't ask "what would it take to get her on board" — that enables the deflection); a NO/hesitation = a different objection hiding → surface it. **Holding pending re-grade with context:** money-tight move-2 "what would need to be true for it not to be an if?" = convoluted, failed first-read clarity (watch/encode if recurs); results-doubt = the fuller high-school-math analogy is welcome.
