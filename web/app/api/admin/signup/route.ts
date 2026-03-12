import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabaseServer";
import { Enums } from "@/lib/supabaseServerSchema";

type SignupPayload = {
  email: string;
  password: string;
  role?: Enums<"User_specialization_types">;
};

function validateEmail(email: string): boolean {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
}

/* API route for admin user signup
   Takes JSON input:
   {
    email: string
    password: string
    role: Enums<"User_specialization_types">
   }
   Returns JSON response:
   type BasicResponse, found in lib/api.ts
*/
export async function POST(request: Request) {

  let payload: SignupPayload;

  // Make sure we have valid JSON in the request body
  try {
    payload = (await request.json()) as SignupPayload;
  } catch (error) {
    return NextResponse.json({ success: false,
                               message: "Fel JSON-format."}, 
                               { status: 400 });
  }

  // Get email and password
  const { email, password, role } = payload;

  // Assert email, password and role are present and of correct type
  var isInvalid = 
    !email || typeof email !== "string" 
    || !password || typeof password !== "string" 
    || !role || typeof role !== "string";
  if (isInvalid) {
    return NextResponse.json({ success: false,
                               message: "E-mail, lösenord eller roll är av fel typ. Försök igen." },
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

    // Check if email is already present in supabase
    const { data: existingUser, error: existingUserError } = await supabase
      .from('User')
      .select('id')
      .eq('email', email)
      .maybeSingle();

    if (existingUser) {
      return NextResponse.json({ success: false,
                                 message: "Angivet e-mail är redan registrerad." },
                                 { status: 400 });
    }

    // Insert user
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password
    })

    if (authError) {
      return NextResponse.json(
        { success: false, 
          message: "Kunde inte lägga till användare. supabase-fel: " + authError.message },
        { status: 500 }
      );
    }

    if (!authData.user) {
      return NextResponse.json({ success: false, 
                                 message: "Kunde inte skapa användare: " + JSON.stringify(authData) }, 
                                 { status: 500 });
    }

    // Add role to user in User table
    const { error: userError } = await supabase
      .from('User')
      .update({ role })
      .eq('id', authData.user.id)

    if (userError) {
      console.error("Couldn't add role: ", userError.message);
      return NextResponse.json({ success: false,
                                 message: "Kunde inte lägga till roll."},
                                { status: 500});
    }

    return NextResponse.json({ success: true,
                               message: "Skapade användare. Verifierings-mail skickat till angiven e-post" },
                              { status: 200 });

  } catch (error) {
    console.error(error);
    return NextResponse.json({ success: false, 
                               message: "Kunde inte skapa användare." },
                               { status: 500 });
  }
}