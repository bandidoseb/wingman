/**
 * instrumentation.ts — Next.js boot hook (runs once when the server starts).
 *
 * We use it for exactly one thing: kick the in-memory KB load the instant the
 * Railway server boots, so the KB is `ready` before the first call of the day —
 * not lazily on the first hotkey press. The load is non-blocking and self-heals
 * on failure (see kb-memory.ts); this just starts it as early as possible.
 *
 * Guarded to the Node.js runtime so it never runs in the Edge runtime or at
 * build time (where there is no persistent server to hold the memory).
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { ensureKbMemoryLoaded } = await import("./lib/wingman/kb-memory");
    ensureKbMemoryLoaded();
  }
}
