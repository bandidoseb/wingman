"use client";

import * as React from "react";
import OutcomePill from "./OutcomePill";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

/**
 * The outcome chip as a single clickable control. Used in the Flight Log list AND
 * the call detail header, so the two can never drift.
 *
 * WHY THIS EXISTS (Sebastian, 2026-07-29): the same job was being done by four
 * separate elements sitting in a row — an "OUTCOME" caption, the pill, an "AUTO"
 * chip, and a "Confirm"/"Edit" button. It read as busy. Now there is one element:
 *
 *   confirmed        → solid filled pill
 *   Wingman's guess  → same pill, dimmed, with a sparkle mark
 *
 * and the pill itself is the button. The caption became a tooltip, because "what
 * is this pill" is a question you ask once, not something that needs permanent
 * screen space.
 *
 * WHY CONFIRM IS NOT HIDDEN BEHIND HOVER: confirming an auto-detected outcome is
 * what lets a call count toward close rate (auto outcomes are excluded until a
 * human confirms — see `outcome-stats.ts`). Sebastian's close rate was understated
 * precisely because that click was hard to find. The dimmed+sparkle state has to
 * stay visible at rest so an unconfirmed call still looks unfinished.
 *
 * TooltipProvider is mounted here rather than at the dashboard root to keep the
 * blast radius at zero — Radix providers nest safely and cost nothing.
 */
export default function OutcomeControl({
  outcome,
  isAuto,
  onEdit,
  className,
}: {
  outcome: string;
  /** Auto-detected by the post-call job AND not yet confirmed by the rep. */
  isAuto: boolean;
  onEdit: () => void;
  className?: string;
}) {
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label={
              isAuto
                ? `Outcome ${outcome}, detected by Wingman — click to confirm or change`
                : `Outcome ${outcome} — click to change`
            }
            onClick={(e) => {
              // The list row is itself clickable (it opens the call), so this must
              // never bubble into "open the call" when the rep meant "edit outcome".
              e.stopPropagation();
              onEdit();
            }}
            className={
              "rounded-pill outline-hidden cursor-pointer " +
              "transition-opacity duration-2 ease-wm hover:opacity-100 " +
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal " +
              (className ?? "")
            }
          >
            <OutcomePill outcome={outcome} dimmed={isAuto} auto={isAuto} />
          </button>
        </TooltipTrigger>
        <TooltipContent>
          {isAuto ? "Wingman's guess — click to confirm" : "Call outcome — click to change"}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
