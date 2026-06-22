# Stack Reference

> ⚠️ **Updated 2026-06-21:** the live **objection** card is generated with **Sonnet** (was Haiku); it no longer embeds or hits pgvector. OpenAI embeddings are now for KB ingestion + the **Wingman Coach** search only. See Decisions Log 2026-06-21.

[[API Contracts]] | [[Deploy Runbook]]

Last updated: 2026-04-02

Every tool in the Wingman stack. What it does, where credentials live, what breaks if it goes down, pricing tier, and what we'd replace it with if forced to.

---

## Recall.ai Desktop SDK

**What it does:** Captures audio from Zoom, Google Meet, and Microsoft Teams calls at the OS level on the user's Mac. Streams a real-time transcript via Deepgram. Invisible to the call participant — no bot joins the meeting.

**Why it's critical:** This is the entire input layer. No Recall.ai = no transcript = no signal cards. The whole product stops.

**Where credentials live:** `RECALL_AI_API_KEY` — Railway environment variables only. Never in Electron binary or client-side code. Electron fetches a short-lived upload token via `/api/wingman/recall-upload-token`.

**What breaks if it goes down:** Everything. Users cannot start calls. Existing sessions would need to be stopped.

**Pricing tier:** Per recording minute. This is the largest variable cost per user. Active monitoring needed.

**Apple Silicon only:** The Desktop SDK only runs on Apple Silicon Macs (M1, M2, M3). Intel Macs not supported. This is a Recall.ai constraint — not Wingman's to fix.

**What we'd replace it with:** No drop-in replacement. LiveKit could be adapted but requires significant engineering. This is a strategic dependency — monitor Recall.ai's health as a company.

---

## Deepgram

**What it does:** Speech-to-text transcription engine, running inside Recall.ai's pipeline. Wingman doesn't call Deepgram directly — Recall.ai does.

**Where credentials live:** Managed by Recall.ai. No direct Deepgram credentials needed in Wingman.

**What breaks if it goes down:** Transcription quality degrades or stops. Recall.ai would handle this failover.

**Pricing:** Bundled into Recall.ai costs. No separate Deepgram bill.

**What we'd replace it with:** AssemblyAI, OpenAI Whisper (for batch), or Google STT. Not a concern until Recall.ai's reliability becomes an issue.

---

## Anthropic Claude API

**What it does:** Powers live signal card generation (Claude Haiku) and all post-call analysis (Claude Sonnet). The intelligence layer.

**Where credentials live:** `ANTHROPIC_API_KEY` — Railway environment variables and `.env.local` (server-side Next.js only). Never client-side.

**Models used:**
- Live signal cards: `claude-haiku-4-5-20251001`
- Post-call analysis + Offer Brain update: `claude-sonnet-4-20250514` (or latest Sonnet)
- Mission Intel coaching: `claude-sonnet-4-20250514`

**What breaks if it goes down:** Signal cards stop generating. Post-call analysis fails (would need to queue and retry). Mission Intel chat stops working.

**Pricing tier:** Pay-per-token. Signal cards are cheap (Haiku). Post-call analysis is moderate (Sonnet + long context). Monitor token costs per user per month.

**What we'd replace it with:** OpenAI GPT-4o for Sonnet tasks, GPT-4o-mini for Haiku tasks. Not ideal (different model characteristics) but functional fallback.

---

## OpenAI API

**What it does:** Embeddings only. `text-embedding-3-small` is used both at ingestion time (converting KB entries to vectors) and at runtime (embedding trigger chunks for RAG search).

**Where credentials live:** `OPENAI_API_KEY` — Railway environment variables and `.env.local`. Must use the same model at both ingestion and runtime — they produce vectors in the same space.

**What breaks if it goes down:** KB ingestion fails. Runtime RAG search fails (no embedding → no vector search → no KB results → signal cards revert to prompt-only generation without KB context).

**Pricing tier:** Very cheap. `text-embedding-3-small` is $0.02 per million tokens. Essentially zero cost at current scale.

**What we'd replace it with:** Anthropic doesn't offer embeddings yet. Alternatives: Cohere embeddings, Voyage AI embeddings. Would require re-embedding all 419 KB entries with the new model.

---

## Supabase

**What it does:** Primary database for everything: users, auth, call records, Offer Brain JSON, KB entries + embeddings, transcript temp storage, vault_objections, vault_signals.

**Where credentials live:**
- `NEXT_PUBLIC_SUPABASE_URL` — public (in browser)
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — public (in browser, Row Level Security enforces access)
- `SUPABASE_SERVICE_ROLE_KEY` — Railway only. NEVER client-side. This key bypasses RLS.

**Key extensions:** pgvector (for KB embeddings search). Must stay enabled.

**What breaks if it goes down:** Everything. Auth, data, vector search — all stop.

**Pricing tier:** Free tier handles beta. Pro tier ($25/month) adds more storage and compute. Monitor database size as KB grows.

**What we'd replace it with:** PlanetScale (MySQL) + Pinecone (vectors) + Auth0 (auth). Major migration — three services instead of one. Not worth it unless Supabase fails.

---

## Railway

**What it does:** Hosts the Next.js app and all API routes. Auto-deploys on git push to main.

**Where credentials live:** All environment variables are set in the Railway dashboard. `.env.local` is for local dev only — never pushed to git.

**What breaks if it goes down:** The web dashboard, all API routes, and the backend pipeline are unreachable. Electron desktop app can't fetch tokens or post transcripts.

**Pricing tier:** Hobby plan ($5/month) covers early beta. Pro plan ($20+/month) as usage grows.

**What we'd replace it with:** Vercel (native Next.js support, but serverless timeout concerns for post-call jobs), Render, or AWS App Runner.

---

## Stripe

**What it does:** Handles subscription billing. Checkout, customer portal, webhooks for subscription status changes.

**Where credentials live:**
- `STRIPE_SECRET_KEY` — Railway only
- `STRIPE_WEBHOOK_SECRET` — Railway only
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` — public (in browser)

**What breaks if it goes down:** New subscriptions can't be created. Existing subscriptions continue (Stripe is extremely reliable — effectively never goes down).

**Pricing tier:** 2.9% + $0.30 per transaction. No monthly fee.

**What we'd replace it with:** Nothing reasonable. Stripe is the industry standard.

---

## Rewardful

**What it does:** Affiliate tracking. Generates unique referral links. Tracks attributed subscriptions. Integrates with Stripe for commission payouts.

**Where credentials live:** Rewardful dashboard. API key stored in Railway if needed for webhook integration.

**What breaks if it goes down:** Affiliate link tracking stops. New referrals aren't attributed. Existing commissions aren't affected (already tracked).

**Pricing tier:** Starts at ~$49/month. Only worth it when affiliates are active.

**Status:** Not yet active.

---

## GitHub

**What it does:** Source control. GitHub Actions auto-builds the desktop .dmg on git tag push.

**Repository:** `bandidoseb/wingman`

**What breaks if it goes down:** No code can be pushed. No desktop builds generated. Core dev workflow blocked.

**GitHub Actions:** `.github/workflows/` — auto-builds, signs, packages .dmg, uploads to GitHub Releases on new release tag.

---

## Blooio / Project Blue

**What it does:** iMessage API. Sends and receives iMessages programmatically from a real phone number.

**Where credentials live:** Not yet set up.

**Status:** Not yet integrated. Required for the iMessage conversion funnel.

**What breaks if it goes down:** iMessage funnel stops. No conversion impact on existing subscribers.

---

## Local KB Ingestion Tool

**What it does:** A local Node.js tool in `/knowledge-base/` that ingests YouTube videos into the Sales KB. Not deployed — runs locally only.

**Tools it uses:** yt-dlp (download audio), Whisper (transcribe), Claude Sonnet (extract KB entries), OpenAI (embed), Supabase (store).

**What breaks if it goes down:** Can't add new content to the KB. Existing 419 entries remain unaffected.

**Port:** 3333 (when running `node server.js` for the management UI)
