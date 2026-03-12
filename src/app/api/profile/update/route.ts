import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

/**
 * POST /api/profile/update
 *
 * Server-side profile updater used by OnboardingClient for ALL profile writes.
 * Uses explicit SELECT → UPDATE-or-INSERT instead of upsert, which had
 * unpredictable behaviour with the `onConflict` option in some Supabase
 * project configurations and was silently returning 500 errors.
 */
export async function POST(request: Request) {
  try {
    // 1. Verify the caller is an authenticated Supabase user
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      console.error("[profile/update] Auth failed:", authError?.message ?? "no user");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Parse the fields to update from the request body
    let updates: Record<string, unknown> = {};
    try {
      const body = await request.json();
      updates = body?.updates ?? {};
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    // Strip undefined values (JSON.stringify already dropped them, but be safe)
    const cleanUpdates = Object.fromEntries(
      Object.entries(updates).filter(([, v]) => v !== undefined)
    );

    if (Object.keys(cleanUpdates).length === 0) {
      // Nothing to write — treat as success so callers don't blow up
      return NextResponse.json({ success: true, skipped: true });
    }

    const serviceSupabase = createServiceClient();

    // 3. Check whether a profile row already exists for this user
    const { data: existing } = await serviceSupabase
      .from("profiles")
      .select("id")
      .eq("id", user.id)
      .maybeSingle();

    if (existing) {
      // Row exists — UPDATE the specific columns only
      const { error: updateError } = await serviceSupabase
        .from("profiles")
        .update(cleanUpdates)
        .eq("id", user.id);

      if (updateError) {
        console.error("[profile/update] UPDATE failed:", updateError.message, "code:", updateError.code, "| updates:", cleanUpdates);
        return NextResponse.json(
          { error: updateError.message, code: updateError.code },
          { status: 500 }
        );
      }
    } else {
      // No row yet — INSERT with the id + email anchor
      const { error: insertError } = await serviceSupabase
        .from("profiles")
        .insert({ id: user.id, email: user.email ?? "", ...cleanUpdates });

      if (insertError) {
        console.error("[profile/update] INSERT failed:", insertError.message, "code:", insertError.code, "| updates:", cleanUpdates);
        return NextResponse.json(
          { error: insertError.message, code: insertError.code },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[profile/update] Unexpected error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
