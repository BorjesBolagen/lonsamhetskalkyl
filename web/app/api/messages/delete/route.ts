import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabaseServer";
import { User } from "@/lib/databaseTypes";
import { getCurrentUser } from "@/lib/backend/utils";
import { requireAdmin } from "@/lib/authHelpers";

export async function DELETE(request: Request) {

    const { error: adminError } = await requireAdmin();
    if (adminError) return adminError

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
    const supabase = await getSupabaseServerClient();

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