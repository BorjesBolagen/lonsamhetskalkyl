"use server";

import { NextResponse } from "next/server";
import type { User } from "@supabase/supabase-js";
import { getSupabaseServerClient } from "@/lib/supabaseServer";

type AuthSuccess = { error: null; user: User };
type AuthFailure = { error: NextResponse; user: null };

/**
 * General function for asserting that the logged in user has a valid JWT and a verified email adress
 *
 * Returnerar även den inloggade användaren. Varje supabase.auth.getUser() är
 * ett nätverksanrop mot Supabase Auth (auth-js cachar inte), så anropande kod
 * ska återanvända `user` härifrån istället för att hämta den en gång till.
 * @returns 
 */
export async function requireUser(): Promise<AuthSuccess | AuthFailure> {
    const supabase = await getSupabaseServerClient();
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) {
        return {
            user: null,
            error: NextResponse.json({ status: false, message: "Ej autentiserad" }, { status: 401 }),
        };
    }

    return { error: null, user };
}

export async function requireAdmin(): Promise<AuthSuccess | AuthFailure> {
    const result = await requireUser();
    if (result.error) return result;

    const supabase = await getSupabaseServerClient();

    const { data: profile } = await supabase
        .from("User")
        .select("role")
        .eq("id", result.user.id)
        .maybeSingle();

    if (profile?.role !== "admin") {
        return {
            user: null,
            error: NextResponse.json({ status: false, message: "Åtkomst nekad" }, { status: 403 }),
        };
    }

    return { error: null, user: result.user };
}
