import "server-only";
import { Database } from "@/lib/supabaseServerSchema";

import { createServerClient } from '@supabase/ssr'
import { createClient } from "@supabase/supabase-js";
import { cookies } from 'next/headers'

const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; 

export async function getSupabaseServerClient() {
  const cookieStore = await cookies()
  const rememberMe = cookieStore.get("sb-remember-me")?.value === "1";

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, {
                ...options,
                path: "/",
                sameSite: "lax",
                secure: process.env.NODE_ENV === "production",
                ...(rememberMe ? { maxAge: COOKIE_MAX_AGE } : {}),
              })
            );
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
            console.warn("setAll called from Server Component, which is not supported.")
          }
        },
      },
    }
  )
}

/**
 * Används bara om service role key krävs med höjda privilegier.
 * 99% av fallen ska getSupabaseServerClient användas.
 */
export function getSupabaseAdminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}