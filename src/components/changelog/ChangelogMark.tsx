import type { ChangelogCategory } from "@/lib/changelog/types";

/**
 * Minimal, monochrome, thin-stroke geometric marks — one per category.
 * Deliberately abstract (not literal icons): same restrained visual family,
 * distinct enough to tell apart at a glance. Uses `currentColor` so the
 * parent controls the color.
 */

const STROKE = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.75,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

const MARKS: Record<ChangelogCategory, React.ReactNode> = {
  // motion — parallel lines fading back
  speed: (
    <>
      <line x1="8" y1="17" x2="40" y2="17" {...STROKE} />
      <line x1="8" y1="24" x2="33" y2="24" {...STROKE} />
      <line x1="8" y1="31" x2="26" y2="31" {...STROKE} />
    </>
  ),
  // a node tuned on a track
  fix: (
    <>
      <line x1="8" y1="24" x2="40" y2="24" {...STROKE} />
      <circle cx="20" cy="24" r="5" {...STROKE} />
    </>
  ),
  // a facet — something new
  feature: (
    <>
      <polygon points="24,8 40,24 24,40 8,24" {...STROKE} />
      <circle cx="24" cy="24" r="2" fill="currentColor" stroke="none" />
    </>
  ),
  // a frame — layout / look & feel
  ui: (
    <>
      <rect x="9" y="12" width="30" height="24" rx="3" {...STROKE} />
      <line x1="19" y1="12" x2="19" y2="36" {...STROKE} />
    </>
  ),
  // a small constellation — reasoning
  ai: (
    <>
      <line x1="12" y1="16" x2="34" y2="12" {...STROKE} />
      <line x1="34" y1="12" x2="26" y2="34" {...STROKE} />
      <line x1="12" y1="16" x2="26" y2="34" {...STROKE} />
      <circle cx="12" cy="16" r="3" {...STROKE} />
      <circle cx="34" cy="12" r="3" {...STROKE} />
      <circle cx="26" cy="34" r="3" {...STROKE} />
    </>
  ),
  // a shield — security & privacy
  security: (
    <path d="M24 7 L39 13 V24 C39 32 32 37 24 41 C16 37 9 32 9 24 V13 Z" {...STROKE} />
  ),
  // stacked layers — plumbing
  infra: (
    <>
      <polygon points="24,12 36,18 24,24 12,18" {...STROKE} />
      <polygon points="24,20 36,26 24,32 12,26" {...STROKE} />
    </>
  ),
  // nested hexagon — a shipped build
  release: (
    <>
      <polygon points="16,10 32,10 40,24 32,38 16,38 8,24" {...STROKE} />
      <polygon points="20,17 28,17 32,24 28,31 20,31 16,24" {...STROKE} />
    </>
  ),
};

export function ChangelogMark({
  category,
  size = 44,
  className,
}: {
  category: ChangelogCategory;
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      className={className}
      aria-hidden="true"
    >
      {MARKS[category]}
    </svg>
  );
}
