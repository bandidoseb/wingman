# KB Quality Notes

Last updated: 2026-04-02

Notes on the quality and gaps in the current Sales KB. This file is updated after any major ingestion batch and after beta feedback reveals signal card quality issues.

---

## Current KB State (as of v0.1.19)

- **37 videos ingested**
- **~15 hours of content**
- **419 KB entries**
- **Similarity threshold:** 0.65 (lowered from 0.78 to improve recall)
- **Embedding model:** OpenAI `text-embedding-3-small`

---

## What's Well Represented

*[Update after reviewing KB entries and beta signal card quality]*

Based on source content ingested:
- Cole Gordon methodology is the foundation — the stages, the tonality, the framework
- General objection handling principles are covered
- Price objection handling has reasonable coverage
- Close stage techniques are the best-represented category

---

## What's Missing or Weak

*[Update as gaps are discovered from beta call data and signal card quality review]*

**Suspected gaps (not yet confirmed by live call data):**

1. **The Press stage** — The "cost of inaction" quantification stage (Gordon Gap) is the most commonly skipped and potentially the least well-represented in the current KB. If reps are skipping Press and Wingman isn't catching it, this is a knowledge gap.

2. **Discovery depth questions** — NEPQ-style problem awareness questions, implication questions. Jeremy Miner's content should fill this, but needs to be ingested.

3. **Pre-frame / Agenda** — How to open the call with a clear agenda that kills objections early. Light on content here.

4. **Rapport establishment techniques** — We intentionally fire almost no cards during Rapport, but the KB should still understand what good Rapport looks like to correctly classify the stage.

5. **Transition / Bridge language** — How to summarize pain and transition into the pitch. The exact language for this is critical and may not be well-covered.

6. **Offer-specific language** — The KB is generic to high-ticket sales, not specific to any offer type (fitness, investing, biz op). Offer-specific context comes from the Offer Brain, not the KB.

---

## Signal Card Quality Observations

*[Populate from beta feedback — these are hypotheses until live call data arrives]*

**High-quality card indicators (what we're aiming for):**
- Rep reads the card, uses the technique, prospect responds positively
- Rep says "that's exactly what I was thinking but couldn't find the words"
- Card fires at a moment where the rep was about to make a mistake

**Low-quality card indicators (what to fix):**
- Card fires but rep dismisses it without reading
- Card fires at a point where the rep was already handling the moment well (false positive)
- Card language feels generic — could apply to any sales call, not this specific moment
- Card fires too late (the moment has passed)

---

## Threshold Tuning Notes

**Current threshold:** 0.65 (lowered from 0.78)
**Reason for lower threshold:** At 0.78, retrieval was returning near-zero results for many trigger moments. The similarity space in `text-embedding-3-small` at this KB size (419 entries) required a lower threshold to return useful results.
**Risk of lower threshold:** May return lower-relevance matches. Watch for generic or off-topic signal cards in beta.
**Action:** Validate threshold with real call data. If cards feel generic, consider raising back toward 0.72–0.75. If cards are still missing obvious triggers, consider adding more content rather than lowering the threshold further.

---

## Ingestion Quality Control

After each new batch of videos is ingested:

1. **Review 10 random KB entries** from the batch — do they read like actionable sales techniques or like transcription noise?
2. **Run 5 test queries** against the new entries using the KB management UI (localhost:3333) — do the top results match what you'd expect?
3. **Check for duplicates** — does the same technique appear multiple times with slightly different wording? If so, the source video repeated itself a lot, which is fine.
4. **Flag entries that are context-specific** to the video's original example (e.g., "when the prospect mentioned their gym membership cost") — these may not generalize well to other offer types.

---

## KB Improvement Priorities

1. Ingest Jeremy Miner NEPQ content (Discovery depth questions, implication questions)
2. Add more Cole Gordon role-play / live call review content
3. Fill Press stage content gap
4. After beta: review which KB sources are contributing to successful signal cards vs which are not (track `source` field in signal card JSON)
