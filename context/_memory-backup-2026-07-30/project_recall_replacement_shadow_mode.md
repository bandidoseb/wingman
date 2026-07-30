---
name: project-recall-replacement-shadow-mode
description: "Decided 2026-07-26 — Wingman will build its own macOS audio capture to replace Recall.ai, as the first post-launch project, in shadow mode"
metadata: 
  node_type: memory
  type: project
  originSessionId: 036deeff-d2d0-4187-a039-1ad2f2c2e777
  modified: 2026-07-28T18:30:12.488Z
---

**DECIDED (Sebastian, 2026-07-26): Wingman will replace Recall.ai with its own audio capture — as the FIRST POST-LAUNCH project, built in SHADOW MODE.**

**Why not now:** researched 2026-07-26. Every commercial alternative (Skribby $0.35/hr, MeetingBaaS, Attendee, Vexa, Nylas) is **bot-based** — a visible participant joins the call, which breaks Wingman's core promise of invisibility. **Recall's botless Desktop SDK is effectively unique in 2026.** So there is no vendor swap; only DIY.

**The DIY option** (what Granola does): macOS system-audio capture — Core Audio process taps (macOS 14.2+, `CATapDescription`, one-time "record system audio" prompt) or ScreenCaptureKit (macOS 13+, heavier Screen Recording permission) — plus mic via AVFoundation, streamed to Soniox (~$0.12/hr) or AssemblyAI (~$0.15/hr). Electron needs a native piece (`audiotee` + `audioteejs`, MIT, is the ready-made pattern).
- **Cost: ~$0.15–0.30/hr vs Recall's $0.65 — a 55–75% cut.**
- Bonus: mic vs system audio gives perfect rep/prospect separation with no diarization.
- **Cost: 6–10 senior-dev-weeks**, and permanent ownership of the ugly 20% Recall absorbs — echo cancellation (prospect's voice re-entering the mic duplicates every line), mute detection, mid-call device switching, mic/system stream sync, meeting detection. **DIY can never get speaker NAMES** from the meeting app — only channel labels.

**SHADOW MODE is the migration plan:** build it, run it *alongside* Recall on Sebastian's own calls, compare transcripts across ~20 real calls, and flip only at proven parity. Zero launch risk, same payoff.

**Near-term lever instead: negotiate Recall.** Volume discounts exist but are sales-only (contact: Marcus). Their April 2026 quote — 6,000 hrs @ $0.45/hr, 12-month expiry — is a **$2,700 commitment** for a weak discount now that PAYG dropped to $0.50; Sebastian rightly balked. Knowing DIY costs ~$0.20/hr is the BATNA — play it on a call, not in writing.
⚠️ **Recall PAYG fine print:** 2-hour per-recording limit + 500 hr/month account cap. Both lift on the Launch tier — worth getting on before Test Pilots scale.

Related: [[project-launch-cutline]] · [[project-av-recording-notetaker]] (a custom pipeline is a prerequisite for that pivot too)
