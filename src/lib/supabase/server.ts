import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

type CookieItem = { name: string; value: string; options: CookieOptions };

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: CookieItem[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }: CookieItem) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Server component — ignore
          }
        },
      },
    }
  );
}

// NOTE: The service client uses the plain @supabase/supabase-js createClient
// (NOT createServerClient from @supabase/ssr).  createServerClient reads user
// session cookies and sets the Authorization header to the user's JWT, which
// overrides the service role key and causes RLS to apply.  The plain client
// always sends the service role key as Authorization, bypassing RLS correctly.
export function createServiceClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}
