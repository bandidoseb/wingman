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
    fallbackHeader: "What's in the way?",
    fallbackHandle:
      "What specifically do you need to think about — is it the investment, the timing, or whether this is the right fit?",
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
    fallbackHeader: "If price wasn't a factor?",
    fallbackHandle:
      "If price wasn't a factor, would this be the obvious next step for you?",
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
    fallbackHeader: "What would they say?",
    fallbackHandle:
      "What do you think their main concern would be?",
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
    fallbackHeader: "What would help you decide?",
    fallbackHandle:
      "What's the specific piece of information that would actually help you make this decision?",
  },
  {
    patterns: [
      "not ready",
      "i'm not ready",
      "not quite ready",
      "not there yet",
    ],
    objectionKey: "not ready",
    fallbackHeader: "What does ready look like?",
    fallbackHandle:
      "What would need to be true for you to feel ready?",
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
    fallbackHeader: "What failed last time?",
    fallbackHandle:
      "What happened with that — what specifically didn't work?",
  },
  {
    patterns: [
      "need to wait",
      "waiting until",
      "not until",
    ],
    objectionKey: "future event",
    fallbackHeader: "What's the cost of waiting?",
    fallbackHandle:
      "What does waiting cost you between now and then?",
  },
  {
    patterns: [
      "don't have time",
      "too busy",
      "no time right now",
      "really busy",
    ],
    objectionKey: "no time",
    fallbackHeader: "What's it costing you now?",
    fallbackHandle:
      "How much time is the current situation already taking up each week?",
  },
  {
    patterns: [
      "need to look at my finances",
      "need to check my finances",
      "need to look at my money",
      "check my bank",
    ],
    objectionKey: "money concern",
    fallbackHeader: "Cash flow or ROI?",
    fallbackHandle:
      "Is this more about cash flow right now, or about whether the return makes sense for you?",
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
