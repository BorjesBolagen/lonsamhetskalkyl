import "server-only";
import { createClient } from "@supabase/supabase-js";

type SupabaseClientFactory = ReturnType<typeof createClient>;

export const getSupabaseServerClient = (): SupabaseClientFactory => {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error("Missing Supabase server environment variables");
  }

  return createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { persistSession: false },
  });
};
