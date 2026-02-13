import { createClient } from '@supabase/supabase-js';

// قراءة متغيرات البيئة من Vite
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// فقط من أجل التشخيص – لنرى القيم في الـ Console
console.log('VITE_SUPABASE_URL =', supabaseUrl);
console.log(
  'VITE_SUPABASE_ANON_KEY length =',
  supabaseAnonKey ? supabaseAnonKey.length : 0
);

// متغير يمكن أن يكون null إذا لم تُضبط Supabase
let supabase: ReturnType<typeof createClient> | null = null;

// لا ننشئ العميل إلا إذا كانت القيم صحيحة
if (
  typeof supabaseUrl === 'string' &&
  supabaseUrl.startsWith('https') &&
  typeof supabaseAnonKey === 'string' &&
  supabaseAnonKey.length > 0
) {
  supabase = createClient(supabaseUrl, supabaseAnonKey);
}

export { supabase };

// true فقط إذا تم إنشاء supabase بنجاح
export const isSupabaseConfigured = !!supabase;
