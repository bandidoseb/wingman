import { ChangelogMark } from "@/components/changelog/ChangelogMark";
import type { ChangelogCategory } from "@/lib/changelog/types";

/**
 * The image card for each entry: a unique, grainy mesh-gradient background
 * with the category mark in white on top — in the vibe of soft, saturated,
 * film-grain gradients.
 *
 * Everything is self-contained (CSS gradients + an inline SVG grain texture),
 * so there are no external image files to load. The gradient is derived
 * deterministically from the entry's id, so every entry gets its own look
 * and it stays identical across reloads.
 */

// Grayscale film grain, encoded inline so nothing is fetched over the network.
const NOISE_SVG =
  "<svg xmlns='http://www.w3.org/2000/svg' width='140' height='140'>" +
  "<filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/>" +
  "<feColorMatrix type='saturate' values='0'/></filter>" +
  "<rect width='100%' height='100%' filter='url(#n)'/></svg>";
const NOISE_URL = `url("data:image/svg+xml,${encodeURIComponent(NOISE_SVG)}")`;

/**
 * Stable 32-bit hash of a string → non-negative integer. FNV-1a plus a
 * murmur-style avalanche finalizer so similar ids (they share long prefixes
 * like "2026-07-…") still spread evenly across the color wheel.
 */
function hash(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  h ^= h >>> 15;
  h = Math.imul(h, 2246822519);
  h ^= h >>> 13;
  h = Math.imul(h, 3266489917);
  h ^= h >>> 16;
  return h >>> 0;
}

/** Small seeded PRNG (mulberry32) so each entry gets its own repeatable layout. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Build a soft mesh gradient from a base hue. Uses mostly-analogous colors plus
 * one gentle near-complement for a subtle contrasting "pop". Four ROUND blobs
 * (not ovals) with a wide, soft falloff are spread ~90° apart around a ring
 * whose rotation is randomized per entry — so the arrangement differs every
 * time instead of always landing in the same corners.
 */
function meshBackground(seed: string): string {
  const h = hash(seed);
  const rand = mulberry32(h);
  const hue = h % 360;
  const col = (dh: number, s: number, l: number) =>
    `hsl(${(hue + dh + 360) % 360} ${s}% ${l}%)`;

  // Mostly analogous, with one softened near-complement for contrast.
  const blobs = [
    { off: 0, s: 78, l: 64 },
    { off: 36, s: 72, l: 66 },
    { off: 200, s: 58, l: 63 }, // the "pop" — kept gentle so it never screams
    { off: 24, s: 76, l: 60 },
  ];

  const rot = rand() * Math.PI * 2; // whole-arrangement rotation, per entry
  const layers = blobs.map((b, i) => {
    const angle = rot + (i * Math.PI) / 2 + (rand() - 0.5) * 0.9;
    const radius = 32 + rand() * 14; // how far the blob sits from center (%)
    const x = Math.round(50 + radius * Math.cos(angle));
    const y = Math.round(50 + radius * Math.sin(angle));
    const spread = 62 + Math.round(rand() * 22); // wide, soft falloff
    return `radial-gradient(circle at ${x}% ${y}%, ${col(b.off, b.s, b.l)} 0%, transparent ${spread}%)`;
  });

  // Base fill so there are never hard gaps behind the blobs.
  layers.push(col(16, 60, 60));
  return layers.join(", ");
}

export function ChangelogArtwork({
  category,
  seed,
}: {
  category: ChangelogCategory;
  seed: string;
}) {
  return (
    <div
      className="relative flex aspect-16/10 w-full items-center justify-center overflow-hidden rounded-xl"
      style={{ background: meshBackground(seed) }}
    >
      {/* film grain */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage: NOISE_URL,
          backgroundSize: "140px 140px",
          opacity: 0.24,
          mixBlendMode: "overlay",
        }}
      />
      {/* the mark, in white */}
      <ChangelogMark
        category={category}
        size={88}
        className="relative text-white drop-shadow-[0_1px_10px_rgba(0,0,0,0.28)]"
      />
    </div>
  );
}
