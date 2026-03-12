import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET /api/calls — list all calls for the authenticated user
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data, error } = await supabase
      .from("calls")
      .select(`
        *,
        call_stages(*),
        call_transcript(*)
      `)
      .eq("user_id", user.id)
      .order("call_date", { ascending: false });

    if (error) throw error;
    return NextResponse.json({ calls: data });
  } catch (err) {
    console.error("GET /api/calls error:", err);
    return NextResponse.json({ error: "Failed to fetch calls" }, { status: 500 });
  }
}

// POST /api/calls — create a new call
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const {
      prospect_name,
      outcome,
      duration,
      summary,
      missed_topics,
      call_date,
      stages,
      transcript,
    } = body;

    // Insert call
    const { data: call, error: callError } = await supabase
      .from("calls")
      .insert({
        user_id: user.id,
        prospect_name: prospect_name || null,
        outcome: outcome || null,
        duration: duration || null,
        summary: summary || null,
        missed_topics: missed_topics || [],
        call_date: call_date || new Date().toISOString(),
      })
      .select()
      .single();

    if (callError) throw callError;

    // Insert stages if provided
    if (stages && Array.isArray(stages) && stages.length > 0) {
      const stageRows = stages.map((s: { name: string; status: string; note?: string }, idx: number) => ({
        call_id: call.id,
        name: s.name,
        status: s.status,
        note: s.note || null,
        display_order: idx,
      }));
      const { error: stageError } = await supabase.from("call_stages").insert(stageRows);
      if (stageError) console.error("Stage insert error:", stageError);
    }

    // Insert transcript lines if provided
    if (transcript && Array.isArray(transcript) && transcript.length > 0) {
      const transcriptRows = transcript.map((t: { speaker: string; text: string }, idx: number) => ({
        call_id: call.id,
        speaker: t.speaker,
        text: t.text,
        sequence_order: idx,
      }));
      const { error: transcriptError } = await supabase.from("call_transcript").insert(transcriptRows);
      if (transcriptError) console.error("Transcript insert error:", transcriptError);
    }

    return NextResponse.json({ call }, { status: 201 });
  } catch (err) {
    console.error("POST /api/calls error:", err);
    return NextResponse.json({ error: "Failed to create call" }, { status: 500 });
  }
}
