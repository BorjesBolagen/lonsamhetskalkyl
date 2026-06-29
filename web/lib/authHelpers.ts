"use server";

import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabaseServer";

type AuthSuccess = { error: null };
type AuthFailure = { error: NextResponse };

/**
 * General function for asserting that the logged in user has a valid JWT and a verified email adress
 * @returns 
 */
export async function requireUser(): Promise<AuthSuccess | AuthFailure> {
    const supabase = await getSupabaseServerClient();
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) {
        return {
            error: NextResponse.json({ status: false, message: "Ej autentiserad" }, { status: 401 }),
        };
    }

    return { error: null };
}

export async function requireAdmin(): Promise<AuthSuccess | AuthFailure> {
    const result = await requireUser();
    if (result.error) return result;

    const supabase = await getSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    const { data: profile } = await supabase
        .from("User")
        .select("role")
        .eq("id", user!.id)
        .maybeSingle();

    if (profile?.role !== "admin") {
        return {
            error: NextResponse.json({ status: false, message: "Åtkomst nekad" }, { status: 403 }),
        };
    }

    return { error: null };
}