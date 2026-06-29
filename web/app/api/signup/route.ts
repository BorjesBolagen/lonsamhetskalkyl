import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabaseServer";
import { validateEmail } from "@/lib/validation";
import { requireAdmin } from "@/lib/authHelpers";

/* QUeries the database with an email. Returns the user data if the user exists
    Returns on this format
    {
        status: boolean,
        message: string,
        data?: object
    }
*/
export async function GET(request: Request) {

  const { error: adminError } = await requireAdmin();
  if (adminError) return adminError;

  const { searchParams } = new URL(request.url);
  const email = searchParams.get("email");

  if (!email) {
    return NextResponse.json({ status: false, message: "Inget email angivet" }, { status: 400 });
  }

  if (!validateEmail(email)) {
    return NextResponse.json({ status: false, message: "Email är inte rätt formaterat" }, { status: 400 });
  }

  try {
    const supabase = await getSupabaseServerClient();
    const { data, error } = await supabase.from("User").select("*").eq("email", email).maybeSingle();

    if (error) {
      return NextResponse.json({ status: false, message: "Oväntat fel: " + error.message }, { status: 500 });
    }

    if (data) {
      return NextResponse.json({ status: false, message: "Angivet email är redan registrerat" }, { status: 400 });
    }

    return NextResponse.json({ status: true, message: "Angivet email finns inte. Sign up går bra" });
  } catch {
    return NextResponse.json({ status: false, message: "Internal server error" }, { status: 500 });
  }
}

