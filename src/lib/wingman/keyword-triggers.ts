import type { WingmanSignal } from "@/types";
import type { VaultObjection } from "@/types";

interface KeywordTrigger {
  patterns: string[];
  objectionKey: string; // matches against vault_objections.objection (lowercase)
  fallbackHandle: string;
  fallbackHeader: string;
}

export const KEYWORD_TRIGGERS: KeywordTrigger[] = [
  {
    patterns: [
      "need to think about it",
      "i need to think",
      "let me think about it",
      "need to think",
    ],
    objectionKey: "think about it",
    fallbackHeader: "Handle: Think About It",
    fallbackHandle:
      "What specifically do you need to think about? Is it the investment, the timing, or whether this is the right fit?",
  },
  {
    patterns: [
      "too expensive",
      "that's a lot",
      "can't afford",
      "too much money",
      "that's too much",
    ],
    objectionKey: "price",
    fallbackHeader: "Handle: Price Objection",
    fallbackHandle:
      "I hear you on the investment. Can I ask — if price wasn't a factor, would this be the obvious next step for you?",
  },
  {
    patterns: [
      "need to talk to my partner",
      "need to talk to my wife",
      "need to talk to my husband",
      "need to check with my spouse",
      "need to run it by",
    ],
    objectionKey: "partner",
    fallbackHeader: "Handle: Partner Objection",
    fallbackHandle:
      "Totally understand. What do you think their main concern would be? Let's make sure you have everything you need to walk them through it.",
  },
  {
    patterns: [
      "send me more info",
      "send me information",
      "send me something",
      "send me details",
      "can you send me",
    ],
    objectionKey: "more info",
    fallbackHeader: "Handle: More Info",
    fallbackHandle:
      "Of course. Before I do — what's the specific piece of information that would help you make this decision? I want to make sure I send exactly what's useful.",
  },
  {
    patterns: [
      "not ready",
      "i'm not ready",
      "not quite ready",
      "not there yet",
    ],
    objectionKey: "not ready",
    fallbackHeader: "Handle: Not Ready",
    fallbackHandle:
      "What would need to be true for you to feel ready? Let's figure out what's actually in the way.",
  },
  {
    patterns: [
      "tried before",
      "tried something like this",
      "tried a program",
      "been through programs",
      "done something similar",
    ],
    objectionKey: "past experience",
    fallbackHeader: "Handle: Past Experience",
    fallbackHandle:
      "What happened with that? Understanding what didn't work last time helps me know if this would actually be different for you.",
  },
  {
    patterns: [
      "need to wait",
      "waiting until",
      "not until",
    ],
    objectionKey: "future event",
    fallbackHeader: "Handle: Future Event",
    fallbackHandle:
      "What's happening after that? And what does waiting cost you between now and then?",
  },
  {
    patterns: [
      "don't have time",
      "too busy",
      "no time right now",
      "really busy",
    ],
    objectionKey: "no time",
    fallbackHeader: "Handle: No Time",
    fallbackHandle:
      "That's actually one of the biggest reasons people come to us — they don't have time because the problem is already taking up too much of it. How much time is the current situation costing you weekly?",
  },
  {
    patterns: [
      "need to look at my finances",
      "need to check my finances",
      "need to look at my money",
      "check my bank",
    ],
    objectionKey: "money concern",
    fallbackHeader: "Handle: Money Concern",
    fallbackHandle:
      "Completely fair. Is this more about cash flow right now, or about whether the ROI makes sense for you?",
  },
];

/**
 * Extract spoken text from a transcript chunk, excluding the rep's lines.
 *
 * Recall AI uses the participant's actual Zoom display name as the speaker label
 * (e.g. "TLG - Sebastian Perez: I hear you" or "John Smith: I need to think about it").
 * We identify the rep by their speaker label captured from the first chunk of the call
 * and exclude their lines — so keyword triggers only fire on the prospect's words.
 *
 * If repSpeaker is null (first chunk hasn't arrived yet), all lines are checked.
 */
function extractProspectText(chunk: string, repSpeaker?: string | null): string {
  const repLower = repSpeaker?.toLowerCase();
  const lines: string[] = [];
  for (const line of chunk.split("\n")) {
    const colonIdx = line.indexOf(":");
    if (colonIdx === -1) continue;
    if (repLower && line.slice(0, colonIdx).trim().toLowerCase() === repLower) continue;
    lines.push(line.slice(colonIdx + 1).trim().toLowerCase());
  }
  return lines.join(" ");
}

/** Find the best matching objection handle from the vault */
function findVaultHandle(
  trigger: KeywordTrigger,
  vault: VaultObjection[]
): { header: string; text: string } {
  const match = vault.find((obj) =>
    obj.objection.toLowerCase().includes(trigger.objectionKey)
  );

  if (match && (match.handle1 || match.handle2)) {
    return {
      header: trigger.fallbackHeader,
      text: match.handle1 || match.handle2 || trigger.fallbackHandle,
    };
  }

  return {
    header: trigger.fallbackHeader,
    text: trigger.fallbackHandle,
  };
}

/**
 * Check a new transcript chunk for keyword triggers.
 * Excludes the rep's lines (identified by repSpeaker) so cards only fire
 * on the prospect's words. Returns a WingmanSignal or null.
 */
export function checkKeywordTriggers(
  chunk: string,
  vault: VaultObjection[],
  repSpeaker?: string | null
): WingmanSignal | null {
  const prospectText = extractProspectText(chunk, repSpeaker);
  if (!prospectText) return null;

  for (const trigger of KEYWORD_TRIGGERS) {
    const matched = trigger.patterns.some((pattern) =>
      prospectText.includes(pattern.toLowerCase())
    );
    if (matched) {
      const { header, text } = findVaultHandle(trigger, vault);
      return {
        type: "Handle",
        header,
        text,
        firedAt: Date.now(),
        source: "keyword",
      };
    }
  }

  return null;
}
