/* This just returns if the token is valid or not.
*/

import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabaseServer";

export async function GET(request: Request) {
  try {
    const supabase = await getSupabaseServerClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      return NextResponse.json({ status: true, message: "Token is valid", token: session });
    } else {
      return NextResponse.json({ status: false, message: "Token is not valid" }, { status: 401 });
    }
    } catch (error) {
        return NextResponse.json({ status: false, message: (error as Error).message }, { status: 500 });
    }
}