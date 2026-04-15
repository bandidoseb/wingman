---
name: Dual Visual Brain — KB Graph + Offer Brain Visualizer
type: feature
status: backlog
logged: 2026-04-10
---

[[Architecture]] | [[Objection Sequences (Option A)]] | [[Rep Speech Monitoring]]

# Dual Visual Brain

Two separate Obsidian-style interactive knowledge graphs in the Wingman dashboard.
Different data sources. Different purposes. Both are moat mechanics.

---

## Brain 1 — The Training KB Graph
**What it shows:** Everything Wingman knows universally about sales.
**Data source:** kb_entries (ingested from training videos)
**Same for every user.** Grows when new videos are ingested.

### What It Looks Like
- Network graph (force-directed, Obsidian-style)
- Every technique = one node
- Node clusters by call stage (Discovery, Close, Press, etc.)
- Node color by category (objection handle, discovery question, close technique, etc.)
- Edges connect sequence-linked techniques (when sequences are built)
- Click a node → see: technique name, situation, exact script, call stage, sourced from X videos (no coach attribution)
- Filter by: call stage, category, recently added
- Search bar

### Why It Matters
A new user opens this on day one and sees 800+ nodes covering every corner of the sales process. The question "does this thing actually know what it's doing?" disappears instantly. 800 nodes is a visual proof of depth that no competitor can replicate with a demo or a marketing page.

---

## Brain 2 — The Offer Brain Visualizer
**What it shows:** Everything Wingman has learned about THIS user specifically.
**Data source:** Offer Brain JSON + call history + vault_objections
**Unique per user.** Grows with every call.

### What It Shows
- Prospect archetypes this rep encounters (visualized as clusters)
- Which objections come up, how often, at what call stage
- Which techniques have worked vs. failed for this specific rep
- Close timing patterns ("Your calls close at 42 min avg when X happens")
- Win/loss patterns by prospect archetype
- Rep-specific strengths and blind spots

### The Predictive Angle
After 50-100 calls, the Offer Brain starts recognizing patterns:
- "This prospect matches Archetype B. They usually object about price at 18-22 minutes."
- "Last 8 times you heard this exact phrasing, 6 ended in close when you used the ROI reframe."
- Wingman starts to feel psychic — not because of magic, but because it has seen their specific sales process play out dozens of times.

### Why It Matters (The Real Moat)
Brain 1 makes Wingman credible on day one.
Brain 2 makes it irreplaceable by month three.

Every call adds to this graph. A rep who has used Wingman for 6 months has an AI that knows their specific offer, their specific prospects, their specific strengths and weaknesses — built from their own call history. Switching to a competitor means starting from zero. Nobody does that.

The Offer Brain already exists as a JSON object updated after every call. The visualizer makes that invisible intelligence visible and tangible. Right now users have no idea how much Wingman has learned about them. This changes that.

---

## What's Needed to Build Both

### Brain 1 (KB Graph)
- KB re-ingestion with new schema must happen first (call_stage, category, sequence_id fields)
- `/api/kb/graph` endpoint returning all entries as nodes + edges
- D3.js or similar force-directed graph renderer
- New "Knowledge Base" tab in dashboard sidebar

### Brain 2 (Offer Brain Visualizer)
- Offer Brain must be updating consistently from post-call jobs (already in progress)
- vault_objections data for objection frequency mapping
- calls table for win/loss and timing patterns
- `/api/offer-brain/graph` endpoint
- Separate graph component — different visual style from Brain 1

---

## Priority
Both are V2. Do not build until:
1. Core signal card pipeline is working reliably
2. KB re-ingestion with new schema is complete
3. Offer Brain is updating consistently for several calls

Brain 1 should be built before Brain 2 (simpler data, higher day-one impact).
