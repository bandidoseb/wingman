"use client";

import { useState } from "react";
import type { Call } from "@/types";
import Pill from "@/components/ui/wm/Pill";

/**
 * Inline outcome confirm — the Granola "AI guessed a folder, ✓ or ✗" pattern.
 *
 * WHY THIS EXISTS (it is not cosmetic): the post-call job already AI-detects the
 * outcome and writes it with `outcome_source: 'auto'` (post-call/route.ts). Auto
 * outcomes are EXCLUDED from close-rate math until a human confirms them
 * (`confirmedOutcome` in lib/wingman/outcome-stats.ts). Before this control, the
 * only way to confirm was opening the Flight Log picker — so most auto outcomes
 * were never confirmed and every stat built on them read low.
 *
 *   ✓  → PATCH the SAME outcome back. The route stamps source='manual', which is
 *        what promotes the row into the stats. No new endpoint needed.
 *   ✗  → open the picker to correct it.
 *
 * Rows with no outcome get the picker directly. Rows already confirmed by a human
 * show a plain badge with nothing to click.
 */

const OUTCOMES = ["Closed", "Follow Up", "DQ", "No Show", "Lost"] as const;

const TONE: Record<string, "positive" | "warning" | "critical" | "signal" | "neutral"> = {
  Closed: "positive",
  "Follow Up": "signal",
  Lost: "critical",
  "No Show": "warning",
  DQ: "neutral",
};

export default function OutcomeConfirm({
  call,
  onSaved,
}: {
  call: Call;
  /** Fires only after the server confirms — parent updates its local copy. */
  onSaved: (callId: string, outcome: string) => void;
}) {
  const [picking, setPicking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);

  const save = async (outcome: string) => {
    // Guard double-clicks: one in-flight PATCH at a time.
    if (saving) return;
    setSaving(true);
    setFailed(false);
    try {
      const res = await fetch("/api/wingman/outcome", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ call_id: call.id, outcome }),
        // Without a timeout a hung request leaves `saving` true forever and the
        // ✓/✗ for this row stay disabled until a page reload.
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) throw new Error(String(res.status));
      // Only tell the parent once the write is real. An optimistic update here
      // would show a confirmed outcome that never actually landed, and the rep
      // would have no idea their close rate is still wrong.
      onSaved(call.id, outcome);
      setPicking(false);
    } catch (err) {
      console.error("[OutcomeConfirm] outcome PATCH failed", call.id, outcome, err);
      setFailed(true);
    }
    setSaving(false);
  };

  const failedNote = failed && (
    <span className="text-[11px] text-critical" role="status">
      Didn&apos;t save — try again
    </span>
  );

  if (picking) {
    return (
      <div className="flex items-center gap-1 flex-wrap justify-end">
        {failedNote}
        {OUTCOMES.map((o) => (
          <button
            key={o}
            onClick={() => save(o)}
            disabled={saving}
            className="h-6 px-2 rounded-pill text-[11px] font-semibold bg-surface-sunken text-ink-2 border border-line hover:bg-signal-weak hover:text-signal hover:border-signal/30 transition-colors duration-2 ease-wm disabled:opacity-50"
          >
            {o}
          </button>
        ))}
        <button
          onClick={() => { setPicking(false); setFailed(false); }}
          disabled={saving}
          aria-label="Cancel"
          className="h-6 w-6 rounded-pill text-ink-3 hover:text-ink-1 hover:bg-surface-sunken transition-colors duration-2 ease-wm disabled:opacity-50"
        >
          ✕
        </button>
      </div>
    );
  }

  // No outcome at all — offer the picker directly.
  if (!call.outcome) {
    return (
      <button
        onClick={() => setPicking(true)}
        className="h-6 px-2.5 rounded-pill text-small font-medium text-ink-3 border border-dashed border-line-strong hover:text-signal hover:border-signal transition-colors duration-2 ease-wm"
      >
        Set outcome
      </button>
    );
  }

  const tone = TONE[call.outcome] ?? "neutral";

  // Human already confirmed (or a legacy row) — nothing to do.
  if (call.outcome_source !== "auto") {
    return <Pill tone={tone}>{call.outcome}</Pill>;
  }

  // AI-detected and unconfirmed — this is the ✓ / ✗ moment.
  return (
    <div className="flex items-center gap-1.5">
      <Pill tone={tone} className="opacity-70">{call.outcome}</Pill>
      <span
        className="text-[9px] font-bold uppercase tracking-wider text-ink-3"
        title="Wingman detected this. Confirm it so it counts toward your stats."
      >
        auto
      </span>
      <button
        onClick={() => save(call.outcome as string)}
        disabled={saving}
        aria-label={`Confirm outcome ${call.outcome}`}
        title="Yes — that's right"
        className="h-6 w-6 rounded-pill grid place-items-center text-positive hover:bg-positive-weak transition-colors duration-2 ease-wm disabled:opacity-40"
      >
        ✓
      </button>
      <button
        onClick={() => setPicking(true)}
        disabled={saving}
        aria-label="Change outcome"
        title="No — pick the right one"
        className="h-6 w-6 rounded-pill grid place-items-center text-ink-3 hover:text-critical hover:bg-critical-weak transition-colors duration-2 ease-wm disabled:opacity-40"
      >
        ✕
      </button>
      {failedNote}
    </div>
  );
}
