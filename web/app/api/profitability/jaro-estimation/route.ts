import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabaseServer";
import { requireUser } from "@/lib/authHelpers";

/**
 * API route that gets the best match name in the database for a given name.
 */
export async function GET(req: NextRequest) {

    const { error: userError } = await requireUser();
    if (userError) return userError;

    const { searchParams } = new URL(req.url);
    const name = searchParams.get("name") || "";

    if (!name.trim()) {
        return NextResponse.json({
            status: false,
            message: "No name provided",
            data: null
        }, { status: 400 });
    }

    const supabase = await getSupabaseServerClient();
    const { data, error } = await supabase.rpc("find_best_name_match", {
        input_name: name
    });

    if (error) {
        console.error("Error calling find_best_name_match:", error);
        return NextResponse.json({ status: false, message: error.message }, { status: 500 });
    }

    if (!data || data.length === 0) {
        console.error("Jaro-estimation gave empty response");
        return NextResponse.json({
            status: false,
            message: "No match found",
            data: null
        }, { status: 404 });
    }

    const bestMatch = data[0];

    return NextResponse.json({
        status: true,
        message: "Found best name match",
        data: {
            best_name: bestMatch.best_name,
            best_score: bestMatch.best_score
        }
    });
}