import { NextResponse } from "next/server";
import { getSupabaseAdminClient, getSupabaseServerClient } from "@/lib/supabaseServer";
import { getCurrentUser } from "@/lib/backend/utils";
import { TablesUpdate } from "@/lib/supabaseServerSchema";
import { validatePassword } from "@/lib/validation";


/**
 * Returns all users in the User table in supabase. Policies apply.
 * @param request 
 * @returns NextResponse(
 *      {
 *          status: boolean,
 *          message: string,
 *          data?: object
 *      }
 * )
 */
export async function GET() {
    try {
        const supabase = await getSupabaseServerClient();

        const { data, error } = await supabase.from("User").select("*");

        if (error) {
            return NextResponse.json({ status: false, message: "Error fetching users: " + error.message }, { status: 500 });
        }

        if (!data || data.length === 0) {
            return NextResponse.json({ status: false, message: "No users found", data: null }, { status: 404 });
        }

        return NextResponse.json({ status: true, message: "Users fetched successfully", data }, { status: 200 });
    } catch {
        return NextResponse.json({ status: false, message: "Internal server error" }, { status: 500 });
    }
}

type PatchUserPayload = {
    userId?: string;
    first_name?: string | null;
    last_name?: string | null;
    email?: string | null;
    role?: TablesUpdate<"User">["role"];
    newPassword?: string;
};

export async function PATCH(request: Request) {
    let payload: PatchUserPayload = {};

    try {
        payload = (await request.json()) as PatchUserPayload;
    } catch {
        return NextResponse.json({ status: false, message: "Ogiltig JSON" }, { status: 400 });
    }

    const { userId, first_name, last_name, email, role, newPassword } = payload;

    if (!userId) {
        return NextResponse.json({ status: false, message: "userId måste anges" }, { status: 400 });
    }

    const trimmedEmail = email?.trim();
    const trimmedFirstName = first_name?.trim();
    const trimmedLastName = last_name?.trim();
    const trimmedPassword = newPassword?.trim();

    if (trimmedPassword && !validatePassword(trimmedPassword)) {
        return NextResponse.json(
            {
                status: false,
                message: "Lösenordet måste vara minst 7 tecken långt och innehålla minst 1 siffra",
            },
            { status: 400 },
        );
    }

    if (email !== undefined && !trimmedEmail) {
        return NextResponse.json({ status: false, message: "Email får inte vara tomt" }, { status: 400 });
    }

    try {
        const supabase = await getSupabaseServerClient();
        const currentUser = await getCurrentUser(supabase);

        if (!currentUser.status || !currentUser.data) {
            return NextResponse.json({ status: false, message: "Kunde inte verifiera användare" }, { status: 401 });
        }

        if (currentUser.data.role !== "admin") {
            return NextResponse.json({ status: false, message: "Du har inte behörighet att göra detta" }, { status: 403 });
        }

        const supabaseAdmin = getSupabaseAdminClient();

        const { data: existingUser, error: lookupError } = await supabaseAdmin
            .from("User")
            .select("*")
            .eq("id", userId)
            .maybeSingle();

        if (lookupError) {
            return NextResponse.json(
                { status: false, message: "Fel vid hämtning av användare: " + lookupError.message },
                { status: 500 },
            );
        }

        if (!existingUser) {
            return NextResponse.json({ status: false, message: "Användare hittades inte" }, { status: 404 });
        }

        if (trimmedEmail || trimmedPassword) {
            const authUpdate: { email?: string; password?: string } = {};

            if (trimmedEmail) {
                authUpdate.email = trimmedEmail;
            }

            if (trimmedPassword) {
                authUpdate.password = trimmedPassword;
            }

            const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(userId, authUpdate);

            if (authError) {
                return NextResponse.json({ status: false, message: authError.message }, { status: 400 });
            }
        }

        const hasTableUpdates =
            email !== undefined || first_name !== undefined || last_name !== undefined || role !== undefined;

        let updatedUser = existingUser;

        if (hasTableUpdates) {
            const update: TablesUpdate<"User"> = {
                ...(email !== undefined ? { email: trimmedEmail } : {}),
                ...(first_name !== undefined ? { first_name: trimmedFirstName || null } : {}),
                ...(last_name !== undefined ? { last_name: trimmedLastName || null } : {}),
                ...(role !== undefined ? { role } : {}),
            };

            const { data: tableUpdateData, error: tableUpdateError } = await supabaseAdmin
                .from("User")
                .update(update)
                .eq("id", userId)
                .select("*")
                .maybeSingle();

            if (tableUpdateError) {
                return NextResponse.json(
                    { status: false, message: "Fel vid uppdatering av användare: " + tableUpdateError.message },
                    { status: 500 },
                );
            }

            if (tableUpdateData) {
                updatedUser = tableUpdateData;
            }
        }

        return NextResponse.json({ status: true, message: "Användare uppdaterad", data: updatedUser }, { status: 200 });
    } catch (error) {
        const message = error instanceof Error ? error.message : "Oväntat fel";
        return NextResponse.json({ status: false, message }, { status: 500 });
    }
}