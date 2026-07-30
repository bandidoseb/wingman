---
name: project-dashboard-solidity-sweep
description: "Deferred final pass to make the whole dashboard \"Granola-smooth\" once Sebastian finishes his dashboard changes"
metadata: 
  node_type: memory
  type: project
  originSessionId: 7bc3d0df-6fb1-4386-868f-c31dcaf31298
---

Sebastian wants a dedicated **solidity / polish sweep of the entire dashboard** — go interaction-by-interaction and make every little detail feel Granola-smooth (loading states, button feedback, no races, no flimsy/janky moments). 

**UPDATE 2026-07-13 — NOW ACTIVE. Sebastian kicked off a full dashboard redesign** (called the current dashboard "Frankensteined, nothing cohesive, no design language"). This became a **design-language-first** effort, not just a polish sweep. Decisions locked this session:
- **North star = Granola-clean** (warm neutrals, whitespace, calm premium). Approach = **language-first**: define tokens once, approve the feel, THEN rebuild screens.
- **Scope = whole product (dashboard + HUD)** under ONE language, but "one language, MANY rebuilds" — build sequentially, never one big-bang change (protects the live-call pipeline; dashboard ships via Railway, HUD needs a desktop release).
- **Canonical doc written:** `Wingman Brain/00 - Product/Wingman Design Language.md` (single source of truth — consolidates ~8 scattered design notes). Interactive token/component reference built as a Claude artifact (Granola-clean palette, "signal blue" accent #3557C7, sunset gradient for scoring, both surfaces shown). Pending Sebastian's approval of the feel.
- **Key reconciliation:** HUD card stays DARK/glassy ([[Signal Card Design Science]] is load-bearing, research-backed) — do NOT reskin it light. Surfaces unified by type (SF Pro), motion (one easing, fade-not-slide), restraint, accent.
- **Next after approval:** tokens → app CSS, then rebuild dashboard screen-by-screen (first screen TBD). Card Placement Studio + homepage/metrics redesign = features built LATER in the finished language, not part of defining it.
- Sebastian has shadcn components collected from various sites to fold in (re-skin to tokens, don't paste raw).

**(Prior timing note, now superseded by the update above):** was DEFERRED until the dashboard was "done"; Sebastian has now chosen to redesign rather than keep patching.

**Why:** He explicitly benchmarks against Granola / well-funded super-smooth non-buggy apps and said the app currently "feels kinda flimsy." Quality bar = a well-funded startup's senior team; "flimsy" is death-by-a-thousand-small-things, so the sweep must be exhaustive, not a spot check.

**How to apply:** When triggered, audit every dashboard interaction for: double-click/spam safety (see the Deploy state-machine fix from the #47 work as the template), explicit loading/empty/error states, immediate feedback on every action, and concurrency/state races. Its own focused session, before beta. Related: the Deploy-button state-machine fix (Known Issue [[#47]]) is the first instance of this standard applied.
