import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * PATCH /api/wingman/hud-outcome
 *
 * Called by the Electron HUD (via main.ts fetch) after the user picks a call
 * outcome in the post-call "How'd it go?" card. Unlike the dashboard outcome
 * endpoint, this uses Bearer token auth because the HUD runs outside the
 * browser cookie context.
 *
 * RETAINED for v0.1.28-and-earlier app compatibility: the HUD outcome card was
 * removed in v0.1.29 (outcome moved to the dashboard + AI auto-detect), but
 * installed older apps still PATCH this. Slated for Phase-5 removal once v0.1.29
 * is the floor. A pick here is a human choice → outcome_source='manual'.
 */
export async function PATCH(req: NextRequest) {
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const token = authHeader.slice(7);

    // Build a Supabase client authenticated with the user's access token
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { global: { headers: { Authorization: `Bearer ${token}` } } }
    );

    // Verify the token resolves to a real user.
    // Must pass the token explicitly — getUser() without an arg reads from local
    // session storage (which doesn't exist in a server context), not from headers.
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { call_id, outcome } = await req.json();

    if (!call_id || !outcome) {
      return NextResponse.json({ error: "call_id and outcome are required" }, { status: 400 });
    }

    const { error } = await supabase
      .from("calls")
      .update({ outcome, outcome_source: "manual" })
      .eq("id", call_id)
      .eq("user_id", user.id); // ownership check — user can only update their own calls

    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[hud-outcome] update error:", err);
    return NextResponse.json({ error: "Failed to update outcome" }, { status: 500 });
  }
}
