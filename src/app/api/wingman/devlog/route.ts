import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { append, devlogEnabled } from "@/lib/wingman/devlog";

// POST /api/wingman/devlog — Flight Recorder sink for RENDERER-side events (DEV-ONLY).
// Body: { callId, kind, payload? }. Server-side routes call devlog.append() directly;
// this endpoint exists so the browser (which can't touch the fs) can log too.
//
// Gated: returns 404 unless the server flag is on (NODE_ENV !== production && WINGMAN_DEVLOG=1),
// so a production build never accepts telemetry. The client gates itself on
// NEXT_PUBLIC_WINGMAN_DEVLOG and won't even call this in prod — this 404 is the backstop.
export async function POST(req: NextRequest) {
  // Backstop gate BEFORE reading the body — off in prod, this route simply doesn't exist.
  if (!devlogEnabled()) return NextResponse.json({ error: "Not found" }, { status: 404 });

  try {
    // Require auth (defense-in-depth): only a signed-in user's client can write.
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { callId, kind, payload } = body as {
      callId?: string;
      kind?: string;
      payload?: Record<string, unknown>;
    };
    if (!callId || !kind) {
      return NextResponse.json({ error: "callId and kind required" }, { status: 400 });
    }

    append(callId, "renderer", kind, payload ?? {});
    return NextResponse.json({ ok: true });
  } catch {
    // Instrumentation must never surface an error to the client. Swallow.
    return NextResponse.json({ ok: true });
  }
}
