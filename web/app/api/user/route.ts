import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabaseServer";

/*
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

    const { data, error } = await supabase.from("User").select("*").eq("email", email).maybeSingle();

    if (error) {
      return NextResponse.json({ status: false, message: error.message }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ status: false, message: "User not found" }, { status: 404 });
    }

    return NextResponse.json({ status: true, message: "User found", data });
  } catch {
    return NextResponse.json({ status: false, message: "Internal server error" }, { status: 500 });
  }
}