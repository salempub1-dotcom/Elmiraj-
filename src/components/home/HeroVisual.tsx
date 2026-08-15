import { useState } from 'react';

/**
 * 🖼️ صور الـHero — جاهزة لاستقبال صورتين حقيقيتين
 * ─────────────────────────────────────────────────────────────
 * تم فحص المشروع بالكامل (public/, src/, وكل مسارات الصور) ولم يتم العثور على أي صورة حقيقية
 * لأستاذ/ة داخل القسم أو صور فعلية لمنتجات المعراج مخزّنة في المستودع (الشعار فقط رابط خارجي ثابت).
 * صور initialProducts هي صور Unsplash عامة (Placeholder demo) وليست صورًا حقيقية للمعراج —
 * لذلك لم تُستخدم هنا، ولم يُستخدم أي Hotlink عشوائي من الإنترنت.
 *
 * الحل: هذا المكوّن يحاول تحميل الصورتين الحقيقيتين مباشرة من المسارين التاليين. طالما
 * الملفان غير موجودين، يظهر تكوين بصري (SVG/CSS) أنيق بهوية الموقع كـPlaceholder مؤقت فقط
 * (وليس تصميمًا نهائيًا). بمجرد إضافة الملفين الحقيقيين إلى المشروع، ستظهر الصورتان تلقائيًا
 * بدون أي تعديل إضافي على الكود:
 *
 *   1) صورة الأستاذة داخل القسم  →  public/images/hero-teacher.webp
 *   2) صورة منتجات المعراج الحقيقية →  public/images/hero-products.webp
 *
 * (يفضَّل مقاس ~1000×1250px تقريبًا للصورة الأولى (عمودية) و~800×500px للثانية، بصيغة webp
 * مضغوطة لأداء أفضل — لكن أي مقاس معقول يعمل بفضل object-fit: cover).
 */
const HERO_TEACHER_IMAGE_SRC = '/images/hero-teacher.webp';
const HERO_PRODUCTS_IMAGE_SRC = '/images/hero-products.webp';

type ImgStatus = 'loading' | 'loaded' | 'error';

function ClassroomIllustration() {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6 sm:p-8">
      {/* نسيج نقطي خفيف جدًا لإضفاء عمق بصري بسيط */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.07]"
        style={{ backgroundImage: 'radial-gradient(circle, #ffffff 1px, transparent 1px)', backgroundSize: '18px 18px' }}
      />
      {/* سبورة القسم مع بطاقات تعليمية */}
      <div className="relative w-full max-w-[230px] sm:max-w-[260px] aspect-[4/3] bg-white rounded-2xl shadow-lg border-4 border-white/85">
        <div className="h-full w-full rounded-lg border border-dashed border-blue-200 flex items-center justify-center gap-2 sm:gap-3 p-3">
          {[
            { emoji: '🔤', bg: 'bg-rose-100', rotate: '-rotate-6' },
            { emoji: '🔢', bg: 'bg-sky-100', rotate: '-translate-y-1.5' },
            { emoji: '🔺', bg: 'bg-amber-100', rotate: 'rotate-6' },
          ].map((card, i) => (
            <div key={i} className={`${card.bg} ${card.rotate} rounded-lg shadow-sm px-2.5 py-3 sm:px-3 sm:py-4 text-lg sm:text-xl leading-none`}>
              {card.emoji}
            </div>
          ))}
        </div>
        <div aria-hidden="true" className="absolute -bottom-3 left-1/2 -translate-x-1/2 h-2.5 w-16 bg-[#0B1833]/30 rounded-b-md blur-[1px]" />
      </div>
      {/* شارة توضيحية — تختفي تلقائيًا فور توفر الصورة الحقيقية */}
      <div className="relative bg-white/10 border border-white/20 text-white/90 text-[11px] sm:text-xs font-bold px-3 py-1.5 rounded-full backdrop-blur-sm">
        📍 وسيلة تعليمية داخل القسم — صورة مؤقتة بانتظار التصوير الفعلي
      </div>
    </div>
  );
}

function ProductStackIllustration() {
  return (
    <div className="flex items-center gap-3">
      <div className="relative h-16 w-14 sm:h-20 sm:w-16 shrink-0" aria-hidden="true">
        <div className="absolute inset-0 translate-x-1 translate-y-1 rotate-6 rounded-lg bg-amber-100 shadow-sm" />
        <div className="absolute inset-0 -translate-x-0.5 -rotate-3 rounded-lg bg-sky-100 shadow-sm" />
        <div className="absolute inset-0 rounded-lg bg-white shadow-md border border-gray-100 flex items-center justify-center text-xl sm:text-2xl">
          🗂️
        </div>
      </div>
      <div className="min-w-0">
        <p className="text-[#0B1833] font-extrabold text-xs sm:text-sm leading-tight">منتجات المعراج</p>
        <p className="text-gray-500 text-[11px] sm:text-xs mt-0.5 leading-snug">بطاقات تعليمية + خطط دروس جاهزة</p>
      </div>
    </div>
  );
}

/**
 * لوحة القسم / الأستاذة — تحاول تحميل /images/hero-teacher.webp، وتعرض الرسم التوضيحي
 * كخلفية بديلة إلى حين نجاح تحميل الصورة الحقيقية أو في حال فشل التحميل (404).
 */
function TeacherPanel() {
  const [status, setStatus] = useState<ImgStatus>('loading');
  const showIllustration = status !== 'loaded';

  return (
    <div className="miraj-rise miraj-delay-1 relative rounded-3xl border border-white/10 bg-gradient-to-br from-[#10254a] to-[#0B1833] shadow-2xl shadow-black/30 aspect-[4/5] sm:aspect-[5/6] lg:aspect-[4/5] overflow-hidden">
      {showIllustration && <ClassroomIllustration />}
      <img
        src={HERO_TEACHER_IMAGE_SRC}
        alt="أستاذة داخل القسم تستخدم وسيلة تعليمية من المعراج"
        className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-500 ${status === 'loaded' ? 'opacity-100' : 'opacity-0'}`}
        onLoad={() => setStatus('loaded')}
        onError={() => setStatus('error')}
        fetchPriority="high"
        decoding="async"
      />

      {/* شارة عائمة 1 — تظهر بجانب لوحة القسم من sm فأعلى فقط لتجنّب أي تراكب مع النص على الموبايل */}
      <div className="miraj-rise miraj-float miraj-delay-2 hidden sm:flex absolute top-4 -right-3 lg:-right-6 items-center gap-2 bg-white/95 backdrop-blur text-[#0B1833] text-xs font-bold px-3 py-2 rounded-xl shadow-lg border border-white/50 max-w-[170px]">
        <span className="text-emerald-500 shrink-0" aria-hidden="true">✓</span>
        <span>مطابق للدليل الديداكتيكي</span>
      </div>
    </div>
  );
}

/**
 * لوحة المنتجات — تتراكب مع لوحة القسم (أصغر، مع دوران خفيف وظل واضح لإحساس بالعمق)،
 * وتحاول تحميل /images/hero-products.webp بنفس منطق اللوحة الأولى.
 */
function ProductsPanel() {
  const [status, setStatus] = useState<ImgStatus>('loading');
  const showIllustration = status !== 'loaded';

  return (
    <div className="miraj-rise miraj-delay-2b relative sm:absolute sm:-bottom-6 sm:-left-6 lg:-bottom-8 lg:-left-10 mt-4 sm:mt-0 w-full sm:w-[72%] rounded-2xl bg-white shadow-xl shadow-black/25 border border-amber-100 p-3 sm:p-4 -rotate-1 ring-1 ring-black/5">
      {showIllustration && <ProductStackIllustration />}
      <img
        src={HERO_PRODUCTS_IMAGE_SRC}
        alt="منتجات المعراج للوسائل التعليمية: بطاقات وخطط دروس"
        className={`h-16 w-full sm:h-20 rounded-lg object-cover transition-opacity duration-500 ${status === 'loaded' ? 'opacity-100 block' : 'opacity-0 hidden'}`}
        onLoad={() => setStatus('loaded')}
        onError={() => setStatus('error')}
        loading="lazy"
        decoding="async"
      />
    </div>
  );
}

/**
 * التكوين البصري في الـHero: لوحة "القسم" الكبيرة (رئيسية) + لوحة "المنتجات" الأصغر المتراكبة
 * أسفلها، بالإضافة إلى شارتَي ثقة صغيرتين تطفوان بلطف حول اللوحتين (Desktop) أو تحتهما (Mobile).
 * Positioning منفصل لكل حجم شاشة عبر sm:/lg: — على الموبايل تُرصف اللوحتان عموديًا بدون أي
 * خروج عن حدود الشاشة، وعلى الديسكتوب تتراكبان بعمق واضح.
 */
export default function HeroVisual() {
  return (
    <div className="relative mx-auto max-w-[320px] sm:max-w-md lg:max-w-none">
      {/* توهج Navy/Gold خفيف جدًا خلف الصور — طبقتان لعمق أغنى دون المساس بالتباين */}
      <div aria-hidden="true" className="pointer-events-none absolute -inset-6 rounded-[2.5rem] bg-amber-400/10 blur-2xl" />
      <div aria-hidden="true" className="pointer-events-none absolute -inset-10 -z-10 rounded-[3rem] bg-blue-500/10 blur-3xl" />

      <div className="relative">
        <TeacherPanel />
        <ProductsPanel />

        {/* شارة عائمة 2 — Desktop فقط */}
        <div className="miraj-rise miraj-float miraj-delay-3 hidden lg:flex absolute -bottom-2 -right-6 items-center gap-2 bg-white/95 backdrop-blur text-[#0B1833] text-xs font-bold px-3 py-2 rounded-xl shadow-lg border border-white/50">
          <span aria-hidden="true">⏱️</span>
          <span>وفّر وقت التحضير</span>
        </div>
      </div>

      {/* شارتا الثقة على الموبايل فقط — تحت التكوين البصري بدل التعويم فوقه، حتى لا تغطي أي نص */}
      <div className="mt-4 flex sm:hidden flex-wrap justify-center gap-2">
        <span className="inline-flex items-center gap-1.5 bg-white/10 border border-white/20 text-white/90 text-[11px] font-bold px-3 py-1.5 rounded-full">
          <span className="text-emerald-400" aria-hidden="true">✓</span>
          مطابق للدليل الديداكتيكي
        </span>
        <span className="inline-flex items-center gap-1.5 bg-white/10 border border-white/20 text-white/90 text-[11px] font-bold px-3 py-1.5 rounded-full">
          <span aria-hidden="true">⏱️</span>
          وفّر وقت التحضير
        </span>
      </div>
    </div>
  );
}
