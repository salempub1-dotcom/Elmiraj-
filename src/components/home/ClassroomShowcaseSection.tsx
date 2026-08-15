import { useState } from 'react';

/**
 * 🖼️ صور هذا القسم — جاهزة لاستقبال صورتين حقيقيتين (نفس منطق HeroVisual.tsx)
 * ─────────────────────────────────────────────────────────────
 * لا توجد صور حقيقية لاستعمال منتجات المعراج داخل القسم في المستودع بعد. لتفادي استخدام
 * Stock/Unsplash كنسخة نهائية، يعرض هذا المكوّن Placeholder أنيق (إطار صورة فارغ بهوية الموقع)
 * إلى حين توفر الصورتين. بمجرد إضافة الملفين التاليين، ستظهران تلقائيًا بدون أي تعديل كود:
 *
 *   1) صورة أستاذة تستعمل Flash Cards داخل القسم  →  public/images/classroom-use-1.webp
 *   2) Close-up لمنتجات المعراج أثناء الاستعمال     →  public/images/classroom-use-2.webp
 */
const IMAGE_1_SRC = '/images/classroom-use-1.webp';
const IMAGE_2_SRC = '/images/classroom-use-2.webp';

type ImgStatus = 'loading' | 'loaded' | 'error';

function ClarityIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6">
      <circle cx="12" cy="12" r="4.2" />
      <path d="M12 2.5v2.2M12 19.3v2.2M4.2 12H2M22 12h-2.2M5.8 5.8l1.5 1.5M16.7 16.7l1.5 1.5M18.2 5.8l-1.5 1.5M7.3 16.7l-1.5 1.5" />
    </svg>
  );
}

function EngagementIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6">
      <path d="M8.5 14.5h-3A2.5 2.5 0 0 1 3 12V7a2.5 2.5 0 0 1 2.5-2.5h9A2.5 2.5 0 0 1 17 7v1" />
      <path d="M9 20.5h9.5A2.5 2.5 0 0 0 21 18v-5a2.5 2.5 0 0 0-2.5-2.5h-9A2.5 2.5 0 0 0 7 13v4.2L9 20.5Z" />
    </svg>
  );
}

function ReadyKitIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6">
      <rect x="3" y="8.5" width="18" height="11" rx="2" />
      <path d="M8.5 8.5V6.8A2.3 2.3 0 0 1 10.8 4.5h2.4a2.3 2.3 0 0 1 2.3 2.3v1.7" />
      <path d="M3 12.8h18" />
    </svg>
  );
}

const POINTS = [
  {
    Icon: ClarityIcon,
    title: 'شرح أوضح',
    desc: 'تساعد الصور والبطاقات البصرية على تقديم المعلومة بطريقة مباشرة.',
  },
  {
    Icon: EngagementIcon,
    title: 'تفاعل أكبر',
    desc: 'وسائل تساعد على إشراك التلاميذ أثناء الحصة بدل الاكتفاء بالشرح التقليدي.',
  },
  {
    Icon: ReadyKitIcon,
    title: 'جاهزة للقسم',
    desc: 'مواد عملية يمكن للأستاذ استعمالها مباشرة أثناء الدرس.',
  },
];

/** إطار صورة فارغ أنيق — Placeholder صريح (وليس رسمًا توضيحيًا لبطاقة منتج) إلى حين توفر التصوير الفعلي. */
function PhotoPlaceholder({ label }: { label: string }) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2.5 bg-gradient-to-br from-[#0B1833]/[0.06] to-amber-500/[0.06]">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" className="h-8 w-8 text-[#0B1833]/30">
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <circle cx="9" cy="10.5" r="2" />
        <path d="m3 16 4.5-4.5a1.5 1.5 0 0 1 2.1 0L14 15.9M15.5 13l1.4-1.4a1.5 1.5 0 0 1 2.1 0L21 13.4" />
      </svg>
      <span className="text-[#0B1833]/45 text-[11px] sm:text-xs font-bold text-center px-4">{label}</span>
    </div>
  );
}

function ShowcaseImage({
  src,
  alt,
  placeholderLabel,
  className,
  imgClassName,
}: {
  src: string;
  alt: string;
  placeholderLabel: string;
  className: string;
  imgClassName?: string;
}) {
  const [status, setStatus] = useState<ImgStatus>('loading');
  return (
    <div className={className}>
      {status !== 'loaded' && <PhotoPlaceholder label={placeholderLabel} />}
      <img
        src={src}
        alt={alt}
        className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-500 ${status === 'loaded' ? 'opacity-100' : 'opacity-0'} ${imgClassName ?? ''}`}
        loading="lazy"
        decoding="async"
        onLoad={() => setStatus('loaded')}
        onError={() => setStatus('error')}
      />
    </div>
  );
}

interface ClassroomShowcaseSectionProps {
  onDiscoverProducts: () => void;
}

/**
 * "شاهد وسائل المعراج داخل القسم" — قسم بصري Editorial بعد الأكثر طلبًا وقبل شبكة كل المنتجات.
 * صورتان بتكوين متداخل هادئ (وليس بطاقات منتج)، 3 نقاط قصيرة، وCTA واحد يربط بقسم المنتجات
 * الحقيقي الموجود فعليًا في الصفحة (بدون اختراع route).
 */
export default function ClassroomShowcaseSection({ onDiscoverProducts }: ClassroomShowcaseSectionProps) {
  return (
    <section className="relative overflow-hidden bg-[#F5F3EE] py-10 sm:py-14 lg:py-20 px-4">
      {/* توهجات زخرفية خفيفة جدًا لكسر رتابة الخلفيات البيضاء السابقة دون gradient قوي */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-16 -right-16 h-72 w-72 rounded-full bg-amber-400/10 blur-3xl" />
        <div className="absolute bottom-0 -left-20 h-80 w-80 rounded-full bg-[#0B1833]/[0.06] blur-3xl" />
      </div>

      <div className="relative max-w-7xl mx-auto">
        <div className="flex flex-col lg:flex-row lg:items-center gap-7 lg:gap-14">
          {/* عمود المحتوى — 42% تقريبًا على الديسكتوب. Wrapper بـdisplay:contents على Mobile
              حتى تصبح النقاط الثلاث وCTA وحدة منفصلة تُرتَّب بعد الصور (عبر order) بدل أن تُلحق
              مباشرة بالعنوان والوصف، بينما يتحول إلى عمود واحد فعلي على lg. */}
          <div className="contents lg:flex lg:flex-col lg:w-[42%] lg:gap-7">
            {/* المقدمة: العنوان + الوصف */}
            <div className="order-1 lg:order-none">
              <h2 className="miraj-rise text-xl sm:text-3xl lg:text-[2rem] font-extrabold text-[#0B1833] leading-snug">
                شاهد وسائل المعراج داخل القسم
              </h2>
              <p className="miraj-rise miraj-delay-1 mt-2.5 sm:mt-3 text-sm sm:text-base text-gray-600 leading-relaxed max-w-md">
                وسائل تعليمية صُممت لتكون عملية، واضحة وسهلة الاستخدام أثناء الحصة.
              </p>
            </div>

            {/* النقاط الثلاث + CTA */}
            <div className="order-3 lg:order-none mt-6 lg:mt-0">
              <div className="space-y-4 sm:space-y-5">
                {POINTS.map((p, i) => (
                  <div
                    key={i}
                    className={`miraj-rise flex items-start gap-3 ${i === 1 ? 'miraj-delay-1' : i === 2 ? 'miraj-delay-2' : ''}`}
                  >
                    <div className="h-9 w-9 sm:h-10 sm:w-10 shrink-0 rounded-lg bg-white text-[#0B1833] border border-[#0B1833]/10 flex items-center justify-center shadow-sm">
                      <p.Icon />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-bold text-[#0B1833] text-sm sm:text-base">{p.title}</h3>
                      <p className="text-gray-500 text-xs sm:text-sm leading-relaxed mt-0.5">{p.desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={onDiscoverProducts}
                className="miraj-rise miraj-delay-3 mt-6 sm:mt-7 inline-flex items-center gap-2 bg-[#102A52] hover:bg-[#0B1833] text-white font-bold px-6 py-3 rounded-xl shadow-md transition-all duration-200 hover:scale-[1.02] active:scale-[0.99]"
              >
                <span>اكتشف الوسائل التعليمية</span>
                <span aria-hidden="true">←</span>
              </button>
            </div>
          </div>

          {/* التكوين البصري — 56% تقريبًا على الديسكتوب، order-2 على Mobile (بين المقدمة والنقاط) */}
          <div className="order-2 lg:order-none lg:w-[56%]">
            <div className="relative mx-auto max-w-[380px] sm:max-w-[440px] lg:max-w-none">
              <div aria-hidden="true" className="pointer-events-none absolute -inset-8 rounded-[3rem] bg-amber-400/[0.08] blur-3xl" />

              <div className="relative">
                <ShowcaseImage
                  src={IMAGE_1_SRC}
                  alt="أستاذة تستعمل بطاقات تعليمية من المعراج داخل القسم"
                  placeholderLabel="صورة أستاذة داخل القسم — قيد الإضافة"
                  className="miraj-rise relative aspect-[4/5] sm:aspect-[16/11] lg:aspect-[4/5] w-full rounded-[1.5rem] sm:rounded-[1.75rem] overflow-hidden border border-[#0B1833]/10 shadow-xl ring-1 ring-amber-400/15"
                />

                <ShowcaseImage
                  src={IMAGE_2_SRC}
                  alt="لقطة قريبة لبطاقات ووسائل تعليمية من المعراج أثناء الاستعمال"
                  placeholderLabel="Close-up المنتجات — قيد الإضافة"
                  className="miraj-rise miraj-delay-2 absolute -bottom-4 -left-2 sm:-bottom-6 sm:-left-6 lg:-bottom-8 lg:-left-10 w-[50%] sm:w-[48%] aspect-[4/3] rounded-xl sm:rounded-2xl overflow-hidden border border-[#0B1833]/10 shadow-lg ring-1 ring-amber-400/20 -rotate-1"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
