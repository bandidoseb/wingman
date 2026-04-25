import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { pusherServer } from "@/lib/pusher";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CHANNEL_PREFIX = "private-wingman-call-";

export async function POST(req: NextRequest) {
  try {
    // ── 1. Validate Supabase session ──────────────────────────────────────────
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      console.warn("[pusher/auth] Unauthorized subscription attempt");
      return new Response("Unauthorized", { status: 403 });
    }

    // ── 2. Parse Pusher's form-encoded body ───────────────────────────────────
    // pusher-js sends: application/x-www-form-urlencoded
    // Body fields: socket_id, channel_name
    const body = await req.formData();
    const socket_id    = body.get("socket_id")    as string | null;
    const channel_name = body.get("channel_name") as string | null;

    if (!socket_id || !channel_name) {
      return new Response("Missing socket_id or channel_name", { status: 400 });
    }

    // ── 3. Validate channel name format ───────────────────────────────────────
    // Only allow subscriptions to private-wingman-call-{uuid} channels.
    // Any other channel name is rejected — prevents subscribing to arbitrary channels.
    if (!channel_name.startsWith(CHANNEL_PREFIX)) {
      console.warn("[pusher/auth] Invalid channel prefix:", channel_name);
      return new Response("Invalid channel", { status: 403 });
    }

    const callId = channel_name.slice(CHANNEL_PREFIX.length);
    if (!UUID_REGEX.test(callId)) {
      console.warn("[pusher/auth] Invalid callId in channel name:", callId);
      return new Response("Invalid channel", { status: 403 });
    }

    // ── 4. Verify user owns this call ─────────────────────────────────────────
    // Service client bypasses RLS so we get a definitive ownership check.
    const service = createServiceClient();
    const { data: call } = await service
      .from("calls")
      .select("id")
      .eq("id", callId)
      .eq("user_id", user.id)
      .single();

    if (!call) {
      console.warn("[pusher/auth] User", user.id, "attempted to subscribe to call", callId, "they don't own");
      return new Response("Forbidden", { status: 403 });
    }

    // ── 5. Sign and return the Pusher auth token ──────────────────────────────
    const authResponse = pusherServer.authorizeChannel(socket_id, channel_name);
    return NextResponse.json(authResponse);

  } catch (err) {
    console.error("[pusher/auth] Error:", err);
    return new Response("Internal server error", { status: 500 });
  }
}
