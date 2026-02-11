import { createClient } from '@supabase/supabase-js';

// Base URL for GoTrue (client appends /auth/v1)
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://mediahub.communityhealth.media';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'public';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
