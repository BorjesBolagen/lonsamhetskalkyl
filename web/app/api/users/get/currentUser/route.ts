import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabaseServer";

/**
 * Gets and returns the currently signed in user
 * @param request 
 * @returns json{
 *   status: boolean,
 *   message: string,
 *   data: User | null
 * }
 */
export async function GET(request: Request) {

    try {
        const supabase = await getSupabaseServerClient();
        const { data: { user }, error } = await supabase.auth.getUser();

        if (error) {
            return NextResponse.json({ status: false, message: "Oväntat fel:" + error.message }, { status: 500 });
        }

        if (!user) {
            return NextResponse.json({ status: false, message: "Du måste vara inloggad." }, { status: 401 });
        }

        // Query this user in the User table to get all their stuff
        const { data: userData, error: userError } = await supabase
            .from("User")
            .select("*")
            .eq("id", user.id)
            .single();

        if (userError) {
            return NextResponse.json({ status: false, message: "Oväntat fel:" + userError.message }, { status: 500 });
        }


        return NextResponse.json({ status: true, message: "Användare hämtad", data: userData }, { status: 200 });

    } catch (error) {
        return NextResponse.json({ status: false, message: "Internal server error" }, { status: 500 });
    }
}