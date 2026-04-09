# Video Ingestion Queue

Last updated: 2026-04-02

A running list of YouTube videos and channels to ingest into the Sales KB. The KB is the foundation of Wingman's signal card quality — the better the content ingested, the better the cards.

**Current KB stats (as of v0.1.19):** 37 videos, ~15 hours, 419 KB entries

---

## How to Ingest a New Video

Run the local ingestion tool:
```bash
cd "/Users/sebastianperez/Desktop/Wingman CC/knowledge-base"
node ingest.js [YouTube URL]
```

The tool runs: yt-dlp (download audio) → Whisper (transcribe) → Claude Sonnet (extract KB entries) → OpenAI embeddings → Supabase pgvector

**Cost per video:** ~$0.006/min Whisper + ~$0.005 Sonnet extraction + negligible embedding cost

---

## Priority Queue

### High Priority — Ingest Next

| Video / Channel | Topic | Why It's High Priority |
|----------------|-------|----------------------|
| Cole Gordon — "How to Handle ANY Objection" | Objection handling | Core methodology for signal cards |
| Cole Gordon — Full closing framework walk-through | Full framework | Foundation for stage tracking |
| Jeremy Miner NEPQ — "The Problem with Traditional Sales" | NEPQ methodology | Foundation for discovery stage cards |
| Jeremy Miner — "How to Use Problem Awareness Questions" | Discovery / pain excavation | High-value KB content for Discovery stage cards |
| Jeremy Miner — "How to Handle I Need to Think About It" | Close objections | Very specific, very common trigger |
| Jeremy Miner — "The Most Powerful Close in Sales" | Closing technique | Direct signal card source |
| Alex Hormozi — "100M Leads — Sales Chapter" | Offer positioning, closing | Hormozi's framework for high-ticket offer sales |
| Alex Hormozi — "The Close" (YouTube) | Close methodology | Complementary framework |

### Medium Priority

| Video / Channel | Topic | Why |
|----------------|-------|-----|
| Any Cole Gordon role-play or live call review | Applied technique examples | Shows the methodology in action, not just theory |
| Jeremy Miner full podcast interviews on objection handling | Deep objection content | Longer form = more KB entries per video |
| Dan Lok — "High Ticket Closing" content | Alternative closing framework | Adds methodology diversity |
| Grant Cardone close techniques | Assumptive close, urgency | Different style — useful for reps with Cardone training |

### Low Priority — Eventually

| Video / Channel | Topic | Notes |
|----------------|-------|-------|
| General sales psychology content | Buyer psychology | Lower signal-to-noise than methodology-specific content |
| Cold calling training | Cold outreach techniques | Not Wingman's use case — but some psychology content may be useful |

---

## Already Ingested (Summary)

37 videos, ~15 hours total, 419 KB entries as of v0.1.19. Specific video list not yet tracked in this file — add tracking below as new videos are ingested.

| Date Ingested | Video | Entries Created | Notes |
|--------------|-------|----------------|-------|
| (Pre-vault) | Various (37 total) | 419 total | Initial KB build |

---

## Ingestion Notes

- **Avoid content with heavy background music** — Whisper transcription quality degrades significantly
- **Long-form content (30+ min) produces more KB entries** than short clips — prioritize full sessions over highlights
- **Role-play and live call reviews** are the highest-quality content — the model sees the technique applied in a real conversation, not just explained
- **Avoid duplicate sources** — if two videos cover the same technique from the same speaker, one is usually enough unless they add meaningfully different nuance
- **Check the KB quality notes** after each major ingestion batch to assess if new cards improved signal quality
