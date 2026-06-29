import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabaseServer";
import { getCurrentUser } from "@/lib/backend/utils";
import { User } from "@/lib/databaseTypes";
import { MAX_NUMBER_OF_CHARACTERS_PER_MESSAGE } from "@/lib/backend/constants";
import { requireAdmin } from "@/lib/authHelpers";

type AddMessagePayload = {
    body: string
}

export async function POST(request: Request) {

    const { error: adminError } = await requireAdmin();
    if (adminError) return adminError;

    let payload: AddMessagePayload | null = null;
        
    try {
        payload = (await request.json()) as AddMessagePayload;
    } catch {
        return NextResponse.json({ error: "Ogiltig JSON" }, { status: 400 });
    }

    const { body } = payload;
    if (!body || body.length < 1 || body.length > MAX_NUMBER_OF_CHARACTERS_PER_MESSAGE) {
        return NextResponse.json(
            { status: false, message: `Innehåll saknas eller är längre än ${MAX_NUMBER_OF_CHARACTERS_PER_MESSAGE} tecken`},
            { status: 400 }
        )
    }

    // Get currently signed in user and make sure they are admin
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

    const { error } = await supabase
        .from("messages")
        .insert({
            body: body,
            created_by: currentUser.id
        });
    
    if (error) {
        return NextResponse.json(
            { status: false, message: `Kunde inte lägga till meddelande: ${error.message}` },
            { status: 500 }
        );
    }

    return NextResponse.json(
        { status: true, message: "Skickade meddelande"},
        { status: 200 }
    );
}