import { useEffect, useState } from 'react';

// العبارات المتحركة داخل جملة "كل ما يحتاجه الأستاذ لـ ..."
export const TYPEWRITER_PHRASES = ['تحضير أسرع', 'شرح أوضح', 'درس أكثر تفاعلاً', 'تنظيم أفضل للحصة'];

const TYPE_SPEED_MS = 65;   // سرعة الكتابة (لكل حرف)
const DELETE_SPEED_MS = 32; // سرعة الحذف (لكل حرف)
const HOLD_MS = 1000;       // مدة التوقف بعد اكتمال الكتابة
const GAP_MS = 350;         // توقف قصير قبل بدء العبارة التالية

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mq.matches);
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  return reduced;
}

/**
 * عبارة متحركة بأسلوب Typewriter (كتابة → توقف قصير → حذف → عبارة تالية).
 * - لا تُحرّك الجملة كاملة، فقط الكلمة/العبارة الأخيرة المُمرَّرة عبر phrases.
 * - تحجز مساحة العرض الأقصى (minWidth بوحدة ch) لمنع أي Layout Shift عند تغيّر النص.
 * - تحترم prefers-reduced-motion: تعرض العبارة الأولى ثابتة بدون حركة.
 */
export default function TypewriterPhrase({ className = '' }: { className?: string }) {
  const reduced = usePrefersReducedMotion();
  const phrases = TYPEWRITER_PHRASES;
  const maxLen = Math.max(...phrases.map(p => p.length));

  const [phraseIndex, setPhraseIndex] = useState(0);
  const [charCount, setCharCount] = useState(reduced ? phrases[0].length : 0);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (reduced) return; // ثابت بدون مؤقتات عند طلب تقليل الحركة

    const current = phrases[phraseIndex];
    let delay: number;
    if (!deleting && charCount === current.length) {
      delay = HOLD_MS;
    } else if (deleting && charCount === 0) {
      delay = GAP_MS;
    } else {
      delay = deleting ? DELETE_SPEED_MS : TYPE_SPEED_MS;
    }

    const t = setTimeout(() => {
      if (!deleting && charCount === current.length) {
        setDeleting(true);
      } else if (deleting && charCount === 0) {
        setDeleting(false);
        setPhraseIndex(i => (i + 1) % phrases.length);
      } else {
        setCharCount(c => c + (deleting ? -1 : 1));
      }
    }, delay);

    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [charCount, deleting, phraseIndex, reduced]);

  const current = phrases[phraseIndex];
  const display = reduced ? phrases[0] : current.slice(0, charCount);

  return (
    <span
      className={`relative inline-block text-amber-400 ${className}`}
      style={{ minWidth: `${maxLen}ch` }}
      aria-hidden="true"
    >
      {display}
      {!reduced && <span className="miraj-caret">|</span>}
      {/* مسافة غير مرئية للحفاظ على ارتفاع السطر عندما يكون النص فارغًا للحظة */}
      <span className="invisible">{' '}</span>
    </span>
  );
}
