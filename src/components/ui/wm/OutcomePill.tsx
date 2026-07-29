"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * The call-outcome chip. ONE definition, used everywhere an outcome is shown.
 *
 * Before this there were three treatments for the same thing: a tinted badge in
 * the Flight Log list, OUTLINED buttons in its picker, and a differently-tinted
 * pill on Home. Sebastian, 2026-07-29: "the outcome pills are inconsistent, and
 * I don't like it when it has an outline. I want the color to be filled."
 *
 * WHY THE TEXT IS `--paper` AND NOT WHITE:
 * `--paper` is near-white in light mode and near-black in dark. The state colors
 * LIGHTEN in dark mode (the positive green goes several steps brighter), so
 * hardcoded white text would drop to roughly 2.3:1 contrast and be unreadable.
 * `--paper` flips with the theme and stays legible on both.
 */

const TONE: Record<string, string> = {
  Closed: "bg-positive",
  "Follow Up": "bg-signal",
  Lost: "bg-critical",
  "No Show": "bg-warning",
  Set: "bg-signal",
  DQ: "bg-ink-3",
  Other: "bg-ink-3",
};

/** Background class for an outcome — exported so pickers match the chips exactly. */
export function outcomeTone(outcome: string): string {
  return TONE[outcome] ?? "bg-ink-3";
}

/**
 * The "Wingman guessed this" mark. An inline SVG, not an emoji: it inherits
 * `currentColor` (so it flips with the pill's text) and renders identically on
 * every machine, which an emoji does not.
 */
function AutoSparkle() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-[11px] w-[11px] shrink-0 -ml-0.5"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M12 2.5l1.9 5.6 5.6 1.9-5.6 1.9L12 17.5l-1.9-5.6L4.5 10l5.6-1.9L12 2.5z" />
    </svg>
  );
}

export default function OutcomePill({
  outcome,
  className,
  dimmed = false,
  auto = false,
  ...props
}: React.ComponentProps<"span"> & {
  outcome: string;
  /** Auto-detected and not yet confirmed — reads as provisional. */
  dimmed?: boolean;
  /**
   * Show the sparkle mark. This replaces the separate uppercase "AUTO" chip that
   * used to sit beside the pill — Sebastian, 2026-07-29: the row read as busy with
   * an "OUTCOME" label, a pill, an "AUTO" chip and a "Confirm" button all doing one
   * job. Dimmed + sparkle says "Wingman's guess" in one element; solid says
   * "you confirmed it".
   */
  auto?: boolean;
}) {
  return (
    <span
      data-slot="outcome-pill"
      className={cn(
        "inline-flex items-center gap-1 h-6 px-2.5 rounded-pill text-[11px] font-semibold whitespace-nowrap",
        "text-paper",
        outcomeTone(outcome),
        dimmed && "opacity-60",
        className
      )}
      {...props}
    >
      {auto && <AutoSparkle />}
      {outcome}
    </span>
  );
}
