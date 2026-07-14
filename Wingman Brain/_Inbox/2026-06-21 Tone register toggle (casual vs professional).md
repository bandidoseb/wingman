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

---

## Update 2026-07-11 (S3) — expanded scope from the desk-paper capture

Sebastian re-raised this off his idea paper and pushed it wider. Two changes to the design above:

- **More than two registers — a 3–4-step scale.** Reference is **Wispr Flow's** tone control:
  **formal → casual → very casual → excited.** So the enum grows from casual↔balanced↔professional
  into something closer to that ladder (final labels TBD — Wispr's four are a good starting set).
- **Applies to EMAILS too, not just live signal cards.** When the post-call **Recipes / action layer**
  ships (`/write follow-up email`, etc. — see `_Inbox/2026-07-11 Paper capture — 5 ideas…`), the same
  one tone knob threads into the email-generation prompt. A too-formal follow-up email reads as robotic
  the same way a too-formal card does. **One rep-level setting → every generation surface** (cards +
  emails), NOT a per-surface toggle.

**Why this matters (Sebastian, "I love that idea"):** it's in direct service of Core Product Rules
#10/#11 — never make a rep sound scripted/robotic. That makes it **moat-adjacent**, not a nice-to-have.

**Build note:** still cheap — one setting on the rep profile, injected as a single register line into
whichever prompt is generating (card or email). Natural home = **Settings** (account-wide), sitting next
to the rep's Sales DNA. Build alongside either the Sales DNA capture work or the email/recipe layer.

*(This note is now the single home for the tone-toggle idea — the paper-capture note points here so the
idea doesn't fork.)*
