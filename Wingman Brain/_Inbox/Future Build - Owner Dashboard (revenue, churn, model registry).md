---
date: 2026-07-01
status: idea — save for later (post-beta)
priority: medium (model-registry slice becomes important sooner — see #44)
---

# Future Build: Owner Dashboard (Sebastian-only)

## The idea (Sebastian, 2026-07-01)
A private dashboard for Sebastian as the *owner* of Wingman — not the rep-facing product, and
distinct from the [[Future Build - Internal Observability Dashboard]] (which is about *failure*
logging). This one is business + operational health at a glance.

## What it shows
1. **Business metrics** — revenue (MRR), churn, active users, calls/day, conversion (free → paid),
   maybe LTV/CAC. The founder cockpit.
2. **Model registry (the part that matters soonest):**
   - A live list of **which Claude/AI model is used for what** (live objection card, summarizer,
     post-call job, embeddings, ingestion) — one place, not scattered across the code.
   - **Toggle** a slot's model from the dashboard (e.g. bump the objection card to a newer model)
     without a code change.
   - **Deprecation warnings** on the dashboard if Anthropic is planning to drop a model we use.

## How it connects to the engineering work (#44 model-resilience)
The *toggle + warning* UI is the front-end of the model-resilience track already queued as **#44**:
- `src/lib/wingman/models.ts` = the single source of truth every route imports (the "central place").
- A **daily deprecation canary** hits Anthropic's Models API + watches deprecation emails
  (`sebastian@meetwingman.ai`) and flags any model we use that's going away.
Build #44 first (the source of truth + canary + alert). The dashboard toggle/warning is the visible
layer on top of it — do it when the owner dashboard gets built.

## Why it matters
- Model deprecation is a real outage risk (a retired `claude-sonnet-4-*` silently 502'd the Coach
  once already). A dashboard warning + one-click toggle turns a fire drill into a click.
- Revenue/churn visibility is founder table-stakes once there are paying users.

## Sizing / don't-over-build
- Do NOT build before V1 beta ships.
- The model-registry slice can piggyback on #44 and could even live inside the same `/admin` surface
  as the observability dashboard (one gated owner area, multiple tabs) rather than a separate app.
- Business metrics likely pull from Stripe + Supabase — straightforward once billing is live.
