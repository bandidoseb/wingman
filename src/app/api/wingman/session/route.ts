import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { PLANS } from "@/lib/stripe";
import { FREE_CALL_LIMIT } from "@/lib/constants";

// ─── POST /api/wingman/session — start a new call session ──────────────────
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { prospect_name } = body;

    // Load profile to check subscription + usage
    const { data: profile } = await supabase
      .from("profiles")
      .select("role, subscription_status, subscription_plan, calls_used, extra_calls_remaining")
      .eq("id", user.id)
      .single();

    const status    = profile?.subscription_status ?? "trialing";
    const callsUsed = profile?.calls_used ?? 0;

    // ── 1. Free-tier users: enforce calls_used limit ───────────────────────
    if (status !== "active") {
      if (callsUsed >= FREE_CALL_LIMIT) {
        return NextResponse.json(
          {
            error:      "trial_ended",
            message:    `You've used all ${FREE_CALL_LIMIT} of your free calls. Subscribe to keep going.`,
            calls_used: callsUsed,
            call_limit: FREE_CALL_LIMIT,
          },
          { status: 403 },
        );
      }
    }

    // ── 2. Paid users: enforce plan monthly call limits ────────────────────
    if (status === "active") {
      const plan      = profile?.subscription_plan as keyof typeof PLANS | null;
      const planData  = plan && plan in PLANS ? PLANS[plan] : null;
      const callLimit = planData && "calls" in planData
        ? (planData as { calls: number }).calls
        : null;

      if (callLimit) {
        const now        = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

        const { count: monthCount } = await supabase
          .from("calls")
          .select("*", { count: "exact", head: true })
          .eq("user_id", user.id)
          .gte("call_date", monthStart);

        if ((monthCount ?? 0) >= callLimit) {
          // Plan limit hit — check if user has purchased extra (rollover) calls
          const extraCalls = profile?.extra_calls_remaining ?? 0;
          if (extraCalls <= 0) {
            return NextResponse.json(
              {
                error:      "call_limit_reached",
                message:    `You've used all ${callLimit} calls for this month. Purchase additional calls to continue.`,
                calls_used: monthCount,
                call_limit: callLimit,
              },
              { status: 403 },
            );
          }
          // Extra calls available — fall through and allow call creation
        }
      }
    }

    // ── 3. Create the call record ──────────────────────────────────────────
    const { data: call, error } = await supabase
      .from("calls")
      .insert({
        user_id:       user.id,
        prospect_name: prospect_name || "Simulator Session",
        outcome:       null,
        call_date:     new Date().toISOString(),
        missed_topics: [],
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ call_id: call.id, call });
  } catch (err) {
    console.error("Session create error:", err);
    return NextResponse.json({ error: "Failed to create session" }, { status: 500 });
  }
}

// ─── PATCH /api/wingman/session — end a call, update counters ───────────────
export async function PATCH(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { call_id, outcome, summary, duration, stages } = body;

    if (!call_id) {
      return NextResponse.json({ error: "call_id required" }, { status: 400 });
    }

    // Update the call (ownership enforced by .eq("user_id", user.id))
    const { data: call, error } = await supabase
      .from("calls")
      .update({
        outcome:  outcome ?? null,
        summary:  summary ?? null,
        duration: duration ?? null,
      })
      .eq("id", call_id)
      .eq("user_id", user.id)
      .select()
      .single();

    if (error) throw error;

    // Insert stage records if provided
    if (stages && Array.isArray(stages) && stages.length > 0) {
      const stageRows = stages.map(
        (s: { name: string; status: string; note?: string }, idx: number) => ({
          call_id,
          name:          s.name,
          status:        s.status,
          note:          s.note ?? null,
          display_order: idx,
        })
      );
      await supabase.from("call_stages").insert(stageRows);
    }

    // ── Increment calls_used counter for free-tier users ──────────────────
    const { data: profile } = await supabase
      .from("profiles")
      .select("subscription_status, subscription_plan, calls_used, extra_calls_remaining")
      .eq("id", user.id)
      .single();

    if (profile?.subscription_status !== "active") {
      const current = profile?.calls_used ?? 0;
      await supabase
        .from("profiles")
        .update({ calls_used: current + 1 })
        .eq("id", user.id);
    }

    // ── Deduct from extra_calls_remaining if plan limit was exceeded ───────
    if (profile?.subscription_status === "active") {
      const plan      = profile?.subscription_plan as keyof typeof PLANS | null;
      const planData  = plan && plan in PLANS ? PLANS[plan] : null;
      const callLimit = planData && "calls" in planData
        ? (planData as { calls: number }).calls
        : null;

      if (callLimit) {
        const now        = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

        // Count completed calls this month (including the one just ended)
        const { count: monthCount } = await supabase
          .from("calls")
          .select("*", { count: "exact", head: true })
          .eq("user_id", user.id)
          .gte("call_date", monthStart);

        // If this call pushed us over the plan limit, deduct one extra call
        if ((monthCount ?? 0) > callLimit) {
          const extra = profile?.extra_calls_remaining ?? 0;
          if (extra > 0) {
            await supabase
              .from("profiles")
              .update({ extra_calls_remaining: extra - 1 })
              .eq("id", user.id);
          }
        }
      }
    }

    // ── Fire post-call analysis job (fire-and-forget — does not block response) ─
    // Runs async: transcript → Sonnet → objection upsert → debrief written to DB.
    // Failures are non-fatal — call record is already saved above.
    fetch(
      `${req.nextUrl.origin}/api/wingman/post-call`,
      {
        method:  "POST",
        headers: {
          "content-type": "application/json",
          cookie:          req.headers.get("cookie") ?? "",
        },
        body: JSON.stringify({ call_id }),
      }
    ).catch((err) => console.error("[session] post-call fire-and-forget failed:", err));

    return NextResponse.json({ call });
  } catch (err) {
    console.error("Session end error:", err);
    return NextResponse.json({ error: "Failed to end session" }, { status: 500 });
  }
}
