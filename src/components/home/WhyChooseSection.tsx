// أيقونات بسيطة واحترافية (Line icons) — بدون Emojis وبدون رسوم طفولية
function DidacticCheckIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6">
      <path d="M8 3.5H6.5A1.5 1.5 0 0 0 5 5v14a1.5 1.5 0 0 0 1.5 1.5h11A1.5 1.5 0 0 0 19 19V5a1.5 1.5 0 0 0-1.5-1.5H16" />
      <rect x="8" y="2.5" width="8" height="3.5" rx="1" />
      <path d="m8.5 13 2.2 2.2L15.5 10.5" />
    </svg>
  );
}

function ReadyToUseIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6">
      <circle cx="12" cy="13" r="8" />
      <path d="M12 9v4l2.7 2.7" />
      <path d="M9.5 2.5h5" />
    </svg>
  );
}

function LocalFitIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6">
      <path d="M12 21.5s-7-6.1-7-11.7a7 7 0 0 1 14 0c0 5.6-7 11.7-7 11.7Z" />
      <circle cx="12" cy="9.8" r="2.6" />
    </svg>
  );
}

const BENEFITS = [
  {
    Icon: DidacticCheckIcon,
    title: 'مطابقة للدليل الديداكتيكي',
    desc: 'محتوى ووسائل مصممة لتنسجم مع متطلبات الدروس.',
  },
  {
    Icon: ReadyToUseIcon,
    title: 'جاهزة للاستعمال',
    desc: 'وسائل عملية تقلل وقت التحضير وتساعد الأستاذ داخل القسم.',
  },
  {
    Icon: LocalFitIcon,
    title: 'مصممة للأستاذ الجزائري',
    desc: 'منتجات تراعي المنهاج وواقع القسم الجزائري.',
  },
];

/**
 * قسم "لماذا يختار الأساتذة المعراج؟" — يُعرض مباشرة بعد الـHero.
 * تصميم يكمل هوية الـHero (Navy/White/Gold) ببطاقات هادئة الحجم، Icons بسيطة بدل Emojis،
 * وHover خفيف على Desktop فقط.
 */
export default function WhyChooseSection() {
  return (
    <section className="bg-white py-8 sm:py-14 px-4 border-b border-gray-100">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-5 sm:mb-10">
          <h2 className="text-xl sm:text-3xl font-extrabold text-[#0B1833]">لماذا يختار الأساتذة المعراج؟</h2>
          <span aria-hidden="true" className="block w-12 h-1 rounded-full bg-amber-500 mx-auto mt-3" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-6">
          {BENEFITS.map((b, i) => (
            <div
              key={i}
              className="rounded-2xl border border-gray-100 bg-white shadow-sm px-5 py-3.5 sm:px-6 sm:py-6 transition-all duration-200 sm:hover:shadow-md sm:hover:-translate-y-0.5 sm:hover:border-amber-200"
            >
              <div className="h-10 w-10 sm:h-11 sm:w-11 rounded-xl bg-[#0B1833]/5 text-[#0B1833] flex items-center justify-center mb-2.5 sm:mb-4">
                <b.Icon />
              </div>
              <h3 className="font-bold text-[#0B1833] text-base sm:text-lg mb-1">{b.title}</h3>
              <p className="text-gray-500 text-sm leading-relaxed">{b.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
