import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { detectSyntax } from "@/lib/wingman/syntax-detect";

/**
 * GET /api/wingman/detect-syntax
 *
 * The "I'm not sure" fast-follow: read the caller's recent call summaries, infer whether
 * they tend to open problems-first or goals-first, and return a SUGGESTION. It never writes
 * — the Sales DNA page decides whether to surface it, and the rep confirms the change.
 *
 * Returns: { detected: "problems" | "goals" | null, problems, goals, sample }
 *   detected=null  → not enough clear signal yet (keep showing "I'm not sure").
 *
 * Reads with the RLS client (the user can only ever see their own calls). Cheap: one indexed
 * select of a text column, no AI. Read-only, so no rate limit needed.
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Last 10 calls that actually produced a Belief-Ladder summary. The detector needs a
    // few readable Syntax signals; 10 gives headroom since some calls won't have a clear one.
    const { data: calls, error } = await supabase
      .from("calls")
      .select("live_summary")
      .eq("user_id", user.id)
      .not("live_summary", "is", null)
      .order("call_date", { ascending: false })
      .limit(10);

    if (error) {
      console.error("[detect-syntax] query failed:", error.message);
      return NextResponse.json({ error: "Query failed" }, { status: 500 });
    }

    const detection = detectSyntax((calls ?? []).map((c) => c.live_summary as string | null));
    return NextResponse.json(detection);
  } catch (err) {
    console.error("[detect-syntax] unexpected error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
