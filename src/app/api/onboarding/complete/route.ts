import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

/**
 * POST /api/onboarding/complete
 *
 * Marks the authenticated user's onboarding as complete.
 * Uses explicit SELECT → UPDATE-or-INSERT (not upsert) to avoid the
 * silent 500 errors caused by the `onConflict` option in some Supabase
 * project configurations.
 */
export async function POST(request: Request) {
  try {
    // 1. Verify the caller is an authenticated user
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      console.error("[onboarding/complete] Auth failed:", authError?.message ?? "no user");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const serviceSupabase = createServiceClient();

    // 2. Check whether a profile row already exists
    const { data: existing } = await serviceSupabase
      .from("profiles")
      .select("id")
      .eq("id", user.id)
      .maybeSingle();

    if (existing) {
      // Row exists — UPDATE the completion flags only
      const { error: updateError } = await serviceSupabase
        .from("profiles")
        .update({ onboarding_complete: true, onboarding_step: "complete" })
        .eq("id", user.id);

      if (updateError) {
        console.error("[onboarding/complete] UPDATE failed:", updateError.message, "code:", updateError.code);
        return NextResponse.json({ error: updateError.message }, { status: 500 });
      }
    } else {
      // No profile row — INSERT one with the completion flag set
      const { error: insertError } = await serviceSupabase
        .from("profiles")
        .insert({
          id: user.id,
          email: user.email ?? "",
          onboarding_complete: true,
          onboarding_step: "complete",
        });

      if (insertError) {
        console.error("[onboarding/complete] INSERT failed:", insertError.message, "code:", insertError.code);
        return NextResponse.json({ error: insertError.message }, { status: 500 });
      }
    }

    // 3. Verify the write actually landed before telling the client to proceed
    const { data: verify } = await serviceSupabase
      .from("profiles")
      .select("onboarding_complete")
      .eq("id", user.id)
      .single();

    if (!verify?.onboarding_complete) {
      console.error("[onboarding/complete] Post-write verification failed — flag still false");
      return NextResponse.json({ error: "Write verification failed" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[onboarding/complete] Unexpected error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
