/** One Supabase client for the whole app (readers and admin share the sign-in). */
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_ANON_KEY, SUPABASE_URL } from '#lib/config.ts';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
