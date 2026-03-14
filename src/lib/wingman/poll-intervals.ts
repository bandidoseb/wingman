import type { CallStageLabel } from "@/types";

/** Poll interval in milliseconds per stage */
export const POLL_INTERVALS: Record<CallStageLabel, number> = {
  Rapport:   90_000,
  Discovery: 30_000,
  Press:     15_000,
  Confirm:   15_000,
  Pitch:     25_000,
  Close:      8_000,
};

export const CLOSER_STAGES: CallStageLabel[] = [
  "Rapport", "Discovery", "Press", "Confirm", "Pitch", "Close",
];

export function getStagesForRole(): CallStageLabel[] {
  return CLOSER_STAGES;
}

export function getDefaultStage(): CallStageLabel {
  return "Rapport";
}
