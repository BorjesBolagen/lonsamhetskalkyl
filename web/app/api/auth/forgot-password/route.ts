import { NextResponse } from "next/server";
import { validateEmail } from "@/lib/validation";
import { getSupabaseAdminClient } from "@/lib/supabaseServer";

export async function POST(request: Request) {
    const { email } = await request.json();

    // Validate input first, before any auth or DB calls
    if (!email) {
        return NextResponse.json({ status: false, message: "Saknar email" }, { status: 400 });
    }
    if (!validateEmail(email)) {
        return NextResponse.json({ status: false, message: "Email är inte rätt formaterat" }, { status: 400 });
    }

    const adminSupabase = getSupabaseAdminClient();

    // Check if target email exists (prevents account enumeration)
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
		console.log("användare angav fel email");
        return NextResponse.json({
            status: true,
            message: "Om adressen finns i systemet skickas en återställningslänk.",
        });
    }

    // Get the site URL from environment or request origin
    // IMPORTANT: In production (Vercel), this should be explicitly set to your domain
    // Example: NEXT_PUBLIC_SITE_URL=https://yourdomain.com
    let siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
    
    if (!siteUrl) {
        // Only use request origin as fallback for development
        // In production, this may not be the correct URL
        const origin = new URL(request.url).origin;
        siteUrl = origin;
        
        // Log warning in production
        if (process.env.NODE_ENV === 'production') {
            console.warn('NEXT_PUBLIC_SITE_URL is not set. Using request origin: ' + origin);
        }
    }

    const redirectTo = new URL("/reset-password", siteUrl).toString();

    const { error: resetError } = await adminSupabase.auth.resetPasswordForEmail(email, { redirectTo });

    if (resetError) {
        console.error("resetPasswordForEmail failed", {
            message: resetError.message,
            name: resetError.name,
            status: resetError.status,
            code: resetError.code,
        });

        const errorMessage = resetError.message.toLowerCase();

        if (resetError.status === 429 || errorMessage.includes("rate limit") || errorMessage.includes("too many")) {
            return NextResponse.json(
                { status: false, message: "Vi har skickat många länkar nyligen. Försök igen om en liten stund." },
                { status: 429 },
            );
        }
        if (errorMessage.includes("redirect") || errorMessage.includes("url")) {
            return NextResponse.json(
                { status: false, message: "Återställningslänken kunde inte skapas just nu. Kontrollera Supabase URL-inställningar." },
                { status: 400 },
            );
        }

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