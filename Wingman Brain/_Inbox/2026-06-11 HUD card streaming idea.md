# HUD card streaming (Sebastian, 2026-06-11)

**The idea:** instead of waiting for the full card, stream it onto the HUD as Haiku writes it — the headline appears in well under a second, the support line fills in behind it. Biggest perceived-latency lever left after Phase 3.5 (bigger than any provider/model swap).

**Sebastian's hard requirement:** the stream must be **super smooth — not choppy and distracting.** Design constraint: never render raw network chunks (they arrive in jittery bursts). Buffer the stream server/renderer-side and reveal at a constant cadence (word-by-word with a soft fade, decoupled from chunk timing). The rep should perceive one calm motion, not a stuttering teleprompter.

**Build shape (rough):** kb-signal route switches to a streaming response (SSE) for the card branch → DashboardClient consumes the stream → relays increments over IPC (`hud:signal-stream`) → HUD renders with a constant-rate reveal animation. Headline-first prompt order already holds (JSON: headline before subtext) — may need a streaming-friendly output format so the headline is parseable before the JSON closes.

**When:** after the Phase 3.5 live gate + warm `branch=kb` latency number. If warm presses already land ~1.5s, this is polish; if they sit >2s, this is the next lever (ahead of speculative pre-generation, which costs tokens).

**Status:** captured, not committed. Needs its own Plan Review Loop (streaming + IPC + parse-while-streaming has real failure modes: mid-stream abort, partial JSON, pill handoff).
