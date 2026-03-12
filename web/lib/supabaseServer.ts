import "server-only";
import { createClient } from "@supabase/supabase-js";

type Database = {
  public: {
    Tables: {
      
      messages: {
        Row: {
          id: number;
          message: string;
          sent_at: string | null;
          created_at: string;
        };
        Insert: {
          message: string;
          sent_at?: string | null;
        };
        Update: {
          message?: string;
          sent_at?: string | null;
        };
        Relationships: [];
      };

      test: {
        Row: {
          name: string;
          password: string;
        };
        Insert: {
          name: string;
          password: string;
        };
        Update: {
          name?: string;
          password?: string;
        };
        Relationships: [];
      };

    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

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
