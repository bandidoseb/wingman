"use client";

import { useState } from "react";
import { ChangelogArtwork } from "@/components/changelog/ChangelogArtwork";
import { formatEntryDate, sortEntries, type ChangelogEntry } from "@/lib/changelog/types";

/**
 * Private changelog timeline — styled after shadcnblocks "changelog2".
 * Self-contained (own white background + type) so it never inherits, or is
 * affected by, dashboard styling.
 *
 * A Full / Compact toggle lets you hide the gradient images and tighten the
 * spacing for a fast skim down the whole list.
 */
export function ChangelogTimeline({ entries }: { entries: ChangelogEntry[] }) {
  const sorted = sortEntries(entries);
  const [compact, setCompact] = useState(false);

  return (
    <div className="min-h-screen bg-white text-neutral-900">
      <div className="mx-auto max-w-2xl px-6">
        {/* Header */}
        <header className="pt-20 pb-12 text-center md:pt-28">
          <div className="flex items-start justify-center gap-2.5">
            <h1 className="text-5xl font-bold tracking-tight md:text-6xl">Changelog</h1>
            <span className="mt-2 rounded-full bg-emerald-400 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-white md:mt-3">
              New
            </span>
          </div>
          <p className="mx-auto mt-5 max-w-md text-base text-neutral-500 md:text-lg">
            Everything new in Wingman — in plain English.
          </p>

          {/* Full / Compact toggle */}
          {sorted.length > 0 && (
            <div className="mt-7 inline-flex items-center gap-0.5 rounded-full border border-neutral-200 bg-neutral-50 p-0.5 text-sm font-medium">
              {[
                { value: false, label: "Full" },
                { value: true, label: "Compact" },
              ].map((opt) => {
                const active = compact === opt.value;
                return (
                  <button
                    key={opt.label}
                    type="button"
                    onClick={() => setCompact(opt.value)}
                    aria-pressed={active}
                    className={
                      "rounded-full px-4 py-1.5 transition-colors " +
                      (active
                        ? "bg-white text-neutral-900 shadow-xs"
                        : "text-neutral-500 hover:text-neutral-800")
                    }
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          )}
        </header>

        {/* Timeline */}
        {sorted.length === 0 ? (
          <p className="pb-24 text-center text-neutral-400">Nothing logged yet.</p>
        ) : (
          <ol className="relative ml-1 border-l border-dashed border-neutral-300">
            {sorted.map((entry) => (
              <li
                key={entry.id}
                className={
                  "relative pl-7 md:pl-9 " + (compact ? "pb-6 last:pb-8" : "pb-16 last:pb-10")
                }
              >
                {/* dot on the line */}
                <span className="absolute -left-1.5 top-1.5 h-3 w-3 rounded-full bg-emerald-400 ring-4 ring-white" />

                {/* date + version */}
                <div className="flex items-center gap-2 font-mono text-sm text-neutral-500">
                  <time dateTime={entry.date}>{formatEntryDate(entry.date)}</time>
                  {entry.version && (
                    <>
                      <span className="text-neutral-300">·</span>
                      <span className="text-neutral-400">v{entry.version}</span>
                    </>
                  )}
                </div>

                {/* image card — hidden in compact mode */}
                {!compact && (
                  <div className="mt-4">
                    <ChangelogArtwork category={entry.category} seed={entry.id} />
                  </div>
                )}

                {/* title + summary */}
                <h2
                  className={
                    "text-xl font-bold tracking-tight md:text-2xl " + (compact ? "mt-2" : "mt-5")
                  }
                >
                  {entry.title}
                </h2>
                <p className="mt-2 leading-relaxed text-neutral-600">{entry.summary}</p>

                {/* bullets */}
                {entry.changes && entry.changes.length > 0 && (
                  <ul className="mt-3 space-y-1.5">
                    {entry.changes.map((change, i) => (
                      <li key={i} className="flex gap-2.5 leading-relaxed text-neutral-600">
                        <span className="mt-2 h-1 w-1 flex-none rounded-full bg-neutral-400" />
                        <span>{change}</span>
                      </li>
                    ))}
                  </ul>
                )}

                {/* deeper dive — native disclosure, no JS */}
                {entry.details && entry.details.length > 0 && (
                  <details className="group mt-4">
                    <summary className="flex w-fit cursor-pointer list-none items-center gap-1.5 text-sm font-medium text-neutral-500 transition-colors hover:text-neutral-900 [&::-webkit-details-marker]:hidden">
                      <span className="group-open:hidden">Read more about this</span>
                      <span className="hidden group-open:inline">Show less</span>
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        className="transition-transform duration-200 group-open:rotate-180"
                        aria-hidden="true"
                      >
                        <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </summary>
                    <div className="mt-3 space-y-3 border-l-2 border-neutral-200 pl-4 text-[15px] leading-relaxed text-neutral-600">
                      {entry.details.map((paragraph, i) => (
                        <p key={i}>{paragraph}</p>
                      ))}
                    </div>
                  </details>
                )}
              </li>
            ))}
          </ol>
        )}

        {/* Footer */}
        <footer className="pb-16 pt-6 text-center text-xs text-neutral-400">
          Wingman · private changelog
        </footer>
      </div>
    </div>
  );
}
