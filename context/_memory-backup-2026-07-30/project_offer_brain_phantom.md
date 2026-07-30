---
name: ""
metadata: 
  node_type: memory
  originSessionId: 4d7942ae-6891-4bba-a505-590878200e77
---

The "Offer Brain → Sales DNA" rename (Current Sprint item 0k) is a **phantom task**. Verified 2026-06-01 three ways: full-repo grep + `git log --all -S "Offer Brain"` across `src/` and `electron/` = **zero hits in any commit ever**. "Offer Brain" lived ONLY in docs (CLAUDE.md, Wingman Brain vault, `tasks/*.html` architecture diagrams). The user never saw it in the app.

What Sebastian was actually remembering = the **Personalize** tab (offer name/price + offer-URL crawl). That tab is *manual intake*, not the "brain."

The real per-rep **Sales DNA learning JSON does not exist yet**. Today: `post-call/route.ts` (Sonnet) writes only debrief, objections (text + frequency, the one accumulating dataset), missed_topics, pillar_coverage; `rep-profile.ts` reassembles a fresh `REP PROFILE:` string each call from raw stats. No archetypes / price-reveal patterns / close-timing / compounding profile. Objection *handles* (handle1/handle2) are rep-entered in the Objection Vault, not AI-derived.

**Decision (2026-06-01):** Defer building a "Sales DNA" tab/page to later. Do **NOT** rename the Personalize tab to "Sales DNA" — it's manual setup and would mislabel user input as machine-learned intelligence. The real Sales DNA tab belongs with the big #1 build that creates the learning layer.

**How to apply:** If a future session sees item 0k or CLAUDE.md's note that "DB columns may still say offer_brain," ignore it — there are no `offer_brain` identifiers or columns. Don't do a copy sweep or code rename; there's nothing to rename. Related: [[feedback-plan-review-loop]].
