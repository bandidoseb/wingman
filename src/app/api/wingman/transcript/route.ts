import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { call_id, transcript_chunk }: { call_id: string; transcript_chunk: string } = body;

    if (!call_id) {
      return NextResponse.json({ error: "Missing call_id" }, { status: 400 });
    }

    if (!transcript_chunk?.trim()) {
      return NextResponse.json({ error: "Empty transcript chunk" }, { status: 400 });
    }

    if (transcript_chunk.length > 50_000) {
      return NextResponse.json({ error: "Transcript chunk too large" }, { status: 400 });
    }

    const service = createServiceClient();

    // Verify call belongs to this user before writing
    const { data: callCheck } = await service
      .from("calls")
      .select("id")
      .eq("id", call_id)
      .eq("user_id", user.id)
      .single();

    if (!callCheck) {
      return NextResponse.json({ error: "Call not found" }, { status: 404 });
    }

    // Parse "Speaker: text" lines and insert rows — same logic as poll route
    const lines = transcript_chunk.split("\n").filter((l) => l.trim());
    const sequenceBase = Math.floor(Date.now() / 1000);

    const transcriptRows = lines
      .map((line, idx) => {
        const colonIdx = line.indexOf(":");
        if (colonIdx === -1) return null;
        const speaker = line.slice(0, colonIdx).trim();
        const text = line.slice(colonIdx + 1).trim();
        if (!text) return null;
        return { call_id, speaker, text, sequence_order: sequenceBase + idx };
      })
      .filter(Boolean);

    if (transcriptRows.length > 0) {
      await service.from("call_transcript").insert(transcriptRows);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[transcript] Route error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
