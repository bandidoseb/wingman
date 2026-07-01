# Card Placement Studio + Notch Mode (post-streaming feature)

**Captured:** 2026-06-30 · **Status:** queued, AFTER the streaming-reveal feature ships · **Own task(s).**
**Inspiration:** Moody (https://moody.mjarosz.com) — a Mac teleprompter. We take its *look + placement*, NOT its behavior (see "What we're NOT copying").

---

## The idea
Let the rep decide WHERE and HOW the objection card appears, and preset it once before calls — via a visual customizer in the Wingman dashboard.

### Two placement modes (user's choice)
1. **Notch mode** — the card renders at/below the camera notch so it looks like a native part of the Mac, right at the lens (best eye contact, "seamless" feel).
2. **Floating window mode** — a free card the rep can place anywhere on screen and resize (today's top-center is the default of this mode).

### The Placement Studio (dashboard UI)
A **mockup of a Zoom call** in the Wingman dashboard where the rep previews and customizes everything live, then saves it as their preset:
- Drag the floating card around the mock call to position it.
- Toggle between **Notch** and **Floating window**.
- See a realistic preview of how it'll actually look on a call.

### Adjustable settings (apply to BOTH notch and window where sensible)
- **Notch:** size · width · how far down it drops
- **Window:** position (drag) · size
- **Text:** color · size

Saved per-user, applied silently on every call (same "preset once, runs in the background" philosophy as the Playbook).

---

## What we're NOT copying (decided 2026-06-30)
- **Voice-activated scrolling / teleprompter behavior.** Moody scrolls a long script as you talk. Wingman's card is ONE surgical line — there's nothing to scroll, and a rep *reading a flowing script while talking* is the exact robotic-rep failure mode our Core Rules #10/#11 forbid. Skip entirely.
- **Parked (philosophy-aligned, but later + needs mic VAD):** auto-fade the card the instant the rep starts *speaking* (they've absorbed the line → get out of the way). The only "voice" idea that fits; not now.

---

## Technical reality / constraints (so we plan it right)
- **The notch only exists on SOME Apple Silicon Macs** — 14"/16" MacBook Pro (2021+) and newer MacBook Airs. The 2020 M1 Air / 13" MBP have none, and **any external monitor has no notch.** So notch mode must be an *enhancement when present, graceful fallback to top-center floating otherwise* — detect the display's safe-area/notch, never assume it's there.
- We already moved the card top-center for camera proximity (2026-06-29) — this is that instinct perfected. Validates the direction.
- **Already done for free:** our HUD has `setContentProtection(true)` → invisible in screen shares/screenshots (Moody advertises the same). We don't need to build that.
- The HUD is a separate always-on-top Electron window; positioning/resizing it + per-user preset (likely a `profiles` column or settings JSON) is the build surface. Studio lives in the Next.js dashboard; the chosen preset flows to the Electron HUD.

## Sequencing
1. **Streaming reveal first** (in progress, `feat/streaming-card-reveal`).
2. **Notch mode + floating mode** (HUD positioning + safe-area detection + fallback) — own task.
3. **Placement Studio** (dashboard mock-call customizer + per-user preset storage) — own task.
4. Personalization (color/size) rides along with the Studio.
