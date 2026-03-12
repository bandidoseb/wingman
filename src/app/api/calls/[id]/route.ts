import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

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
