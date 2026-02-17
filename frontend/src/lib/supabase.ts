import { createClient } from '@supabase/supabase-js';

// Base URL for GoTrue (client appends /auth/v1)
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://mediahub.communityhealth.media';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzA2NzQ1NjAwLCJleHAiOjE4NjQ1MTIwMDB9.bNuR9BoKqMlWQJKTcECGf59hVyj2MZGs0aKbBNAExtM';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
