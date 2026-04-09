"use server";

import type { User } from "../databaseTypes";
import type { BasicResponse } from "../returnTypes";
import { Database } from "../supabaseServerSchema";
import { createServerClient } from "@supabase/ssr/dist/main/createServerClient";

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
    .single();

  if (userError) throw new Error("Oväntat fel: " + userError.message);

  return { status: true, message: "Användare hämtad", data: userData };
}