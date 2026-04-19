---
date: 2026-04-19
status: idea — save for later
priority: medium-high (becomes critical at scale)
---

# Future Build: Internal Observability Dashboard

## The Problem
At low call volume, failures hide silently in Railway logs. Nobody checks Railway logs proactively. At 10,000 calls/month, even a 0.5% failure rate = 50 silent failures per month. Sebastian has no visibility into where the system is breaking down or how often.

Currently all failures write to `console.error` on Railway — that's the only signal. Not good enough at scale.

## What to Build

### Phase 1 — Event Logging (foundation)
Add a `system_events` table to Supabase:
- `id`, `event_type`, `severity` (error/warning/info), `user_id`, `call_id`, `message`, `metadata` (jsonb), `created_at`

Log the following events:
- `snapshot_fetch_failed` — flight plan snapshot failed to load at session creation
- `session_create_failed` — session creation failed entirely
- `transcript_missing` — post-call job found no transcript
- `post_call_failed` — Sonnet post-call job failed after all retries
- `pillar_coverage_failed` — pillar evaluation failed or returned invalid JSON
- `signal_card_failed` — KB search or Haiku call failed during live poll
- `offer_brain_update_failed` — Offer Brain didn't update after call
- `recall_connect_failed` — Recall.ai failed to join meeting
- `flight_log_missing` — call ended but no Flight Log entry created

### Phase 2 — Internal Admin Dashboard
A simple `/admin` route (auth-gated to Sebastian's account only) showing:
- Total events by type, last 30 days
- Failure rate per event type (failures / total calls)
- Timeline chart — spot when a deploy caused a spike
- Drill down into individual failures with full context (call_id, user_id, error message, timestamp)

### Phase 3 — AI-Suggested Fixes (the sick part)
When viewing a cluster of failures, a button: "Diagnose this." 
- Sends the error logs to Sonnet
- Sonnet reads the pattern, identifies the likely root cause, and proposes a fix
- Output: plain English explanation + suggested code change
- Sebastian can hand this to a developer or paste it to Claude Code

## Why This Matters
- At beta (small volume): nice to have
- At 1,000+ users: essential infrastructure
- Prevents silent degradation where Wingman appears to work but 10% of users are getting bad output
- Gives Sebastian real data to prioritize engineering work and direct contractors

## Notes
- Foundation (`console.error` on Railway) already exists — this builds on top of it
- Phase 1 is a migration + a few lines added to each error catch block — low effort, high value
- Phase 2 is a few hours of UI work
- Phase 3 is the long-term vision — don't build until Phase 1 data actually exists
- Do NOT build this before V1 beta ships. Log it, ship the product, come back to it.
