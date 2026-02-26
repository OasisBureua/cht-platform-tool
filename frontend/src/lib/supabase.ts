import { createClient } from '@supabase/supabase-js';

// Base URL for GoTrue (client appends /auth/v1)
// VITE_SUPABASE_ANON_KEY must be set - get valid JWT from MediaHub/CHM team (signed with GoTrue secret)
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://mediahub.communityhealth.media';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
if (!supabaseAnonKey) {
  throw new Error('VITE_SUPABASE_ANON_KEY is required. Get valid JWT from MediaHub/CHM team.');
}
export const supabase = createClient(supabaseUrl, supabaseAnonKey);
