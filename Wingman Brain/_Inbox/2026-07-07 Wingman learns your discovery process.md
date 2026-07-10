# Wingman Learns Your Discovery Process (Sebastian, 2026-07-07)

**The vision:** a dashboard mode where Wingman and the rep work back-and-forth to capture EXACTLY how that rep runs discovery for THEIR offer — their actual questions, their sequence, their language, the details that matter for their product. Then the ↓ Dig feature can LEAD from the jump, in the rep's own voice, instead of only supplementing.

## Why this matters (the core insight)
Discovery questions differ enormously offer-to-offer. The CATEGORY is universal (pain, goals, money…) but the word-for-word questions are not:
- Real-estate investing → "what kind of monthly cash flow are you after?"
- Personal fitness → "how much weight are you looking to lose?"
Same belief (Desire), completely different question. A generic opener is safe but never godlike.

## Two tiers of solution (from the 2026-07-07 discussion)
1. **Near-term — offer-aware Dig** (small, tractable): feed Dig a compact offer summary (already captured in the rep's profile / flight plan) so even the early/thin-transcript openers are offer-tuned. Best injected into the Belief Ladder summarizer too, so BOTH objection + dig benefit. Cleanest plumbing = client passes a cached offer summary in the press request (static per call, load once at call start, ~zero added latency). Needs: offer-aware dig prompt rule + offer-aware eval fixtures (real-estate vs fitness vs agency) + verify no fabrication from the offer text. **Decision on timing: deferred until after the 4a.1 live test** tells us whether transcript-only is actually a problem in practice.
2. **The big vision — discovery-process capture** (its own feature, differentiated moat): the back-and-forth dashboard builder above. This is the "Dig becomes the FOUNDATION, not the cherry" version. Pairs naturally with the Playbook and Sales DNA. Genuinely differentiated — worth its own build + spec.

## Positioning guardrail (locked 2026-07-07)
Until the discovery-process-capture feature exists, **Dig is a SUPPLEMENT, not the foundation of discovery.** The rep leads their own process; Dig helps when they blank or want to go a layer deeper. This MUST be set correctly in the dashboard tooltip so no rep expects Dig to run their whole discovery. Draft tooltip:
> **↓ Dig Deeper** — When you want to go a layer deeper on what the prospect just said, Dig hands you the next probing question. It builds on the conversation — a supplement to your discovery, not a replacement for it.

## Refined plan (Sebastian, 2026-07-07 — second pass)
- **Capture offer context in ONBOARDING.** Wingman interviews the rep to learn the offer + how they run discovery. Start with a **questionnaire** (reliable, structured, stored as offer context); **AI voice-call** version is a later premium upgrade — don't gate the build on it.
- **Why it's non-negotiable:** a shitty/generic signal card = lost trust = churn. The rep must FEEL that Wingman understands their specific offer, or they won't believe it can help on their calls. Tailored-per-user is the trust bar.
- **Tier split (paywall + selling point):**
  - **Core** = generic, Dig-only supplement (the approved tooltip copy below). Early in a call → a nudge like "Run your discovery — trigger Dig when you want to probe." No offer-aware early-discovery leading.
  - **Pro** = offer-aware. Knows the offer + the rep's discovery process → **verbatim, offer-specific** discovery questions from the jump, and can roll into a Dig flow.
- **Cards stay VERBATIM, never instructions.** "Touch on pain" is an instruction (robotic, breaks Core Rules #10/#11) — always give the word-for-word question. The verbatim question IS the tailored value.
- **No HUD discovery-vs-dig toggle** — overcomplicates. Same ↓ arrow; the TIER decides behavior (Core generic / Pro offer-aware), not a manual mid-call switch.

Origin: 2026-07-07 side-chat during the Phase 4a.1 build. Related: Playbook, Sales DNA, onboarding flow.
