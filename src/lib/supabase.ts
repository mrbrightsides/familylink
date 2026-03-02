import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || import.meta.env?.VITE_SUPABASE_URL || '';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || import.meta.env?.VITE_SUPABASE_ANON_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
