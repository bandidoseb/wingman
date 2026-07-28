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

    // transcriptRows — lets a poller tell "still generating" apart from
    // "nothing is coming", which `summary` alone cannot express: post-call returns
    // { skipped: "no transcript" } and writes NOTHING, so a call that captured no audio
    // sat in "generating debrief…" until the HUD's 6-minute dead-man timer.
    //
    // This reports FACTS, not a verdict. The server cannot distinguish "zero rows
    // forever" from "zero rows so far" — transcript saves are still in flight around
    // call end (flushBuffer early-returns when the 25s auto-save is mid-request, so its
    // resolution does NOT prove rows are committed). The caller owns that judgment,
    // because only the caller knows how long ago the call ended. Deciding it here would
    // permanently hide a real debrief on a slow save.
    //
    // (An earlier version keyed off `call.duration != null` as proof the flush had
    // finished. `duration` is never written by any client — it would have been dead
    // code that shipped looking fixed.)
    // (No debriefStatus field — it would only restate `call.summary`, which every
    // caller already reads off the row.)
    let transcriptRows: number | null = null;
    if (!call.summary) {
      const { count, error: cErr } = await supabase
        .from("call_transcript")
        .select("id", { count: "exact", head: true })
        .eq("call_id", id);
      // On error leave null — callers treat unknown as "keep waiting", never as "none".
      if (!cErr) transcriptRows = count ?? 0;
    }

    if (req.nextUrl.searchParams.get("include") === "transcript") {
      // Ownership proven above, so scoping by call_id is safe here.
      const { data: transcript, error: tErr } = await supabase
        .from("call_transcript")
        .select("id, call_id, speaker, text, sequence_order")
        .eq("call_id", id)
        .order("sequence_order", { ascending: true });
      if (tErr) throw tErr;
      return NextResponse.json({ call, transcript: transcript ?? [], transcriptRows });
    }

    return NextResponse.json({ call, transcriptRows });
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
