import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getCurrentUser } from "@/lib/backend/utils";
import { validatePassword } from "@/lib/validation";
import { requireUser } from "@/lib/authHelpers";

export async function POST(request: Request) {

	const { error: userError } = await requireUser();
	if (userError) return userError;

	const { currentPassword, newPassword } = await request.json();

	if (!currentPassword || !newPassword) {
		return NextResponse.json({ status: false, message: "Saknar nuvarande eller nytt lösenord" }, { status: 400 });
	}

	if (!validatePassword(newPassword)) {
		return NextResponse.json({ status: false, message: "Lösenordet måste vara minst 7 tecken långt och innehålla minst 1 siffra" }, { status: 400 });
	}

	const cookieStore = await cookies();
	const response = NextResponse.json({ status: true, message: "Lösenordet har uppdaterats." }, { status: 200 });
	const supabase = createServerClient(
		process.env.NEXT_PUBLIC_SUPABASE_URL!,
		process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
		{
			cookies: {
				getAll() {
					return cookieStore.getAll();
				},
				setAll(cookiesToSet) {
					cookiesToSet.forEach(({ name, value, options }) => {
						response.cookies.set(name, value, {
							...options,
							path: "/",
							sameSite: "lax",
							secure: process.env.NODE_ENV === "production",
						});
					});
				},
			},
		},
	);

	try {
		const currentUserResponse = await getCurrentUser(supabase);
		const currentUser = currentUserResponse.data;

		if (!currentUser?.email) {
			return NextResponse.json({ status: false, message: "Kunde inte hitta inloggad användare" }, { status: 401 });
		}

		const { error: signInError } = await supabase.auth.signInWithPassword({
			email: currentUser.email,
			password: currentPassword,
		});

		if (signInError) {
			return NextResponse.json({ status: false, message: "Nuvarande lösenord är felaktigt" }, { status: 400 });
		}

		const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });

		if (updateError) {
			return NextResponse.json({ status: false, message: updateError.message }, { status: 400 });
		}

		response.headers.set("Cache-Control", "private, no-store");
		return response;
	} catch (error) {
		return NextResponse.json(
			{ status: false, message: error instanceof Error ? error.message : "Internal server error" },
			{ status: 500 },
		);
	}
}