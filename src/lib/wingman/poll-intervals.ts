import type { CallStageLabel } from "@/types";

/** Poll interval in milliseconds per stage */
export const POLL_INTERVALS: Record<CallStageLabel, number> = {
  // Closer stages
  Rapport:   90_000,
  Discovery: 30_000,
  Press:     15_000,
  Confirm:   15_000,
  Pitch:     25_000,
  Close:      8_000,
  // Setter stages
  Connect:   90_000,
  Qualify:   30_000,
  Commit:    15_000,
  Book:      25_000,
};

export const CLOSER_STAGES: CallStageLabel[] = [
  "Rapport", "Discovery", "Press", "Confirm", "Pitch", "Close",
];

export const SETTER_STAGES: CallStageLabel[] = [
  "Connect", "Qualify", "Commit", "Book",
];

export function getStagesForRole(role: "closer" | "setter"): CallStageLabel[] {
  return role === "setter" ? SETTER_STAGES : CLOSER_STAGES;
}

export function getDefaultStage(role: "closer" | "setter"): CallStageLabel {
  return role === "setter" ? "Connect" : "Rapport";
}
