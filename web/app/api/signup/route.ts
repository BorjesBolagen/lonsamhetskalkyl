import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabaseServer";

/* QUeries the database with an email. Returns the user data if the user exists
    Returns on this format
    {
        status: boolean,
        message: string,
        data?: object
    }
*/
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const email = searchParams.get("email");

  if (!email) {
    return NextResponse.json({ status: false, message: "Email is required" }, { status: 400 });
  }

  try {
    const supabase = await getSupabaseServerClient();

    //////////////////////////////////// Maybe extract this to a helper function? ////////////////////////////////////
    // It gets the rule of the currently signed in user
    // First authenticate user, make sure they are admin
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError) {
      return NextResponse.json(
        { status: false, message: "Oväntat fel: " + userError.message },
        { status: 500 }
      );
    }

    if (!user) {
      return NextResponse.json({ status: false, message: "Du måste vara inloggad för att göra detta" }, { status: 401 });
    }

    // Query the role this user has
    const { data: roleData, error: roleError } = await supabase
      .from("User")
      .select("role")
      .eq("id", user.id)
      .single();

    if (roleError) {
      return NextResponse.json(
        { status: false, message: "Oväntat fel: " + roleError.message },
        { status: 500 }
      );
    }

    ///////////////////////////////////////////////////////////////////////////////////////////////////////////////////

    if (roleData?.role !== "admin") {
      return NextResponse.json({ status: false, message: "Du har inte behörighet att göra detta" }, { status: 403 });
    }

    const { data, error } = await supabase.from("User").select("*").eq("email", email).maybeSingle();

    if (error) {
      return NextResponse.json({ status: false, message: "Oväntat fel: " + error.message }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ status: false, message: "Angivet email är inte registrerat", data: null }, { status: 400 });
    }

    return NextResponse.json({ status: true, message: "Användare hittades", data });
  } catch {
    return NextResponse.json({ status: false, message: "Internal server error" }, { status: 500 });
  }
}

