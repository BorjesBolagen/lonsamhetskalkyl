import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabaseServer";
import { MAX_NUMBER_OF_MESSAGES_PER_PAGE } from "@/lib/backend/constants";
import { getCurrentUser } from "@/lib/backend/utils";
import { User } from "@/lib/databaseTypes";

export async function GET(request: Request) {

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

    let currentUser: User;
    const supabase = await getSupabaseServerClient();

    try {
        const response = await getCurrentUser(supabase);
        currentUser = response.data!;
    } catch (e) {
        return NextResponse.json(
            { status: false, message: e instanceof Error ? e.message : "Kunde inte verifiera inloggad användare. Försök logga in på nytt." },
            { status: 401 }
        );
    }

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