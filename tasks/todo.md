# Build — Real Listening Waveform (Recall audio → Live Hub pill) — HARDENED

Session: 2026-07-15. Follows the Live Hub core (done/verified). Plan-reviewed; all HIGH/MED fixes folded in.
Research: Recall SDK v2.0.8 streams `audio_mixed_raw.data` (base64 mono 16 kHz S16LE PCM, both speakers
mixed) over the `realtime-event` channel we already use. No extra Recall cost, no new macOS permission
(verify both on live test).

## Goal
The pill's 4 bars react to REAL speech loudness (rep + prospect). Fallback to the ambient animation if
no audio arrives. Audio is decoded in RAM, reduced to one loudness number, and DISCARDED — never stored.

## Files (5)
### 1. `src/app/api/wingman/recall-upload-token/route.ts` — OPT-IN, no-op for old apps
- Parse the request body DEFENSIVELY (route reads no body today — an unguarded `await req.json()` would
  THROW on old apps' empty-body requests and break token minting for everyone):
  `let wantAudio=false; try { wantAudio = (await req.json())?.wantAudioLevel === true; } catch {}`
- Conditionally add the event (line ~101):
  `events: ["transcript.data","transcript.partial_data", ...(wantAudio ? ["audio_mixed_raw.data"] : [])]`
- WHY opt-in: Railway deploys this route to 100% of users on merge. Opt-in keeps every existing install
  BYTE-IDENTICAL (they send no body → no audio sub) until the new desktop app ships. Decouples the
  money-path deploy risk entirely.

### 2. `electron/recall.ts`
- Add `onAudioLevel?: (level: number) => void` to the options type.
- On the token fetch (~line 309), send `body: JSON.stringify({ wantAudioLevel: !!options.onAudioLevel })`.
- NEW branch at the TOP of `realtimeHandler` (ABOVE the `if (!isFinal && !isPartial)` drop at line 377),
  returning before ALL transcript logic:
  - Throttle gate FIRST (`Date.now() - lastAudioEmit >= 40` ms → ~25 Hz) — BEFORE base64 decode (decode
    is the cost). Skipped buffers just drop (visual only).
  - `try { decode base64 → Int16LE RMS → normalize+clamp 0..1 } catch { log err.message once; return; }`
  - `if (!Number.isFinite(level)) return;` then `options.onAudioLevel?.(level); return;`
  - ONE-TIME debug log: **`console.log` ONLY (NEVER `logMeasurement` → that writes JSONL to disk).** Log
    `Object.keys(evt)` + `typeof`/`.length` of the payload field — **NEVER the base64 value, never
    `JSON.stringify(evt)`.** (Invariant #6.)
- Throttle timestamp + `debugLogged` flag live in the per-call handler closure (fresh per call, like
  `lastChunkPerSpeaker`). Must NOT touch `lastChunkAt`, `lastChunkPerSpeaker`, `onChunk`, inactivity.

### 3. `electron/main.ts` (init options, ~704)
- `onAudioLevel: (level) => { if (hudWindow && !hudWindow.isDestroyed()) hudWindow.webContents.send("hud:audio-level", level); }`

### 4. `electron/preload.ts` (hud bridge, ~401)
- `onAudioLevel: (cb) => ipcRenderer.on("hud:audio-level", (_e, l) => cb(l))` — registered once, no stacking.

### 5. `electron/hud/index.html`
- CSS: `#liveHub.audio #hubWave .bar { animation: none !important; }` placed AFTER the `.live` bar rule
  (line ~398) — a running CSS animation OVERRIDES inline `style.transform`, so the JS bars would be
  invisible without this. `!important` + source-order both ensure `.audio` wins.
- Cache the 4 `.bar` nodes once at init (no per-frame querySelectorAll).
- `window.hud.onAudioLevel(level => { if (!isLive) return; audioTarget = clamp(level); add '.audio';
  reset 1s fallback timer; ensure the SINGLE rAF loop is running; })`.
- rAF loop (single `rafId` guard — events update the TARGET only, never spawn a loop): lerp
  current→target ~0.3/frame; set each bar `scaleY` with slight per-bar variation (so it reads as a
  waveform, not one flat meter); defensively clamp/`Number.isFinite`.
- Leaving audio mode (1s fallback OR call end): remove `.audio`, `cancelAnimationFrame`, clear the
  fallback timer, and CLEAR inline `bar.style.transform=''` on all 4 bars (else the last inline value
  fights the resumed CSS animation).
- Proactive teardown in `setLive(false)` / `hideHub()`: do all of the above so the loop never runs past
  call end and no stale transform bleeds into the next call.

## Invariants / safety (all confirmed by plan-reviewer)
- **#6 audio NEVER stored** — RMS-and-discard; debug log uses `console.log` + keys/typeof only; catch
  logs error message only; confirmed PCM can't reach the disk-writing `logMeasurement`/`JSON.stringify`
  paths (audio event returns above them).
- **Transcript pipeline untouched** — audio branch returns above the transcript logic; does not touch
  `lastChunkAt`/inactivity, dedup, or `onChunk`. Old apps that receive the stream just drop it (one Set
  lookup) — functionally harmless, and opt-in means they don't receive it at all until updated.
- **No shared-state touched** — `isRunning`/`callActive`/`isStarting`/stop chain untouched. No schema.
- **Cost** — $0 extra Recall (verify on live test); CPU trivial; IPC throttled ~25 Hz; `isDestroyed()`
  guard on send.

## Live-test (Sebastian)
1. `npm run electron:dev` → Deploy on a real call. 2. Confirm the one-time key dump in the terminal
(fix field path if needed) and that NO audio bytes are printed. 3. Speak → bars rise with your voice;
prospect speaks → bars react; silence → bars settle low; motion smooth. 4. Transcript + cards still work
identically. 5. No new mac permission prompt. 6. Kill audio (or old app) → ambient animation still shows.
7. Confirm Recall billing unchanged for the call.

## Gates
`tsc` web+electron · `wingman-reviewer` on the diff (flag RMS cost + audio-never-stored) · Sebastian
live-test · then ONE desktop release bundling the whole Live Hub.
