import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET /api/calls/[id] — one call, light by default.
//
// Default: the call row only (~1KB). This is the POLL shape — the dashboard and
// Flight Log ask "is the debrief ready?" every 2s while a call is generating, and
// that question must never cost a full-transcript query (it used to ride on
// router.refresh(), re-running the whole dashboard load: 20 calls × full
// transcripts, ~3MB per tick).
//
// ?include=transcript: adds the transcript rows, ordered. This is the DETAIL shape —
// fetched once when the rep opens a call in the Flight Log.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Non-UUID → 404 up front. Postgres throws 22P02 on a malformed uuid, which the
    // catch below would surface as a 500 + error log per scanner probe.
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // user_id filter (not just RLS) so a foreign call id 404s identically to a
    // missing one — no existence oracle.
    const { data: call, error } = await supabase
      .from("calls")
      .select("id, prospect_name, outcome, outcome_source, duration, summary, missed_topics, call_date, created_at")
      .eq("id", id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (error) throw error;
    if (!call) return NextResponse.json({ error: "Not found" }, { status: 404 });

    if (req.nextUrl.searchParams.get("include") === "transcript") {
      // Ownership proven above, so scoping by call_id is safe here.
      const { data: transcript, error: tErr } = await supabase
        .from("call_transcript")
        .select("id, call_id, speaker, text, sequence_order")
        .eq("call_id", id)
        .order("sequence_order", { ascending: true });
      if (tErr) throw tErr;
      return NextResponse.json({ call, transcript: transcript ?? [] });
    }

    return NextResponse.json({ call });
  } catch (err) {
    console.error("GET /api/calls/[id] error:", err);
    return NextResponse.json({ error: "Failed to load call" }, { status: 500 });
  }
}

// PATCH /api/calls/[id] — update a call
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();

    // Whitelist updatable fields — never let client overwrite user_id, id, created_at, etc.
    const allowed = ["outcome", "call_date", "duration", "summary", "missed_topics", "prospect_name"] as const;
    type AllowedKey = (typeof allowed)[number];
    const safeUpdate: Partial<Record<AllowedKey, unknown>> = {};
    for (const key of allowed) {
      if (key in body) safeUpdate[key] = body[key];
    }

    const { data, error } = await supabase
      .from("calls")
      .update(safeUpdate)
      .eq("id", id)
      .eq("user_id", user.id)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ call: data });
  } catch (err) {
    console.error("PATCH /api/calls/[id] error:", err);
    return NextResponse.json({ error: "Failed to update call" }, { status: 500 });
  }
}

// DELETE /api/calls/[id] — delete a call
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { error } = await supabase
      .from("calls")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("DELETE /api/calls/[id] error:", err);
    return NextResponse.json({ error: "Failed to delete call" }, { status: 500 });
  }
}
