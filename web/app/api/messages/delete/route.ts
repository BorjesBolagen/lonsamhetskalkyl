import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabaseServer";
import { User } from "@/lib/databaseTypes";
import { getCurrentUser } from "@/lib/backend/utils";

export async function DELETE(request: Request) {

    const { searchParams } = new URL(request.url);
    const inputMessageId = searchParams.get("messageId");

    if (!inputMessageId) {
        return NextResponse.json(
            { status: false, message: "Saknar messageId argument"},
            { status: 400 }
        );
    }

    if (isNaN(Number(inputMessageId))) {
        return NextResponse.json(
            { status: false, message: "messageId är inte ett nummer"},
            { status: 400 }
        );
    }

    const messageId = Number(inputMessageId);

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

    // Make sure this user is an admin

    if (currentUser.role !== "admin") {
        return NextResponse.json(
            { status: false, message: "Du har inte behörighet att göra detta" },
            { status: 403 }
        );
    }

    // Delete this messageId
    const { data, error } = await supabase
        .from("messages")
        .delete()
        .eq("id", messageId)
        .select();

    if (error) {
        return NextResponse.json(
            { status: false, message: `Internt fel: ${error.message}` },
            { status: 500 }
        );
    }

    if (data.length === 0) {
        return NextResponse.json(
            { status: false, message: "Meddelandet hittades inte" },
            { status: 404 }
        );
    }

    return NextResponse.json(
        { status: true, message: "Meddelandet har tagits bort" },
        { status: 200 }
    );
}