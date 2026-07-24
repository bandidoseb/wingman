import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * PATCH /api/wingman/outcome
 *
 * Lightweight endpoint to set (or update) the outcome on a finished call.
 * Unlike PATCH /api/wingman/session, this does NOT increment calls_used
 * or fire post-call analysis — it only updates the outcome column.
 *
 * Used by the Flight Log inline outcome picker.
 */
export async function PATCH(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { call_id, outcome } = await req.json();

    if (!call_id || !outcome) {
      return NextResponse.json({ error: "call_id and outcome are required" }, { status: 400 });
    }

    // A human pick always tags source='manual' — this is what promotes an
    // AI-detected ('auto') outcome into the close-rate math (auto marks are
    // excluded until confirmed) and drops the "auto" chip in the dashboard.
    const { error } = await supabase
      .from("calls")
      .update({ outcome, outcome_source: "manual" })
      .eq("id", call_id)
      .eq("user_id", user.id); // ownership check

    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[outcome] update error:", err);
    return NextResponse.json({ error: "Failed to update outcome" }, { status: 500 });
  }
}
