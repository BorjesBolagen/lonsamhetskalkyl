import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabaseServer";
import { User } from "@/lib/databaseTypes";
import { getCurrentUser } from "@/lib/backend/utils";

export async function GET() {
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

    const { data: unreadCount, error } = await supabase.rpc("get_amount_of_unread_messages", {
        user_id: currentUser.id
    });

    if (error) {
        return NextResponse.json(
            { status: false, message: `Internt fel: ${error.message}` },
            { status: 500 }
        );
    }

    return NextResponse.json(
        { status: true, message: "Hämtade antal olästa meddelanden", data: unreadCount },
        { status: 200 }
    );
}