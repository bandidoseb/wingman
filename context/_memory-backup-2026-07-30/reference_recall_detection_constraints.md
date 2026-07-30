---
name: reference-recall-detection-constraints
description: "Recall Desktop SDK meeting-detection is Space-bound (Zoom/Meet); why Wingman can't just copy Granola; the recall-upload-token 429 is OUR per-user limit"
metadata: 
  node_type: memory
  type: reference
  originSessionId: 7bc3d0df-6fb1-4386-868f-c31dcaf31298
---

**Meeting detection is a documented Recall Desktop SDK constraint, not a Wingman bug** (confirmed via docs.recall.ai FAQ, 2026-07-10):
- macOS **Zoom**: the Zoom window must be in the **current virtual Space** to be detected. Switch Spaces → `meeting-closed` fires; swipe back → `meeting-detected` fires. This is why Deploy "only works when Zoom is visible on your screen."
- macOS **Google Meet**: the tab must be actively shown OR in picture-in-picture.
- macOS **Teams**: ALWAYS detected (exception — not Space-bound).
- Window **focus** does NOT matter (another window can overlap the meeting). **Minimized** windows can't be detected.
- No config flag disables this; `dumpAllApplications()` won't fix detection (detection is Space-bound in the native layer).

**Mitigation shipped (#47):** arm-and-wait — press Deploy once from the dashboard, then swipe to the Zoom Space and it auto-starts. Rep no longer has to be ON the Zoom window when pressing.

**Why Wingman can't just copy Granola/Fathom "just works":** Granola captures raw **system audio + calendar** (no window detection → no Space problem); Fathom sends a **server-side bot**. Both sidestep window detection — but a mixed system-audio stream loses clean **per-speaker separation** (prospect vs rep), which Wingman depends on to fire objection cards on the PROSPECT's words. Recall's window-based Desktop SDK gives speaker-attributed audio, at the cost of the Space limit. The real "just works" path that KEEPS speaker separation = **calendar-based detection** (Recall calendar integration — already on the Call Continuity roadmap) + arm-and-wait.

**The `429 "Too many requests"` on deploy is OURS, not Recall's** (`src/app/api/wingman/recall-upload-token/route.ts`): an in-memory per-`user.id` limiter, **1 token / 30s / user**. NOT per-IP, NOT a Recall account limit — Recall isn't even called when it trips. So it does NOT block many different users deploying at once (each has an independent bucket); only ONE user starting 2 calls within 30s trips it. Caveats: (a) 30s is aggressive — a dropped-call redeploy hits it; consider relaxing / token-bucket. (b) It's in-memory per Railway instance → move to Redis for multi-instance. (c) Recall's OWN account-level API limits are a SEPARATE thing to confirm before hundreds of concurrent live calls.

**The on-screen "1440x1080" dimensions overlay near a detected call is NOT Wingman code** (our HUD only logs dimensions to the terminal). It's rendered by the Recall SDK native layer; docs have no disable flag. Unconfirmed whether it's dev-only — verify by testing the packaged/notarized build (or Recall support ticket).
