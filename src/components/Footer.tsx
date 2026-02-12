import { Logo } from './Logo';
import { Mail, Phone, MapPin } from 'lucide-react';

interface FooterProps {
  onNavigate?: (view: string) => void;
}

export function Footer({ onNavigate }: FooterProps) {
  return (
    <footer className="bg-gradient-to-b from-royal-900 to-royal-950 text-white">
      {/* Newsletter */}
      <div className="border-b border-royal-800">
        <div className="max-w-7xl mx-auto px-4 py-12">
          <div className="bg-gradient-to-l from-royal-800 to-royal-700 rounded-3xl p-8 md:p-12 flex flex-col md:flex-row items-center gap-8">
            <div className="flex-1 text-center md:text-right">
              <h3 className="text-2xl font-bold mb-2">اشترك في نشرتنا البريدية</h3>
              <p className="text-royal-200/70 text-sm">احصل على أحدث العروض والمنتجات التعليمية مباشرة في بريدك</p>
            </div>
            <div className="flex gap-3 w-full md:w-auto">
              <input
                type="email"
                placeholder="بريدك الإلكتروني"
                className="flex-1 md:w-64 px-5 py-3 rounded-xl bg-royal-900/50 border border-royal-600 text-white placeholder:text-royal-300/50 focus:outline-none focus:border-gold-500 transition-colors text-sm"
              />
              <button className="bg-gradient-to-l from-gold-500 to-gold-400 hover:from-gold-400 hover:to-gold-300 text-royal-900 font-bold px-6 py-3 rounded-xl transition-all text-sm whitespace-nowrap">
                اشترك
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Footer */}
      <div className="max-w-7xl mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10">
          {/* About */}
          <div className="space-y-4">
            <Logo size="sm" />
            <p className="text-royal-200/60 text-sm leading-relaxed mt-4">
              المعراج — متجر متخصص في الوسائل التعليمية لأساتذة اللغة الإنجليزية والفرنسية. فلاش كاردز احترافية مصممة لتنشيط الحصص وتحقيق أهداف التعلم. توصيل لجميع ولايات الجزائر عبر Noest 🇩🇿
            </p>
            <div className="flex gap-3 pt-2">
              {['𝕏', 'f', 'in', '📷'].map((social, i) => (
                <button key={i} className="w-9 h-9 bg-royal-800 hover:bg-royal-700 rounded-lg flex items-center justify-center text-sm text-royal-300 hover:text-gold-400 transition-all">
                  {social}
                </button>
              ))}
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="font-bold text-gold-400 mb-4">روابط سريعة</h4>
            <ul className="space-y-3">
              {[
                { label: 'الرئيسية', view: 'home' },
                { label: 'المنتجات', view: 'products' },
                { label: 'تتبع الطلب', view: 'tracking' },
                { label: 'سياسة الإرجاع', view: 'home' },
                { label: 'الشروط والأحكام', view: 'home' },
              ].map((link, i) => (
                <li key={i}>
                  <button
                    onClick={() => onNavigate?.(link.view)}
                    className="text-sm text-royal-200/60 hover:text-gold-400 transition-colors"
                  >
                    {link.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* Categories */}
          <div>
            <h4 className="font-bold text-gold-400 mb-4">الفئات</h4>
            <ul className="space-y-3">
              {['رياض الأطفال', 'الصف الثالث', 'المرحلة الابتدائية', 'المرحلة المتوسطة', 'بطاقات ثنائية اللغة'].map((cat, i) => (
                <li key={i}>
                  <button
                    onClick={() => onNavigate?.('products')}
                    className="text-sm text-royal-200/60 hover:text-gold-400 transition-colors"
                  >
                    {cat}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="font-bold text-gold-400 mb-4">تواصل معنا</h4>
            <ul className="space-y-4">
              <li className="flex items-start gap-3">
                <MapPin className="w-4 h-4 text-gold-500 mt-1 flex-shrink-0" />
                <span className="text-sm text-royal-200/60">الجزائر العاصمة، الجزائر 🇩🇿</span>
              </li>
              <li className="flex items-center gap-3">
                <Phone className="w-4 h-4 text-gold-500 flex-shrink-0" />
                <span className="text-sm text-royal-200/60" dir="ltr">0555-XX-XX-XX</span>
              </li>
              <li className="flex items-center gap-3">
                <Mail className="w-4 h-4 text-gold-500 flex-shrink-0" />
                <span className="text-sm text-royal-200/60">info@almiraj.dz</span>
              </li>
            </ul>
            {/* Delivery & Payment */}
            <div className="mt-6 space-y-3">
              <div>
                <h5 className="text-xs text-royal-300/50 mb-2">شركة التوصيل</h5>
                <div className="flex gap-2 flex-wrap">
                  <span className="text-[11px] bg-royal-800 text-royal-200 px-3 py-2 rounded-lg font-medium flex items-center gap-2">
                    🚚 Noest
                  </span>
                </div>
                <p className="text-[10px] text-royal-300/40 mt-1.5">توصيل سريع لجميع 58 ولاية • API متكامل</p>
              </div>
              <div>
                <h5 className="text-xs text-royal-300/50 mb-2">طريقة الدفع</h5>
                <div className="flex gap-2">
                  <span className="text-[10px] bg-green-900/50 text-green-300 px-3 py-1.5 rounded-lg font-bold">
                    💰 الدفع عند الاستلام
                  </span>
                </div>
              </div>
              <div>
                <button
                  onClick={() => onNavigate?.('tracking')}
                  className="text-[11px] bg-blue-900/40 text-blue-300 hover:bg-blue-900/60 px-3 py-2 rounded-lg font-medium transition-all flex items-center gap-2"
                >
                  📦 تتبع طلبك عبر Noest
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom */}
      <div className="border-t border-royal-800">
        <div className="max-w-7xl mx-auto px-4 py-5 flex flex-col sm:flex-row items-center justify-between gap-3">
          <span className="text-xs text-royal-300/40">
            © 2024 المعراج للمنتجات التعليمية. جميع الحقوق محفوظة.
          </span>
          <span className="text-xs text-royal-300/40">
            صُنع بـ ❤️ في الجزائر لخدمة الأساتذة 🇩🇿
          </span>
        </div>
      </div>
    </footer>
  );
}
