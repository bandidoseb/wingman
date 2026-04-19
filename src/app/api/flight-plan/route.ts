import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: plan, error } = await supabase
      .from("flight_plans")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) throw error;
    return NextResponse.json({ plan });
  } catch (err) {
    console.error("GET /api/flight-plan error:", err);
    return NextResponse.json({ error: "Failed to fetch flight plan" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();

    const syntax = ["problems-first", "goals-first"].includes(body.syntax)
      ? (body.syntax as "problems-first" | "goals-first")
      : "problems-first";

    const investment_min =
      typeof body.investment_min === "number" && body.investment_min >= 0
        ? body.investment_min
        : null;
    const investment_max =
      typeof body.investment_max === "number" && body.investment_max >= 0
        ? body.investment_max
        : null;

    if (investment_min !== null && investment_max !== null && investment_min > investment_max) {
      return NextResponse.json(
        { error: "Minimum investment cannot exceed maximum" },
        { status: 400 }
      );
    }

    const custom_checkpoints = Array.isArray(body.custom_checkpoints)
      ? (body.custom_checkpoints as unknown[])
          .filter((c): c is string => typeof c === "string" && c.trim().length > 0)
          .slice(0, 3)
      : [];

    const payload = {
      user_id: user.id,
      syntax,
      target_market:
        typeof body.target_market === "string"
          ? body.target_market.slice(0, 500) || null
          : null,
      core_problem:
        typeof body.core_problem === "string"
          ? body.core_problem.slice(0, 1000) || null
          : null,
      dream_outcome:
        typeof body.dream_outcome === "string"
          ? body.dream_outcome.slice(0, 1000) || null
          : null,
      investment_min,
      investment_max,
      involves_partner: body.involves_partner === true,
      method_differentiation:
        typeof body.method_differentiation === "string"
          ? body.method_differentiation.slice(0, 1000) || null
          : null,
      custom_checkpoints,
    };

    const { data: plan, error } = await supabase
      .from("flight_plans")
      .upsert(payload, { onConflict: "user_id" })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ plan });
  } catch (err) {
    console.error("POST /api/flight-plan error:", err);
    return NextResponse.json({ error: "Failed to save flight plan" }, { status: 500 });
  }
}
