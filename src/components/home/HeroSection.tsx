import { useEffect, useState } from 'react';
import TypewriterPhrase, { TYPEWRITER_PHRASES } from './TypewriterPhrase';

export type LevelCategory = 'تحضيري' | 'ابتدائي' | 'متوسط';

const LEVEL_CHIPS: { value: LevelCategory; label: string; icon: string }[] = [
  { value: 'تحضيري', label: 'تحضيري', icon: '🎨' },
  { value: 'ابتدائي', label: 'ابتدائي', icon: '📚' },
  { value: 'متوسط', label: 'متوسط', icon: '🎓' },
];

const EDUCATION_LEVELS_SECTION_ID = 'education-levels';

// Use only two proven, already-served WebP assets from the storefront.
// Combined transfer is small enough for a premium hero while avoiding the previous broken preview assets.
const HERO_IMAGES = ['/images/hero-teacher.webp', '/images/hero-products.webp'] as const;

interface HeroSectionProps {
  onBrowseProducts: () => void;
  onSelectLevel: (category: LevelCategory) => void;
}

export default function HeroSection({ onBrowseProducts, onSelectLevel }: HeroSectionProps) {
  const [activeImage, setActiveImage] = useState(0);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setReduceMotion(media.matches);
    sync();
    media.addEventListener?.('change', sync);
    return () => media.removeEventListener?.('change', sync);
  }, []);

  useEffect(() => {
    if (reduceMotion) {
      setActiveImage(0);
      return;
    }

    const timer = window.setInterval(() => {
      setActiveImage(current => (current + 1) % HERO_IMAGES.length);
    }, 6500);

    return () => window.clearInterval(timer);
  }, [reduceMotion]);

  const handleDiscoverByLevel = () => {
    document.getElementById(EDUCATION_LEVELS_SECTION_ID)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <section className="relative isolate overflow-hidden bg-[#071226] text-white">
      {/*
        Cinematic partial-image treatment: photography occupies the left side only,
        then dissolves naturally into the Al Miraj navy identity behind the copy.
      */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden bg-[#071226]">
        {HERO_IMAGES.map((src, index) => {
          const isActive = index === activeImage;
          return (
            <img
              key={src}
              src={src}
              alt=""
              aria-hidden="true"
              loading={index === 0 ? 'eager' : 'lazy'}
              fetchPriority={index === 0 ? 'high' : 'auto'}
              decoding="async"
              style={{
                opacity: isActive ? 1 : 0,
                transform: reduceMotion ? 'scale(1.02)' : isActive ? 'scale(1.055)' : 'scale(1.02)',
                transition: reduceMotion
                  ? 'none'
                  : 'opacity 1200ms ease-in-out, transform 7600ms ease-out',
              }}
              className="absolute inset-y-0 left-0 h-full w-[76%] select-none object-cover object-center sm:w-[72%] lg:w-[68%] xl:w-[66%]"
            />
          );
        })}
      </div>

      {/* Hard guarantee that the image is never shown as a full-width wallpaper. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 right-0 w-[62%] sm:w-[58%] lg:w-[55%]"
        style={{
          background:
            'linear-gradient(270deg, #071226 0%, rgba(7,18,38,.99) 45%, rgba(11,24,51,.94) 68%, rgba(11,24,51,.58) 88%, rgba(11,24,51,0) 100%)',
        }}
      />

      {/* Soft veil over the visual edge so the merge feels photographic rather than like two columns. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'linear-gradient(270deg, rgba(7,18,38,.10) 0%, rgba(7,18,38,.08) 48%, rgba(7,18,38,.10) 62%, rgba(7,18,38,.24) 76%, rgba(7,18,38,.06) 100%)',
        }}
      />

      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-24 -right-16 h-72 w-72 rounded-full bg-amber-400/[0.055] blur-3xl" />
      </div>

      <div className="relative z-10 mx-auto flex min-h-[520px] max-w-7xl items-center px-4 py-7 sm:min-h-[570px] sm:px-6 sm:py-10 lg:min-h-[640px] lg:py-14">
        <div className="ml-auto w-full text-right sm:w-[70%] lg:w-[58%] xl:w-[56%]">
          <div className="mb-3 hidden items-center justify-start gap-3 text-sm font-bold text-amber-400/90 sm:flex">
            <span className="h-px w-16 bg-amber-400/80" />
            <span>المعراج للتعليم</span>
          </div>

          <h1 className="miraj-rise max-w-3xl text-[1.7rem] font-extrabold leading-[1.28] drop-shadow-[0_3px_18px_rgba(0,0,0,.42)] sm:text-4xl sm:leading-tight lg:text-5xl xl:text-[3.25rem]">
            <span className="block">أدوات تعليمية مبتكرة</span>
            <span className="mt-1 block text-amber-400">لأساتذة المستقبل</span>
          </h1>

          <div className="miraj-rise miraj-delay-1 mt-3 flex flex-wrap items-baseline justify-start gap-x-2 gap-y-1 text-base font-bold text-blue-100 sm:mt-4 sm:text-xl lg:text-2xl">
            <span>كل ما يحتاجه الأستاذ لـ</span>
            <TypewriterPhrase />
          </div>
          <span className="sr-only">كل ما يحتاجه الأستاذ لـ {TYPEWRITER_PHRASES.join('، ')}.</span>

          <p className="miraj-rise miraj-delay-2 mt-3 max-w-xl text-sm leading-relaxed text-blue-50/90 drop-shadow-sm sm:mt-6 sm:text-base lg:text-lg">
            نقدّم للأساتذة أدوات تعليمية تفاعلية تساعدهم على تحضير الدروس، وتجعل التلاميذ أكثر تفاعلاً وانخراطًا في العملية التعليمية.
          </p>

          <div className="miraj-rise miraj-delay-3 mt-4 flex flex-wrap items-center gap-3 sm:mt-7 lg:mt-8">
            <button
              type="button"
              onClick={onBrowseProducts}
              className="inline-flex items-center gap-2 rounded-xl bg-amber-500 px-7 py-3.5 text-base font-bold text-white shadow-xl shadow-black/25 ring-1 ring-amber-300/45 transition-all duration-200 hover:-translate-y-0.5 hover:bg-amber-600 active:translate-y-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300 sm:px-9 sm:py-4 sm:text-lg"
            >
              <span aria-hidden="true">🛍️</span>
              <span>تصفح المنتجات</span>
            </button>
            <button
              type="button"
              onClick={handleDiscoverByLevel}
              className="inline-flex items-center gap-1.5 rounded-xl border border-white/30 bg-[#071226]/55 px-4 py-3 text-sm font-semibold text-white/90 backdrop-blur-[2px] transition-all duration-200 hover:border-amber-300/60 hover:bg-[#071226]/70 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/60 sm:px-5 sm:py-3.5"
            >
              <span>اكتشف حسب الطور</span>
              <span aria-hidden="true">←</span>
            </button>
          </div>

          <div className="miraj-rise miraj-delay-4 mt-3 flex flex-wrap gap-2 sm:mt-6">
            {LEVEL_CHIPS.map(chip => (
              <button
                key={chip.value}
                type="button"
                onClick={() => onSelectLevel(chip.value)}
                className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-[#071226]/50 px-3.5 py-2 text-xs font-bold text-white/90 backdrop-blur-[2px] transition-all duration-200 hover:border-amber-300/60 hover:bg-[#071226]/65 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-300 sm:text-sm"
              >
                <span aria-hidden="true">{chip.icon}</span>
                <span>{chip.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Mobile keeps the same idea but prioritises copy readability over photography. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-[1] sm:hidden"
        style={{
          background: 'linear-gradient(270deg, rgba(7,18,38,.93), rgba(7,18,38,.58) 70%, rgba(7,18,38,.22))',
        }}
      />
    </section>
  );
}
