# API Contracts

[[Stack Reference]] | [[Deploy Runbook]]

Last updated: 2026-04-02

Documentation of every external API dependency. For each: what endpoints we use, what data we send, what we get back, failure handling, and the pricing cliff.

---

## Recall.ai Desktop SDK

**Integration type:** Local SDK (not HTTP API calls — native macOS SDK installed in the Electron app)

**Key operations:**
- `sdk.initialize({ apiKey })` — called at session start using a short-lived token fetched from Railway
- `sdk.startRecording()` — begins audio capture from the active Zoom/Google Meet window
- `sdk.stopRecording()` — ends capture and cleans up
- Transcript stream: SDK emits events with real-time transcript chunks via a local socket

**What we send:** Nothing directly to Recall.ai during a call — the SDK handles it internally. Wingman's Railway API route provides the short-lived upload token.

**What we receive:** Real-time transcript chunks as events from the SDK.

**Failure handling:**
- If `sdk.startRecording()` fails → `isRunning` stays false, error surfaced to user, call start blocked
- If transcript stream drops mid-call → current session memory preserved, but new trigger data stops arriving
- If `sdk.stopRecording()` fails → caught and logged; `isRunning` and `callActive` set to false regardless

**Pricing cliff:** Charged per recording minute. The cliff is at high call volume per user (e.g., a rep doing 8 calls/day × 60 minutes = 480 minutes/day). Monitor average call duration and calls per day per user as beta scales.

**API key security:** `RECALL_AI_API_KEY` lives on Railway only. Electron fetches a short-lived token via `/api/wingman/recall-upload-token` using the user's Supabase auth session.

---

## Anthropic Claude API

**Integration type:** HTTP REST API

**Endpoints used:**
- `POST /v1/messages` — used for all Claude calls (Haiku and Sonnet)

**What we send:**
- Model identifier (Haiku or Sonnet)
- System prompt
- User message (assembled prompt with Offer Brain + KB results + trigger chunk)
- `max_tokens` limit
- `stream: false` (not using streaming for signal cards — await the full response)

**What we receive:**
- `content[0].text` — the generated signal card JSON or post-call analysis JSON

**Failure handling:**
- Wrap every Claude call in try/catch
- If signal card generation fails → log error, do NOT show a card (fail silently for the rep — they miss a card, not a disaster)
- If post-call analysis fails → log error, retry once after 30 seconds, then fail with a visible error in the Flight Log entry
- Never retry the live signal card call — the moment has passed

**Pricing cliff:**
- Haiku: cheap. The cliff is at extremely high trigger frequency (if trigger classifier is too sensitive)
- Sonnet post-call: moderate. The cliff is at long call transcripts (2-hour calls = much larger input). Monitor token usage per post-call call.

**Timeout:** All Claude API calls must have an `AbortController` timeout. Signal card: 5 seconds. Post-call: 30 seconds.

---

## OpenAI API

**Integration type:** HTTP REST API

**Endpoints used:**
- `POST /v1/embeddings` — for KB ingestion and runtime RAG search

**What we send:**
- Model: `text-embedding-3-small`
- Input: the text to embed (trigger chunk at runtime, KB entry text at ingestion time)

**What we receive:**
- `data[0].embedding` — a `vector(1536)` array

**Failure handling:**
- If embedding fails at runtime → skip the KB search, generate signal card without KB context (degraded quality but no error surfaced to user)
- If embedding fails during ingestion → log error, skip that entry, continue with rest of batch

**Pricing cliff:** $0.02 per million tokens. Essentially zero cost at current scale. The cliff doesn't exist until millions of queries per day.

**Critical constraint:** Must always use `text-embedding-3-small` for BOTH ingestion and runtime. Switching embedding models requires re-embedding all 419 existing KB entries.

---

## Supabase API

**Integration type:** Supabase client library (JavaScript SDK)

**Key operations:**

| Operation | Table/Function | Used in |
|-----------|---------------|---------|
| User auth | `supabase.auth` | All authenticated routes |
| Read/write call records | `calls` | Session start/end, Flight Log |
| Read/write Offer Brain | `profiles.offer_brain` | Session load, post-call update |
| Store/retrieve KB entries | `kb_entries` | Ingestion, RAG search |
| Vector search | `search_kb_entries()` RPC | RAG pipeline |
| Store + RETAIN transcripts (user-deletable) | `call_transcript` | Saved during session; **retained after post-call** (Ask Wingman + Flight Log + follow-up memory rely on it). Never auto-deleted. Rep can delete per-call or account-wide (compliance #33). |
| Store objections | `vault_objections` | Post-call job |

**What we send:** Standard SQL operations + pgvector RPC calls.

**What we receive:** Row data, error codes, session tokens.

**Failure handling:**
- Auth failures: return 401 immediately. Log warning. Never fall through to the API call.
- Database write failures: log error. For critical writes (Offer Brain update), retry once. For non-critical (signal card log), fail silently.
- Vector search failure: fall back to prompt-only signal card generation (no KB context)

**Pricing cliff:** Free tier: 500MB database, 1GB file storage, 50,000 monthly active users. The KB embeddings (419 entries × 1536 floats × 4 bytes = ~2.5MB) is tiny. Growth cliff is at user scale (50k MAU).

---

## Stripe API

**Integration type:** HTTP REST API + webhooks

**Endpoints used:**
- `POST /v1/checkout/sessions` — create checkout session
- `POST /v1/billing_portal/sessions` — customer portal
- Webhook: `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`

**What we send:** Customer ID, price ID, success/cancel URLs.

**What we receive:** Checkout session URL, subscription status from webhooks.

**Failure handling:**
- Checkout creation failure → show error to user, log
- Webhook delivery failure → Stripe retries automatically for 3 days. Supabase subscription status may be stale until webhook delivers. Acceptable.
- Webhook signature validation must happen before processing any webhook event.

**Pricing cliff:** 2.9% + $0.30 per transaction. No per-API-call charges. Costs scale linearly with revenue.

---

## Internal API Routes (Next.js → Railway)

These are not external APIs but are the contracts between Electron and the Next.js backend:

| Route | Method | Auth | Purpose |
|-------|--------|------|---------|
| `/api/wingman/session` | POST | Supabase session | Start/end call session |
| `/api/wingman/poll` | GET | Supabase session | Poll for signal cards (legacy) |
| `/api/wingman/kb-signal` | POST | Supabase session | RAG + Haiku signal card generation |
| `/api/wingman/recall-upload-token` | GET | Supabase session | Fetch short-lived Recall.ai token |
| `/api/wingman/post-call` | POST | Bearer token | Post-call job trigger |
| `/api/wingman/outcome` | POST | Bearer token | Log call outcome from HUD card |

**All routes:** Validate Supabase session or Bearer token before any logic. Return 401 immediately on auth failure.
