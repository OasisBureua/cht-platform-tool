import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://mediahub.communityhealth.media';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

/** Null when anon key is unset (local dev). OAuth URLs live in `supabase-oauth.ts`. */
export const supabase: SupabaseClient | null = supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: { detectSessionInUrl: false },
    })
  : null;
