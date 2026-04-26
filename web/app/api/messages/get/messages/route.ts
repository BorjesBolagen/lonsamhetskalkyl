import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabaseServer";
import { PageNotFoundError } from "next/dist/shared/lib/utils";
import { User } from "@/lib/databaseTypes";
import { getCurrentUser } from "@/lib/backend/utils";
import { MAX_NUMBER_OF_MESSAGES_PER_PAGE } from "@/lib/backend/constants";

export async function GET(request: Request) {
    
    const { searchParams } = new URL(request.url);
    const inputPage = searchParams.get("page");
    const inputPageSize = searchParams.get("pageSize");

    if (!inputPage || !inputPageSize) {
        return NextResponse.json(
            { status: false, message: "Saknar page eller pageSize argument"},
            { status: 400 }
        );
    }

    if (isNaN(Number(inputPage)) || isNaN(Number(inputPageSize))) {
        return NextResponse.json(
            { status: false, message: "page Eller pageSize är inte nummer"},
            { status: 400 }
        );
    }

    const page = Number(inputPage);
    const pageSize = Number(inputPageSize);

    if (page < 1) {
        return NextResponse.json(
            { status: false, message: "Page måste vara ett positivt heltal" },
            { status: 400 }
        );
    }

    if (pageSize < 1 || pageSize > MAX_NUMBER_OF_MESSAGES_PER_PAGE) {
        return NextResponse.json(
            { status: false, message: `Page size får minst vara 1 och max ${MAX_NUMBER_OF_MESSAGES_PER_PAGE}`},
            { status: 400 }
        );
    }

    // Make sure requesting user is signed in
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

    // Read messages on input page with input page size
    const { data: messagesData, error: messagesError } = await supabase
        .from("messages")
        .select("*")
        .range((page - 1) * pageSize, page * pageSize - 1)
        .order("created_at", { ascending: false });
    
    if (messagesError) {
        return NextResponse.json(
            { status: false, message: `Internt fel: ${messagesError.message}`},
            { status: 500 }
        );
    }

    // Get last read messages timestamp and update it
    const { data: lastReadData, error: lastReadError } = await supabase
        .from("User")
        .select("last_read_messages_at")
        .eq("id", currentUser.id)
        .single();
    
    if (lastReadError) {
        return NextResponse.json(
            { status: false, message: `Internt fel: ${lastReadError.message}`},
            { status: 500 }
        );
    }

    const { error: updateError } = await supabase.rpc("update_last_read_messages",{ 
        user_id: currentUser.id 
    });

    if (updateError) {
        return NextResponse.json(
            { status: false, message: `Internt fel: ${updateError.message}`},
            { status: 500 }
        );
    }

    if (!lastReadData.last_read_messages_at) {
        return NextResponse.json(
            { status: false, message: `Kunde inte hämta senast läst datum. Försök igen`},
            { status: 500 }
        );
    }

    return NextResponse.json(
        { 
            status: false, message: "Hämtade meddelanden",
            last_read_messages: lastReadData.last_read_messages_at,
            messages: messagesData
        },
        { status: 200 }
    );
}