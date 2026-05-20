import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://dgorxcykntoibkqsaorh.supabase.co";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "sb_publishable_jDPK7cSaGQPQiSjOW2lQYw_N-PL0fZT";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
