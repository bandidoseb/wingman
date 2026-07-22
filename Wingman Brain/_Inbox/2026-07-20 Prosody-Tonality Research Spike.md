# 2026-07-20 — Prosody / Tonality research spike (future)

**Context:** During the summarizer-tuning session we named an honest limitation: the summarizer reads a TEXT transcript and cannot hear tonality — the flat, checked-out *"yeah, sure"* vs. the leaning-in *"yeah — yeah actually"* look identical on paper. Jeremy Miner's #1 skill (tonality) is invisible to Wingman today. The momentum layer (word choice, answer length, buying questions) is a partial proxy only.

**Deepgram Audio Intelligence — evaluated 2026-07-20, REJECTED for this:**
- Sentiment / Intent / Topic / Summarization are **pre-recorded only** (streaming chip struck through in docs; streaming feature matrix lists only Entity Detection). Live product → unusable; post-call we store no audio (invariant #6).
- Their "sentiment" is **linguistic, not acoustic** — the same models ship as "Text Intelligence" on plain text. It reads words, not voice. Sonnet with call context already beats it.
- Entity Detection does stream, but grabs digits/names with zero hedging judgment (our NUMBER CONFIDENCE rule exists precisely for that) — and our Deepgram runs inside Recall.ai anyway (no raw param control).
→ Log in Why We Didn't when a build touches this space.

**The real path (the spike):** acoustic **prosody** analysis — pitch, energy, pace, pauses/hesitation measured from the audio signal itself, not the transcript.
- Candidates: Hume AI expression-measurement API (streaming), or lightweight local acoustic feature extraction (pitch/energy/pace deltas).
- **Physical path already exists:** the Live Hub waveform taps live `audio_mixed_raw.data` (RMS → IPC) — so raw audio is available in-process WITHOUT storing anything (invariant #6 stays intact if analysis is transient).
- Product shape (idea): a per-utterance "delivery temperature" signal fed into the summarizer's MOMENTUM line — never rep-facing coaching mid-call, just better card context.
- Open questions: latency, cost per call-minute, accuracy on meeting audio (mixed channel — prospect + rep together in one stream; would need diarization-aware handling), privacy posture ("processes audio transiently, stores nothing").

**Status:** idea only. Not scheduled. Sort into a project note when someone picks it up.
