import { NextResponse } from "next/server";
import { getSupabaseAdminClient, getSupabaseServerClient } from "@/lib/supabaseServer";
import { getCurrentUser } from "@/lib/backend/utils";
import { requireAdmin } from "@/lib/authHelpers";

type DeleteUserPayload = {
    userId?: string;
}

export async function DELETE(request: Request) {

    const { error: adminError } = await requireAdmin();
    if (adminError) return adminError;

    let payload: DeleteUserPayload = {};

    try {
        payload = (await request.json()) as DeleteUserPayload;
    } catch {
        return NextResponse.json({ error: "Ogiltig JSON" }, { status: 400 });
    }

    const { userId } = payload;

    if (!userId) {
        return NextResponse.json({ error: "userId is required" }, { status: 400 });
    }


    try {
        const supabase = await getSupabaseServerClient();
        const currentUser = await getCurrentUser(supabase);
        
        if (!currentUser.status || !currentUser.data) {
            return NextResponse.json({ status: false, message: "Kunde inte verifiera användare" }, { status: 401 });
        }

        if (currentUser.data.id === userId) {
            return NextResponse.json({ status: false, message: "Du kan inte radera din egen användare" }, { status: 400 });
        }

        // Now we know user is an admin, allow admin access with service role key
        const supabaseAdmin = getSupabaseAdminClient();

        const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);

        if (error) {
            if (error.status === 404) {
                return NextResponse.json({ status: false, message: "Användare inte hittad" }, { status: 404 });
            }
            return NextResponse.json({ status: false, message: error.message }, { status: 500 });
        }

        return NextResponse.json({ status: true, message: "Användare raderad" }, { status: 200 });
    } catch (err) {
        const message = err instanceof Error ? err.message : "Oväntat fel";
        return NextResponse.json({ status: false, message }, { status: 500 });
    }
}