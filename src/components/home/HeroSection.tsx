import TypewriterPhrase, { TYPEWRITER_PHRASES } from './TypewriterPhrase';

export type LevelCategory = 'تحضيري' | 'ابتدائي' | 'متوسط';

const LEVEL_CHIPS: { value: LevelCategory; label: string; icon: string }[] = [
  { value: 'تحضيري', label: 'تحضيري', icon: '🎨' },
  { value: 'ابتدائي', label: 'ابتدائي', icon: '📚' },
  { value: 'متوسط', label: 'متوسط', icon: '🎓' },
];

const EDUCATION_LEVELS_SECTION_ID = 'education-levels';
const MOBILE_HERO_IMAGE = '/images/hero-mobile-classroom.webp';
const DESKTOP_HERO_IMAGE = '/images/hero-desktop-classroom.webp';

interface HeroSectionProps {
  onBrowseProducts: () => void;
  onSelectLevel: (category: LevelCategory) => void;
}

export default function HeroSection({ onBrowseProducts, onSelectLevel }: HeroSectionProps) {
  const handleDiscoverByLevel = () => {
    document.getElementById(EDUCATION_LEVELS_SECTION_ID)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <section className="relative isolate overflow-hidden bg-[#071226] text-white">
      {/* One responsive visual per breakpoint: portrait on phones, wide classroom on larger screens. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-[clamp(238px,65vw,280px)] overflow-hidden bg-[#071226] sm:inset-0 sm:h-full">
        <picture>
          <source media="(max-width: 639px)" srcSet={MOBILE_HERO_IMAGE} />
          <img
            src={DESKTOP_HERO_IMAGE}
            alt=""
            aria-hidden="true"
            loading="eager"
            fetchPriority="high"
            decoding="async"
            className="absolute inset-0 h-full w-full select-none object-cover object-[50%_42%] sm:object-center"
          />
        </picture>

        {/* Mobile: let the classroom remain fully visible across the phone width, then dissolve into navy. */}
        <div
          className="absolute inset-0 sm:hidden"
          style={{
            background:
              'linear-gradient(180deg, rgba(7,18,38,.02) 0%, rgba(7,18,38,.05) 45%, rgba(7,18,38,.42) 72%, rgba(7,18,38,.88) 91%, #071226 100%)',
          }}
        />
        <div
          className="absolute inset-0 sm:hidden"
          style={{
            background:
              'linear-gradient(270deg, rgba(7,18,38,.16) 0%, rgba(7,18,38,.04) 55%, rgba(7,18,38,0) 100%)',
          }}
        />
      </div>

      {/* Desktop/tablet: the wide image already leaves breathing room on the right; the gradient protects Arabic copy. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 hidden sm:block"
        style={{
          background:
            'linear-gradient(270deg, #071226 0%, rgba(7,18,38,.97) 27%, rgba(11,24,51,.86) 43%, rgba(11,24,51,.48) 63%, rgba(11,24,51,.10) 82%, rgba(11,24,51,0) 100%)',
        }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 hidden sm:block"
        style={{ background: 'linear-gradient(180deg, rgba(7,18,38,.06), rgba(7,18,38,.17))' }}
      />

      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-20 -right-14 h-64 w-64 rounded-full bg-amber-400/[0.05] blur-3xl" />
      </div>

      <div className="relative z-10 mx-auto flex min-h-[600px] max-w-7xl items-start px-4 pb-5 pt-[clamp(205px,55vw,235px)] sm:min-h-[570px] sm:items-center sm:px-6 sm:py-10 lg:min-h-[640px] lg:py-14">
        <div className="ml-auto w-full text-right sm:w-[66%] lg:w-[57%] xl:w-[54%]">
          <div className="mb-3 hidden items-center justify-start gap-3 text-sm font-bold text-amber-400/90 sm:flex">
            <span className="h-px w-16 bg-amber-400/80" />
            <span>المعراج للتعليم</span>
          </div>

          <h1 className="miraj-rise max-w-3xl text-[1.78rem] font-extrabold leading-[1.17] tracking-[-0.02em] drop-shadow-[0_3px_18px_rgba(0,0,0,.50)] min-[390px]:text-[1.98rem] sm:text-4xl sm:leading-tight sm:tracking-normal lg:text-5xl xl:text-[3.25rem]">
            <span className="block">أدوات تعليمية مبتكرة</span>
            <span className="mt-1 block text-amber-400">لأساتذة المستقبل</span>
          </h1>

          <div className="miraj-rise miraj-delay-1 mt-2.5 flex min-h-7 flex-wrap items-baseline justify-start gap-x-1.5 gap-y-1 text-[0.9rem] font-bold text-blue-100 min-[390px]:text-[0.98rem] sm:mt-4 sm:gap-x-2 sm:text-xl lg:text-2xl">
            <span>كل ما يحتاجه الأستاذ لـ</span>
            <TypewriterPhrase />
          </div>
          <span className="sr-only">كل ما يحتاجه الأستاذ لـ {TYPEWRITER_PHRASES.join('، ')}.</span>

          <p className="miraj-rise miraj-delay-2 mt-2.5 text-[0.8rem] leading-[1.72] text-blue-50/90 drop-shadow-sm sm:hidden">
            أدوات تعليمية تفاعلية تساعد الأستاذ على التحضير وتجعل الدرس أكثر وضوحًا وتفاعلًا.
          </p>
          <p className="miraj-rise miraj-delay-2 mt-6 hidden max-w-xl text-base leading-relaxed text-blue-50/90 drop-shadow-sm sm:block lg:text-lg">
            نقدّم للأساتذة أدوات تعليمية تفاعلية تساعدهم على تحضير الدروس، وتجعل التلاميذ أكثر تفاعلاً وانخراطًا في العملية التعليمية.
          </p>

          <div className="miraj-rise miraj-delay-3 mt-3.5 grid w-full grid-cols-1 gap-2 sm:mt-7 sm:flex sm:flex-wrap sm:items-center sm:gap-3 lg:mt-8">
            <button
              type="button"
              onClick={onBrowseProducts}
              className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-amber-500 px-5 py-3 text-base font-bold text-white shadow-xl shadow-black/25 ring-1 ring-amber-300/45 transition-all duration-200 active:scale-[0.985] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300 sm:min-h-0 sm:w-auto sm:px-9 sm:py-4 sm:text-lg sm:hover:-translate-y-0.5 sm:hover:bg-amber-600"
            >
              <span aria-hidden="true">🛍️</span>
              <span>تصفح المنتجات</span>
            </button>
            <button
              type="button"
              onClick={handleDiscoverByLevel}
              className="inline-flex min-h-10 w-full items-center justify-center gap-1.5 rounded-xl border border-white/25 bg-white/[0.045] px-4 py-2 text-[0.82rem] font-semibold text-white/95 backdrop-blur-[2px] transition-all duration-200 active:scale-[0.985] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/60 sm:min-h-0 sm:w-auto sm:bg-[#071226]/55 sm:px-5 sm:py-3.5 sm:text-sm sm:hover:border-amber-300/60 sm:hover:bg-[#071226]/70"
            >
              <span>اكتشف حسب الطور</span>
              <span aria-hidden="true">←</span>
            </button>
          </div>

          <div className="miraj-rise miraj-delay-4 mt-2.5 grid grid-cols-3 gap-2 sm:mt-6 sm:flex sm:flex-wrap">
            {LEVEL_CHIPS.map(chip => (
              <button
                key={chip.value}
                type="button"
                onClick={() => onSelectLevel(chip.value)}
                className="inline-flex min-h-9 items-center justify-center gap-1 rounded-full border border-white/18 bg-white/[0.045] px-2 py-1.5 text-[0.7rem] font-bold text-white/92 backdrop-blur-[2px] transition-all duration-200 active:scale-[0.985] focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-300 min-[390px]:text-[0.74rem] sm:min-h-0 sm:bg-[#071226]/50 sm:px-3.5 sm:py-2 sm:text-sm sm:hover:border-amber-300/60 sm:hover:bg-[#071226]/65"
              >
                <span aria-hidden="true">{chip.icon}</span>
                <span>{chip.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
