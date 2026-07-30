---
name: project-owner-dashboard
description: Future owner-only dashboard — revenue/churn + model registry (toggle + deprecation warnings)
metadata: 
  node_type: memory
  type: project
  originSessionId: 2522bd5f-4be9-472d-acff-b3cbd59cc7c2
---

Sebastian wants (flagged 2026-07-01, post-beta) a private **owner dashboard**: business metrics
(revenue/MRR, churn, active users, conversion) PLUS a **model registry** — one place listing which
AI model powers each slot (objection card, summarizer, post-call, embeddings, ingestion), with a
**toggle** to switch a slot's model without a code change and **deprecation warnings** when Anthropic
plans to drop a model we use.

The model-registry slice is the visible layer on top of the queued **#44 model-resilience** work
(`src/lib/wingman/models.ts` single source of truth + a daily deprecation canary on Anthropic's
Models API). Build #44 first; the dashboard toggle/warning sits on top.

Full note: `Wingman Brain/_Inbox/Future Build - Owner Dashboard (revenue, churn, model registry).md`.
Distinct from the failure-logging [[Future Build - Internal Observability Dashboard]] but may share
one gated `/admin` area. Do NOT build before V1 beta ships.
