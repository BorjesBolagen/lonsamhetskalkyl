import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabaseServer";


/**
 * Returns all users in the User table in supabase. Policies apply.
 * @param request 
 * @returns NextResponse(
 *      {
 *          status: boolean,
 *          message: string,
 *          data?: object
 *      }
 * )
 */
export async function GET(request: Request) {
    try {
        const supabase = await getSupabaseServerClient();

        const { data, error } = await supabase.from("User").select("*");

        if (error) {
            return NextResponse.json({ status: false, message: "Error fetching users: " + error.message }, { status: 500 });
        }

        if (!data || data.length === 0) {
            return NextResponse.json({ status: false, message: "No users found", data: null }, { status: 404 });
        }

        return NextResponse.json({ status: true, message: "Users fetched successfully", data }, { status: 200 });
    } catch (error) {
        return NextResponse.json({ status: false, message: "Internal server error" }, { status: 500 });
    }
}