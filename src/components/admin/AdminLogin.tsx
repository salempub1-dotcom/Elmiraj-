import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Lock, Mail, Loader2, AlertCircle } from 'lucide-react';
import { Logo } from '../Logo';

interface AdminLoginProps {
  onLogin: () => void;
}

export function AdminLogin({ onLogin }: AdminLoginProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) {
      setError('Supabase غير مُعدّ. تحقق من متغيرات البيئة.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (authError) {
        if (authError.message.includes('Invalid login')) {
          setError('البريد الإلكتروني أو كلمة المرور غير صحيحة');
        } else {
          setError(authError.message);
        }
        return;
      }

      onLogin();
    } catch {
      setError('حدث خطأ في الاتصال. حاول مرة أخرى.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-royal-900 via-royal-800 to-royal-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-block mb-4">
            <Logo size="lg" />
          </div>
          <h1 className="text-2xl font-black text-white mb-2">لوحة التحكم</h1>
          <p className="text-royal-200/60 text-sm">سجّل الدخول لإدارة المنتجات</p>
        </div>

        <form onSubmit={handleLogin} className="bg-white rounded-3xl shadow-2xl p-8 space-y-6">
          {error && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-sm animate-fade-in-up">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
              <Mail className="w-4 h-4 text-royal-500" />
              البريد الإلكتروني
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="admin@example.com"
              className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-royal-500 focus:ring-4 focus:ring-royal-100 outline-none transition-all text-sm"
              dir="ltr"
              required
            />
          </div>

          <div>
            <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
              <Lock className="w-4 h-4 text-royal-500" />
              كلمة المرور
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-royal-500 focus:ring-4 focus:ring-royal-100 outline-none transition-all text-sm"
              dir="ltr"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-l from-royal-700 to-royal-600 hover:from-royal-600 hover:to-royal-500 disabled:from-gray-300 disabled:to-gray-300 text-white py-4 rounded-xl font-bold transition-all shadow-lg flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                جاري تسجيل الدخول...
              </>
            ) : (
              <>
                <Lock className="w-5 h-5" />
                تسجيل الدخول
              </>
            )}
          </button>

          <p className="text-center text-xs text-gray-400">
            🔒 لوحة التحكم محمية ومخصصة للمشرفين فقط
          </p>
        </form>
      </div>
    </div>
  );
}
