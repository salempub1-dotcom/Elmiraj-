
import { createClient } from '@supabase/supabase-js';

// نفترض أن القيم موجودة في متغيرات البيئة (Vercel)
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

// إنشاء عميل Supabase مباشرة
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// اعتبر أن Supabase مُعَدّ دائمًا (لأننا وضعنا المتغيرات في Vercel)
export const isSupabaseConfigured = true;
