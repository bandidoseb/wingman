import { NextRequest, NextResponse } from "next/server";
import { join } from "node:path";
import { createClient } from "@/lib/supabase/server";
import { isOwnerEmail } from "@/lib/owner";
import { devlogEnabled } from "@/lib/wingman/devlog";
import { listCalls, buildReport } from "@/lib/wingman/flight-recorder-core.mjs";

// GET /api/wingman/devlog/report — Flight Recorder reader for the owner dashboard (DEV-ONLY).
//   ?list        → { calls: [callId, …] } (newest first)
//   ?callId=<id> → the merged report for that call
//   (no params)  → the newest call's report
//
// DOUBLE-GATED: 404 unless the devlog flag is on (dev-only) AND the caller is an owner.
// Reads the local dev-logs/ files the recorder wrote — never touches the live pipeline.
export async function GET(req: NextRequest) {
  if (!devlogEnabled()) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!isOwnerEmail(user?.email)) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const dir = join(process.cwd(), "dev-logs");
  const calls = listCalls(dir);

  if (req.nextUrl.searchParams.has("list")) {
    return NextResponse.json({ calls });
  }

  const callId = req.nextUrl.searchParams.get("callId") || calls[0];
  if (!callId) return NextResponse.json({ calls: [], report: null });
  // callId flows into a filename in buildReport — reject anything but the UUID/slug
  // charset so a crafted ?callId= can't read a .server.jsonl outside dev-logs/.
  if (!/^[A-Za-z0-9_-]+$/.test(callId)) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const report = buildReport(dir, callId);
  if (!report) return NextResponse.json({ error: "No usable log for that call" }, { status: 404 });
  return NextResponse.json({ calls, report });
}
