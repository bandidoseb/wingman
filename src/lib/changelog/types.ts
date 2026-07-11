// Private changelog — shared types + loader.
// The page at /app/changelog reads this. Data lives in src/data/changelog.json.

export type ChangelogCategory =
  | "speed"    // performance / latency wins
  | "fix"      // bug fixes
  | "feature"  // brand-new capability
  | "ui"       // look & feel / layout
  | "ai"       // signal cards / Sales DNA / models
  | "security" // security & privacy
  | "infra"    // releases plumbing, auto-update, build
  | "release"; // a shipped desktop build

export interface ChangelogEntry {
  /** Stable unique id, e.g. "2026-07-10-deploy". */
  id: string;
  /** ISO date "YYYY-MM-DD". Used for sorting + display. */
  date: string;
  /** Optional app version this shipped in, e.g. "0.1.28". */
  version?: string;
  category: ChangelogCategory;
  /** Short, plain-English headline. */
  title: string;
  /** 1–3 sentences, no jargon. */
  summary: string;
  /** Optional plain-English bullet points. */
  changes?: string[];
  /**
   * Optional deeper dive, shown under a "Read more about this" expander.
   * Each string is one paragraph — still plain English, just more granular.
   */
  details?: string[];
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/**
 * Format "2026-07-10" -> "July 10, 2026" deterministically.
 * Parses the parts by hand so there's no timezone drift from `new Date("...")`.
 */
export function formatEntryDate(iso: string): string {
  const [y, m, d] = iso.split("-").map((n) => parseInt(n, 10));
  if (!y || !m || !d || m < 1 || m > 12) return iso; // fall back to raw on bad input
  return `${MONTHS[m - 1]} ${d}, ${y}`;
}

/** Newest first. Ties broken by id (descending) so ordering is stable. */
export function sortEntries(entries: ChangelogEntry[]): ChangelogEntry[] {
  return [...entries].sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? 1 : -1;
    return a.id < b.id ? 1 : -1;
  });
}
