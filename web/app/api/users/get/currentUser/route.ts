import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabaseServer";
import { getCurrentUser } from "@/lib/backend/utils";
import { requireUser } from "@/lib/authHelpers";

/**
 * Gets and returns the currently signed in user
 * For some reason not called if there is no cookie with token
 * @param request 
 * @returns json{
 *   status: boolean,
 *   message: string,
 *   data: User | null
 * }
 */
export async function GET() {

    const { error: userError } = await requireUser();
    if (userError) return userError;

    try {
        const supabase = await getSupabaseServerClient();
        const currentUser = await getCurrentUser(supabase);
        return NextResponse.json({ status: true, message: "Användare hämtad", data: currentUser.data }, { status: 200 });
    } catch (error) {
        const message = error instanceof Error ? error.message : "Internal server error";
        return NextResponse.json({ status: false, message: message, data: null }, { status: 500 });
    }
}