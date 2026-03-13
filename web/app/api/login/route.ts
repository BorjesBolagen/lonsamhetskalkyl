import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabaseServer";
import { LoginPayload, validateEmail } from "@/app/api/Utils";

/* API route for user login
   Takes JSON input:
   {
    email: string,
    password: string
   }
    Returns JSON response:
    TBD
*/
export async function POST(request: Request) {
  
  let payload: LoginPayload;

  // Make sure we have valid JSON in the request body
  try {
    payload = (await request.json()) as LoginPayload;
  } catch (error) {
    return NextResponse.json({ success: false,
                               message: "Fel JSON-format."},
                              { status: 400 });
  }

  // Get email and password
  const { email, password } = payload;

  // Assert email and password are present and of correct type
  var isInvalid = 
    !email || typeof email !== "string"
    || !password || typeof password !== "string";
  if (isInvalid) {
    return NextResponse.json({ success: false,
                               message: "Användarnamn eller lösenord är av fel typ. Försök igen." },
                               { status: 400 });
  }

  // Validate email address
  if (!validateEmail(email)) {
    return NextResponse.json({ success: false,
                               message: "E-mail har inte rätt format." },
                               { status: 400 });
  }

  const supabase = getSupabaseServerClient();

  try {

    // Check if the email has been verified
    const { data: user, error: userError } = await supabase
      .from("User")
      .select("email_verified")
      .eq("email", email)
      .maybeSingle();

    if (userError || !user) {
      return NextResponse.json({ success: false, message: "Användaren finns inte." }, { status: 404 });
    }

    if (!user.email_verified) {
      return NextResponse.json({ success: false,
                                 message: "E-mail har inte verifierats. Vänligen verifiera din e-mail innan du loggar in." },
                                { status: 403 });
    }


    // Attempt to sign in the user
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    console.log("Sign in data:", signInData);
    console.log("Sign in error:", signInError);

    if (signInError) {
      return NextResponse.json({ success: false,
                                 message: "Felaktigt e-mail eller lösenord." },
                                { status: 401 });
    }

    // If sign in is successful, return success response
    return NextResponse.json({ success: true, message: "Inloggning lyckades." });



    /*
    const { data, error } = await supabase
      .from("Accounts")
      .select("name, password") 
      .eq("name", email)
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
    */

  } catch (err) {
    console.error("API Crash:", err);
    return NextResponse.json(
      { status: false, message: "Ett oväntat fel inträffade." },
      { status: 500 }
    );
  }
}