import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isOwnerEmail } from "@/lib/owner";
import { OwnerDashboard } from "@/components/owner/OwnerDashboard";

export const metadata = {
  title: "Owner — Wingman",
  description: "Founder cockpit.",
};

// Owner-gated founder cockpit. Non-owners never see it (bounced to login), same
// as /changelog. The Flight Recorder tab's DATA is additionally dev-only (its API
// 404s in prod), so in production this page shows the shell + a "local only" note.
export default async function OwnerPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!isOwnerEmail(user?.email)) redirect("/login");
  return <OwnerDashboard />;
}
