import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET /api/user — get the current user's profile
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: profile, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    if (error) throw error;
    return NextResponse.json({ profile });
  } catch (err) {
    console.error("GET /api/user error:", err);
    return NextResponse.json({ error: "Failed to fetch profile" }, { status: 500 });
  }
}

// PATCH /api/user — update profile fields
export async function PATCH(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();

    // Whitelist updatable fields
    const allowed = [
      "sales_style",
      "call_length",
      "alert_pitching_early",
      "alert_missed_topics",
      "alert_post_call_debrief",
      "alert_weekly_summary",
      "assist_enabled",
      "signal_display_mode",
      "ai_model_preference",
    ];

    const update: Record<string, unknown> = {};
    for (const key of allowed) {
      if (key in body) update[key] = body[key];
    }

    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
    }

    const { data: profile, error } = await supabase
      .from("profiles")
      .update(update)
      .eq("id", user.id)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ profile });
  } catch (err) {
    console.error("PATCH /api/user error:", err);
    return NextResponse.json({ error: "Failed to update profile" }, { status: 500 });
  }
}
