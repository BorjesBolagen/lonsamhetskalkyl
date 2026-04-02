import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabaseServer";
import { getCurrentUser } from "@/lib/backend/utils";
import { Json, TablesUpdate } from "@/lib/supabaseServerSchema";

type FiltersPayload = {
    userId?: string;
    filters?: Json;
}

export async function POST(request: Request) {
    let payload: FiltersPayload = {};
    
    try {
        payload = (await request.json()) as FiltersPayload;
    } catch {
        return NextResponse.json({ error: "Ogiltig JSON" }, { status: 400 });
    }

    const { userId, filters } = payload;
    if (!userId || filters === undefined) {
        return NextResponse.json(
            { status: false, message: "userId och filters måste anges" },
            { status: 400 }
        );
    }

    try {
        const supabase = await getSupabaseServerClient();
        const currentUser = await getCurrentUser(supabase);

        if (!currentUser.status || !currentUser.data) {
            return NextResponse.json({ status: false, message: "Kunde inte verifiera användare" }, { status: 401 });
        }

        if (currentUser.data.role !== "admin" && currentUser.data.id !== userId) {
            return NextResponse.json({ status: false, message: "Du har inte behörighet att göra detta" }, { status: 403 });
        }

        const update: TablesUpdate<"User"> = { filters };
        const { error } = await supabase
            .from("User")
            .update(update)
            .eq("id", userId);

        if (error) throw new Error(error.message);

        return NextResponse.json({ status: true, message: "Filter uppdaterade" }, { status: 200 });
    } catch (err) {
        const message = err instanceof Error ? err.message : "Oväntat fel";
        return NextResponse.json(
            { status: false, message },
            { status: 500 }
        );
    }
}