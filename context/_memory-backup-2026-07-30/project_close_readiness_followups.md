---
name: project-close-readiness-followups
description: "Queued close-readiness + surface-agreement work — dropdown, strictness test, premature-buying-signal redirect card, shared readiness engine"
metadata: 
  node_type: memory
  type: project
  originSessionId: 6fc81b8d-ee3f-43f7-84e1-4951ec94d2f4
  modified: 2026-07-22T14:41:17.250Z
---

Queued from the 2026-07-20→22 summarizer "grades harder" discussion. Full brief: `tasks/close-readiness-followups.md`. One focused session, one desktop release (same → close HUD surface), eval-gated + plan-reviewer. Not started.

Four items:
1. **"See what's missing ▾" dropdown** — chip shows top-2 gap only; rep covers 2, re-presses, sees 2 more, feels misled. Fix: collapsed-by-default expander listing ALL not-covered items in priority order (⚠️→⬜→🟡). Keeps "not a live checklist" rule (minimal default, complete on demand). **Naming ruled: do NOT rename "beliefs"** — not Cole IP, user never sees the word (labels already plain English: Core Problem / Can't DIY / Cost of Waiting / Dream Outcome / Investment / Who's Deciding / Why You). Dropdown header "Still to cover", no category noun. Keep "beliefs" internal (no rename sweep).
2. **Test the emotional-ownership ✅ bar for over-strictness** on real calls (the 2026-07-20 change made the chip stricter — intended, but watch it doesn't tell reps NOT to pitch when they could).
3. **Premature-buying-signal → "defer + redirect" card** — "how do I start?" 10 min in ≠ pitch. Miner/Cole both DEFER + loop back. The correct output is a THIRD move (acknowledge + defer + redirect, e.g. Sebastian's line "we'll definitely get there — I just want to learn a bit more first"), not pitch and not silent-dig. The dig-card "readiness overrides soft belief → take the close" rule is too aggressive — make it conditional on CASE-BUILT, not buying-signal-detected.
4. **Surfaces must AGREE** — chip (ladder-only) and dig card (buying-signal) can disagree. Feed the new MOMENTUM line into a SHARED readiness definition all cards read. This is the real close-readiness audit (supersedes the earlier "punish ⬜ qualification harder" idea — "Almost Ready · <gap>" is honest, keep it).

**Hard requirement (Sebastian):** the rep is NEVER left wondering — the chip must always show the reason ("Haven't covered: …" + ↓ Dig CTA, or the cold-start note). Already true in code (`close-readiness.mjs` → `electron/hud/index.html`); must survive future changes.

Related: [[project-summarizer-tuning-session]] (the summarizer that grades the ladder the chip reads), [[project-dig-card-threading]].
