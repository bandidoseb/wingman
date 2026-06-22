# Tone Register Toggle — casual vs professional (signal card outputs)

**Captured 2026-06-21 (Sebastian).**

## Idea
A per-rep setting in the dashboard (Settings or Playbook) that controls how casual vs
professional/proper the signal-card wording comes out. The rep picks the register that matches how
THEY actually talk, so the card reads exactly how they'd say it out loud.

## Why
Tonality is everything in objection handling, and the rep reads the card once and says it live. If
the words aren't how they personally talk, the delivery gets stiff or weird. Example: the default
might say *"Here's what I want to know…"* — but Sebastian would say *"Here's what I wanna know…"* or
just cut it. Letting the rep set their register removes that friction. (Sebastian: "I'd toggle that
on myself.")

## How it'd work
- A small enum setting, e.g. **Casual ↔ Balanced ↔ Professional** (or a simple on/off "casual mode").
- It injects ONE register line into the objection prompt's system message at generation time, e.g.
  casual → "Use relaxed spoken contractions (wanna/gonna/gotta); talk like a sharp closer texting a
  friend." professional → "Keep it polished and articulate; full words, no slang."
- Default for now: **casual/human** (contractions, spoken, no AI throat-clearing) — already baked
  into `objection-prompt-test.mjs` after the 2026-06-21 tonality pass.

## Notes / open questions
- Where does it live — Settings (account-wide) vs Playbook (per-framework)? Probably Settings.
- Does it apply to ALL card types (answer/dig/close) or just objection? Likely all.
- Persist on the rep profile; pass through the kb-signal route into the prompt.
- Cheap to build once the objection prompt is wired to production (it's just a prompt variable).

Related: the broader tonality rules now live in the objection prompt's "TONALITY & READABILITY"
section (the most important section). This toggle just lets the rep slide that register.
