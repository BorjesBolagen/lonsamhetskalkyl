import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabaseServer";
import { getCurrentUser } from "@/lib/backend/utils";

type ThresholdPayload = {
    userId?: string;
    threshold?: number;
};

/**
 * Posts the attached threshold value to the given userId.
 * @param request 
 * @returns 
 */
export async function POST(request: Request) {

    let payload: ThresholdPayload = {};
    
    try {
        payload = (await request.json()) as ThresholdPayload;
    } catch {
        return NextResponse.json({ error: "Ogiltig JSON" }, { status: 400 });
    }

    const { userId, threshold } = payload;

    if (!userId || threshold === undefined) {
        return NextResponse.json(
            { status: false, message: "userId och threshold måste anges" },
            { status: 400 }
        );
    }

    if (typeof userId !== "string" || typeof threshold !== "number") {
        return NextResponse.json(
            { status: false, message: "Ogiltiga datatyper för userId eller threshold" },
            { status: 400 }
        );
    }

    if (!Number.isInteger(threshold)) {
        return NextResponse.json(
            { status: false, message: "threshold måste vara ett heltal" },
            { status: 400 }
        );
    }

    if (!Number.isSafeInteger(threshold)) {
        return NextResponse.json(
            { status: false, message: "threshold är utanför säkert intervall" },
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

        const { error } = await supabase.from("User").update({ threshold }).eq("id", userId);

        if (error) {
            return NextResponse.json({ status: false, message: error.message }, { status: 500 });
        }

        return NextResponse.json({ status: true, message: "Threshold uppdaterad" }, { status: 200 });
    } catch (error) {
        const message = error instanceof Error ? error.message : "Internal server error";
        return NextResponse.json({ status: false, message }, { status: 500 });
    }
}