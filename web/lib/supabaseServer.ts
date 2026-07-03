import "server-only";
import { Database } from "@/lib/supabaseServerSchema";

import { createServerClient } from '@supabase/ssr'
import { createClient } from "@supabase/supabase-js";
import { cookies } from 'next/headers'
import { AsyncLocalStorage } from "node:async_hooks";
import { COOKIE_MAX_AGE } from "./constants";

// Cron-jobb körs utan inloggad användare. Kod som körs inuti
// runWithSupabaseAdminContext får service role-klienten från
// getSupabaseServerClient, så att befintlig beräkningskod (trappsteg,
// tillägg m.m.) fungerar oförändrad utan cookies/RLS-session.
const supabaseAdminContext = new AsyncLocalStorage<boolean>();

export function runWithSupabaseAdminContext<T>(fn: () => Promise<T>): Promise<T> {
  return supabaseAdminContext.run(true, fn);
}

export async function getSupabaseServerClient() {
  if (supabaseAdminContext.getStore()) {
    return getSupabaseAdminClient();
  }

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
                maxAge: rememberMe ? COOKIE_MAX_AGE : undefined,
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