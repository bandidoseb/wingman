---
name: project-calendar-detection
description: "Future task — Google Calendar-based meeting detection so Deploy \"just works\" without the swipe-to-Space limitation"
metadata: 
  node_type: memory
  type: project
  originSessionId: 7bc3d0df-6fb1-4386-868f-c31dcaf31298
---

**Task (its own session — Sebastian 2026-07-10, do NOT tackle inline):** hook Wingman up to **Google Calendar** so it can detect an active/upcoming meeting from the calendar instead of relying on Recall's Space-bound window detection.

**Why:** Recall's Desktop SDK only detects the Zoom/Meet window when it's on the current macOS Space (see [[reference-recall-detection-constraints]]) — the rep has to swipe to the call window for detection to fire. Granola/Fathom feel "just works" because they don't do window detection (Granola = system audio + calendar; Fathom = server-side bot). Calendar detection is the path to that same feel **without losing Recall's per-speaker separation** (which Wingman needs to fire objection cards on the PROSPECT's words, not the rep's).

**How to apply:** Recall has a calendar integration; combine calendar-known meeting times with the arm-and-wait deploy flow (shipped in #47) so Wingman can auto-arm / prompt at call time without needing the window visible. Ties into the existing **Call Continuity + Prospect Memory** roadmap (`Wingman Brain/00 - Product/Call Continuity + Prospect Memory Design.md`) which already assumed Recall calendar. Interim mitigation already shipped: the "Looking for your call…" state tells the rep to swipe to the call window.
