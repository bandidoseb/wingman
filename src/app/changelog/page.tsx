import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isOwnerEmail } from "@/lib/owner";
import { ChangelogTimeline } from "@/components/changelog/ChangelogTimeline";
import type { ChangelogEntry } from "@/lib/changelog/types";
import entries from "@/data/changelog.json";

export const metadata = {
  title: "Changelog — Wingman",
  description: "What's new in Wingman.",
};

export default async function ChangelogPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!isOwnerEmail(user?.email)) {
    // Not signed in, or not an owner account → bounce to login. The changelog
    // data never renders (and never ships) for anyone else.
    redirect("/login");
  }

  return <ChangelogTimeline entries={entries as ChangelogEntry[]} />;
}
