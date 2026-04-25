[[09 - Code Review]]

---

# Wingman Daily Code Review — 2026-04-25

## What Was Pushed

Four commits, all from a competitive research and financial modeling session — no new features built. The only real code change is a one-line tightening of the chatbot's profanity rule in `src/app/api/ai/chat/route.ts`. The rest of the push is documentation: a new build log, updated sprint and known issues files, a WebSocket push migration plan, a unit economics model, and a standalone HTML margin calculator tool (runs only in your browser locally — not served by Railway).

## Automated Scan Results

- **TypeScript:** PASSED — 0 errors
- **New dependencies:** None
- **Hardcoded localhost:** None found
- **Secrets exposure:** None found
- **Sensitive data in logs:** None found
- **Debug artifacts left in code:** None found
- **.env.local modified:** Not touched

## 🔴 Critical Issues — Fix Before Next Beta Call

None found.

## 🟡 High Issues

None found.

## 🟠 Medium Issues

**Missing request timeout on the "Ask Wingman" chatbot's Anthropic call**
- **File:** `src/app/api/ai/chat/route.ts:292`
- **What's wrong:** The `fetch()` call to Anthropic has no `AbortController` timeout. If Anthropic is slow or hangs (overloaded, network hiccup, etc.), the Railway server request just sits there waiting — potentially for 30–60 seconds before Railway kills it with a 504 error.
- **What a user experiences:** They send a message in the Mission Intel chatbot, the spinner runs for 30–60 seconds, then they see a generic error. No explanation. Could happen mid-session.
- **Note:** This is a pre-existing issue, not introduced today. It was flagged because this file was modified. The `poll/route.ts` already uses `AbortController` correctly — this route should match.
- **Fix:** Add `const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), 15000);` then pass `signal: controller.signal` to the fetch call, and `clearTimeout(timeout)` in the success path.

## 🔵 Low / Nice-to-Fix

- `src/app/api/ai/chat/route.ts` — No AbortController on the fetch to Anthropic (same as Medium above — separate low note: a 15-second timeout is appropriate for a chatbot, shorter than the 10-second poll timeout since users are waiting interactively).

## Architectural Invariants Check

- **Invariant 1 (Recall key on Railway only):** Checked — clean. No Recall AI key in any client-side or Electron file.
- **Invariant 2 (isRunning set after success only):** Checked — clean. `isRunning = true` at `electron/recall.ts:325` is set after `sdk.startRecording()` resolves successfully inside the try block.
- **Invariant 3 (stopRecallAI is the only stop path):** Checked — clean. `sdk.stopRecording()` only appears inside `stopRecallAI()` at `electron/recall.ts:389`.
- **Invariant 4 (isRunning and callActive always change together):** Checked — clean. All three locations where `callActive = false` is set in `main.ts` (lines 65, 343, 355) either call `stopRecallAI()` directly or are paired with the failure path where recording never started.
- **Invariant 5 (auto-stops through the full chain):** Checked — clean. All auto-stop paths call `options.onAutoStop?.()` which routes to `autoStopCall` → `stopRecallAI()`.

## Product Rules Check

All 10 checked — clean. Today's push only modifies a prompt text string and planning documents. No signal card logic, no cooldown logic, no stage logic, no transcript storage logic was touched.

## Known Issues — Status Check

| Issue | Impact | Change today |
|-------|--------|--------------|
| #33 — Wiretap compliance | Critical | Unchanged — still #1 pre-beta blocker |
| #32 — HUD blocks mouse clicks | Critical | Resolved (marked in Known Issues — confirmed `setIgnoreMouseEvents(true, { forward: true })` already implemented) |
| #31 — Chatbot permanently blocks after error | High | Unchanged |
| #29 — Duplicate trigger phrases | Medium | Unchanged |
| #28 — Negation blindness | Medium | Unchanged |
| #24 — Non-sales content in KB | High | Unchanged |
| #23 — Third-person prospect triggers | High | Unchanged |
| #22 — Offer-specific scripts in KB | High | Unchanged |
| #21 — Embedding latency, no Redis cache | Medium | Unchanged |

## Stress Test Results

Today's only code change is a one-line prompt string update. The chatbot still functions identically for all 11 stress scenarios. The pre-existing AbortController gap (Medium issue above) is the only scenario where behavior could degrade — a hung Anthropic request during an interactive chat session would eventually time out via Railway's platform timeout (~30–60s), not hang forever.

All 11 stress tests checked — no new failures introduced by today's changes.

## Verdict

Everything is safe to stay in production as-is. Today's push was almost entirely documentation — the one real code change (profanity rule hardened at `chat/route.ts:150`) is a low-risk text update that correctly fixes Issue #31 as logged. The only finding is a pre-existing missing timeout on the chatbot's Anthropic `fetch()` call, which should be patched before heavy beta use of Mission Intel.
