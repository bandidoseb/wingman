import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      console.error("[onboarding/compliance] Auth failed:", authError?.message ?? "no user");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const forwarded = request.headers.get("x-forwarded-for");
    const ip = forwarded ? forwarded.split(",")[0].trim() : (request.headers.get("x-real-ip") ?? null);

    const serviceSupabase = createServiceClient();
    const { error: updateError } = await serviceSupabase
      .from("profiles")
      .update({
        compliance_acknowledged_at: new Date().toISOString(),
        compliance_acknowledged_ip: ip,
      })
      .eq("id", user.id);

    if (updateError) {
      console.error("[onboarding/compliance] Update failed:", updateError.message);
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[onboarding/compliance] Unexpected error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
