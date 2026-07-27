import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import DashboardClient from "./DashboardClient";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (!profile?.onboarding_complete) {
    redirect("/onboarding");
  }

  // Load all dashboard data server-side
  const [
    { data: calls },
    { data: vaultObjections },
    { data: vaultSignals },
  ] = await Promise.all([
    // NO call_transcript here — transcripts are the heavy half of a call (~23 rows/min,
    // ~1,400 rows for an hour) and the list view never shows them. The Flight Log
    // detail view fetches one call's transcript on open via GET /api/calls/[id]
    // ?include=transcript. Loading them for 20 calls made every dashboard render —
    // and every router.refresh() poll — a multi-MB query (Session-1 review finding).
    supabase.from("calls").select("*, call_stages(*)").eq("user_id", user.id).order("call_date", { ascending: false }).limit(20),
    supabase.from("vault_objections").select("*").eq("user_id", user.id).order("frequency", { ascending: false }),
    supabase.from("vault_signals").select("*").eq("user_id", user.id).order("display_order"),
  ]);

  return (
    <DashboardClient
      profile={profile}
      initialCalls={calls || []}
      initialObjections={vaultObjections || []}
      initialSignals={vaultSignals || []}
      userId={user.id}
    />
  );
}
