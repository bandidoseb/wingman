# Offer-Aware Wingman — The Moat

**Status:** North-Star feature. Not yet built. This is the canonical spec/rationale — a session building it starts here.
**Created:** 2026-07-07 (Sebastian, during the Phase 4a.1 Dig build).

---

## The one-line thesis
Wingman becomes **god-like, context-aware, and specific to each user's exact offer** — so its help feels tailored, not generic. **This is the moat.** Competitors are shipping generic live-call copilots; none are building deeply offer-specific, user-specific, context-aware assistance. If Wingman nails this, it beats the field.

## Why this is the whole game (the reasoning — do not lose this)
- A **generic or off-base signal card destroys trust instantly.** One shitty card and the rep stops believing Wingman understands their world → they stop pressing → churn.
- Trust comes from the rep **feeling that Wingman fully understands their offer.** If Wingman doesn't know what they sell, the rep won't believe it can help on *their* specific calls. Tailored-per-user is the trust bar, and trust is the retention engine.
- Discovery/objection language is **wildly different offer-to-offer.** The belief CATEGORY is universal (pain, desire, money…), the words are not: real-estate "what monthly cash flow are you after?" vs fitness "how much weight do you want to lose?" — same belief, opposite wording. Generic = safe but never god-like. Offer-aware = the magic.

## What it unlocks
1. **Offer-aware Dig (and every card).** Even early/thin-transcript moments produce offer-specific, verbatim questions — not "what's your goal?" but the exact question a top closer on *that* offer would ask.
2. **Wingman can LEAD early discovery for Pro users**, not just supplement — because it knows the offer AND how that rep runs discovery. (Also solves the real rep pain: "I sometimes forget to touch a point mid-call" — Wingman reminds them, verbatim.)

## How Wingman gets the context: capture it in ONBOARDING
- Wingman **interviews the rep** to learn the offer (what they sell, avatar, transformation, price, differentiators) AND how they run their discovery (their actual questions, sequence, language).
- **Start with a questionnaire** — reliable, structured, easy to store as offer context. **AI voice-call** interview is a later premium/delightful upgrade; do NOT gate the build on voice.
- Stored context feeds the live cards (inject into the Belief Ladder summarizer so BOTH objection + dig get sharper) + guards against fabrication from the offer text.

## Tiering (paywall + selling point)
- **Core** = generic, **Dig-only supplement.** Approved tooltip: *"↓ Dig Deeper — When you want to go a layer deeper on what the prospect just said, Dig hands you the next probing question. It builds on the conversation — a supplement to your discovery, not a replacement for it."* Early in a call → a nudge like *"Run your discovery — trigger Dig when you want to probe."* No offer-aware leading.
- **Pro** = **offer-aware.** Knows the offer + the rep's discovery process → verbatim, offer-specific discovery questions from the jump, can roll into a Dig flow. This is a concrete, compelling upgrade reason.

## Hard rules a building session must honor
- **Cards are VERBATIM spoken words, NEVER instructions.** "Touch on pain" is an instruction (robotic — breaks Core Product Rules #10/#11). Always the word-for-word question. The verbatim question IS the tailored value.
- **No HUD discovery-vs-dig toggle.** Same ↓ arrow; the TIER decides behavior (Core generic / Pro offer-aware). No manual mid-call switch — one less thing to think about.
- **No fabrication.** Offer context is input, not license to invent specifics the prospect never said (same fence as the objection/dig prompts).

## Sequencing
- 4a.1 shipped transcript-only (correct for now). Offer-awareness is deferred **pending the 4a.1 live test** — but Sebastian is confident the offer-context gap is real and worth building regardless (AI genuinely can't know the offer 2 min into a call without being told).
- Natural home ties into: onboarding flow, the Playbook, and Sales DNA.

## Related
- Decisions Log 2026-07-07 (Dig = supplement, offer-aware deferred).
- `_Inbox/2026-07-07 Wingman learns your discovery process.md` (working capture — this North Star doc supersedes it as canonical).
- Core Product Rules #10/#11 (never make reps robotic).
