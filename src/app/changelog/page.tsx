import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ChangelogTimeline } from "@/components/changelog/ChangelogTimeline";
import type { ChangelogEntry } from "@/lib/changelog/types";
import entries from "@/data/changelog.json";

// Private page — only these accounts may view it. To make it public later,
// remove this set and the gate below.
const ALLOWED_EMAILS = new Set([
  "sebmattiasperez@gmail.com",
  "sebastian@meetwingman.ai",
  "yungseboo@gmail.com",
]);

export const metadata = {
  title: "Changelog — Wingman",
  description: "What's new in Wingman.",
};

export default async function ChangelogPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const email = user?.email?.toLowerCase();
  if (!email || !ALLOWED_EMAILS.has(email)) {
    // Not signed in, or not an owner account → bounce to login. The changelog
    // data never renders (and never ships) for anyone else.
    redirect("/login");
  }

  return <ChangelogTimeline entries={entries as ChangelogEntry[]} />;
}
