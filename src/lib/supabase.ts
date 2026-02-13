import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// للتشخيص - يمكن حذفها لاحقاً
console.log('VITE_SUPABASE_URL =', supabaseUrl);
console.log('VITE_SUPABASE_ANON_KEY length =', supabaseAnonKey ? supabaseAnonKey.length : 0);

let supabase: any = null;

if (
  typeof supabaseUrl === 'string' &&
  supabaseUrl.startsWith('https') &&
  typeof supabaseAnonKey === 'string' &&
  supabaseAnonKey.length > 0
) {
  supabase = createClient(supabaseUrl, supabaseAnonKey);
}

export { supabase };
export const isSupabaseConfigured = !!supabase;
