import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as "signup" | "magiclink" | "recovery" | null;

  if (token_hash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ token_hash, type });

    if (!error) {
      if (type === "recovery") {
        return NextResponse.redirect(`${origin}/auth/reset-password`);
      }
      if (type === "signup") {
        return NextResponse.redirect(`${origin}/onboarding`);
      }
      // magiclink
      return NextResponse.redirect(`${origin}/dashboard`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_confirm_failed`);
}
