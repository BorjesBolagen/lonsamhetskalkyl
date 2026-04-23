import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { validateEmail, validatePassword } from "@/lib/validation";
import { COOKIE_MAX_AGE } from "@/lib/constants";

const supabaseErrorMessages: Record<string, string> = {
  "Invalid login credentials": "Felaktiga inloggningsuppgifter",
  "Email not confirmed": "E-postadressen är inte bekräftad. Se inkorg för verifieringsmejl",
  "User not found": "Användaren hittades inte",
  "Password should be at least 6 characters": "Lösenordet måste vara minst 6 tecken",
  "Email already registered": "E-postadressen är redan registrerad",
  "Too many requests": "För många försök, försök igen senare",
}

const translateError = (message: string): string => {
  return supabaseErrorMessages[message] ?? message
}

export async function POST(request: Request) {
  const { email, password, rememberMe } = await request.json();

  if (!email || !password) {
    return NextResponse.json({status: false, message: "Saknar email eller lösenord"}, {status: 400});
  }

  if (!validateEmail(email)) {
    return NextResponse.json({status: false, message: "Email är inte rätt formaterat"}, {status: 400})
  }

  if (!validatePassword(password)) {
    return NextResponse.json({status: false, message: "Lösenordet måste vara minst 7 tecken långt och innehålla minst 1 siffra"}, {status: 400})
  }
  const cookieStore = await cookies();

  const response = NextResponse.json({ status: true, message: "Användare inloggad" }, {status: 200});

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
              maxAge: rememberMe ? COOKIE_MAX_AGE : undefined,
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
    //const errorMsg = "Felaktiga inloggningsuppgifter" if error.message === ""
    return NextResponse.json(
      { status: false, message: translateError(error.message) },
      { status: 400 }
    );
  }

  response.cookies.set("sb-remember-me", rememberMe ? "1" : "0", {
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: rememberMe ? COOKIE_MAX_AGE : undefined,
  });

  response.headers.set("Cache-Control", "private, no-store");

  return response;
}