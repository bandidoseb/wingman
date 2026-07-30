# Mission Intel Deep Dive — Complete Build Plan

**Status:** Ready to build. Two adversarial review rounds completed (34 issues found and resolved).
**Files to touch:** exactly 2 — `src/app/api/ai/chat/route.ts` and `src/components/dashboard/FlightLogTab.tsx`
**Do NOT touch:** `knowledge-search.ts` (already done), `Current Sprint.md` (already updated)

---

## What We're Building (Plain English)

When a user chats with Mission Intel (global mode), Wingman walks them through a 3-turn flow to identify a specific past call. Once confirmed, it silently fetches the full transcript and switches to a deep-dive coaching mode — all inside the same chat modal, no navigation, no button. The modal seamlessly becomes a per-call coaching session.

**The 3-turn flow:**
- **Turn 1 (Step 1):** User asks about a specific call. Claude identifies the best match and asks "Are you talking about the call with [Name] on [Date]?" — no marker yet.
- **Turn 2 (Step 2):** User says yes. Claude offers the deep dive and ends response with `CALL_MATCH:{"call_id":"...","name":"...","date":"..."}`. Server strips marker, returns `callSuggestion`. Client stores silently as `pendingCallSuggestion` — **NO button shown**.
- **Turn 3 (Step 3):** User says yes/let's go. Claude says something like "Give me a moment, I'm reading the full transcript…" and ends with `DIVE_NOW`. Server detects marker, fetches full transcript, returns `diveReady: { openerReply, callData }`. Client shows staggered messages then switches to single-call mode.

---

## FILE 1: `src/app/api/ai/chat/route.ts`

**Full rewrite.** Replace the entire file with the following logic.

### Imports (no changes needed)
```typescript
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { searchCoachingKnowledge } from "@/lib/wingman/knowledge-search";
```

### Constants
```typescript
const DAILY_CAP = 20;
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
```

### `capTranscript` — DELETE THIS FUNCTION ENTIRELY
Remove `capTranscript`. No word cap. The full transcript goes in.

### `buildGlobalContext` — KEEP AS-IS (already updated in prev session)
Already includes `id` field in call lines. No changes.

### `buildSingleCallContext` — REMOVE capTranscript call
Change line `lines.push(\`\nTRANSCRIPT:\n${capTranscript(call.call_transcript)}\`);`
to: `lines.push(\`\nTRANSCRIPT:\n${capTranscript(call.call_transcript)}\`);`

Wait — actually remove capTranscript entirely and inline the sort+join:

```typescript
if (call.call_transcript?.length) {
  const sorted = [...call.call_transcript]
    .sort((a, b) => a.sequence_order - b.sequence_order)
    .map((l) => `${l.speaker}: ${l.text}`)
    .join("\n");
  lines.push(`\nTRANSCRIPT:\n${sorted}`);
}
```

### New Helper: `fetchCallWithRetry`

Add this BEFORE the route handler:

```typescript
async function fetchCallWithRetry(
  supabase: Awaited<ReturnType<typeof createClient>>,
  callId: string,
  userId: string,
  maxRetries = 2
) {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, 500));
    try {
      const { data, error } = await supabase
        .from("calls")
        .select(`
          prospect_name,
          outcome,
          call_date,
          duration,
          summary,
          missed_topics,
          call_stages ( name, status, note, display_order ),
          call_transcript ( speaker, text, sequence_order )
        `)
        .eq("id", callId)
        .eq("user_id", userId)   // ← CRITICAL: security guard
        .single();
      if (error) throw error;
      if (data) return data;
    } catch (err) {
      if (attempt === maxRetries) throw err;
    }
  }
  return null;
}
```

### Parse body — add `pendingCallId`

```typescript
const { mode, messages, callSummaries, call, pendingCallId } = await req.json();
```

### UUID validation — add right after body parse

```typescript
const validPendingCallId = (
  typeof pendingCallId === "string" && UUID_REGEX.test(pendingCallId)
) ? pendingCallId : null;
```

### Updated global mode system prompt — FULL REPLACEMENT

Replace the existing global mode system prompt section with this:

```typescript
if (mode === "global") {
  systemParts.push(
    `\n---\nCALL TRIAGE — follow these steps exactly, in order:\n\nSTEP 1 — User asks about a specific call: Identify the best match from the call list above. Ask for confirmation only — e.g. "Are you talking about the call with [Name] on [Date]?" Do NOT include CALL_MATCH. Do NOT offer to dive deeper yet.\n\nSTEP 2 — User confirms the call (says yes, "that's the one", etc.): Offer the deep dive clearly. Say something like: "If you want to do a deep dive into your call with [Name], just say the word — I'll read the full transcript and we can get into every detail." Then end your response with this marker on its own line:\nCALL_MATCH:{"call_id":"[exact ID from the list]","name":"[prospect name]","date":"[e.g. Apr 12]"}\n\nSTEP 3 — User accepts the deep dive (says "yes", "let's do it", "yeah go ahead", etc.): Say something like "Give me a moment — I'm reading the full transcript now." Then end your response with this exact marker on its own line:\nDIVE_NOW\n\nRules:\n- CALL_MATCH only appears in a STEP 2 response — never in Step 1 or Step 3\n- DIVE_NOW only appears in a STEP 3 response — never in Step 1 or Step 2\n- Copy the call_id exactly as it appears in the list — do not alter it\n- Never include CALL_MATCH or DIVE_NOW for general pattern or trend questions\n- If the user denies the call in Step 1, try to identify another match or ask for more detail`
  );
}
```

### DIVE_NOW detection — add after CALL_MATCH parsing block

```typescript
// ── Detect DIVE_NOW marker (global mode only, requires a valid pending call ID) ──
let diveReady: { openerReply: string; callData: ReturnType<typeof buildSingleCallContext> extends string ? never : object } | null = null;

if (mode === "global" && /\n?DIVE_NOW[.!]?\s*$/i.test(reply)) {
  // Strip marker from reply
  reply = reply.replace(/\n?DIVE_NOW[.!]?\s*$/i, "").trim();

  if (!validPendingCallId) {
    // Claude said DIVE_NOW but client didn't send a pendingCallId — soft error
    reply = "Having trouble loading that call right now — just say 'try again' and we'll get it.";
  } else {
    try {
      const callData = await fetchCallWithRetry(supabase, validPendingCallId, user.id);

      if (!callData) {
        // All retries failed — keep pendingCallSuggestion on client, user can retry
        reply = "Having trouble loading that transcript right now — just say 'try again' and I'll give it another shot.";
      } else if (!callData.call_transcript?.length) {
        reply = "That call doesn't have a transcript available yet.";
      } else {
        const date = new Date(callData.call_date).toLocaleDateString("en-US", {
          month: "short", day: "numeric"
        });
        const openerReply = `Read it. Your call with ${callData.prospect_name ?? "that prospect"} on ${date} — ${callData.duration ?? "unknown duration"}, ${callData.outcome ?? "no outcome logged"}. What do you want to look at?`;

        diveReady = { openerReply, callData };
      }
    } catch {
      reply = "Having trouble loading that transcript right now — just say 'try again' and I'll give it another shot.";
    }
  }
}
```

### Prompt caching — restructure system prompt assembly

Replace the current `const systemPrompt = systemParts.join("\n");` section with:

```typescript
// Split system prompt into cacheable vs non-cacheable parts
// corePromptStr = persona + tone + format rules (static across all users)
// contextStr    = call data (changes per call — what we cache in single_call mode)
// kbContext     = KB search result (never cached — changes per message)

const corePromptStr = systemParts
  .filter((p) => !p.startsWith("\n---\n")) // everything before the first --- divider
  .join("\n");

// The context block (call data or global stats) — this is what we cache
const contextBlock = contextStr ? `\n---\n${contextStr}` : "";

// The call triage instructions (global mode) — also static, include in core
// (already pushed into systemParts above)

const usePromptCaching = mode === "single_call" && contextStr.length > 0;
```

Wait — the systemParts array already has the context embedded. Let me rethink the structure cleanly.

**ACTUAL IMPLEMENTATION — restructure systemParts assembly:**

Build `coreSystemStr` separately from `contextStr`. The current code mixes them. Here's the clean split:

```typescript
// ── Build system prompt ─────────────────────────────────────────────────────
const coreParts: string[] = [
  `You are Wingman — an elite sales coach who has seen thousands of real calls. You don't sugarcoat, and you don't flatter.`,
  ``,
  `Tone:`,
  `- Proper grammar and punctuation. You're a professional.`,
  `- Confident and direct. When you have an opinion, share it.`,
  `- Not a yes-man. If their thinking or performance is off, name it briefly — then move on. Don't be harsh, but don't sugarcoat.`,
  `- No filler openers. Never start with "Great question", "Absolutely", "Of course", or "I".`,
  `- Praise when it's earned. Pushback when it's earned. Neither is given freely.`,
  ``,
  `Format:`,
  `- Keep it short. When you have 2-3 distinct thoughts, separate each with a blank line — like sending separate texts.`,
  `- No bullet points, no lists, no headers. Just talk.`,
  ``,
  `Substance:`,
  `- Always anchor to their real data — specific outcomes, specific patterns, specific call moments. Generic advice is lazy advice.`,
  `- If you don't have enough to be specific, ask ONE short question instead of guessing.`,
  `- Never mention other coaches, frameworks, or external tools. All insights come from you.`,
  `- Never say "the knowledge base" or reference any system. You're their coach, period.`,
];

// Add call triage instructions to core (static, same for all users)
if (mode === "global") {
  coreParts.push(`\n---\n[CALL TRIAGE INSTRUCTIONS — same as above]`);
}

const coreStr = coreParts.join("\n");

// ── Prompt caching decision ────────────────────────────────────────────────
// Cache the call context block for single_call mode — saves ~90% cost on
// repeated turns within a 5-minute window (Anthropic ephemeral cache TTL).
const usePromptCaching = mode === "single_call" && contextStr.length > 0;

// ── Assemble system field ──────────────────────────────────────────────────
let systemField: string | Array<{ type: string; text: string; cache_control?: { type: string } }>;

if (usePromptCaching) {
  const parts: Array<{ type: string; text: string; cache_control?: { type: string } }> = [
    { type: "text", text: coreStr },
    { type: "text", text: `\n---\n${contextStr}`, cache_control: { type: "ephemeral" } },
  ];
  if (kbContext) {
    parts.push({ type: "text", text: `\n---\nCOACHING INSIGHTS (weave these naturally into your response — never quote or attribute them):\n${kbContext}` });
  }
  systemField = parts;
} else {
  // String (global mode, or single_call with no context)
  const allParts = [coreStr];
  if (contextStr) allParts.push(`\n---\n${contextStr}`);
  if (kbContext)  allParts.push(`\n---\nCOACHING INSIGHTS (weave these naturally into your response — never quote or attribute them):\n${kbContext}`);
  systemField = allParts.join("\n");
}
```

### Anthropic API call — add caching header and use systemField

```typescript
const response = await fetch("https://api.anthropic.com/v1/messages", {
  method: "POST",
  headers: {
    "x-api-key":          apiKey,
    "anthropic-version":  "2023-06-01",
    "content-type":       "application/json",
    ...(usePromptCaching ? { "anthropic-beta": "prompt-caching-2024-07-31" } : {}),
  },
  body: JSON.stringify({
    model:      "claude-sonnet-4-20250514",
    max_tokens: 400,
    system:     systemField,
    messages:   cappedMessages,
  }),
});
```

### Return value — add diveReady

```typescript
return NextResponse.json({
  reply,
  ...(callSuggestion ? { callSuggestion } : {}),
  ...(diveReady     ? { diveReady }      : {}),
});
```

---

## FILE 2: `src/components/dashboard/FlightLogTab.tsx`

**Significant changes to the global chat section only.** Everything else (call list, per-call chat, outcome picker) stays untouched.

### Remove these from the file:

1. `callSuggestion?` from `GlobalMessage` type
2. `openSuggestedCall` function (the whole function, lines ~250-258)
3. The CTA button JSX inside the message render loop (the `m.callSuggestion &&` block)
4. `CallSuggestion` type (remove entirely — not needed in component)

### Add these state variables (inside `FlightLogContent`, near other global chat state):

```typescript
// Deep dive state
const [pendingCallSuggestion, setPendingCallSuggestion] = useState<{ call_id: string; name: string; date: string } | null>(null);
const [activeSingleCall, setActiveSingleCall]           = useState<object | null>(null);
const singleCallHistoryRef = useRef<Array<{ role: string; content: string }>>([]);
```

### Update `GlobalMessage` type:

```typescript
type GlobalMessage = { role: "user" | "assistant"; text: string };
```
(Remove `callSuggestion?` entirely.)

### Update localStorage restore:

The save already uses `{ role, text }` via `globalMessages` — just make sure the load doesn't try to read `callSuggestion`. Since the type is now clean, this works automatically.

### Update `sendGlobalMessage` — full replacement of the function:

```typescript
const sendGlobalMessage = async (text: string) => {
  if (!text.trim() || globalInFlightRef.current) return;
  globalInFlightRef.current = true;
  const newMessage: GlobalMessage = { role: "user", text };
  setGlobalMessages((prev) => [...prev, newMessage]);
  setGlobalInput("");
  if (modalInputRef.current) modalInputRef.current.style.height = "auto";
  setGlobalLoading(true);

  try {
    // ── Determine mode and build payload ──────────────────────────────────
    const isInSingleCallMode = activeSingleCall !== null;

    let body: object;
    if (isInSingleCallMode) {
      // Turn 7+: we're in deep-dive mode — send single_call with full call data
      const newTurn = { role: "user" as const, content: text };
      singleCallHistoryRef.current = [...singleCallHistoryRef.current, newTurn];

      // Body size guard — activeSingleCall includes full transcript
      const callDataStr = JSON.stringify(activeSingleCall);
      if (callDataStr.length > 800_000) {
        setGlobalMessages((prev) => [...prev, { role: "assistant", text: "That transcript is too large to process. Try asking about a shorter call." }]);
        setGlobalLoading(false);
        globalInFlightRef.current = false;
        return;
      }

      body = {
        mode:     "single_call",
        messages: singleCallHistoryRef.current.slice(-10),
        call:     activeSingleCall,
      };
    } else {
      // Global mode — include pendingCallId if we have one
      const last9 = globalMessages.slice(-9);
      const messages = [...last9, newMessage].map((m) => ({ role: m.role, content: m.text }));

      body = {
        mode:          "global",
        messages,
        callSummaries: calls.map((c) => ({
          id:            c.id,
          prospect_name: c.prospect_name,
          outcome:       c.outcome,
          call_date:     c.call_date,
          duration:      c.duration,
          summary:       c.summary,
          missed_topics: c.missed_topics ?? [],
        })),
        ...(pendingCallSuggestion ? { pendingCallId: pendingCallSuggestion.call_id } : {}),
      };
    }

    const res = await fetch("/api/ai/chat", {
      method:  "POST",
      headers: { "content-type": "application/json" },
      body:    JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      if (err.limitReached) {
        setGlobalMessages((prev) => [...prev, { role: "assistant", text: "You've hit today's coaching limit. Come back tomorrow — or upgrade to Pro for unlimited sessions." }]);
      } else {
        setGlobalMessages((prev) => [...prev, { role: "assistant", text: "Connection error. Try again." }]);
      }
      setGlobalLoading(false);
      globalInFlightRef.current = false;
      return;
    }

    const data = await res.json();
    const reply      = data.reply || "Couldn't get a response.";
    const diveReady  = data.diveReady  ?? null;
    const suggestion = data.callSuggestion ?? null;

    // ── Handle callSuggestion (silently — no button) ──────────────────────
    if (suggestion) {
      setPendingCallSuggestion(suggestion);
    }

    // ── Handle diveReady (transcript fetched, switch to single-call mode) ──
    if (diveReady) {
      // Show Claude's "reading transcript" reply first (staggered)
      const chunks = reply.split("\n\n").filter(Boolean);
      for (let i = 0; i < chunks.length; i++) {
        if (i > 0) await new Promise<void>((r) => setTimeout(r, 3000));
        setGlobalMessages((prev) => [...prev, { role: "assistant", text: chunks[i] }]);
      }

      // Wait 2 seconds, then show opener
      await new Promise<void>((r) => setTimeout(r, 2000));
      setGlobalMessages((prev) => [...prev, { role: "assistant", text: diveReady.openerReply }]);

      // Switch to single-call mode
      setActiveSingleCall(diveReady.callData);
      setPendingCallSuggestion(null);
      singleCallHistoryRef.current = [{ role: "assistant", content: diveReady.openerReply }];

      setGlobalLoading(false);
      globalInFlightRef.current = false;
      return;
    }

    // ── Normal message display (staggered bubbles) ────────────────────────
    const chunks = reply.split("\n\n").filter(Boolean);
    if (chunks.length <= 1) {
      setGlobalMessages((prev) => [...prev, { role: "assistant", text: reply }]);
    } else {
      for (let i = 0; i < chunks.length; i++) {
        if (i > 0) await new Promise<void>((r) => setTimeout(r, 3000));
        setGlobalMessages((prev) => [...prev, { role: "assistant", text: chunks[i] }]);
      }
    }

    // ── Update single-call history if in that mode ────────────────────────
    if (isInSingleCallMode) {
      singleCallHistoryRef.current = [
        ...singleCallHistoryRef.current,
        { role: "assistant", content: reply },
      ];
    }

  } catch {
    setGlobalMessages((prev) => [...prev, { role: "assistant", text: "Connection error. Try again." }]);
  }

  setGlobalLoading(false);
  globalInFlightRef.current = false;
};
```

### Clear state on modal close

Find where `setModalOpen(false)` is called (the ESC handler and close button). After each one, add:

```typescript
setPendingCallSuggestion(null);
setActiveSingleCall(null);
singleCallHistoryRef.current = [];
```

The ESC handler should look like:
```typescript
useEffect(() => {
  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Escape" && modalOpen) {
      setModalOpen(false);
      setPendingCallSuggestion(null);
      setActiveSingleCall(null);
      singleCallHistoryRef.current = [];
    }
  };
  window.addEventListener("keydown", onKey);
  return () => window.removeEventListener("keydown", onKey);
}, [modalOpen]);
```

### Remove CTA button from message render loop

Find the block in the JSX that renders `m.callSuggestion && (...)` and delete it entirely. The message bubble render should be clean — just text bubbles, no buttons.

### Modal header — optional: show "Deep dive: [Name]" when in single-call mode

Inside the modal header area, you can optionally show a subtle indicator:
```typescript
{activeSingleCall && (
  <div style={{ fontSize: 11, color: "#8e8e93", marginTop: 2 }}>
    Deep dive: {(activeSingleCall as { prospect_name?: string }).prospect_name ?? "call"}
  </div>
)}
```

---

## Edge Cases Handled

| Scenario | Behavior |
|----------|----------|
| DIVE_NOW fires but no `pendingCallId` sent | Soft error reply, no diveReady |
| Supabase fetch fails after 2 retries | Error reply, `pendingCallSuggestion` preserved (user can say "try again") |
| Call exists but has no transcript | "That call doesn't have a transcript available yet." |
| UUID is not valid format | `validPendingCallId = null`, treated as if no pendingCallId sent |
| User is not owner of call | `.eq("user_id", user.id)` ensures Supabase returns no row → fetch fails gracefully |
| activeSingleCall JSON > 800KB | Body size guard triggers, clear error message |
| Modal closed mid-dive | `pendingCallSuggestion`, `activeSingleCall`, `singleCallHistoryRef` all cleared |
| CALL_MATCH malformed JSON | Existing try/catch keeps full reply, no suggestion set |

---

## What's NOT Changing

- `knowledge-search.ts` — already done
- Per-call chat (the `chatMessages` / `sendChatMessage` flow inside individual call cards) — untouched
- The outcome picker — untouched
- The call list rendering — untouched
- Daily cap logic in route.ts — untouched
- All other API routes — untouched

---

## How to Test After Build

1. Open Mission Intel modal
2. Ask "tell me about my call with [name]" — Wingman should ask for confirmation (no button, no CTA)
3. Say "yes, that's the one" — Wingman should offer the deep dive (no button still)
4. Say "yeah let's do it" — Wingman should say "reading the transcript…" then 2s later give a personalized opener
5. Ask follow-up questions — they should use the full transcript context
6. Close and reopen modal — should start fresh in global mode (no leftover state)
7. Verify no button ever appears during this flow
