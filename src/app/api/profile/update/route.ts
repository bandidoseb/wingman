import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { sanitizeSalesDna } from "@/lib/wingman/sales-dna.mjs";

/**
 * POST /api/profile/update
 *
 * Server-side profile updater used by OnboardingClient + the Sales DNA page for
 * profile writes. Uses explicit SELECT → UPDATE-or-INSERT instead of upsert,
 * which had unpredictable behaviour with the `onConflict` option in some
 * Supabase project configurations and was silently returning 500 errors.
 *
 * SECURITY: this route writes with the SERVICE-ROLE client (RLS bypassed), so it
 * MUST NOT let a caller write arbitrary columns. Only the columns in
 * WRITABLE_PROFILE_COLUMNS below can be set from the client. Sensitive columns
 * (subscription_*, stripe_*, calls_used, activation_key, compliance_*, …) are
 * NEVER writable here — otherwise any logged-in user could grant themselves Pro
 * or reset their call limits. Non-writable keys are dropped and logged, never
 * written.
 */

// The ONLY profile columns a client may write through this endpoint.
// Everything else (billing, stripe, usage counters, compliance) is server-owned.
const WRITABLE_PROFILE_COLUMNS = new Set<string>([
  "onboarding_step",
  "onboarding_complete",
  "role",
  "sales_style",
  "call_length",
  "offer_url",
  "ideal_client",
  "unique_differentiator",
  "guarantee",
  "lead_source",
  "call_weakness",
  "deal_loss_stage",
  "sales_dna",
]);

// sales_dna sanitizer — single source in sales-dna.mjs (Phase 1b, imported above),
// shared with every call-time injection rail (summarize body, press payload,
// session create) so the caps at save time and at inject time can never disagree.
// Semantics unchanged: plain object only, known string keys only, per-field 2,000
// chars, total 26,000 chars (above a full 12×2,000 brain-dump — guards abuse only,
// never drops legitimate heavy input; overflow → 400, never a silent "Saved").
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

    // Enforce the write allowlist. Non-writable keys (billing, stripe, usage,
    // compliance, …) are dropped and logged — a caller cannot escalate its own
    // account through this service-role writer.
    const allowed: Record<string, unknown> = {};
    const rejected: string[] = [];
    for (const [k, v] of Object.entries(cleanUpdates)) {
      if (!WRITABLE_PROFILE_COLUMNS.has(k)) { rejected.push(k); continue; }
      if (k === "sales_dna") {
        const clean = sanitizeSalesDna(v);
        if (clean === null) {
          // Malformed shape or over the abuse cap. Fail LOUD (non-200) so the
          // client shows an error — never a silent drop that reports "Saved".
          console.warn(`[profile/update] invalid sales_dna from user ${user.id}`);
          return NextResponse.json({ error: "sales_dna_invalid" }, { status: 400 });
        }
        allowed[k] = clean;
        continue;
      }
      allowed[k] = v;
    }
    if (rejected.length > 0) {
      console.warn(`[profile/update] dropped non-writable keys for user ${user.id}:`, rejected);
    }

    if (Object.keys(allowed).length === 0) {
      // Nothing writable — treat as success so callers don't blow up
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
        .update(allowed)
        .eq("id", user.id);

      if (updateError) {
        console.error("[profile/update] UPDATE failed:", updateError.message, "code:", updateError.code, "| updates:", allowed);
        return NextResponse.json(
          { error: updateError.message, code: updateError.code },
          { status: 500 }
        );
      }
    } else {
      // No row yet — INSERT with the id + email anchor
      const { error: insertError } = await serviceSupabase
        .from("profiles")
        .insert({ id: user.id, email: user.email ?? "", ...allowed });

      if (insertError) {
        console.error("[profile/update] INSERT failed:", insertError.message, "code:", insertError.code, "| updates:", allowed);
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
