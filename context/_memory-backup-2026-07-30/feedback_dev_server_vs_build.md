---
name: feedback-dev-server-vs-build
description: "Never run npm run build while the dev server is running, and don't trust a screenshot taken right after a DOM change"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 0d201796-b1f0-4545-b083-4bb928ff209a
  modified: 2026-07-29T15:43:51.028Z
---

Two verification traps that each cost real time on 2026-07-29.

**1. Never run `npm run build` while the dev server is running.**
Both write `.next`. The production build overwrites what the running dev server is serving, so the
page loses its stylesheet and renders as raw unstyled HTML — sidebar looks fine (inline styles), the
rest looks catastrophically broken. Sebastian hit this and reported "welp, it looks broken."

**Why:** it reads as a code disaster when nothing is wrong.
**How to apply:** stop the dev server → build → `rm -rf .next` → restart. If a page ever looks
unstyled, suspect this before debugging any code.

**2. A browser screenshot taken right after a DOM/theme change returns a STALE FRAME.**
Twice in one session a screenshot showed obviously-wrong colours (dark panels in light mode, then
light cards in dark mode). Both times reading computed styles proved the DOM was correct — the
screenshot was a frame from mid-transition.

**Why:** it produced two false "I introduced a regression" claims that wasted effort and would have
led to "fixing" working code.
**How to apply:** after toggling a theme or mutating the DOM, read `getComputedStyle` values before
believing a screenshot. If evidence contradicts itself twice, restart the dev server — a stale bundle
is more likely than a subtle bug.

Related: [[project-dashboard-rebuild]]
