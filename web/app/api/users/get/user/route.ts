import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabaseServer";

/**
 * Gets a user with the gived id and returns it.
 * @param request 
 * @returns json{
 *   status: boolean,
 *   message: string,
 *   data: User | null
 * }
 */
export async function GET(request: Request) {

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");

    if (!userId) {
        return NextResponse.json({ status: false, message: "Ingen användar-ID angiven" }, { status: 400 });
    }

    try {
        const supabase = await getSupabaseServerClient();

        // Verify caller is authenticated
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            return NextResponse.json({ status: false, message: "Ej autentiserad" }, { status: 401 });
        }

        const isAdmin = false; // replace with your admin check if needed
        const isSelf = user.id === userId;

        // Admins and self get full profile, any authenticated user gets public fields only
        const selectColumns = (isAdmin || isSelf)
            ? "id, email, first_name, last_name, role, created_at"
            : "id, first_name, last_name";

        const { data, error } = await supabase
            .from("User")
            .select(selectColumns)
            .eq("id", userId)
            .maybeSingle();

        if (error) {
            return NextResponse.json({ status: false, message: "Fel vid hämtning av användare: " + error.message }, { status: 500 });
        }
        if (!data) {
            return NextResponse.json({ status: false, message: "Användare hittades inte" }, { status: 404 });
        }

        return NextResponse.json({ status: true, message: "Användare hämtad", data }, { status: 200 });
    } catch (error) {
        const message = error instanceof Error ? error.message : "Internal server error";
        return NextResponse.json({ status: false, message: message }, { status: 500 });
    }
}