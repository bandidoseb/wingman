---
name: project-av-recording-notetaker
description: "Strategic initiative — store call VIDEO+AUDIO (not just transcript) so Wingman replaces Fathom/Granola; stay invisible, offload all legal/consent to the user. Under research 2026-07-15."
metadata: 
  node_type: memory
  type: project
  originSessionId: f996c76c-82a5-49d2-b183-97c14686f454
---

**Initiative (Sebastian 2026-07-15):** have Wingman store the full call **video + audio** (not just the text transcript), turning it into a notetaker/call-recorder too — so reps drop Fathom/Granola and Wingman becomes the one sticky tool.

**Why video specifically:** every sales team Sebastian's been on does **call reviews** where the manager pulls up the *video* recording and the team watches together. Transcript/audio alone can't replicate that. Video+audio is high-value for sales teams → a real wedge + retention moat.

**Reconsidered the "audio never stored" rule (Invariant #6):** Claude had overstated the legal fear. Reality agreed this session: (a) Wingman **already offloads** recording/wiretap liability to the user via ToS Section 5 (all-party-consent states listed, ECPA cited, indemnification); (b) the core recording-consent risk was already taken on the moment Wingman listens+transcribes — storing A/V is *incremental*, not a new category; (c) storing prospect A/V is the **notetaker category NORM** (Fathom/Otter/Granola/Fireflies all do it) — NOT brand-killing (Claude retracted that claim); (d) storage is cheap (~1GB/Zoom-hr, ~$0.02/GB/mo). **So Invariant #6 is up for revision pending this research** — do NOT treat "never store audio/video" as settled anymore.

**Sebastian's desired end state:** fully **invisible** (no visible bot if possible) + records video+audio + **all legal/consent/compliance offloaded to the user** (ToS + a signup click-through agreement) — "act as Recall": Recall records our prospects and offloads consent to us, the builder; Wingman takes the identical posture toward its users.

**Bot-naming ask:** IF video forces Recall's visible **bot** (vs the invisible Desktop SDK), can each user **rename/white-label the bot** (e.g. "John's Notetaker" not "Wingman") so it stays discreet and doesn't out Wingman on a prospect's call? Research this.

**Research spun up 2026-07-15 — must answer by end:**
1. Cost to store video+audio (Recall Desktop SDK video support? or bot-only? Recall pricing per hour + storage math at scale).
2. Legalities of recording video+audio; do we legally HAVE to disclose? one-party vs all-party; does VIDEO change it vs audio.
3. Consent — how to offload fully to the user (processor/controller model, signup agreement).
4. Can it stay **fully invisible** while recording A/V + offloading everything to the user?
5. Custom/white-label **bot naming** if a bot is required.
6. Competitor consent playbook (Granola/Fathom/Otter/Fireflies).

**RESEARCH DONE 2026-07-15 → full doc: `Wingman Brain/00 - Product/AV Recording — Notetaker Feature (Legal, Cost, Plan).md`.** Key conclusions:
- **Cost ≈ free:** Recall Desktop SDK records video+audio invisibly by default, $0 recording surcharge (likely already capturing it, kept 7 days); self-store ≈ $35/mo storage + $135/mo egress at 100 users. MP4 via `sdk_upload.complete` webhook → Retrieve Recording.
- **Legal:** assume all-party consent (~11 states); storing audio ≈ storing video for the consent line (video only adds BIPA-if-face-analysis + breach blast radius → keep store-only, no face analysis). Offload via clickwrap ToS = standard but ~80% shield (can't bind the prospect; Otter/Fireflies actively sued by non-users). Irreducible floor: own security/breach/deletion/no-knowing-facilitation.
- **Training/"controller" worry RESOLVED:** Sales DNA is rep-entered (not from calls); future learning = de-identified aggregates only ("objections across 100 calls", no names) → fine, PROVIDED anonymization is real and we never train on raw prospect A/V/voice/face.
- **Invisible+video+auto-notify: pick 2.** Auto chat-notice needs a BOT (invisible desktop can't post chat — Fathom's video isn't bot-free for this reason).
- **Per-user bot naming CONFIRMED:** Recall `bot_name` per call → 1,000 unique names ("Mike's Notetaker") on Zoom/Meet/open Teams; NO login/Recall-name shown. Only locked-down Teams (rare, enterprise IT policy) forces one shared MS-account name.
- **RECOMMENDED PLAY:** Fathom-style capture menu (A+V / Audio / Transcript / Off) + renamable VISIBLE bot for the video mode (notice built-in) + invisible desktop SDK for audio/transcript + clickwrap ToS + de-id training + a startup-privacy-lawyer session.
- **OPEN DECISION:** bot-with-notice (recommended) vs fully-invisible for video.

**Status:** captured for later; separate from the [[project-wingman-live-hub]] waveform (stores nothing, shipped-pending-live-test). Gate before ANY storage code: Sebastian reverses Invariant #6 explicitly + lawyer sign-off + live-verify Recall already yields the video artifact. Ties to compliance Issue #33.
