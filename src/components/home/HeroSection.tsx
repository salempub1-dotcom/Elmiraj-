import { useEffect, useState } from 'react';
import TypewriterPhrase, { TYPEWRITER_PHRASES } from './TypewriterPhrase';

export type LevelCategory = 'تحضيري' | 'ابتدائي' | 'متوسط';

const LEVEL_CHIPS: { value: LevelCategory; label: string; icon: string }[] = [
  { value: 'تحضيري', label: 'تحضيري', icon: '🎨' },
  { value: 'ابتدائي', label: 'ابتدائي', icon: '📚' },
  { value: 'متوسط', label: 'متوسط', icon: '🎓' },
];

const EDUCATION_LEVELS_SECTION_ID = 'education-levels';
const HERO_IMAGES = [
  '/images/hero/al_miraj_hero_1.webp',
  '/images/hero/al_miraj_hero_2.webp',
  '/images/hero/al_miraj_hero_3.webp',
] as const;

interface HeroSectionProps {
  onBrowseProducts: () => void;
  onSelectLevel: (category: LevelCategory) => void;
}

export default function HeroSection({ onBrowseProducts, onSelectLevel }: HeroSectionProps) {
  const [activeImage, setActiveImage] = useState(0);
  const [secondaryImagesReady, setSecondaryImagesReady] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

    const syncMotionPreference = () => setReduceMotion(motionQuery.matches);
    syncMotionPreference();
    motionQuery.addEventListener?.('change', syncMotionPreference);

    return () => motionQuery.removeEventListener?.('change', syncMotionPreference);
  }, []);

  useEffect(() => {
    if (reduceMotion) return;

    const prepareSecondaryImages = () => setSecondaryImagesReady(true);
    const idleWindow = window as Window & {
      requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
      cancelIdleCallback?: (id: number) => void;
    };

    if (idleWindow.requestIdleCallback) {
      const id = idleWindow.requestIdleCallback(prepareSecondaryImages, { timeout: 1800 });
      return () => idleWindow.cancelIdleCallback?.(id);
    }

    const timeout = window.setTimeout(prepareSecondaryImages, 1200);
    return () => window.clearTimeout(timeout);
  }, [reduceMotion]);

  useEffect(() => {
    if (reduceMotion || !secondaryImagesReady) {
      setActiveImage(0);
      return;
    }

    const interval = window.setInterval(() => {
      setActiveImage(current => (current + 1) % HERO_IMAGES.length);
    }, 6000);

    return () => window.clearInterval(interval);
  }, [reduceMotion, secondaryImagesReady]);

  const handleDiscoverByLevel = () => {
    document.getElementById(EDUCATION_LEVELS_SECTION_ID)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <section className="relative isolate overflow-hidden bg-[#071226] text-white">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        {HERO_IMAGES.map((src, index) => {
          const shouldRender = index === 0 || secondaryImagesReady;
          if (!shouldRender) return null;

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
                transform: reduceMotion ? 'scale(1)' : isActive ? 'scale(1.025)' : 'scale(1)',
                transition: reduceMotion
                  ? 'none'
                  : 'opacity 1200ms ease-in-out, transform 7000ms ease-out',
              }}
              className="absolute inset-0 h-full w-full select-none object-cover object-[40%_center] sm:object-[42%_center] lg:object-center"
            />
          );
        })}
      </div>

      {/* Desktop/tablet brand gradient: dark behind the Arabic copy, lighter over the classroom scene. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 hidden sm:block"
        style={{
          background:
            'linear-gradient(270deg, rgba(7,18,38,.96) 0%, rgba(11,24,51,.89) 30%, rgba(11,24,51,.72) 55%, rgba(11,24,51,.43) 78%, rgba(7,18,38,.18) 100%)',
        }}
      />

      {/* Slightly stronger mobile veil keeps copy readable without hiding the image completely. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 sm:hidden"
        style={{
          background:
            'linear-gradient(270deg, rgba(7,18,38,.97) 0%, rgba(11,24,51,.92) 36%, rgba(11,24,51,.78) 64%, rgba(7,18,38,.50) 100%)',
        }}
      />
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[#071226]/5" />

      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-24 -right-20 h-72 w-72 rounded-full bg-amber-400/[0.07] blur-3xl" />
        <div className="absolute -bottom-24 left-1/4 h-80 w-80 rounded-full bg-blue-400/[0.07] blur-3xl" />
      </div>

      <div className="relative z-10 mx-auto flex min-h-[520px] max-w-7xl items-center px-4 py-7 sm:min-h-[570px] sm:px-6 sm:py-10 lg:min-h-[650px] lg:py-14">
        <div className="ml-auto w-full text-right lg:max-w-[59%]">
          <h1 className="miraj-rise max-w-3xl text-[1.7rem] font-extrabold leading-[1.28] drop-shadow-[0_3px_18px_rgba(0,0,0,.38)] sm:text-4xl sm:leading-tight lg:text-5xl xl:text-[3.25rem]">
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
              className="inline-flex items-center gap-2 rounded-2xl bg-amber-500 px-7 py-3.5 text-base font-bold text-white shadow-xl shadow-black/25 ring-1 ring-amber-300/45 transition-all duration-200 hover:scale-[1.03] hover:bg-amber-600 active:scale-[0.99] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300 sm:px-9 sm:py-4 sm:text-lg"
            >
              <span aria-hidden="true">🛍️</span>
              <span>تصفح المنتجات</span>
            </button>
            <button
              type="button"
              onClick={handleDiscoverByLevel}
              className="inline-flex items-center gap-1.5 rounded-2xl border border-white/25 bg-[#071226]/35 px-4 py-3 text-sm font-semibold text-white/90 backdrop-blur-sm transition-all duration-200 hover:border-white/45 hover:bg-[#071226]/50 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/60 sm:px-5 sm:py-3.5"
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
                className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-[#071226]/35 px-3.5 py-2 text-xs font-bold text-white/90 backdrop-blur-sm transition-all duration-200 hover:border-amber-300/60 hover:bg-[#071226]/55 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-300 sm:text-sm"
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
