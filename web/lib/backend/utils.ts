"use server";

import type { User } from "../databaseTypes";
import type { BasicResponse } from "../returnTypes";
import { Database } from "../supabaseServerSchema";
import { createServerClient } from "@supabase/ssr/dist/main/createServerClient";
import { getSupabaseServerClient } from "@/lib/supabaseServer";

type SupabaseServerClient = ReturnType<typeof createServerClient<Database>>;

/**
 * Helper function to get the currently signed in user
 * @param supabase 
 * @returns json(
 *      status: boolean,
 *      message: string,
 *      data: User
 * )
 * @throws Error if user is not signed in or if there is an unexpected error during the process
 */
export async function getCurrentUser(supabase: SupabaseServerClient): Promise<BasicResponse<User>> {

  // Get auth user
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error) throw new Error("Oväntat fel: " + error.message);
  if (!user) throw new Error("Du måste vara inloggad.");

  // Query user table
  const { data: userData, error: userError } = await supabase
    .from("User")
    .select("*")
    .eq("id", user.id)
    .maybeSingle()
  
  if (userError) throw new Error("Oväntat fel: " + userError.message + ". " + userError.details);

  if (!userData) throw new Error("Kunde inte hämta inloggad användare");

  return { status: true, message: "Användare hämtad", data: userData };
}

/**
 * Rundar upp en vikt till lägsta vikt i nästa viktklass
 * @param weight vikt att hitta vikt+1 för
 * @returns vikt som ett nummer, -1 om fel uppstår
 */
export async function roundUpWeight(weight: number): Promise<number> {

  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase.rpc("round_up_weight", {
    input_weight: weight
  });

  if (error) {
    console.error("Kunde inte konvertera vikt till viktklass: ", error.message);
    return -1;
  }

  const viktklass = Number(data);
  return viktklass;

}

