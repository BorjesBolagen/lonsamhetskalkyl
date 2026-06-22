import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabaseServer";

/**
 * API route that gets the best match name in the database for a given name.
 */
export async function GET(req: NextRequest) {

    const { searchParams } = new URL(req.url);
    const name = searchParams.get("name") || "";

    const supabase = await getSupabaseServerClient();
    const { data, error } = await supabase.rpc("find_best_name_match", {
        input_name: name
    });

    if (error) {
        console.error("Error calling find_best_name_match:", error);
        return NextResponse.json({ status: false, message: error.message }, { status: 500 });
    }

    if (!data) {
        console.error("Jaro-estimation gave empty response");
        return NextResponse.json({
            status: false,
            message: "No match found"
        }, { status: 404 });
    }

    return NextResponse.json({
        status: true,
        message: "Found best name match",
        data: {
            best_name: data[0].best_name,
            best_score: data[0].best_score
        }
    });
}