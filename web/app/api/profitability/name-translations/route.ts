import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabaseServer";
import { requireUser } from "@/lib/authHelpers";

/**
 * API route that gets all name translations for a given ilog_name.
 * Returns all kusk_name values where ilog_name matches the provided name.
 */
export async function GET(req: NextRequest) {

    const { error: userError } = await requireUser();
    if (userError) return userError;

    const { searchParams } = new URL(req.url);
    const name = searchParams.get("name") || "";

    if (!name) {
        return NextResponse.json({
            status: true,
            message: "No name provided",
            data: { translations: [] }
        });
    }

    const supabase = await getSupabaseServerClient();
    
    try {
        const { data, error } = await supabase
            .from("name_translation")
            .select("kusk_name")
            .eq("ilog_name", name)
            .order("kusk_name", { ascending: true });

        if (error) {
            console.error("Error fetching name translations:", error);
            return NextResponse.json({
                status: false,
                message: error.message
            }, { status: 500 });
        }

        // Extract unique kusk_name values
        const translations = data
            ? [...new Set(data.map(row => row.kusk_name))].filter(name => name && name.trim().length > 0)
            : [];

        return NextResponse.json({
            status: true,
            message: "Found name translations",
            data: {
                translations
            }
        });
    } catch (error) {
        console.error("Unexpected error fetching name translations:", error);
        return NextResponse.json({
            status: false,
            message: error instanceof Error ? error.message : "Unexpected error"
        }, { status: 500 });
    }
}
