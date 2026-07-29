"use client";

import Card from "@/components/ui/Card";
import type { Call } from "@/types";

/**
 * Mission Intel — placeholder.
 *
 * Sebastian, 2026-07-29: "I want the intel page to say something like 'Coming soon'
 * and not show anything." The tab stays clickable so it still reads as part of the
 * product; it just stops pretending to have finished analytics.
 *
 * The previous version rendered a stat grid, an overall-score dial and a stage
 * heatmap off `calls`. That work is not lost — it is in git history at commit
 * 4b83044 and can be restored wholesale when this page is designed properly. It was
 * pulled because it carried 53 hardcoded colours (several of which rendered
 * effectively invisible in dark mode) and showed a "Danger Zone" score derived from
 * stage data that has never been validated against real calls.
 *
 * `calls` is still accepted so DashboardClient's call site does not have to change
 * when the real page lands.
 */
export default function IntelTab({ calls: _calls }: { calls?: Call[] }) {
  return (
    <div style={{ maxWidth: 640, margin: "0 auto" }}>
      <div style={{ marginBottom: 20 }}>
        <div className="text-h1 text-ink-1">Mission Intel</div>
        <div className="text-small text-ink-2 mt-1">
          Patterns across every call you run.
        </div>
      </div>

      <Card>
        <div className="flex flex-col items-center text-center py-10 px-4">
          <span className="grid place-items-center h-11 w-11 rounded-pill bg-surface-sunken mb-4">
            <svg viewBox="0 0 24 24" className="h-5 w-5 text-ink-2" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M4 19V10M10 19V5M16 19v-6M22 19H2" />
            </svg>
          </span>

          <div className="text-h3 text-ink-1 mb-1.5">Coming soon</div>
          <p className="text-small text-ink-2 leading-relaxed max-w-[380px]">
            Wingman is collecting your calls now. Once there&apos;s enough to find real
            patterns, this page will show where deals actually slip — the stage you
            lose them at, and what changes when you win.
          </p>
        </div>
      </Card>
    </div>
  );
}
