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
    const senderName = searchParams.get("senderName") || "";
    const receiverName = searchParams.get("receiverName") || "";

    if (!senderName.trim() && !receiverName.trim()) {
        return NextResponse.json({
            status: true,
            message: "No name provided",
            data: { translations: [] }
        });
    }

    const supabase = await getSupabaseServerClient();

    const lookupNames = [senderName.trim(), receiverName.trim()].filter(Boolean);
    let lookupError: Error | null = null;
    let translations: string[] = [];

    try {
        for (const lookupName of lookupNames) {
            const { data, error } = await supabase
                .from("name_translation")
                .select("kusk_name")
                .eq("ilog_name", lookupName)
                .order("kusk_name", { ascending: true });

            if (error) {
                lookupError = error;
                continue;
            }

            const currentTranslations = data
                ? [...new Set(data.map((row) => row.kusk_name))].filter(
                    (name) => name && name.trim().length > 0,
                )
                : [];

            if (currentTranslations.length > 0) {
                translations = currentTranslations;
                break;
            }

            // If first lookup returned no results, continue to the next one.
        }

        if (translations.length === 0 && lookupError) {
            console.error("Error fetching name translations:", lookupError);
            return NextResponse.json(
                {
                    status: false,
                    message: lookupError.message,
                },
                { status: 500 },
            );
        }

        return NextResponse.json({
            status: true,
            message: translations.length > 0 ? "Found name translations" : "No translations found",
            data: {
                translations,
            },
        });
    } catch (error) {
        console.error("Unexpected error fetching name translations:", error);
        return NextResponse.json({
            status: false,
            message: error instanceof Error ? error.message : "Unexpected error"
        }, { status: 500 });
    }
}
