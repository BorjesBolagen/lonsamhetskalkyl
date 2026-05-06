import { redirect } from "next/navigation";
import { getSupabaseServerClient } from "@/lib/supabaseServer";

/**
 * This is the main page of the application and only redirects users to either login or home.
 * It checks if the user is authenticated by retrieving the auth-cookies from Supabase.
 */
export default async function Home() {
  const supabase = await getSupabaseServerClient();
  const { data } = await supabase.auth.getClaims();

  if (data?.claims) {
    redirect("/home");
  }

  redirect("/login");
}
