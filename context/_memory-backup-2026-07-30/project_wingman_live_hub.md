---
name: project-wingman-live-hub
description: "Granola-style floating \"Wingman live\" pill — draggable, branded, content-protected, hover→mini-settings; its own dedicated session"
metadata: 
  node_type: memory
  type: project
  originSessionId: 856e19fd-d7ca-4b0b-b01b-dfd8d3b5d408
---

**The "Wingman live hub"** — a Granola-style floating call indicator, its own dedicated session (Sebastian 2026-07-15, decided AFTER live-testing the close-readiness chip [[project-close-readiness-chip]] exposed three real problems: the top-center is CROWDED — compass + signal cards + the "thinking" pill all render in the same spot and overlap; the current live dot is basically invisible; and after Deploy, "Starting" flashes then vanishes with no "Wingman is running" confirmation).

**Reference:** Granola's call indicator (a small black pill with the app logo + a live waveform). Build OUR version.

**Scope (this session):**
- **Draggable branded pill** — a small always-on-while-live floating pill with the **Wingman logo**. Rep drags it anywhere; position persists (localStorage, same pattern as the HUD stage-bar drag). Default spot: a corner OUT of the top-center card zone (bottom-right TBD — ask Sebastian).
- **Content protection (NON-NEGOTIABLE)** — must stay INVISIBLE to the prospect. The HUD already uses macOS `setContentProtection(true)` (excluded from screen-share/recording); verify the pill inherits it explicitly. Core product rule: Wingman is invisible on the call.
- **Listening WAVEFORM — Sebastian explicitly wants a REAL one (2026-07-15).** THE CHALLENGE: the HUD renderer does NOT currently have the live audio stream — Recall captures audio server-side, the HUD never sees it. Must FIGURE OUT HOW: options to explore — (a) pipe Deepgram/Recall audio-level or speaking events to the HUD via IPC, (b) tap a local system/mic audio level, (c) drive the waveform off transcript-arrival cadence as a proxy, (d) worst case an ambient animation (Sebastian wants real, so exhaust a/b/c first). Not solved yet — research task.
- **Hover/click → mini-settings shell** — a small panel surfaced on hover/click of the pill, with per-rep toggles:
  - **Signal-card word color** — this IS roadmap #3 (spec locked 2026-07-13: card = 2 presets dark/white; text = 4 presets white/blue #7E9BFF/green #4ED188/yellow #F1D24C + a color-wheel picker; guard unreadable combos). First `--signal-*` theming hook in `electron/hud/index.html` (colors are hard-coded literals today).
  - **Formality of the generated words** — NEW. Deeper than the color toggle: a prompt-level tone control that flows into EVERY generated line (objection/dig/etc.), so it needs backend wiring + an eval pass, not just a UI toggle.
- **Also rework the top-center layout** so compass / signal card / thinking-pill don't overlap (the pill-above-card gap + compass-vs-card positioning Sebastian flagged) — the draggable hub helps, but the stacking needs a real fix.

**Consolidation:** this one build absorbs roadmap **#4 (live indicator — UN-SKIPPED; the "it's fine" call was reversed once live-tested)** + **#3 (card-color customizer)** + the new **formality** control.

**Order (Sebastian-locked):** ship the close-readiness chip (#2) FIRST, then build this hub next.
