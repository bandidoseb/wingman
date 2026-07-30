/**
 * Unit tests — this session's outcome confirmations, overlaid on server rows.
 *
 * These exist because PR 3 merged two DIFFERENTLY-SHAPED copies of this map into
 * one. Home's flipped `outcome_source` to "manual" so stats counted the row; Flight
 * Log's was a bare outcome string that `confirmedOutcome()` never saw. Merging them
 * carelessly would silently change Flight Log's "N/M closed" header — a number
 * nobody would think to re-check.
 *
 * The pairing with `confirmedOutcome` is the whole point, so it is asserted here
 * rather than trusted.
 */
import { describe, it, expect } from "vitest";
import { applySessionOutcomes } from "../../src/lib/wingman/session-outcomes";
import { confirmedOutcome } from "../../src/lib/wingman/outcome-stats";
import type { Call } from "../../src/types";

const mk = (id: string, outcome: string | null, source: "auto" | "manual" | null): Call =>
  ({ id, outcome, outcome_source: source }) as unknown as Call;

describe("applySessionOutcomes", () => {
  it("returns the SAME array when nothing has been confirmed", () => {
    // Identity fast-path — lets memoised consumers skip re-deriving on every render.
    const calls = [mk("a", "Closed", "manual")];
    expect(applySessionOutcomes(calls, {})).toBe(calls);
  });

  it("flips outcome_source to manual so the row COUNTS in stats", () => {
    // THE BUG THIS GUARDS: overlay the outcome but leave the source as "auto" and
    // confirmedOutcome() still returns null — the rep's ✓ changes nothing.
    const [row] = applySessionOutcomes([mk("a", "Follow Up", "auto")], { a: "Closed" });
    expect(row.outcome).toBe("Closed");
    expect(row.outcome_source).toBe("manual");
    expect(confirmedOutcome(row)).toBe("Closed");
  });

  it("makes an auto-detected call countable only AFTER confirmation", () => {
    const auto = mk("a", "Closed", "auto");
    expect(confirmedOutcome(auto)).toBeNull(); // excluded — a guess must not count
    const [confirmedRow] = applySessionOutcomes([auto], { a: "Closed" });
    expect(confirmedOutcome(confirmedRow)).toBe("Closed");
  });

  it("leaves untouched calls alone, by reference", () => {
    const keep = mk("b", "Lost", "manual");
    const out = applySessionOutcomes([mk("a", null, null), keep], { a: "DQ" });
    expect(out[1]).toBe(keep);
  });

  it("does not mutate the input rows", () => {
    const original = mk("a", "Follow Up", "auto");
    applySessionOutcomes([original], { a: "Closed" });
    expect(original.outcome).toBe("Follow Up");
    expect(original.outcome_source).toBe("auto");
  });

  it("reproduces the old Flight Log header maths exactly", () => {
    // Old: listOutcome = localOutcomes[id] ?? confirmedOutcome(c)
    // New: overlay first, then confirmedOutcome(c). Must agree on every row.
    const calls = [
      mk("a", "Closed", "manual"),   // already counted
      mk("b", "Closed", "auto"),     // auto — excluded until confirmed
      mk("c", null, null),           // unmarked
      mk("d", "DQ", "manual"),       // excluded from the denominator
    ];
    const session = { b: "Closed", c: "Lost" };

    const oldWay = (c: Call) => session[c.id as keyof typeof session] ?? confirmedOutcome(c);
    const newRows = applySessionOutcomes(calls, session);

    calls.forEach((c, i) => expect(confirmedOutcome(newRows[i])).toBe(oldWay(c)));

    const wins = newRows.filter((c) => confirmedOutcome(c) === "Closed").length;
    const qualifying = newRows.filter((c) => confirmedOutcome(c) !== "DQ").length;
    expect(`${wins}/${qualifying} closed`).toBe("2/3 closed");
  });
});
