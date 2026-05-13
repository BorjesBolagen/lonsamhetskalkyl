import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { validateEmail } from "@/lib/validation";
import { getSupabaseAdminClient } from "@/lib/supabaseServer";

export async function POST(request: Request) {
	const { email } = await request.json();

	// Validate email presence
	if (!email) {
		return NextResponse.json({ status: false, message: "Saknar email" }, { status: 400 });
	}

	// Validate email format
	if (!validateEmail(email)) {
		return NextResponse.json({ status: false, message: "Email är inte rätt formaterat" }, { status: 400 });
	}

	// Check if user exists (prevents account enumeration attacks)
	const adminSupabase = getSupabaseAdminClient();
	const { data: existingUser, error: lookupError } = await adminSupabase
		.from("User")
		.select("id")
		.eq("email", email)
		.maybeSingle();

	if (lookupError) {
		return NextResponse.json(
			{ status: false, message: "Kunde inte behandla begäran." },
			{ status: 500 },
		);
	}

	// Return neutral response whether email exists or not (security)
	if (!existingUser) {
		return NextResponse.json({ status: true, message: "Om adressen finns i systemet skickas en återställningslänk." });
	}

	// Send password reset email via Supabase
	const supabase = createClient(
		process.env.NEXT_PUBLIC_SUPABASE_URL!,
		process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
	);

	// Use configured site URL or fallback to request origin for email links
	const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? new URL(request.url).origin;
	const redirectTo = new URL("/reset-password", siteUrl).toString();
	const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });

	// Handle email send errors with specific messages
	if (error) {
		console.error("resetPasswordForEmail failed", {
			message: error.message,
			name: error.name,
			status: error.status,
			code: error.code,
		});

		const errorMessage = error.message.toLowerCase();

		// Detect rate limit errors (free tier: 2 emails/hour)
		if (error.status === 429 || errorMessage.includes("rate limit") || errorMessage.includes("too many")) {
			return NextResponse.json(
				{ status: false, message: "Vi har skickat många länkar nyligen. Försök igen om en liten stund." },
				{ status: 429 },
			);
		}

		// Detect redirect URL configuration errors
		if (errorMessage.includes("redirect") || errorMessage.includes("url")) {
			return NextResponse.json(
				{ status: false, message: "Återställningslänken kunde inte skapas just nu. Kontrollera Supabase URL-inställningar." },
				{ status: 400 },
			);
		}

		// Generic error fallback
		return NextResponse.json(
			{ status: false, message: "Kunde inte skicka återställningslänken." },
			{ status: 400 },
		);
	}

	return NextResponse.json({
		status: true,
		message: "Om adressen finns i systemet skickas en återställningslänk.",
	});
}