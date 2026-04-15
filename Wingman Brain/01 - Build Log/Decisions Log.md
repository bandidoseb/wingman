# Decisions Log

A running log of every major architectural or product decision made on Wingman. Append only — never delete. Each entry captures the decision, the date, the reasoning, and any alternatives that were rejected.

Last updated: 2026-04-15

---

## 2026

### 2026-04-15 — Dual KB architecture: separate tables for signal cards and coaching chatbot
**Decision:** Split the knowledge base into two separate Supabase tables: `kb_entries` (signal cards, existing) and `kb_coaching_entries` (coaching chatbot, new). One ingestion URL populates both automatically.
**Reasoning:** Signal card entries require surgical precision — 30+ first-person prospect triggers, verbatim script, universal applicability across all offers. Coaching chatbot entries can be broader — mindset, habits, frameworks, general sales advice. The same schema and quality bar can't serve both without compromising one. Two focused tables > one muddled table.
**Rule:** Everything ingested goes into `kb_coaching_entries`. Only entries that pass the strict signal card quality gate ALSO go into `kb_entries`. Signal is a strict subset of coaching.
**Trade-off accepted:** Two ingestion pipelines to maintain. More infrastructure. Worth it for quality.
**Alternatives rejected:** One table with a `use_case` column — rejected because the schemas are genuinely different and the quality bars are incompatible.
**Status:** Active — not yet built. SQL migration is next session priority #1.

---

### 2026-04-15 — Gap-detection signal cards are Playbook cards, not KB cards
**Decision:** "You haven't touched on timeline/budget/decision maker" type signal cards are powered by the Playbook system (pre-call checklist), not by the KB pipeline.
**Reasoning:** KB fires when a prospect says something specific that matches a technique. Gap detection fires when the AI notices a rep hasn't covered a required framework item. These are fundamentally different trigger types requiring different infrastructure.
**Status:** Active — Playbook page not yet built.

---

### 2026-04-02 — Recall.ai Desktop SDK for live audio capture
**Decision:** Use Recall.ai Desktop SDK (not a bot joining the call) to capture audio invisibly.
**Reasoning:** Recall.ai Desktop SDK captures audio at the OS level without joining the call as a participant. This is the "invisible copilot" architecture — the prospect never sees a bot in the meeting. Alternatives considered: LiveKit (would require a visible bot or complex OS audio integration) and building custom macOS audio capture (months of engineering with reliability risk). Recall.ai is proven, works with Zoom/Teams/Google Meet on Apple Silicon Macs.
**Trade-off accepted:** Apple Silicon Mac only. Intel Macs not supported.
**Status:** Active

---

### 2026-04-02 — RAG over static system prompt
**Decision:** Use runtime RAG (vector search against Sales KB) instead of stuffing the full KB into the system prompt at call start.
**Reasoning:** 419 KB entries × ~200 tokens = ~84,000 tokens. At Claude Haiku pricing, that's $0.084 per call in static context alone, before the signal card itself. More importantly, 84k tokens of context the model has to scan degrades output quality. RAG retrieves only the 3 most relevant techniques for the specific trigger moment (~450 tokens). Precision and cost win over convenience.
**Status:** Active

---

### 2026-04-02 — pgvector over Pinecone
**Decision:** Use pgvector extension in Supabase for vector search, not a dedicated vector database like Pinecone.
**Reasoning:** We're already in Supabase for all user data. Adding Pinecone adds a second database dependency, second set of credentials, second bill, and more complexity. At 419 KB entries, pgvector is fast and simple. Pinecone becomes worth the complexity at 100k+ entries or when query latency becomes a proven bottleneck. Don't add infrastructure until the current stack is the bottleneck.
**Status:** Active. Revisit at scale.

---

### 2026-04-02 — Electron for desktop app
**Decision:** Build the Mac desktop app in Electron (TypeScript), not native Swift/SwiftUI.
**Reasoning:** The Wingman dashboard and API are built in Next.js. Using Electron means the dashboard UI runs in a web view inside the desktop app — the same code serves both the web dashboard and the desktop app. A native Swift app would require maintaining two completely separate UIs. Electron's performance overhead is acceptable for this use case (a floating overlay, not a graphics-intensive game). The builder (Sebastian, non-technical) needs Claude Code to maintain this codebase — TypeScript is far more maintainable with AI assistance than Swift.
**Status:** Active

---

### 2026-04-02 — Supabase for database
**Decision:** Use Supabase (PostgreSQL) as the primary database for all persistent data — users, calls, Offer Brain, KB entries, embeddings.
**Reasoning:** Supabase provides PostgreSQL + Row Level Security + auth + realtime subscriptions + pgvector extension — all in one managed platform. The alternative (self-hosted PostgreSQL on Railway) adds operational overhead with no feature advantage. The pgvector extension is the critical capability for KB vector search.
**Status:** Active

---

### 2026-04-02 — Railway for backend hosting
**Decision:** Host the Next.js app and all API routes on Railway.
**Reasoning:** Railway supports Next.js natively, auto-deploys on git push, and has simple pricing. Alternatives: Vercel (would work but hobby plan has serverless function timeout limitations for long-running post-call jobs), AWS (massive operational overhead for a pre-revenue startup). Railway's $5/month hobby plan covers early beta. Upgrade to Pro at scale.
**Status:** Active

---

### 2026-04-02 — $149/month pricing
**Decision:** Set the subscription price at $149/month (directional — may be adjusted pre-launch).
**Reasoning:** The target user closes deals worth $3,000–$15,000. One additional close per month generates 20-100x the subscription cost. At this ROI, price is not the objection. Charging less ($49–$99) doesn't reduce the trust barrier — it signals lower quality. At $149, gross margin after Recall.ai transcription costs stays at ~70%+ for typical user volume.
**Status:** Under review — not finalized. Confirm before launch.

---

### 2026-04-02 — Cole Gordon / Closers.io as beachhead market
**Decision:** Target Cole Gordon's network (Closers.io alumni, high-ticket phone closers in info products) as the first user base.
**Reasoning:** This community is (1) organized and reachable, (2) already sold on investing in tools that improve close rate, (3) ROI-driven enough to pay for something that works, (4) vocal enough to spread by word of mouth if it does work. The community speaks the same language as the Wingman methodology (NEPQ, Gordon Gap, etc.), which means onboarding friction is lower.
**Status:** Active

---

### 2026-04-02 — Delete raw transcripts after post-call processing
**Decision:** Raw transcripts are stored temporarily in Supabase during a call, used by the post-call job, then deleted immediately after the job completes.
**Reasoning:** Legal exposure (storing call transcripts without prospect consent), privacy commitment to users, and infrastructure cost. The insights extracted (grade, debrief, objections, Offer Brain delta) are stored permanently. The raw text is not needed after extraction. This is a hard rule — see Architectural Invariants in CLAUDE.md.
**Status:** Active. Non-negotiable.

---

### 2026-04-02 — Claude Haiku for live signal cards, Claude Sonnet for post-call
**Decision:** Use Claude Haiku for real-time signal card generation (target <800ms) and Claude Sonnet for post-call analysis (async, quality over speed).
**Reasoning:** Haiku's token throughput and latency profile makes it the only Anthropic model that can meet the <1 second end-to-end target reliably. Sonnet is 3-5x slower but produces significantly higher quality analysis for complex tasks (grading a full call transcript, extracting nuanced patterns). Since post-call runs async, latency is irrelevant — quality wins.
**Status:** Active

---

### 2026-04-03 — Recall AI transcript provider key: deepgram_streaming
**Decision:** Use `deepgram_streaming` (not `deepgram`) as the transcript provider key when creating Recall AI recording sessions.
**Reasoning:** Recall AI changed their API format. The old key `deepgram` is no longer valid — the API now requires provider-specific suffixed keys (`deepgram_streaming`, `assembly_ai_streaming`, etc.). This was discovered when every call start returned a 400 error with "Must provide exactly one of: deepgram_streaming, ...". The fix is one word in `recall-upload-token/route.ts`.
**Status:** Active.

---

### 2026-04-03 — Zoom name status synced via IPC tristate (null/true/false)
**Decision:** Sync Zoom display name status from the web app to the Electron main process using a tristate (`null` = unknown, `true` = set, `false` = not set). Only block deploy on explicit `false`.
**Reasoning:** The main process needs to know whether the Zoom name is set so it can show warnings in the tray and HUD before the deploy reaches the dashboard. Using a binary (true/false) defaulting to false would cause false "setup required" warnings if the user opens the tray before the web app has finished loading and reported its status. Null = unknown = pass through to dashboard's existing check. This prevents false positives.
**Status:** Active.

---

### 2026-04-02 — Affiliate model (Rewardful + Stripe) for distribution
**Decision:** Use a creator affiliate model (~20% recurring revenue share) to drive user acquisition, inspired by Cal AI's growth playbook.
**Reasoning:** The target user trusts creators and coaches in the closer space more than ads or cold outreach. A recurring 20% commission creates ongoing incentive to promote (vs one-time bounties). Rewardful + Stripe handles the tracking and payouts cleanly without custom infrastructure.
**Status:** Planned. Not yet active.

---

### 2026-04-07 — Keyword signals bypass the 90-second cooldown
**Decision:** Keyword-triggered objection cards always fire immediately, interrupting any current card and ignoring the 90-second cooldown. Poll-based nudges still respect the cooldown.
**Reasoning:** A prospect raising a live objection is always time-sensitive. Suppressing it because a card fired 60 seconds ago means a buying signal gets no response. Poll-based cards are lower urgency (the rep may already be handling it) — those still respect the cooldown.
**Status:** Active.

---

### 2026-04-07 — Transcript dedup changed to last-text-per-speaker
**Decision:** Dedup transcript chunks by comparing each speaker's new text against their last emitted text. Only emit when the text changes. Replaced the previous 500ms time-window approach.
**Reasoning:** Recall.ai was firing the same utterance 7–9x per speaker turn. The time-window approach was fragile (dependent on timing, not content). Last-text-per-speaker is deterministic — a duplicate is only emitted if the speaker actually said something new. Simpler, more reliable, and immune to timing issues.
**Status:** Active.

---

### 2026-04-09 — Obsidian brain tracked in GitHub repo
**Decision:** Removed `Wingman Brain/` from `.gitignore`. The Obsidian vault is now committed and pushed to the GitHub repo.
**Reasoning:** Sebastian needs to sync the brain across devices (Mac + phone via Poke AI assistant). GitHub is already the sync mechanism for the codebase. Co-locating the brain in the same repo means one push syncs everything. The brain contains no secrets — only product strategy, build logs, and decisions.
**Status:** Active.

---

### 2026-04-09 — /wrap skill for session end automation
**Decision:** Created a Claude Code skill (`wingman-wrap`) that runs at the end of every session. Triggered by "wrap it up" or "/wrap". Writes the daily Obsidian build log, updates Known Issues and Current Sprint, updates any other relevant brain files, commits, and asks for push approval before pushing.
**Reasoning:** Build logs were being skipped at session end (happened on 2026-04-07 — log was blank). A skill is more reliable than a plain text instruction in CLAUDE.md because it's an explicit, named workflow that Claude must invoke rather than a rule it can forget to follow.
**Skill location:** `~/.claude/plugins/marketplaces/claude-plugins-official/plugins/wingman-wrap/skills/wrap/SKILL.md`
**Status:** Active.
