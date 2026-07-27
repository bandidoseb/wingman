import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { PLANS } from "@/lib/stripe";
import { FREE_CALL_LIMIT } from "@/lib/constants";
import { warmUpPipeline } from "@/lib/wingman/pipeline-warmup";
import { sanitizeSalesDna } from "@/lib/wingman/sales-dna.mjs";
import * as devlog from "@/lib/wingman/devlog";

// ── Warm-up debounce (Phase 1b reviewer 🟡) ─────────────────────────────────
// warmUpPipeline fires paid requests (embed ping, Haiku/Sonnet pings, and — with
// complete Sales DNA — a ~2k-token Sonnet cache-write prime). Session POST itself
// is deliberately NOT rate-limited (a failed deploy must be retryable instantly),
// so cap the SPEND instead: skip the warm-up when this user warmed <60s ago. A
// retry inside that window doesn't need re-warming anyway — connections and the
// prompt cache (5-min TTL) are still hot. In-memory Map is fine on single-instance
// Railway (same trade-off as kb-signal's rateLimitMap).
const warmupDebounce = new Map<string, number>();
const WARMUP_DEBOUNCE_MS = 60_000;

// ─── POST /api/wingman/session — start a new call session ──────────────────
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { prospect_name, sales_dna } = body;

    // Phase 1b (warm-at-deploy): the client sends its Sales DNA copy at call start
    // so the warm-up can prime the dig card's prompt cache. Untrusted → the ONE
    // shared sanitizer (same caps as every other rail). Never blocks call start.
    const salesDna = sanitizeSalesDna(sales_dna);

    // Load profile and flight plan in parallel.
    // Flight plan has a 3s timeout — a slow fetch must never block call start.
    const [profileRes, flightPlan] = await Promise.all([
      supabase
        .from("profiles")
        .select("role, subscription_status, subscription_plan, calls_used, extra_calls_remaining")
        .eq("id", user.id)
        .single(),
      Promise.race([
        (async () => {
          try {
            const { data } = await supabase
              .from("flight_plans")
              .select("*")
              .eq("user_id", user.id)
              .maybeSingle();
            return data;
          } catch {
            return null;
          }
        })(),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 3_000)),
      ]),
    ]);

    const { data: profile } = profileRes;

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
        user_id:              user.id,
        prospect_name:        prospect_name || "Live Call",
        outcome:              null,
        call_date:            new Date().toISOString(),
        missed_topics:        [],
        flight_plan_snapshot: flightPlan ?? null,
      })
      .select()
      .single();

    if (error) throw error;

    // Flight Recorder (dev-only, no-op in prod): the call HEADER — the Sales DNA the
    // cards will read from + when it started. Opens this call's log file. Never blocks.
    devlog.append(call.id, "server", "header", {
      prospectName: prospect_name || "Live Call",
      salesDna:     salesDna ?? null,
      startedAt:    call.call_date,
      nodeEnv:      process.env.NODE_ENV,
    });

    // Phase 3.5 (#38) + 1b: fire-and-forget pipeline warm-up — opens TLS/connection
    // pools to OpenAI/Anthropic/Groq, kicks the in-memory KB load, and (when the
    // rep's Sales DNA is complete) primes the dig card's prompt cache with the real
    // DNA prefix so the FIRST hotkey press hits a warm cache. Never awaited (call
    // start is unaffected), never throws, <$0.01/call worst case. Fired only after
    // the call row insert succeeds, at most once per user per 60s (spend cap — a
    // rapid retry is still warm). Railway = persistent Node → completes post-response.
    const lastWarm = warmupDebounce.get(user.id) ?? 0;
    if (Date.now() - lastWarm >= WARMUP_DEBOUNCE_MS) {
      warmupDebounce.set(user.id, Date.now());
      // Opportunistic prune so the map can't grow unbounded across many users.
      if (warmupDebounce.size > 500) {
        for (const [uid, t] of warmupDebounce) {
          if (Date.now() - t > WARMUP_DEBOUNCE_MS) warmupDebounce.delete(uid);
        }
      }
      void warmUpPipeline(salesDna).catch(() => {});
    }

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
    const { call_id, outcome, summary, duration, prospect_name } = body;

    if (!call_id) {
      return NextResponse.json({ error: "call_id required" }, { status: 400 });
    }

    // Build the update object — only include prospect_name if the caller
    // detected one (non-empty string). Avoids overwriting a name set earlier
    // with an empty/null value on a second PATCH.
    const updateFields: Record<string, unknown> = {
      outcome:  outcome ?? null,
      summary:  summary ?? null,
      duration: duration ?? null,
    };
    if (prospect_name && typeof prospect_name === "string" && prospect_name.trim()) {
      updateFields.prospect_name = prospect_name.trim();
    }

    // Update the call (ownership enforced by .eq("user_id", user.id))
    const { data: call, error } = await supabase
      .from("calls")
      .update(updateFields)
      .eq("id", call_id)
      .eq("user_id", user.id)
      .select()
      .single();

    if (error) throw error;

    // NOTE: call_stages are no longer written here. Stage derivation moved to the
    // post-call Sonnet job (Phase 1), which reads the full transcript and writes
    // call_stages itself. The client no longer sends `stages` on PATCH.

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
    //
    // Use x-forwarded-proto/host headers to build the correct public HTTPS URL.
    // req.nextUrl.origin returns the internal Railway HTTP address on deployed
    // instances, which causes ERR_SSL_PACKET_LENGTH_TOO_LONG when TLS is expected.
    const proto    = req.headers.get("x-forwarded-proto") ?? req.nextUrl.protocol.replace(":", "");
    const host     = req.headers.get("x-forwarded-host")  ?? req.nextUrl.host;
    const origin   = `${proto}://${host}`;
    fetch(
      `${origin}/api/wingman/post-call`,
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
