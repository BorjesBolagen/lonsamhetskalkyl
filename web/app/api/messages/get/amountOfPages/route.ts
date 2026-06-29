import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabaseServer";
import { MAX_NUMBER_OF_MESSAGES_PER_PAGE } from "@/lib/backend/constants";
import { getCurrentUser } from "@/lib/backend/utils";
import { requireUser } from "@/lib/authHelpers";

export async function GET(request: Request) {

    const { error: userError } = await requireUser();
    if (userError) return userError;

    const { searchParams } = new URL(request.url);
    const inputPageSize = searchParams.get("pageSize");

    if (!inputPageSize) {
        return NextResponse.json(
            { status: false, message: "Saknar pageSize argument"},
            { status: 400 }
        );
    }

    if (isNaN(Number(inputPageSize))) {
        return NextResponse.json(
            { status: false, message: "pageSize är inte ett nummer"},
            { status: 400 }
        );
    }

    const pageSize = Number(inputPageSize);

    if ( pageSize < 1 || pageSize > MAX_NUMBER_OF_MESSAGES_PER_PAGE) {
        return NextResponse.json(
            { status: false, message: `Page size får minst vara 1 och max ${MAX_NUMBER_OF_MESSAGES_PER_PAGE}`},
            { status: 400 }
        );
    }

    // Make sure user is signed in

    const supabase = await getSupabaseServerClient();

    const { count, error } = await supabase
        .from("messages")
        .select("*", { count: "exact", head: true });

    if (error) {
        return NextResponse.json(
            { status: false, message: `Internt fel: ${error.message}` },
            { status: 500 }
        );
    }

    const totalPages = Math.ceil((count ?? 0) / pageSize); 
    return NextResponse.json(
        { status: true, message: "Hämtade sidoantal", data: totalPages },
        { status: 200 }
    );
}