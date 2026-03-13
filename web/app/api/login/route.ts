import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabaseServer";
import { LoginPayload, validateEmail } from "@/app/api/Utils";


export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, password } = body;

    const supabase = getSupabaseServerClient();

    // Assert the user has authorized the email thru verification email

    const { data, error } = await supabase
      .from("Accounts")
      .select("name, password") 
      .eq("name", name)
      .eq("password", password)
      .maybeSingle(); // .maybeSingle() returnerar null om ingen hittas istället för att krascha

    if (error) {
      console.error("Supabase Database Error:", error.message);
      return NextResponse.json({ error: "Kunde inte läsa från databasen" }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json(
        { error: "Felaktigt användarnamn eller lösenord" },
        { status: 401 }
      );
    }

    // Om vi hittar en matchning
    return NextResponse.json({ 
      success: true, 
      user: { name: (data as { name: string }).name }
    });

  } catch (err) {
    console.error("API Crash:", err);
    return NextResponse.json(
      { error: "Internt serverfel vid inloggning" },
      { status: 500 }
    );
  }
}