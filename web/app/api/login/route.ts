import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

const ONE_YEAR_IN_SECONDS = 60 * 60 * 24 * 365;

export async function POST(request: Request) {
  const { email, password, rememberMe } = await request.json();
  const cookieStore = await cookies();

  const response = NextResponse.json({ ok: true });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, {
              ...options,
              path: "/",
              sameSite: "lax",
              secure: process.env.NODE_ENV === "production",
              ...(rememberMe ? { maxAge: ONE_YEAR_IN_SECONDS } : {}),
            });
          });
        },
      },
    }
  );

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 401 }
    );
  }

  response.cookies.set("sb-remember-me", rememberMe ? "1" : "0", {
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    ...(rememberMe ? { maxAge: ONE_YEAR_IN_SECONDS } : {}),
  });

  response.headers.set("Cache-Control", "private, no-store");

  return response;
}