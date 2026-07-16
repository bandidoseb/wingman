# A/V Recording — Wingman as Notetaker (Legal · Cost · Plan)

**Created 2026-07-15.** Full context capture of the "store call video + audio + transcript" discussion so it's not lost. This is a **future initiative — NOT being built now.** Research is done; a startup privacy lawyer must sign off before any storage code ships. Research is dated; re-verify prices/law before acting.

> **NOTE — this REVERSES Architectural Invariant #6** ("audio/video NEVER stored — text only") and Core Product Rule #7. Do not build until Sebastian explicitly decides to reverse it and the Invariant is updated. Text-only is currently a real trust differentiator (Granola stores nothing) — spending it is a deliberate trade, not free.

---

## The idea & why (Sebastian)
Store the full call **video + audio + transcript** so Wingman also *is* the notetaker → reps drop Fathom/Granola → one sticky tool, stronger moat. **Video specifically matters** because every sales team does **call reviews** where the manager pulls up the *video* and the team watches together — transcript/audio alone can't replicate that. High value for teams.

---

## Cost — basically free (research 2026-07-15)
- **Recall Desktop SDK records video + audio BY DEFAULT, no bot — Wingman stays invisible.** Video is NOT locked to the visible Bot API. (docs.recall.ai/docs/desktop-sdk)
- Wingman is **very likely already capturing the video** on Recall's servers every call (kept free 7 days) — we just never fetch it. Turning it on ≈ a *download + store* project, not a re-architecture. **VERIFY on one live call** that the current config produces a retrievable `video_mixed` artifact.
- **Recall pricing (early-2026):** $0.50/recording-hr (video = NO surcharge; same rate we already pay) · $0.15/hr transcript · storage FREE first 7 days then $0.05/hr per extra 30 days · $0 platform fee.
- **Self-store math** (100 users × 40 calls × 45 min = 3,000 rec-hrs/mo, ~1,500 GB/mo new video): ~**$35/mo** S3 storage + ~**$135/mo** egress if each watched once. Trivial vs the ~$1,950/mo already spent on Recall recording+transcription at that volume. **Accumulates** if retained forever → set a retention window (e.g. 30/90 days by tier). Self-storage is cheaper than Recall retention beyond a week.
- **Retrieval flow:** `sdk_upload.complete` webhook (has `recording_id`) → Retrieve Recording endpoint → `media_shortcuts.video_mixed.data.download_url` (MP4/H.264, pre-signed S3 URL, **expires ~7 days** → must download in time). Mixed by default; per-participant via `video_mixed_layout: "gallery_view_v2"`.
- **NEEDS-VERIFY:** exact MP4 bitrate/file size (~0.5 GB/hr est.); whether `realtime_endpoints` streaming carries a separate charge; enterprise/volume minimums (gated); current S3/Supabase rates.

---

## Legal / consent (research 2026-07-15 — NOT legal advice; lawyer required)
- **Federal = one-party consent** (18 U.S.C. §2511(2)(d)) — a rep on their own call may record. But **~11 ALL-PARTY-consent states: CA, DE, FL, IL, MD, MA, MT, NV, NH, PA, WA** (+ nuance states: CT, OR, MI, HI, ME, MO). National product → **assume all-party.**
- **Video does NOT change the CONSENT question** — audio already set that bar. So **storing audio ≈ storing video** for the consent/wiretap line (the line is crossed the moment the call is recorded, which we already do to transcribe). Video only adds: (a) **Illinois BIPA** biometric risk *only if you ANALYZE faces* (mere storage is outside BIPA per *Rivera v. Google*) → **keep store-only, zero face analysis**; (b) bigger breach blast radius.
- **Offload to user is standard & enforceable — but ~80% shield, not 100%.** Clickwrap ToS + warranty + indemnity + controller/processor DPA reallocates risk *between you and the rep*. It **cannot bind the prospect** (never signed), doesn't immunize you from a wiretap plaintiff/regulator, and is worthless if the rep is judgment-proof. **Active litigation, both by NON-users who were recorded:** *In re Otter.AI* (CIPA/ECPA, N.D. Cal.), Fireflies (2 Illinois BIPA suits).
- **Irreducible floor you CANNOT offload:** your own data security; breach notification; honoring deletion/DSAR (extend per-call + account-wide delete to A/V — ties to Issue #33); NOT knowingly facilitating illegal recording (§2511/§2512 "reason to know" — willful blindness doesn't help).
- **Penalties (examples):** federal civil = greater of $10k or $100/day + fees; CA §637.2 = $5,000/violation or 3× damages, no proof of harm needed.
- **Training / "controller" question — LARGELY RESOLVED by Sebastian's clarification:** Sales DNA is **rep-entered** (not from prospect calls) → no controller issue. Future model-learning on **de-identified aggregates** ("objections seen across 100 calls," no names/contacts) → largely outside privacy law. **Caveat (execution):** "de-identified" is a real bar — raw transcripts/audio/video carry names, voices, faces. Rule: **aggregate/anonymize BEFORE any training use; never train on raw prospect A/V/voice/face.** Do that and it holds. (Lawyer confirms the anonymization is real.)

---

## The invisibility ⇄ notice trade (the crux)
You **cannot max all three** of {fully invisible · video · auto-notify}. Pick two.
- **Auto-posting "[Rep]'s notetaker is recording" into the meeting chat is the single best legal mitigation** (converts all-party states to *implied consent*). BUT the **invisible Desktop SDK can't post to chat** — chat notice requires being a **bot** (or fragile automation of the user's own Zoom client). **Fathom's own menu proves it:** "Audio & video" is NOT bot-free, while "Audio" and "Transcript only" ARE bot-free → their video uses a bot.
- **Why Granola stays silent:** a risk bet — lean on ToS offload + keep the stored footprint minimal (**Granola stores transcript/notes only, no audio/video**). Copying their silence *while storing full A/V* = worst of both (max exposure + max blast radius).

---

## Per-user bot naming (confirmed)
- Recall **`bot_name` is settable per call** → 1,000 users can each have a unique bot name ("Sebastian's Notetaker", "Mike's Notetaker", …). Set it dynamically when each call starts. **Works on Zoom, Google Meet, and open Teams.** No login, no Recall-account name, no "Wingman" — anonymous guest bot shows exactly the name you pass.
- **Only exception — locked-down Teams** that forbids anonymous join (an enterprise IT tenant policy, not the host's choice; rare for reps hosting their own Zoom/Meet calls). There the bot must sign into ONE shared Microsoft account and Teams shows THAT account's name (you'd name it e.g. "Notetaker" — same for everyone on locked Teams). Not per-user there. Edge case of an edge case for high-ticket sales (mostly Zoom).

---

## RECOMMENDED PLAY (cleanest / safest / proven — mirrors Fathom)
1. **Capture menu = user's choice** (exactly Fathom's): **Audio & Video / Audio only / Transcript only / Off.** Gives control + puts visible responsibility on the user; keeps a store-nothing-sensitive option.
2. **Video mode → renamable VISIBLE bot** ("[Rep]'s Notetaker") — its presence IS the consent/notice (solves all-party cleanly, proven pattern). **Audio/transcript modes → invisible Desktop SDK** (what we use today). *(This is the open decision — see below.)*
3. **Clickwrap at signup** — rep affirmatively agrees they'll obtain all consents, acknowledges the all-party states, indemnifies Wingman. Copy Granola/Fathom/Otter clauses (verbatim on file in the research).
4. **Store-only, zero face analysis** (dodges BIPA). **Extend delete** (per-call + account-wide) to the video files.
5. **De-identified training only, walled off from raw A/V.**
6. **Suggested default-ON disclosure** for the A/V mode (more defensible than competitors' opt-in default).
7. **ONE startup-privacy-lawyer session before shipping** — ToS/clickwrap wording, the training/anonymization approach, the disclosure default, insurance to backstop judgment-proof users.

## THE OPEN DECISION (Sebastian)
**For the video mode:** renamable **visible bot** (safest, notice built-in, Fathom model — RECOMMENDED) **vs** fully-invisible **Desktop-SDK video** (max stealth, but you carry the all-party risk on ToS alone). Claude's rec: **bot-with-custom-name for video, invisible for audio/transcript** — trade cheap stealth for automatic notice where you're storing a prospect's face.

---

## Status / next
- Research complete 2026-07-15. **Separate from the Live Hub / waveform work.** Not building now.
- Before any storage code: (1) Sebastian decides bot-vs-invisible for video + reverses Invariant #6 explicitly; (2) lawyer session; (3) live-call verify Recall already produces the video artifact + confirm $0 Recall delta.
- Memory: [[project-av-recording-notetaker]]. Related: compliance Issue #33 (user-deletable data).
