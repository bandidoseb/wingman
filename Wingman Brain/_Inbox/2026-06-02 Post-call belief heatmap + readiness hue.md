# Idea capture — 2026-06-02 (Sebastian)

Two visualization ideas, both DEFERRED (not v1 critical path). Captured so they aren't lost.

## 1. Post-call scoring as ONE dynamic "sunset" heatmap (replace the blocks)
Today the post-call framework/stage scoring shows as a column of blocks (FlightLog Framework Coverage + Stage Breakdown). Sebastian wants it shown as a **single green→yellow→red gradient heatmap** (like the reference scatter image) where each belief/pillar is a **dot dynamically placed by how well the rep actually did** on that point.

- **Dynamic, not fixed:** the dot positions VARY per call based on the real score. One call a belief scores ~78%, next call ~81% → the dot lands in a different spot. Never the same layout twice.
- **Use OUR belief names, NOT Cole Gordon's.** Internal AI scratchpad (the live Belief Ladder summary, Phase 2) can use Cole's words; the **user-facing** viz uses our own pillar labels (Core Problem, Can't DIY, Cost of Waiting, Dream Outcome, Investment, Who's Deciding, Why You) — which we already do in FlightLog. Keep it that way.
- **Open design question for build time:** what are the axes? Options — (a) 1D placement along the gradient (left=weak/red → right=strong/green) with dots spread vertically just for legibility; or (b) a true 2D scatter (need to define the 2nd axis, e.g. importance vs. coverage). Decide when we build it.
- **Status:** post-core polish / V1.5 viz upgrade. Not on the hotkey critical path.

### Claude's recommendation (2026-06-03) — blocks vs. scatter, for "average person digest"
Asked which is easier to digest. Honest take: **labeled blocks win for the SINGLE-CALL breakdown.**
- 6 named stages = a small labeled-category set → blocks/bars are the most instantly readable format (name + status, no decoding). A scatter only "means something" when dot POSITION encodes 2 real axes; for 6 one-score stages, position is arbitrary and adds interpretation cost.
- **Synthesis (the actual win):** keep the labeled-block structure BUT color each block on the **continuous sunset gradient by its exact score** (78%→yellow-green, 81%→greener, 20%→red-orange). Gives the dynamic sunset feel Sebastian wants + instant readability. Current blocks look flat only because the test call scored 0 everywhere.
- **Where the scatter genuinely wins:** an "ALL CALLS OVER TIME" trend view — each call a dot (x=date, y=score) on the sunset background. Position = trajectory, clustering = story. Best home for the reference-image style.
- So: single-call = gradient-colored labeled blocks; multi-call trend = sunset scatter.

## 2. Right-arrow "close readiness" = fluid hue (confirmed direction, Phase 4)
Clarified intent: NOT a dot placed on a color range. Just the **indicator's color itself shifts fluidly** based on readiness:
- Nothing covered → red · everything covered → green · middle → yellow, leaning green or red by how much is covered/how ready they are to pitch.
- Must be **extremely accurate** (driven by the live belief score).
- Still paired with words + the move (locked rule: color for feel, words for action — never a bare gauge/%).
- **Status:** Phase 4 build (the close arrow). Direction confirmed.
