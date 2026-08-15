import TypewriterPhrase, { TYPEWRITER_PHRASES } from './TypewriterPhrase';
import HeroVisual from './HeroVisual';

export type LevelCategory = 'تحضيري' | 'ابتدائي' | 'متوسط';

const LEVEL_CHIPS: { value: LevelCategory; label: string; icon: string }[] = [
  { value: 'تحضيري', label: 'تحضيري', icon: '🎨' },
  { value: 'ابتدائي', label: 'ابتدائي', icon: '📚' },
  { value: 'متوسط', label: 'متوسط', icon: '🎓' },
];

// معرّف القسم الحالي فعليًا في الصفحة (فلترة الأطوار التعليمية) — يُستخدم للتمرير السلس
// من زر "اكتشف حسب الطور" دون اختراع أي مسار/Route جديد غير موجود في المشروع.
const EDUCATION_LEVELS_SECTION_ID = 'education-levels';

interface HeroSectionProps {
  onBrowseProducts: () => void;
  onSelectLevel: (category: LevelCategory) => void;
}

export default function HeroSection({ onBrowseProducts, onSelectLevel }: HeroSectionProps) {
  const handleDiscoverByLevel = () => {
    document.getElementById(EDUCATION_LEVELS_SECTION_ID)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-[#071226] via-[#0B1833] to-[#183C6B] text-white">
      {/* توهجات زخرفية خفيفة جدًا خلف المحتوى — لا تؤثر على تباين النص */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-24 -left-24 h-72 w-72 rounded-full bg-amber-400/10 blur-3xl" />
        <div className="absolute top-1/3 -right-24 h-80 w-80 rounded-full bg-blue-400/10 blur-3xl" />
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 pt-5 pb-6 sm:pt-9 sm:pb-11 lg:pt-16 lg:pb-20">
        <div className="flex flex-col lg:flex-row lg:items-center gap-6 lg:gap-12">
          {/* ── منطقة النص — 54% تقريبًا على الديسكتوب ── */}
          <div className="lg:w-[54%]">
            <h1 className="miraj-rise text-[1.55rem] leading-[1.3] sm:text-4xl sm:leading-tight lg:text-5xl xl:text-[3.1rem] font-extrabold">
              أدوات تعليمية مبتكرة لأساتذة المستقبل
            </h1>

            <div className="miraj-rise miraj-delay-1 mt-2.5 sm:mt-4 flex flex-wrap items-baseline gap-x-2 gap-y-1 text-base sm:text-xl lg:text-2xl font-bold text-blue-100">
              <span>كل ما يحتاجه الأستاذ لـ</span>
              <TypewriterPhrase />
            </div>
            {/* نص بديل ثابت لقارئات الشاشة (العبارة المتحركة أعلاه aria-hidden) */}
            <span className="sr-only">
              كل ما يحتاجه الأستاذ لـ {TYPEWRITER_PHRASES.join('، ')}.
            </span>

            <p className="miraj-rise miraj-delay-2 mt-3 sm:mt-6 max-w-xl text-sm sm:text-base lg:text-lg text-blue-100/90 leading-relaxed">
              نقدّم للأساتذة أدوات تعليمية تفاعلية تساعدهم على تحضير الدروس، وتجعل التلاميذ أكثر تفاعلاً وانخراطًا في العملية التعليمية.
            </p>

            <div className="miraj-rise miraj-delay-3 mt-4 sm:mt-7 lg:mt-8 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={onBrowseProducts}
                className="inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white px-7 sm:px-9 py-3.5 sm:py-4 rounded-2xl font-bold text-base sm:text-lg shadow-xl shadow-amber-950/40 ring-1 ring-amber-300/40 transition-all duration-200 hover:scale-[1.03] active:scale-[0.99] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300"
              >
                <span aria-hidden="true">🛍️</span>
                <span>تصفح المنتجات</span>
              </button>
              <button
                type="button"
                onClick={handleDiscoverByLevel}
                className="inline-flex items-center gap-1.5 bg-white/5 hover:bg-white/10 border border-white/20 hover:border-white/40 text-white/85 hover:text-white px-4 sm:px-5 py-3 sm:py-3.5 rounded-2xl font-semibold text-sm backdrop-blur-sm transition-all duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/60"
              >
                <span>اكتشف حسب الطور</span>
                <span aria-hidden="true">←</span>
              </button>
            </div>

            <div className="miraj-rise miraj-delay-4 mt-3 sm:mt-6 flex flex-wrap gap-2">
              {LEVEL_CHIPS.map(chip => (
                <button
                  key={chip.value}
                  type="button"
                  onClick={() => onSelectLevel(chip.value)}
                  className="inline-flex items-center gap-1.5 bg-white/10 hover:bg-white/20 border border-white/20 hover:border-amber-300/60 text-white/90 hover:text-white text-xs sm:text-sm font-bold px-3.5 py-2 rounded-full transition-all duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-300"
                >
                  <span aria-hidden="true">{chip.icon}</span>
                  <span>{chip.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* ── منطقة الصور — 46% تقريبًا على الديسكتوب ── */}
          <div className="lg:w-[46%]">
            <HeroVisual />
          </div>
        </div>
      </div>
    </section>
  );
}
