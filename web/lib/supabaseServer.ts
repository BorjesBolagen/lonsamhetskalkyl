import "server-only";
import { createClient } from "@supabase/supabase-js";
import { Database } from "@/lib/supabaseServerSchema";

type SupabaseClientFactory = ReturnType<typeof createClient<Database>>;

export const getSupabaseServerClient = (): SupabaseClientFactory => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error("Missing Supabase server environment variables");
  }

  return createClient<Database>(supabaseUrl, supabaseServiceRoleKey, {
    auth: { persistSession: false },
  });
};
