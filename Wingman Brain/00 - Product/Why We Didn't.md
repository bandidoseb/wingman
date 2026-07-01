# Why We Didn't

A log of approaches considered and rejected. Every entry represents a real decision. Append new entries — never delete old ones. Knowing why we rejected something prevents relitigating the same debate six months later.

---

## 2026 — Architecture Decisions

### Why we didn't store audio or video

**Considered:** Capturing and storing call audio/video for training data, playback, or compliance.

**Rejected because:** Legal and privacy exposure is enormous. A recording of a sales call captures the prospect's voice without their explicit consent for storage — depending on jurisdiction, this may require two-party consent. More practically: our target user (the closer) doesn't want a recording of their call in some startup's database. They want a debrief and they want to move on. Storing audio also multiplies infrastructure costs (storage, processing) for zero product value over text. Text-only was a conscious product and legal positioning decision.

**Rule derived:** Never store audio or video — text transcripts only. (Note: the audio/video ban is permanent. Text transcripts themselves ARE retained and user-deletable — reconciled 2026-06-05; an earlier note here said they're deleted after the post-call job, which was stale and never matched the live code.)

---

### Why we didn't use a static system prompt instead of RAG

**Considered:** Stuffing all 419 KB entries (Cole Gordon, Jeremy Miner, NEPQ techniques) into the Claude system prompt at call start, so the model always has the full knowledge base available.

**Rejected because:** 419 entries × ~200 tokens each = ~84,000 tokens per call. That's $0.084 per call in Haiku token costs alone, before the actual signal card generation. At scale, this is untenable. More importantly, a 84k-token context window filled with techniques the model has to sift through degrades output quality — the model can't focus on what's relevant right now. RAG retrieves only the 3 most relevant techniques for the specific trigger moment (~450 tokens), keeping the prompt lean and the signal card precise.

**Rule derived (UPDATED 2026-06-21):** Runtime RAG for **KB/coaching content** (vs. stuffing the whole KB in the system prompt) — still true for the **Wingman Coach**. BUT the **live objection card cut RAG entirely** (2026-06-21): it's a context-driven Sonnet prompt with no retrieval, because a blind A/B on 12 objections showed the KB added no distinguishable value there and its forced-script rule hurt cards. So the current rule is: **RAG for the Coach; NO retrieval for the live objection card** (its "dynamic content" is the per-rep Belief Ladder, not the KB). The original reasoning below still explains why we don't stuff the full KB into a prompt.

---

### Why we didn't build for SDRs or appointment setters

**Considered:** Expanding the target user to include SDRs (cold callers booking appointments) and appointment setters (closers' handoff point).

**Rejected because:** The conversation on a discovery/appointment call is structurally different from a closing call. SDRs are pattern-matching for interest, not navigating objections and closing. The Sales KB is built on closing methodology content (Cole Gordon, Jeremy Miner NEPQ). Building SDR support means a different KB, a different prompt, and a different UX — effectively a second product. The closer market is large enough, underserved enough, and ROI-obvious enough to stay focused.

**Rule derived:** Wingman is a closer's copilot. One user type. One call structure. One knowledge base.

---

### Why we didn't charge below $149/month

**Considered:** Lower price points ($49/month, $99/month) to reduce friction and increase trial-to-paid conversion.

**Rejected because:** The target user closes high-ticket offers — $3,000 to $15,000 per deal. A single additional close per month generates 20-100x the subscription cost. At this ROI, price is not the objection — trust is. Charging less doesn't reduce the trust barrier; it just signals the product is lower-quality. More importantly, at $49/month, the gross margin after Recall.ai transcription costs gets uncomfortably thin. $149/month gives us room to absorb variable costs and stay at 70%+ gross margin even for high-call-volume users.

**Rule derived:** Never compete on price with this user. Compete on ROI clarity. One close pays for a year of Wingman.

---

### Why we didn't build for enterprise

**Considered:** Going upmarket — team dashboards, manager reporting, CRM integrations, SSO, compliance features.

**Rejected because:** Enterprise means procurement, security reviews, 6-month sales cycles, and a completely different buyer (VP Sales, not the closer themselves). It also means building features that don't make the core product better — they make the buying process easier for organizations. The info product closer space has none of this friction: they see it, they want it, they buy it. Staying mid-market keeps us moving fast and keeps the product focused on people who close for a living.

**Rule derived:** Build for the closer. Not the manager. Not the organization. The individual who lives and dies by their close rate.

---

### Why we didn't use LiveKit instead of Recall.ai

**Considered:** LiveKit for real-time audio capture and transcription, which would give us more control over the pipeline and potentially lower costs.

**Rejected because:** LiveKit requires injecting a bot or SDK into the meeting itself, which means either joining the call as a visible bot (bad for our "invisible to the prospect" requirement) or using OS-level audio capture (which has its own reliability and macOS permission complications). Recall.ai Desktop SDK handles all of this — it captures audio at the OS level, invisibly, and streams a real-time transcript via Deepgram without appearing as a meeting participant. The integration is clean and battle-tested. Building a comparable pipeline on LiveKit would take months and introduce reliability risk we can't afford pre-launch.

**Rule derived:** Recall.ai Desktop SDK is the foundation. Don't build what they already built well.

---

### Why we didn't use Pinecone for vector search

**Considered:** Pinecone as a dedicated vector database for the Sales KB instead of pgvector in Supabase.

**Rejected because:** We're already in Supabase for all user data. Adding Pinecone means a second database dependency, a second set of credentials, a second bill, and a more complex infrastructure to debug. pgvector in Supabase handles 419 KB entries trivially — we're nowhere near the scale where pgvector would degrade. When/if we hit 100k+ entries, Pinecone becomes worth the complexity. For now, one database.

**Rule derived:** Don't add infrastructure dependencies until the current stack is a proven bottleneck.

---

### Why we didn't build a real-time transcript viewer in the HUD

**Considered:** Showing a live scrolling transcript in the HUD overlay so the rep can see the conversation on screen.

**Rejected because:** Reps should be looking at their prospect, not reading a transcript on screen. A live transcript in the HUD pulls attention away from the human in front of them, which is the exact opposite of what Wingman is designed to do. The HUD exists to surface signal cards at precise moments — not to create a new distraction. The transcript is available post-call in the Flight Log for review. Mid-call, the rep's eyes belong on the prospect.

**Rule derived:** The HUD is for signal cards and the stage bar only. Nothing else lives there.
