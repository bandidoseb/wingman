---
name: machine-check-comparisons
description: "Never eyeball two-list comparisons (API contracts, bridge methods, channel names) — machine-diff them; an eyeballed comparison missed the"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: ebf9535c-5fcf-45d9-b627-8ecba46805d7
---

While debugging Wingman #39 (2026-06-10), I grepped the HUD's `window.hud.*` calls and the preload bridge's exposed methods, eyeballed the two lists side by side, and declared "every method the HUD calls is exposed." Wrong — `onSignalDismiss` was in the left list and missing from the right, and it was the root cause (a load-time TypeError killing all IPC registrations below it). Only the auto-opened HUD DevTools caught it.

**Why:** Human-style scanning of two sorted lists fails silently on exactly the one-item diff that matters. The cost of being wrong was two extra sessions of dead-end static analysis.

**How to apply:** Any time the question is "does list A ⊆ list B" (renderer calls vs bridge exports, IPC send channels vs listener channels, env keys used vs defined), pipe both through `sort -u` and use `comm -23` / `diff` so the answer is machine-produced, not impression-produced. Same session, the `comm -23` check confirmed the fixed contract in seconds.
