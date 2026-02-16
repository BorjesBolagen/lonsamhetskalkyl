import { createClient } from '@supabase/supabase-js'

// Supabase-klienten används av backend för alla databasanrop
// Använd environment variables för att skydda service role key
export const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)
