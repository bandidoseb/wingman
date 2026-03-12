import { redirect } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import OnboardingClient from "./OnboardingClient";

export default async function OnboardingPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  let { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  // ── Guarantee profile row exists ───────────────────────────────────────────
  // The trigger `handle_new_user` normally creates this row on signup, but it
  // may not have run for test / pre-existing accounts, or the trigger may be
  // inactive in a fresh Supabase project.  Without a row, every `.update()`
  // call in OnboardingClient silently updates 0 rows → onboarding_complete
  // never persists → infinite redirect loop.
  //
  // Using the service role bypasses the RLS INSERT gap (profiles has no INSERT
  // policy for users — only the SECURITY DEFINER trigger is meant to insert).
  if (!profile) {
    const serviceSupabase = createServiceClient();
    await serviceSupabase
      .from("profiles")
      .insert({ id: user.id, email: user.email ?? "" });

    // Re-fetch so OnboardingClient gets a real profile object
    const { data: fresh } = await serviceSupabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();
    profile = fresh;
  }

  if (profile?.onboarding_complete) {
    redirect("/dashboard");
  }

  return <OnboardingClient initialProfile={profile} userId={user.id} />;
}
