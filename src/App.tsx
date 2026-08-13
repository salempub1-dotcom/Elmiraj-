import { useState, useEffect, useRef, useCallback } from 'react';
import { Routes, Route, useNavigate, useSearchParams } from 'react-router-dom';
import { createOrder, getWilayas, getCommunes, getDesks, getWilayaCodeFromDeskCode, pingProxy, diagnoseNoest, type NoestWilaya, type NoestCommune, type NoestDesk, type CreateOrderResult } from './services/noestApi';
import { uploadProductImage, deleteProductImage, isSupabaseConfigured, isSupabaseUrl, testSupabaseConnection, getSupabaseInfo, compressImage } from './services/supabase';
import ProductLanding from './pages/landing/ProductLanding';
import DynamicLanding from './pages/landing/DynamicLanding';
import * as db from './services/database';

// ============================================================
// TYPES
// ============================================================
interface Product {
  id: number;
  name: string;
  description: string;
  price: number;
  category: 'تحضيري' | 'ابتدائي' | 'متوسط';
  images: string[];
  stock: number;
  sales: number;
  benefits: string[];
  // محتويات المنتج (كل عنصر في سطر) — اختياري، تُعرض في صفحة المنتج عند توفرها
  contents?: string[];
  // المستوى الدراسي (رمز مختصر مثل 1AP أو 1MS) — اختياري، تابع للطور الدراسي (category)
  level?: string;
  badge?: string;
}
  
// المستوى الدراسي حسب الطور — قيم مختصرة للتخزين + تسميات عربية كاملة للعرض
const LEVELS_BY_CATEGORY: Record<Product['category'], { value: string; label: string }[]> = {
  'تحضيري': [
    { value: 'PREP', label: 'تحضيري' },
  ],
  'ابتدائي': [
    { value: '1AP', label: 'السنة الأولى ابتدائي' },
    { value: '2AP', label: 'السنة الثانية ابتدائي' },
    { value: '3AP', label: 'السنة الثالثة ابتدائي' },
    { value: '4AP', label: 'السنة الرابعة ابتدائي' },
    { value: '5AP', label: 'السنة الخامسة ابتدائي' },
  ],
  'متوسط': [
    { value: '1MS', label: 'السنة الأولى متوسط' },
    { value: '2MS', label: 'السنة الثانية متوسط' },
    { value: '3MS', label: 'السنة الثالثة متوسط' },
    { value: '4MS', label: 'السنة الرابعة متوسط' },
  ],
};

// خريطة مسطحة: رمز المستوى إلى التسمية العربية الكاملة (للعرض السريع بدون معرفة الطور)
const LEVEL_LABELS: Record<string, string> = Object.values(LEVELS_BY_CATEGORY).flat().reduce(
  (acc, l) => { acc[l.value] = l.label; return acc; },
  {} as Record<string, string>
);

interface CartItem extends Product {
  quantity: number;
}

interface WilayaShipping {
  code: number;
  name: string;
  home: number;
  office: number;
}

interface Order {
  id: string;
  tracking: string;
  customer: string;
  phone: string;
  wilaya: string;
  address: string;
  items: CartItem[];
  total: number;
  shipping: number;
  deliveryType: 'home' | 'office';
  selectedOffice?: string;
  status: 'pending' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled';
  date: string;
  noestId?: string;
}

interface Notif {
  id: number;
  message: string;
  read: boolean;
}

interface LandingPage {
  id?: string;
  title: string;
  slug: string;
  product_id: number | null;
  headline: string;
  description: string;
  image_url: string;
  cta_text: string;
  cta_url: string;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

// ============================================================
// DATA
// ============================================================
const wilayaShipping: WilayaShipping[] = [
  { code: 16, name: 'الجزائر', home: 500, office: 300 },
  { code: 35, name: 'بومرداس', home: 600, office: 400 },
  { code: 9, name: 'البليدة', home: 600, office: 400 },
  { code: 42, name: 'تيبازة', home: 600, office: 400 },
  { code: 15, name: 'تيزي وزو', home: 700, office: 450 },
  { code: 10, name: 'البويرة', home: 700, office: 450 },
  { code: 26, name: 'المدية', home: 700, office: 450 },
  { code: 6, name: 'بجاية', home: 800, office: 500 },
  { code: 34, name: 'برج بوعريريج', home: 800, office: 500 },
  { code: 44, name: 'عين الدفلى', home: 800, office: 500 },
  { code: 46, name: 'عين تيموشنت', home: 800, office: 500 },
  { code: 23, name: 'عنابة', home: 800, office: 500 },
  { code: 5, name: 'باتنة', home: 800, office: 500 },
  { code: 2, name: 'الشلف', home: 800, office: 500 },
  { code: 25, name: 'قسنطينة', home: 800, office: 500 },
  { code: 29, name: 'معسكر', home: 800, office: 500 },
  { code: 43, name: 'ميلة', home: 800, office: 500 },
  { code: 27, name: 'مستغانم', home: 800, office: 500 },
  { code: 28, name: 'المسيلة', home: 800, office: 500 },
  { code: 31, name: 'وهران', home: 800, office: 500 },
  { code: 4, name: 'أم البواقي', home: 800, office: 500 },
  { code: 48, name: 'غليزان', home: 800, office: 500 },
  { code: 38, name: 'تيسمسيلت', home: 800, office: 500 },
  { code: 13, name: 'تلمسان', home: 800, office: 500 },
  { code: 19, name: 'سطيف', home: 800, office: 500 },
  { code: 22, name: 'سيدي بلعباس', home: 800, office: 500 },
  { code: 21, name: 'سكيكدة', home: 800, office: 500 },
  { code: 18, name: 'جيجل', home: 800, office: 500 },
  { code: 36, name: 'الطارف', home: 900, office: 600 },
  { code: 24, name: 'قالمة', home: 900, office: 600 },
  { code: 40, name: 'خنشلة', home: 900, office: 600 },
  { code: 20, name: 'سعيدة', home: 900, office: 600 },
  { code: 41, name: 'سوق أهراس', home: 900, office: 600 },
  { code: 12, name: 'تبسة', home: 900, office: 600 },
  { code: 14, name: 'تيارت', home: 900, office: 600 },
  { code: 51, name: 'أولاد جلال', home: 1000, office: 1000 },
  { code: 17, name: 'الجلفة', home: 1000, office: 600 },
  { code: 3, name: 'الأغواط', home: 1000, office: 600 },
  { code: 7, name: 'بسكرة', home: 1000, office: 600 },
  { code: 47, name: 'غرداية', home: 1100, office: 700 },
  { code: 39, name: 'الوادي', home: 1100, office: 700 },
  { code: 57, name: 'المغير', home: 1100, office: 1100 },
  { code: 30, name: 'ورقلة', home: 1100, office: 700 },
  { code: 55, name: 'تقرت', home: 1100, office: 700 },
  { code: 58, name: 'المنيعة', home: 1200, office: 800 },
  { code: 32, name: 'البيض', home: 1200, office: 800 },
  { code: 45, name: 'النعامة', home: 1200, office: 800 },
  { code: 8, name: 'بشار', home: 1200, office: 800 },
  { code: 52, name: 'بني عباس', home: 1200, office: 1200 },
  { code: 1, name: 'أدرار', home: 1500, office: 1000 },
  { code: 49, name: 'تيميمون', home: 1500, office: 1000 },
  { code: 37, name: 'تندوف', home: 1700, office: 1000 },
  { code: 53, name: 'عين صالح', home: 1800, office: 1200 },
  { code: 33, name: 'إليزي', home: 1900, office: 1500 },
  { code: 11, name: 'تمنراست', home: 2000, office: 1500 },
  { code: 56, name: 'جانت', home: 2200, office: 2200 },
];

const initialProducts: Product[] = [
  { id: 1, name: 'بطاقات الأبجدية الإنجليزية', category: 'تحضيري', description: 'أداة مساعدة للأستاذ في تعليم الحروف الإنجليزية بطريقة تفاعلية وممتعة، تجعل التلاميذ أكثر انخراطاً في الدرس', price: 1200, stock: 50, sales: 120, images: ['https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=400'], benefits: ['تساعد الأستاذ في توضيح الحروف بصرياً', 'تجعل التلاميذ أكثر تفاعلاً', 'مناسبة للاستخدام الفردي والجماعي'], badge: 'الأكثر مبيعاً' },
  { id: 2, name: 'بطاقات الأرقام والحساب', category: 'تحضيري', description: 'تساعد الأستاذ في تعليم الأرقام والعمليات الحسابية الأساسية بطريقة بصرية وتفاعلية', price: 1100, stock: 45, sales: 95, images: ['https://images.unsplash.com/photo-1518133910546-b6c2fb7d79e3?w=400'], benefits: ['تبسيط مفاهيم الأرقام للتلاميذ', 'أداة فعالة للتدريب على الحساب', 'تناسب النشاطات الجماعية'], badge: 'جديد' },
  { id: 3, name: 'بطاقات الألوان والأشكال', category: 'تحضيري', description: 'مجموعة بطاقات ملونة تساعد الأستاذ في تعليم الألوان والأشكال الهندسية بأسلوب ممتع', price: 950, stock: 60, sales: 80, images: ['https://images.unsplash.com/photo-1513542789411-b6a5d4f31634?w=400'], benefits: ['تنمية الإدراك البصري لدى التلاميذ', 'تفعيل مشاركة التلاميذ في الدرس', 'سهلة الاستخدام في الفصل'] },
  { id: 4, name: 'بطاقات الفرنسية للمبتدئين', category: 'تحضيري', description: 'أداة مساعدة لأستاذ الطور التحضيري في تقديم اللغة الفرنسية بطريقة بسيطة وجذابة', price: 1300, stock: 35, sales: 70, images: ['https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?w=400'], benefits: ['تقديم اللغة الفرنسية بأسلوب بسيط', 'تحفيز التلاميذ على التعلم', 'مناسبة لمستوى التحضيري'] },
  { id: 5, name: 'بطاقات المفردات الإنجليزية', category: 'ابتدائي', description: 'تساعد الأستاذ في إثراء حصة اللغة الإنجليزية وتجعل التلاميذ يتعلمون مفردات جديدة بسهولة', price: 1400, stock: 40, sales: 110, images: ['https://images.unsplash.com/photo-1546521343-4eb2c01aa44b?w=400'], benefits: ['إثراء الرصيد اللغوي للتلاميذ', 'تحسين مهارات القراءة والكتابة', 'تفعيل الحصة بأنشطة تفاعلية'], badge: 'الأكثر مبيعاً' },
  { id: 6, name: 'بطاقات قواعد اللغة الإنجليزية', category: 'ابتدائي', description: 'أداة مرجعية للأستاذ تساعد التلاميذ على فهم قواعد اللغة الإنجليزية بصرياً', price: 1500, stock: 30, sales: 85, images: ['https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=400'], benefits: ['تبسيط قواعد اللغة للتلاميذ', 'مرجع سريع أثناء الحصة', 'تحسين مستوى الكتابة'] },
  { id: 7, name: 'بطاقات الأفعال الفرنسية', category: 'ابتدائي', description: 'تساعد الأستاذ في تدريس الأفعال الفرنسية وتصريفها بطريقة منظمة وسهلة الفهم', price: 1350, stock: 25, sales: 75, images: ['https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?w=400'], benefits: ['تنظيم تدريس الأفعال الفرنسية', 'تسهيل حفظ التصريفات', 'مناسبة للتدريب الصفي'] },
  { id: 8, name: 'بطاقات الشعر والأناشيد الفرنسية', category: 'ابتدائي', description: 'مجموعة بطاقات تحتوي على أناشيد وقصائد فرنسية تجعل حصة الفرنسية أكثر حيوية', price: 1100, stock: 55, sales: 60, images: ['https://images.unsplash.com/photo-1513542789411-b6a5d4f31634?w=400'], benefits: ['تنشيط الحصة بالأناشيد', 'تحسين النطق لدى التلاميذ', 'تحفيز الحفظ والإلقاء'] },
  { id: 9, name: 'بطاقات الرياضيات المتقدمة', category: 'ابتدائي', description: 'أدوات بصرية تساعد الأستاذ في شرح مفاهيم الرياضيات المتقدمة بطريقة مبسطة', price: 1600, stock: 20, sales: 90, images: ['https://images.unsplash.com/photo-1518133910546-b6c2fb7d79e3?w=400'], benefits: ['تبسيط المفاهيم الرياضية المعقدة', 'تفعيل مشاركة التلاميذ', 'ربط النظرية بالتطبيق'], badge: 'جديد' },
  { id: 10, name: 'بطاقات العلوم الطبيعية', category: 'متوسط', description: 'بطاقات علمية تساعد الأستاذ في تقديم دروس العلوم بمحتوى بصري غني ومعلومات دقيقة', price: 1800, stock: 15, sales: 65, images: ['https://images.unsplash.com/photo-1532094349884-543bc11b234d?w=400'], benefits: ['تقديم المفاهيم العلمية بصرياً', 'ربط الدرس بالواقع', 'تحفيز الفضول العلمي'], badge: 'الأكثر مبيعاً' },
  { id: 11, name: 'بطاقات المحادثة الإنجليزية', category: 'متوسط', description: 'أداة تفاعلية تساعد الأستاذ في تطوير مهارات المحادثة والتعبير الشفهي لدى التلاميذ', price: 1700, stock: 22, sales: 55, images: ['https://images.unsplash.com/photo-1546521343-4eb2c01aa44b?w=400'], benefits: ['تطوير مهارة التحدث بالإنجليزية', 'تشجيع التلاميذ على المشاركة', 'سيناريوهات حوارية متنوعة'] },
  { id: 12, name: 'بطاقات الأدب الفرنسي', category: 'متوسط', description: 'مقتطفات أدبية فرنسية منتقاة تساعد الأستاذ في تقديم النصوص الأدبية بأسلوب شيق', price: 1900, stock: 18, sales: 45, images: ['https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?w=400'], benefits: ['تقديم التراث الأدبي الفرنسي', 'تحسين مهارات التحليل النصي', 'توسيع آفاق التلاميذ الثقافية'] },
  { id: 13, name: 'بطاقات قواعد الفرنسية المتقدمة', category: 'متوسط', description: 'مرجع شامل يساعد الأستاذ في تدريس قواعد اللغة الفرنسية المتقدمة بطريقة منهجية', price: 2000, stock: 12, sales: 40, images: ['https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=400'], benefits: ['تغطية شاملة لقواعد الفرنسية', 'تدريبات تطبيقية متنوعة', 'مرجع سريع للأستاذ والتلميذ'], badge: 'جديد' },
];

// ============================================================
// UTILITIES — Facebook Pixel (Full Catalog / DPA Integration)
// ============================================================
declare global {
  interface Window {
    fbq: (action: string, event: string, data?: object) => void;
    _fbq: unknown;
  }
}

/**
 * أحداث البيكسل المطلوبة لحملة كتالوج ناجحة:
 * ─────────────────────────────────────────────
 * PageView          → تلقائي في index.html
 * ViewContent       → عند فتح تفاصيل المنتج
 * AddToCart          → عند إضافة منتج للسلة
 * InitiateCheckout  → عند فتح صفحة الدفع
 * Purchase          → عند تأكيد الطلب بنجاح
 * Search            → عند البحث عن منتج
 * ViewCategory      → عند اختيار طور دراسي (CustomEvent)
 * AddToWishlist     → عند الضغط "اشتري الآن" (إشارة نية شراء قوية)
 */
const fbTrack = (event: string, data?: object) => {
  try {
    if (typeof window !== 'undefined' && typeof window.fbq === 'function') {
      window.fbq('track', event, data);
      console.log(`[FB Pixel] ✅ ${event}`, data || '');
    }
  } catch (e) {
    console.warn('[FB Pixel] ⚠️ Error:', e);
  }
};

/** Custom event for category views / remarketing */
const fbTrackCustom = (event: string, data?: object) => {
  try {
    if (typeof window !== 'undefined' && typeof window.fbq === 'function') {
      window.fbq('trackCustom', event, data);
      console.log(`[FB Pixel] ✅ Custom: ${event}`, data || '');
    }
  } catch (e) {
    console.warn('[FB Pixel] ⚠️ Error:', e);
  }
};

/**
 * بناء بيانات الكتالوج بالشكل المطلوب من فيسبوك
 * content_type: 'product' مهم جداً لحملات الكتالوج
 */
const buildCatalogData = (product: { id: number; name: string; price: number; category: string }, quantity = 1) => ({
  content_name: product.name,
  content_category: product.category,
  content_ids: [String(product.id)],
  content_type: 'product' as const,
  contents: [{ id: String(product.id), quantity }],
  value: product.price * quantity,
  currency: 'DZD',
});

const buildCartCatalogData = (items: { id: number; name: string; price: number; category: string; quantity: number }[]) => ({
  content_ids: items.map(i => String(i.id)),
  content_type: 'product' as const,
  contents: items.map(i => ({ id: String(i.id), quantity: i.quantity })),
  value: items.reduce((sum, i) => sum + i.price * i.quantity, 0),
  currency: 'DZD',
  num_items: items.reduce((sum, i) => sum + i.quantity, 0),
});

// ============================================================
// SAFE ACCESSORS — prevent crashes from null/undefined DB data
// ============================================================
const PLACEHOLDER_IMAGE = 'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=400&h=400&fit=crop&auto=format';

/** Safely get an image URL from a product's images array */
const safeImage = (images?: string[] | null, index = 0): string => {
  if (!images || !Array.isArray(images) || images.length === 0) return PLACEHOLDER_IMAGE;
  const safeIndex = Math.min(index, images.length - 1);
  return images[safeIndex] || PLACEHOLDER_IMAGE;
};

/** Safely get array length */
const safeImages = (images?: string[] | null): string[] => {
  if (!images || !Array.isArray(images)) return [];
  return images;
};

/** Safely get a string (description, etc.) */
const safeStr = (str?: string | null, fallback = ''): string => str || fallback;

/** Safely get an array (benefits, etc.) */
const safeArr = <T,>(arr?: T[] | null): T[] => {
  if (!arr || !Array.isArray(arr)) return [];
  return arr;
};

const playAddSound = () => {
  try {
    const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const osc = ctx.createOscillator(); const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.1);
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
    osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.1);
  } catch {
    /* silent */
  }
};

// ============================================================
// SMALL COMPONENTS
// ============================================================
const Logo = ({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) => {
  const sizes = { sm: 'h-8 w-8', md: 'h-10 w-10', lg: 'h-20 w-20' };
  return <img src="https://i.ibb.co/YFNY7gKg/logo-header-transparent.png" alt="المعراج" className={`${sizes[size]} rounded-full object-contain`} onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />;
};

const Toast = ({ message, type, onClose }: { message: string; type: 'success' | 'error' | 'info'; onClose: () => void }) => {
  useEffect(() => { const t = setTimeout(onClose, 3000); return () => clearTimeout(t); }, [onClose]);
  const colors = { success: 'bg-[#183C6B]', error: 'bg-red-500', info: 'bg-[#183C6B]' };
  return (
    <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-[9999] ${colors[type]} text-white px-6 py-3 rounded-xl shadow-2xl flex items-center gap-3`}>
      <span>{type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️'}</span>
      <span className="font-bold">{message}</span>
      <button onClick={onClose} className="text-white hover:text-gray-200 mr-2">✕</button>
    </div>
  );
};

// Social links data
const socialLinks = [
  { href: 'https://www.facebook.com/profile.php?id=100068623115888', bg: 'bg-blue-50 hover:bg-blue-100 text-blue-700', footerBg: 'bg-[#183C6B] hover:bg-blue-700', label: 'فيسبوك', icon: 'M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z' },
  { href: 'https://t.me/PrintinginAlgeria', bg: 'bg-sky-50 hover:bg-sky-100 text-sky-600', footerBg: 'bg-sky-500 hover:bg-sky-600', label: 'تيليغرام', icon: 'M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z' },
  { href: 'https://www.youtube.com/@SalemDZTube', bg: 'bg-red-50 hover:bg-red-100 text-red-600', footerBg: 'bg-red-600 hover:bg-red-700', label: 'يوتيوب', icon: 'M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z' },
  { href: 'https://wa.me/213782272080', bg: 'bg-blue-50 hover:bg-blue-100 text-[#183C6B]', footerBg: 'bg-[#183C6B] hover:bg-[#183C6B]', label: 'واتساب', icon: 'M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z' },
];

// ============================================================
// STORE APP COMPONENT
// ============================================================
function StoreApp({
  products, cart, setCart, orders, setOrders, setNotifications, onOpenAdmin,
}: {
  products: Product[];
  cart: CartItem[];
  setCart: React.Dispatch<React.SetStateAction<CartItem[]>>;
  orders: Order[];
  setOrders: React.Dispatch<React.SetStateAction<Order[]>>;
  setNotifications: React.Dispatch<React.SetStateAction<Notif[]>>;
  onOpenAdmin: () => void;
}) {
  const navigate = useNavigate();
  const [cartOpen, setCartOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('الكل');
  // فلترة المستوى الدراسي داخل واجهة المتجر — 'all' = كل سنوات الطور المختار
  const [selectedLevel, setSelectedLevel] = useState('all');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [cartAnimating, setCartAnimating] = useState(false);
  const [activeSection, setActiveSection] = useState('home');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [trackingInput, setTrackingInput] = useState('');
  const [trackingResult, setTrackingResult] = useState<string | null>(null);
  const [copiedTracking, setCopiedTracking] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerWilayaId, setCustomerWilayaId] = useState<number | ''>('');
  const [customerWilayaLabel, setCustomerWilayaLabel] = useState('');
  const [noestWilayas, setNoestWilayas] = useState<NoestWilaya[]>([]);
  const [noestCommunes, setNoestCommunes] = useState<NoestCommune[]>([]);
  const [noestDesks, setNoestDesks] = useState<NoestDesk[]>([]);
  const [loadingNoest, setLoadingNoest] = useState(false);
  const [customerAddress, setCustomerAddress] = useState('');
  const [deliveryType, setDeliveryType] = useState<'home' | 'office'>('home');
  const [selectedOffice, setSelectedOffice] = useState('');
  const [commune, setCommune] = useState('');
  const [orderPlaced, setOrderPlaced] = useState(false);
  const [currentOrder, setCurrentOrder] = useState<Order | null>(null);
  const [placingOrder, setPlacingOrder] = useState(false);
  const requestIdRef = useRef<string | null>(null);
  const isSubmittingRef = useRef(false);  // Extra guard against double submit
  const secretClickCount = useRef(0);
  const secretClickTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Prevent accidental page close/refresh during order submission ──
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isSubmittingRef.current) {
        e.preventDefault();
        e.returnValue = 'طلبك قيد الإرسال، هل تريد المغادرة؟';
        return e.returnValue;
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  // ── Listen for open-checkout event from landing page redirect ──
  useEffect(() => {
    const handleOpenCheckout = () => {
      setCartOpen(false);
      setCheckoutOpen(true);
      fbTrack('InitiateCheckout', buildCartCatalogData(cart));
    };
    window.addEventListener('open-checkout', handleOpenCheckout);
    return () => window.removeEventListener('open-checkout', handleOpenCheckout);
  }, [cart]);

  const handleSecretClick = () => {
    secretClickCount.current += 1;
    if (secretClickTimer.current) clearTimeout(secretClickTimer.current);
    if (secretClickCount.current >= 5) {
      secretClickCount.current = 0;
      onOpenAdmin();
      return;
    }
    secretClickTimer.current = setTimeout(() => { secretClickCount.current = 0; }, 2000);
  };

  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ message, type });
  }, []);

  // ─── Load NOEST reference lists (wilayas/desks/communes) ─────────────────
  useEffect(() => {
    if (!checkoutOpen) return;
    let cancelled = false;

    (async () => {
      try {
        setLoadingNoest(true);

        if (noestWilayas.length === 0) {
          const w = await getWilayas();
          if (!cancelled && w.ok && Array.isArray(w.data)) {
            setNoestWilayas(w.data as NoestWilaya[]);
          }
        }

        if (noestDesks.length === 0) {
          const d = await getDesks();
          if (!cancelled && d.ok && Array.isArray(d.data)) {
            setNoestDesks(d.data as NoestDesk[]);
          }
        }
      } finally {
        if (!cancelled) setLoadingNoest(false);
      }
    })();

    return () => { cancelled = true; };
  }, [checkoutOpen, noestWilayas.length, noestDesks.length]);

  useEffect(() => {
    if (!checkoutOpen) return;
    if (!customerWilayaId) { setNoestCommunes([]); setCommune(''); return; }

    let cancelled = false;
    (async () => {
      setLoadingNoest(true);
      try {
        const c = await getCommunes(Number(customerWilayaId));
        if (!cancelled && c.ok && Array.isArray(c.data)) {
          setNoestCommunes(c.data as NoestCommune[]);
        } else if (!cancelled) {
          setNoestCommunes([]);
        }
      } finally {
        if (!cancelled) setLoadingNoest(false);
      }
    })();

    return () => { cancelled = true; };
  }, [checkoutOpen, customerWilayaId]);

  const selectedWilayaObj = customerWilayaId ? wilayaShipping.find(w => w.code === customerWilayaId) : undefined;
  const shippingCost = selectedWilayaObj ? (deliveryType === 'home' ? selectedWilayaObj.home : selectedWilayaObj.office) : 0;
  const cartTotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const orderTotal = cartTotal + shippingCost;
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const desks = customerWilayaId ? noestDesks.filter(d => getWilayaCodeFromDeskCode(d.code) === customerWilayaId) : [];

  const filteredProducts = products.filter(p => {
    const matchCat = selectedCategory === 'الكل' || p.category === selectedCategory;
    const matchLevel = selectedCategory === 'الكل' || selectedLevel === 'all' || p.level === selectedLevel;
    const matchSearch = !searchQuery || p.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchCat && matchLevel && matchSearch;
  });

  // نص خيار "الكل" داخل قائمة المستوى — يتغيّر حسب الطور المختار
  const allLevelsLabel = (cat: string) => cat === 'متوسط' ? 'جميع سنوات المتوسط' : cat === 'ابتدائي' ? 'جميع سنوات الابتدائي' : 'جميع منتجات التحضيري';

  const triggerCartAnimation = () => { setCartAnimating(true); setTimeout(() => setCartAnimating(false), 1000); playAddSound(); };

  const addToCart = (product: Product) => {
    setCart(prev => {
      const existing = prev.find(i => i.id === product.id);
      if (existing) return prev.map(i => i.id === product.id ? { ...i, quantity: i.quantity + 1 } : i);
      return [...prev, { ...product, quantity: 1 }];
    });
    triggerCartAnimation();
    // ✅ AddToCart — بيانات كتالوج كاملة لحملات DPA
    fbTrack('AddToCart', buildCatalogData(product));
    showToast(`تمت إضافة "${product.name}" إلى السلة`);
  };

  const buyNow = (product: Product) => {
    // ✅ AddToWishlist — إشارة نية شراء قوية للبيكسل
    fbTrack('AddToWishlist', buildCatalogData(product));
    addToCart(product);
    setCartOpen(true);
  };
  const removeFromCart = (id: number) => setCart(prev => prev.filter(i => i.id !== id));
  const updateQuantity = (id: number, qty: number) => { if (qty < 1) { removeFromCart(id); return; } setCart(prev => prev.map(i => i.id === id ? { ...i, quantity: qty } : i)); };

  const [orderError, setOrderError] = useState<string | null>(null);

  // ── Generate unique request ID (idempotency key) ──
  const generateRequestId = (): string => {
    try {
      return crypto.randomUUID();
    } catch {
      // Fallback for older browsers
      return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
    }
  };

  const handlePlaceOrder = async () => {
    // ── GUARD 1: Prevent double-click via ref (synchronous) ──
    if (isSubmittingRef.current) {
      console.warn('[ORDER] ⚠️ Already submitting — ignoring duplicate click');
      return;
    }

    // ── GUARD 2: Prevent re-entry via state (async) ──
    if (placingOrder) {
      console.warn('[ORDER] ⚠️ placingOrder=true — ignoring');
      return;
    }

    setOrderError(null);

    if (!customerName || !customerPhone || !customerWilayaId || !customerAddress || !commune) {
      showToast('يرجى ملء جميع الحقول المطلوبة', 'error');
      return;
    }
    if (customerPhone.length !== 10) {
      showToast('رقم الهاتف يجب أن يكون 10 أرقام', 'error');
      return;
    }
    if (deliveryType === 'office' && !selectedOffice) {
      showToast('يرجى اختيار مكتب الاستلام', 'error');
      return;
    }

    // ── Lock submission IMMEDIATELY (before any async work) ──
    isSubmittingRef.current = true;
    setPlacingOrder(true);

    // ── Generate a UNIQUE request_id for this attempt ──
    const requestId = generateRequestId();
    requestIdRef.current = requestId;

    const wilayaId = Number(customerWilayaId) || 16;
    const deskCode = selectedOffice ? selectedOffice.split(' — ')[0] : undefined;
    const productStr = cart.map(i => `${i.name} x${i.quantity}`).join(', ');

    console.log('[ORDER] 🚀 Sending to NOEST:', {
      request_id: requestId,
      client: customerName,
      phone: customerPhone,
      wilaya_id: wilayaId,
      commune,
      montant: orderTotal,
      stop_desk: deliveryType === 'office' ? 1 : 0,
      station_code: deskCode,
    });

    const result: CreateOrderResult = await createOrder({
      client: customerName,
      phone: customerPhone,
      adresse: customerAddress,
      wilaya_id: wilayaId,
      commune,
      montant: orderTotal,
      produit: productStr,
      type_id: 1,
      stop_desk: deliveryType === 'office' ? 1 : 0,
      station_code: deliveryType === 'office' ? deskCode : undefined,
      request_id: requestId,
    });

    console.log('[ORDER] NOEST result:', JSON.stringify(result));
    if (result.dedup) {
      console.log(`[ORDER] ♻️ DEDUP: response was cached ${Math.round((result.dedup_age_ms || 0) / 1000)}s ago (source: ${(result as unknown as Record<string, unknown>).dedup_source || 'unknown'})`);
    }

    if (!result.ok || !result.data) {
      setPlacingOrder(false);
      isSubmittingRef.current = false;  // ← Unlock for retry
      requestIdRef.current = null;     // ← New request_id on next attempt
      const errorMsg = result.error || 'فشل إرسال الطلب إلى شركة التوصيل';
      const debugMsg = result.debug ? `\n\n🔧 تفاصيل: ${result.debug}` : '';
      setOrderError(`${errorMsg}${debugMsg}`);
      showToast('❌ فشل إرسال الطلب', 'error');
      console.error('[ORDER] ❌ NOEST REJECTED:', errorMsg, result.debug || '');
      return;
    }

    const noestTracking = result.data.tracking || result.data.id || '';
    const noestId = result.data.id || undefined;

    console.log('[ORDER] ✅ NOEST CONFIRMED:', { tracking: noestTracking, id: noestId });
    showToast('✅ تم إرسال الطلب إلى شركة التوصيل بنجاح!', 'success');

    const newOrder: Order = {
      id: `ORD-${Date.now()}`,
      tracking: noestTracking,
      customer: customerName,
      phone: customerPhone,
      wilaya: customerWilayaLabel || String(customerWilayaId),
      address: customerAddress,
      items: [...cart],
      total: orderTotal,
      shipping: shippingCost,
      deliveryType,
      selectedOffice: selectedOffice || undefined,
      status: 'pending',
      date: new Date().toLocaleDateString('ar-DZ'),
      noestId,
    };

    setOrders(prev => [newOrder, ...prev]);
    // ── Persist order to Supabase ──
    db.saveOrder(newOrder as unknown as Record<string, unknown>);
    setCurrentOrder(newOrder);
    setOrderPlaced(true);
    setPlacingOrder(false);
    isSubmittingRef.current = false;  // ← Unlock
    requestIdRef.current = null;     // ← Clear for next order
    setCart([]);
    setOrderError(null);
    setNotifications(prev => [{
      id: Date.now(),
      message: `طلب جديد من ${customerName} - ${customerWilayaLabel}`,
      read: false,
    }, ...prev]);
    // ✅ Purchase — الحدث الأهم لحملة الكتالوج
    fbTrack('Purchase', {
      ...buildCartCatalogData(cart),
      value: orderTotal,
      currency: 'DZD',
      num_items: cartCount,
    });
  };

  const resetCheckout = () => { setCheckoutOpen(false); setOrderPlaced(false); setCurrentOrder(null); setCustomerName(''); setCustomerPhone(''); setCustomerWilayaId(''); setCustomerWilayaLabel(''); setCustomerAddress(''); setCommune(''); setDeliveryType('home'); setSelectedOffice(''); setNoestCommunes([]); setOrderError(null); isSubmittingRef.current = false; requestIdRef.current = null; };
  const copyTracking = (tracking: string) => { navigator.clipboard.writeText(tracking).then(() => { setCopiedTracking(true); setTimeout(() => setCopiedTracking(false), 2000); showToast('تم نسخ رقم التتبع'); }); };

  const catEmoji = (cat: string) => cat === 'تحضيري' ? '🎨' : cat === 'ابتدائي' ? '📚' : cat === 'متوسط' ? '🎓' : '🛍️';

  return (
    <div className="min-h-screen bg-gray-50 font-sans" dir="rtl">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* Announcement */}
      <div className="bg-[#0B1833] text-white text-center py-2 text-sm font-medium">🎓 منصة المعراج التعليمية | 🚚 التوصيل متوفر لجميع ولايات الجزائر | 💵 الدفع عند الاستلام</div>

      {/* Header */}
      <header className="bg-white shadow-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3"><Logo size="md" /><div><h1 className="text-xl font-bold text-blue-800">المعراج</h1><p className="text-xs text-[#183C6B]">متجر تعليمي للأساتذة</p></div></div>
          <nav className="hidden md:flex items-center gap-6 text-sm font-bold text-gray-600">
            {[{ id: 'home', label: '🏠 الرئيسية' }, { id: 'products', label: '📚 المنتجات' }, { id: 'track', label: '🔍 تتبع الطلب' }, { id: 'contact', label: '📞 اتصل بنا' }].map(s => (
              <button key={s.id} onClick={() => setActiveSection(s.id)} className={`hover:text-[#102A52] transition-colors pb-1 ${activeSection === s.id ? 'text-[#102A52] border-b-2 border-blue-700' : ''}`}>{s.label}</button>
            ))}
          </nav>
          <div className="flex items-center gap-3">
            <div className="relative hidden md:block"><input type="text" value={searchQuery} onChange={e => {
              setSearchQuery(e.target.value);
              // ✅ Search — يرسل عند كتابة 3 أحرف أو أكثر
              if (e.target.value.length >= 3) {
                fbTrack('Search', { search_string: e.target.value, content_category: selectedCategory });
              }
            }} placeholder="ابحث..." className="border-2 border-gray-200 rounded-xl px-4 py-2 text-sm focus:border-[#183C6B] outline-none w-40" /></div>
            <button onClick={() => setCartOpen(true)} className={`relative bg-[#102A52] hover:bg-[#0B1833] text-white p-3 rounded-xl transition-all ${cartAnimating ? 'animate-bounce' : ''}`}>
              🛒
              {cartCount > 0 && <span className={`absolute -top-2 -right-2 text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center transition-all ${cartAnimating ? 'bg-yellow-400 text-yellow-900 scale-125' : 'bg-red-500 text-white'}`}>{cartCount}</span>}
              {cartAnimating && <><span className="absolute inset-0 rounded-xl border-4 border-red-400 animate-ping" /><span className="absolute inset-0 rounded-xl border-4 border-yellow-400 animate-ping" style={{ animationDelay: '0.15s' }} /></>}
            </button>
          </div>
        </div>
      </header>

      {/* HERO */}
      {activeSection === 'home' && (
        <section className="bg-gradient-to-br from-[#071226] via-[#0B1833] to-[#183C6B] text-white py-20 px-4">
          <div className="max-w-4xl mx-auto text-center">
            <div className="flex justify-center mb-6"><Logo size="lg" /></div>
            <h1 className="text-4xl md:text-5xl font-bold mb-4">أدوات تعليمية مبتكرة لأساتذة المستقبل</h1>
            <p className="text-xl text-blue-100 mb-8 max-w-2xl mx-auto">نقدم للأساتذة أدوات تعليمية تفاعلية تساعد في تحضير الدروس وتجعل التلاميذ أكثر تفاعلاً وانخراطاً في العملية التعليمية</p>
            <div className="flex flex-wrap justify-center gap-4 mb-8">
              {(['تحضيري', 'ابتدائي', 'متوسط'] as const).map(cat => (<button key={cat} onClick={() => {
                setSelectedCategory(cat);
                setActiveSection('products');
                setSelectedLevel('all');
                fbTrackCustom('ViewCategory', { content_category: cat, content_name: `طور ${cat}` });
              }} className="bg-white/20 hover:bg-white/30 border border-white/40 text-white px-6 py-3 rounded-xl font-bold transition-all">{catEmoji(cat)} {cat}</button>))}
            </div>
            <button onClick={() => setActiveSection('products')} className="bg-amber-500 hover:bg-amber-600 text-white px-10 py-4 rounded-xl font-bold text-lg transition-all shadow-xl">🛍️ تصفح المنتجات</button>
          </div>
        </section>
      )}

      {/* FEATURES */}
      {activeSection === 'home' && (
        <section className="py-12 px-4 bg-white">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-3xl font-bold text-center text-[#0B1833] mb-8">منصة المعراج ليست مجرد منصة تعليمية، بل شريك نجاح حقيقي لكل أستاذ طموح</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[{ icon: '🎯', title: 'أدوات تفاعلية فعّالة', desc: 'تساعد الأستاذ في تنويع طرق التدريس وجذب انتباه التلاميذ طوال الحصة' }, { icon: '📋', title: 'تنويع طرق التدريس', desc: 'أدوات متنوعة تساعد الأستاذ على تقديم الدروس بأساليب مختلفة تناسب جميع التلاميذ' }, { icon: '🔬', title: 'مبنية على أسس تربوية', desc: 'كل منتج مصمم وفق أحدث الأساليب التربوية لضمان أقصى فائدة تعليمية' }].map((f, i) => (
                <div key={i} className="bg-blue-50 rounded-2xl p-6 text-center hover:shadow-md transition-all"><span className="text-4xl block mb-3">{f.icon}</span><h3 className="text-lg font-bold text-[#0B1833] mb-2">{f.title}</h3><p className="text-gray-600 text-sm">{f.desc}</p></div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* PRODUCTS */}
      {(activeSection === 'home' || activeSection === 'products') && (
        <section className="py-12 px-4 bg-gray-50">
          <div className="max-w-7xl mx-auto">
            <h2 className="text-3xl font-bold text-center text-[#0B1833] mb-8">الأطوار التعليمية</h2>
            <div className="flex flex-wrap justify-center gap-3 mb-8">
              {['الكل', 'تحضيري', 'ابتدائي', 'متوسط'].map(cat => (<button key={cat} onClick={() => {
                setSelectedCategory(cat);
                setSelectedLevel('all');
                // ✅ ViewCategory — لتحسين استهداف الجمهور
                if (cat !== 'الكل') {
                  fbTrackCustom('ViewCategory', { content_category: cat, content_name: `طور ${cat}` });
                }
              }} className={`px-5 py-2.5 rounded-xl font-bold transition-all ${selectedCategory === cat ? 'bg-[#102A52] text-white shadow-md' : 'bg-white text-gray-600 hover:bg-blue-50 border border-gray-200'}`}>{catEmoji(cat)} {cat}</button>))}
            </div>
            {/* المستوى الدراسي — Dropdown تابع للطور المختار، يظهر فقط عند وجود أكثر من سنة دراسية واحدة */}
            {selectedCategory !== 'الكل' && LEVELS_BY_CATEGORY[selectedCategory as Product['category']].length > 1 && (
              <div className="flex flex-col items-center gap-2 mb-8">
                <label className="text-sm font-bold text-gray-600">السنة الدراسية:</label>
                <select
                  value={selectedLevel}
                  onChange={e => {
                    setSelectedLevel(e.target.value);
                    if (e.target.value !== 'all') {
                      fbTrackCustom('ViewCategory', { content_category: selectedCategory, content_name: `مستوى ${e.target.value}` });
                    }
                  }}
                  className="w-full max-w-xs border-2 border-gray-200 rounded-xl px-4 py-2.5 bg-white font-bold text-[#102A52] focus:border-[#183C6B] outline-none"
                >
                  <option value="all">{allLevelsLabel(selectedCategory)}</option>
                  {LEVELS_BY_CATEGORY[selectedCategory as Product['category']].map(l => (
                    <option key={l.value} value={l.value}>{l.label}</option>
                  ))}
                </select>
              </div>
            )}
            <div className="md:hidden mb-6"><input type="text" value={searchQuery} onChange={e => {
              setSearchQuery(e.target.value);
              if (e.target.value.length >= 3) {
                fbTrack('Search', { search_string: e.target.value, content_category: selectedCategory });
              }
            }} placeholder="ابحث عن منتج..." className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 focus:border-[#183C6B] outline-none" /></div>
            {filteredProducts.length === 0 ? (
              <div className="text-center py-16">
                <p className="text-6xl mb-4">🔍</p>
                <p className="text-gray-400 text-lg font-bold">
                  {selectedLevel !== 'all' ? 'لا توجد منتجات متوفرة لهذا المستوى حالياً' : 'لا توجد منتجات مطابقة لبحثك'}
                </p>
              </div>
            ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {filteredProducts.map(product => (
                <div key={product.id} className="bg-white rounded-2xl shadow-md hover:shadow-xl transition-all overflow-hidden group">
                  <div className="relative h-48 overflow-hidden cursor-pointer" onClick={() => {
                    // ✅ الانتقال إلى صفحة المنتج المستقلة /lp/:id (بدل فتح الـpopup)
                    // ViewContent يتم إطلاقه تلقائياً داخل ProductLanding عند التحميل
                    navigate(`/lp/${product.id}`);
}}>
                    <img src={safeImage(product.images)} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                    {product.badge && <span className="absolute top-2 right-2 bg-amber-500 text-white text-xs px-2 py-1 rounded-full font-bold">{product.badge}</span>}
                    <span className="absolute top-2 left-2 bg-[#102A52] text-white text-xs px-2 py-1 rounded-full font-bold">{product.category}</span>
                    {safeImages(product.images).length > 1 && <span className="absolute bottom-2 left-2 bg-black/50 text-white text-xs px-2 py-1 rounded-full">📸 {product.images.length}</span>}
                  </div>
                  <div className="p-4">
                    <h3 className="font-bold text-gray-800 mb-1 text-sm leading-tight cursor-pointer hover:text-[#102A52]" onClick={() => navigate(`/lp/${product.id}`)}>{product.name}</h3>
                    <p className="text-gray-500 text-xs mb-3 line-clamp-2">{safeStr(product.description)}</p>
                    <div className="flex items-center justify-between mb-3"><span className="text-[#102A52] font-bold text-lg">{product.price.toLocaleString()} دج</span><span className="text-gray-400 text-xs">المخزون: {product.stock}</span></div>
                    <div className="flex gap-2">
                      <button onClick={() => addToCart(product)} className="flex-1 bg-[#102A52] hover:bg-[#0B1833] text-white py-2 rounded-lg font-bold text-xs transition-all">🛒 أضف للعربة</button>
                      <button onClick={() => buyNow(product)} className="flex-1 bg-amber-500 hover:bg-amber-600 text-white py-2 rounded-lg font-bold text-xs transition-all">⚡ اشتري الآن</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            )}
          </div>
        </section>
      )}

      {/* TRACK ORDER */}
      {activeSection === 'track' && (
        <section className="py-16 px-4 min-h-[60vh]">
          <div className="max-w-xl mx-auto">
            <h2 className="text-3xl font-bold text-center text-[#0B1833] mb-8">🔍 تتبع طلبك</h2>
            <div className="bg-white rounded-2xl shadow-xl p-8">
              <label className="block text-sm font-bold text-gray-700 mb-3">أدخل رقم التتبع</label>
              <input type="text" value={trackingInput} onChange={e => setTrackingInput(e.target.value)} placeholder="مثال: BX4-16G-14705085" className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 focus:border-[#183C6B] outline-none mb-4 text-center font-mono font-bold text-lg" />
              <button onClick={() => { if (!trackingInput.trim()) { showToast('يرجى إدخال رقم التتبع', 'error'); return; } const found = orders.find(o => o.tracking === trackingInput.trim()); if (found) { setTrackingResult(`الحالة: ${found.status === 'pending' ? '⏳ قيد الانتظار' : found.status === 'confirmed' ? '✅ مؤكد' : found.status === 'shipped' ? '🚚 في الطريق' : found.status === 'delivered' ? '📦 تم التوصيل' : '❌ ملغي'}`); } else { window.open(`https://app.noest-dz.com/tracking?code=${trackingInput.trim()}`, '_blank'); setTrackingResult('تم تحويلك لموقع NOEST لمتابعة الشحنة...'); } }} className="w-full bg-[#102A52] hover:bg-[#0B1833] text-white py-3 rounded-xl font-bold text-lg transition-all">🔍 تتبع الطلب</button>
              {trackingResult && <div className="mt-4 bg-blue-50 border-2 border-blue-200 rounded-xl p-4 text-[#0B1833] font-bold text-center">{trackingResult}</div>}
            </div>
          </div>
        </section>
      )}

      {/* CONTACT */}
      {activeSection === 'contact' && (
        <section className="py-16 px-4 min-h-[60vh]">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl font-bold text-center text-[#0B1833] mb-8">📞 اتصل بنا</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="bg-white rounded-2xl shadow-xl p-8 space-y-6">
                <div><h3 className="text-lg font-bold text-gray-700 mb-1">📱 الهاتف</h3><a href="tel:0564234231" className="text-[#102A52] font-bold text-xl hover:underline">0564234231</a></div>
                <div><h3 className="text-lg font-bold text-gray-700 mb-1">📧 البريد الإلكتروني</h3><a href="mailto:contact@almiraj.dz" className="text-[#102A52] hover:underline">contact@almiraj.dz</a></div>
                <div><h3 className="text-lg font-bold text-gray-700 mb-1">📍 العنوان</h3><p className="text-gray-600">الجزائر العاصمة، الجزائر 🇩🇿</p></div>
              </div>
              <div className="bg-white rounded-2xl shadow-xl p-8">
                <h3 className="text-lg font-bold text-gray-700 mb-4">🌐 تابعنا على</h3>
                <div className="space-y-3">
                  {socialLinks.map((s, i) => (<a key={i} href={s.href} target="_blank" rel="noopener noreferrer" className={`flex items-center gap-3 ${s.bg} p-3 rounded-xl font-bold transition-all`}><svg className="w-6 h-6 fill-current" viewBox="0 0 24 24"><path d={s.icon} /></svg>{s.label}</a>))}
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* FOOTER */}
      <footer className="bg-[#071226] text-white py-10 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
            <div><div className="flex items-center gap-3 mb-3"><Logo size="sm" /><div><h3 className="font-bold text-lg cursor-default select-none" onClick={handleSecretClick}>المعراج</h3><p className="text-blue-300 text-xs">متجر تعليمي للأساتذة</p></div></div><p className="text-blue-300 text-sm">أدوات مساعدة لإعداد الدروس وتفعيل التلاميذ</p></div>
            <div><h4 className="font-bold mb-3 text-amber-400">تواصل معنا</h4><div className="space-y-2 text-blue-300 text-sm"><p>📞 <a href="tel:0564234231" className="hover:text-white">0564234231</a></p><p>📧 <a href="mailto:contact@almiraj.dz" className="hover:text-white">contact@almiraj.dz</a></p><p>📍 الجزائر العاصمة، الجزائر 🇩🇿</p></div></div>
            <div><h4 className="font-bold mb-3 text-amber-400">تابعنا</h4><div className="flex gap-3 flex-wrap">{socialLinks.map((s, i) => (<a key={i} href={s.href} target="_blank" rel="noopener noreferrer" className={`${s.footerBg} p-2.5 rounded-xl transition-all`}><svg className="w-5 h-5 fill-white" viewBox="0 0 24 24"><path d={s.icon} /></svg></a>))}</div></div>
          </div>
          <div className="border-t border-[#102A52] pt-6 text-center"><p className="text-blue-400 text-sm">2024 المعراج - جميع الحقوق محفوظة 🇩🇿</p></div>
        </div>
      </footer>

      {/* PRODUCT MODAL */}
      {selectedProduct && (
        <div className="fixed inset-0 bg-black/70 z-[8000] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="relative">
              <img src={safeImage(selectedProduct.images, currentImageIndex)} alt={selectedProduct.name} className="w-full h-64 object-cover rounded-t-2xl cursor-pointer" onClick={() => setLightboxOpen(true)} />
              <button onClick={() => setSelectedProduct(null)} className="absolute top-3 left-3 bg-white/90 text-gray-800 w-9 h-9 rounded-full flex items-center justify-center font-bold hover:bg-white shadow-md">✕</button>
              {safeImages(selectedProduct.images).length > 1 && (<><button onClick={() => setCurrentImageIndex(i => (i - 1 + safeImages(selectedProduct.images).length) % safeImages(selectedProduct.images).length)} className="absolute left-3 top-1/2 -translate-y-1/2 bg-white/90 w-9 h-9 rounded-full flex items-center justify-center shadow-md font-bold">‹</button><button onClick={() => setCurrentImageIndex(i => (i + 1) % safeImages(selectedProduct.images).length)} className="absolute right-3 top-1/2 -translate-y-1/2 bg-white/90 w-9 h-9 rounded-full flex items-center justify-center shadow-md font-bold">›</button><span className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-black/50 text-white text-xs px-3 py-1 rounded-full">{currentImageIndex + 1} / {safeImages(selectedProduct.images).length}</span></>)}
            </div>
            {safeImages(selectedProduct.images).length > 1 && (<div className="flex gap-2 p-3 overflow-x-auto">{safeImages(selectedProduct.images).map((img, i) => (<img key={i} src={img} alt="" onClick={() => setCurrentImageIndex(i)} className={`h-16 w-16 object-cover rounded-lg cursor-pointer flex-shrink-0 transition-all ${currentImageIndex === i ? 'ring-2 ring-[#183C6B] scale-105' : 'opacity-60 hover:opacity-100'}`} />))}</div>)}
            <div className="p-6">
              <div className="flex items-start justify-between mb-3"><div><h2 className="text-xl font-bold text-gray-800">{selectedProduct.name}</h2><span className="bg-blue-100 text-[#102A52] text-xs px-2 py-1 rounded-full font-bold">{selectedProduct.category}</span></div><span className="text-2xl font-bold text-blue-700">{selectedProduct.price.toLocaleString()} دج</span></div>
              <p className="text-gray-600 mb-4 text-sm">{safeStr(selectedProduct.description)}</p>
              {safeArr(selectedProduct.benefits).length > 0 && (<div className="bg-blue-50 rounded-xl p-4 mb-4"><h4 className="font-bold text-[#0B1833] mb-2">✅ الفوائد التعليمية:</h4><ul className="space-y-1">{safeArr(selectedProduct.benefits).map((b, i) => <li key={i} className="text-sm text-[#102A52] flex items-start gap-2"><span>•</span>{b}</li>)}</ul></div>)}
              <div className="flex gap-3"><button onClick={() => { addToCart(selectedProduct); setSelectedProduct(null); }} className="flex-1 bg-[#102A52] hover:bg-[#0B1833] text-white py-3 rounded-xl font-bold transition-all">🛒 أضف للعربة</button><button onClick={() => { buyNow(selectedProduct); setSelectedProduct(null); }} className="flex-1 bg-amber-500 hover:bg-amber-600 text-white py-3 rounded-xl font-bold transition-all">⚡ اشتري الآن</button></div>
            </div>
          </div>
        </div>
      )}

      {/* LIGHTBOX */}
      {lightboxOpen && selectedProduct && (<div className="fixed inset-0 bg-black/95 z-[9000] flex items-center justify-center" onClick={() => setLightboxOpen(false)}><img src={safeImage(selectedProduct.images, currentImageIndex)} alt="" className="max-h-[90vh] max-w-[90vw] object-contain" onClick={e => e.stopPropagation()} /><button onClick={() => setLightboxOpen(false)} className="absolute top-4 left-4 text-white text-3xl font-bold hover:text-gray-300">✕</button></div>)}

      {/* CART SIDEBAR */}
      {cartOpen && (
        <div className="fixed inset-0 z-[8000]">
          <div className="absolute inset-0 bg-black/50" onClick={() => setCartOpen(false)} />
          <div className="absolute left-0 top-0 h-full w-full max-w-md bg-white shadow-2xl flex flex-col">
            <div className="bg-[#102A52] text-white px-6 py-4 flex justify-between items-center"><h2 className="font-bold text-xl">🛒 سلة التسوق ({cartCount})</h2><button onClick={() => setCartOpen(false)} className="text-white hover:text-gray-200 text-2xl font-bold">✕</button></div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {cart.length === 0 ? (<div className="text-center py-16"><p className="text-6xl mb-4">🛒</p><p className="text-gray-400 text-lg">السلة فارغة</p></div>) : cart.map(item => (
                <div key={item.id} className="bg-gray-50 rounded-xl p-3 flex gap-3">
                  <img src={safeImage(item.images)} alt={item.name} className="w-16 h-16 object-cover rounded-lg" />
                  <div className="flex-1"><h4 className="font-bold text-gray-800 text-sm">{item.name}</h4><p className="text-[#102A52] font-bold">{item.price.toLocaleString()} دج</p><div className="flex items-center gap-2 mt-1"><button onClick={() => updateQuantity(item.id, item.quantity - 1)} className="w-7 h-7 bg-gray-200 hover:bg-gray-300 rounded-lg font-bold flex items-center justify-center">-</button><span className="font-bold w-6 text-center">{item.quantity}</span><button onClick={() => updateQuantity(item.id, item.quantity + 1)} className="w-7 h-7 bg-gray-200 hover:bg-gray-300 rounded-lg font-bold flex items-center justify-center">+</button><button onClick={() => removeFromCart(item.id)} className="text-red-400 hover:text-red-600 text-sm mr-auto">🗑️</button></div></div>
                </div>
              ))}
            </div>
            {cart.length > 0 && (<div className="border-t p-4 space-y-3"><div className="flex justify-between font-bold text-lg"><span>المجموع:</span><span className="text-blue-700">{cartTotal.toLocaleString()} دج</span></div><p className="text-xs text-gray-500 text-center">🚚 التوصيل متوفر لجميع ولايات الجزائر | 💵 الدفع عند الاستلام</p><button onClick={() => {
                  setCartOpen(false);
                  setCheckoutOpen(true);
                  // ✅ InitiateCheckout — بيانات كتالوج كاملة
                  fbTrack('InitiateCheckout', buildCartCatalogData(cart));
                }} className="w-full bg-[#102A52] hover:bg-[#0B1833] text-white py-3 rounded-xl font-bold text-lg transition-all">✅ إتمام الطلب</button></div>)}
          </div>
        </div>
      )}

      {/* CHECKOUT MODAL */}
      {checkoutOpen && (
        <div className="fixed inset-0 bg-black/60 z-[8000] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[95vh] overflow-y-auto">
            {orderPlaced && currentOrder ? (
              <div className="p-8 text-center">
                <div className="text-6xl mb-4">🎉</div>
                <h2 className="text-2xl font-bold text-[#102A52] mb-2">تم تأكيد طلبك!</h2>
                <p className="text-gray-500 mb-6">شكراً {currentOrder.customer}، سيتم التواصل معك قريباً</p>
                <div className="bg-blue-50 border-2 border-blue-300 rounded-2xl p-6 mb-6">
                  <p className="text-sm text-gray-500 mb-2">رقم تتبع طلبك</p>
                  <p className="text-2xl font-mono font-bold text-[#102A52] mb-3">{currentOrder.tracking}</p>
                  <button onClick={() => copyTracking(currentOrder.tracking)} className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${copiedTracking ? 'bg-[#183C6B] text-white' : 'bg-blue-100 text-[#102A52] hover:bg-blue-200'}`}>{copiedTracking ? '✅ تم النسخ!' : '📋 نسخ رقم التتبع'}</button>
                </div>
                <div className="bg-gray-50 rounded-xl p-4 text-sm text-right space-y-2 mb-6">
                  <div className="flex justify-between"><span className="text-gray-500">الاسم:</span><span className="font-bold">{currentOrder.customer}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">الهاتف:</span><span className="font-bold">{currentOrder.phone}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">الولاية:</span><span className="font-bold">{currentOrder.wilaya}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">التوصيل:</span><span className="font-bold">{currentOrder.deliveryType === 'home' ? 'إلى المنزل' : 'إلى المكتب'}</span></div>
                  {currentOrder.selectedOffice && <div className="flex justify-between"><span className="text-gray-500">المكتب:</span><span className="font-bold text-xs">{currentOrder.selectedOffice}</span></div>}
                  <div className="border-t pt-2 flex justify-between text-lg"><span className="font-bold">المجموع الكلي:</span><span className="font-bold text-blue-700">{currentOrder.total.toLocaleString()} دج</span></div>
                </div>
                <div className="flex gap-3"><button onClick={() => { setActiveSection('track'); setTrackingInput(currentOrder.tracking); resetCheckout(); }} className="flex-1 border-2 border-[#183C6B] text-[#102A52] py-3 rounded-xl font-bold hover:bg-blue-50 transition-all">🔍 تتبع الطلب</button><button onClick={resetCheckout} className="flex-1 bg-[#102A52] text-white py-3 rounded-xl font-bold hover:bg-[#0B1833] transition-all">🏠 العودة للمتجر</button></div>
              </div>
            ) : (
              <>
                <div className="bg-[#102A52] text-white px-6 py-4 flex justify-between items-center"><h2 className="font-bold text-lg">📦 إتمام الطلب</h2><button onClick={resetCheckout} className="text-white hover:text-gray-200 text-xl font-bold">✕</button></div>
                <div className="p-6 space-y-4">
                  <div><label className="block text-sm font-bold text-gray-700 mb-1">الاسم الكامل *</label><input type="text" value={customerName} onChange={e => setCustomerName(e.target.value)} className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-[#183C6B] outline-none" placeholder="أدخل اسمك الكامل" /></div>
                  <div><label className="block text-sm font-bold text-gray-700 mb-1">رقم الهاتف * (10 أرقام)</label><input type="tel" value={customerPhone} onChange={e => { const v = e.target.value.replace(/\D/g, ''); if (v.length <= 10) setCustomerPhone(v); }} className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-[#183C6B] outline-none" placeholder="05XXXXXXXX" /><p className={`text-xs mt-1 ${customerPhone.length === 10 ? 'text-[#183C6B] font-bold' : 'text-gray-400'}`}>{customerPhone.length}/10</p></div>
                  <div><label className="block text-sm font-bold text-gray-700 mb-1">الولاية * <span className="text-xs text-gray-400 font-normal">(Wilaya)</span></label><select value={customerWilayaId === '' ? '' : String(customerWilayaId)} onChange={e => { const v = e.target.value; if (!v) { setCustomerWilayaId(''); setCustomerWilayaLabel(''); setNoestCommunes([]); setCommune(''); setSelectedOffice(''); return; } const id = Number(v); setCustomerWilayaId(id); const w = noestWilayas.find(x => x.code === id); setCustomerWilayaLabel(w ? `${w.code} - ${w.nom} (${w.nom_ar})` : String(id)); setSelectedOffice(''); }} className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-[#183C6B] outline-none"><option value="">اختر الولاية / Choisir la wilaya</option>{noestWilayas.length > 0 ? noestWilayas.slice().sort((a, b) => a.code - b.code).map(w => (<option key={w.code} value={String(w.code)}>{w.code} - {w.nom} ({w.nom_ar})</option>)) : wilayaShipping.slice().sort((a, b) => a.code - b.code).map(w => (<option key={w.code} value={String(w.code)}>{w.code} - {w.name}</option>))}</select></div>
                  <div><label className="block text-sm font-bold text-gray-700 mb-1">البلدية * <span className="text-xs text-gray-400 font-normal">(Commune)</span></label><select value={commune} onChange={e => setCommune(e.target.value)} className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-[#183C6B] outline-none" disabled={!customerWilayaId || loadingNoest}><option value="">{!customerWilayaId ? 'اختر الولاية أولاً' : loadingNoest ? 'جاري تحميل البلديات...' : 'اختر البلدية / Choisir la commune'}</option>{noestCommunes.map((c, idx) => (<option key={`${c.wilaya_id}-${idx}`} value={c.nom}>{c.nom} ({c.nom_ar})</option>))}</select></div>
                  <div><label className="block text-sm font-bold text-gray-700 mb-1">العنوان التفصيلي *</label><textarea value={customerAddress} onChange={e => setCustomerAddress(e.target.value)} className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-[#183C6B] outline-none" rows={2} placeholder="أدخل عنوانك التفصيلي" /></div>
                  <div><label className="block text-sm font-bold text-gray-700 mb-2">نوع التوصيل *</label><div className="grid grid-cols-2 gap-3">{[{ value: 'home', icon: '🏠', label: 'إلى المنزل' }, { value: 'office', icon: '🏢', label: 'إلى المكتب' }].map(opt => (<button key={opt.value} onClick={() => { setDeliveryType(opt.value as 'home' | 'office'); setSelectedOffice(''); }} className={`p-3 rounded-xl border-2 font-bold text-sm transition-all ${deliveryType === opt.value ? 'border-[#183C6B] bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-600 hover:border-blue-300'}`}>{opt.icon} {opt.label}</button>))}</div></div>
                  {deliveryType === 'office' && customerWilayaId && (<div><label className="block text-sm font-bold text-gray-700 mb-2">🏢 اختر مكتب الاستلام * <span className="text-xs text-gray-400 font-normal">(Stop Desk)</span></label>{desks.length > 0 ? (<div className="max-h-48 overflow-y-auto space-y-2 border-2 border-gray-200 rounded-xl p-3">{desks.map(desk => (<button key={desk.code} onClick={() => setSelectedOffice(`${desk.code} — ${desk.name}`)} className={`w-full flex items-center gap-3 p-3 rounded-xl text-right transition-all border-2 ${selectedOffice === `${desk.code} — ${desk.name}` ? 'border-[#183C6B] bg-blue-50' : 'border-gray-100 hover:border-blue-300'}`}><span className="bg-[#102A52] text-white text-xs px-2 py-1 rounded-lg font-mono font-bold">{desk.code}</span><div className="flex-1"><span className="font-bold text-gray-800 text-sm block">{desk.name_ar}</span><span className="text-gray-500 text-xs">{desk.name}</span></div>{selectedOffice === `${desk.code} — ${desk.name}` && <span className="text-[#183C6B] mr-auto font-bold">✓</span>}</button>))}</div>) : (<div className="bg-amber-50 border-2 border-amber-200 rounded-xl p-4 text-amber-700 text-sm font-bold text-center">⚠️ سيتم التواصل معك لتحديد نقطة الاستلام</div>)}</div>)}
                  <div className="bg-gray-50 rounded-xl p-4 space-y-2">
                    <h4 className="font-bold text-gray-700 mb-3">ملخص الطلب</h4>
                    {cart.map(item => (<div key={item.id} className="flex justify-between text-sm"><span>{item.name} × {item.quantity}</span><span className="font-bold">{(item.price * item.quantity).toLocaleString()} دج</span></div>))}
                    <div className="border-t pt-2 space-y-1"><div className="flex justify-between text-sm"><span>المجموع الفرعي:</span><span>{cartTotal.toLocaleString()} دج</span></div>{shippingCost > 0 && <div className="flex justify-between text-sm"><span>تكلفة الشحن:</span><span>{shippingCost.toLocaleString()} دج</span></div>}<div className="flex justify-between font-bold text-lg border-t pt-1"><span>المجموع الكلي:</span><span className="text-blue-700">{orderTotal.toLocaleString()} دج</span></div></div>
                    <div className="flex items-center gap-2 bg-blue-50 rounded-xl p-3 mt-2"><span>💵</span><span className="text-[#102A52] font-bold text-sm">الدفع عند الاستلام</span></div>
                  </div>
                  {orderError && (
                    <div className="bg-red-50 border-2 border-red-300 rounded-xl p-4 space-y-2">
                      <div className="flex items-start gap-2">
                        <span className="text-red-500 text-lg">❌</span>
                        <div className="flex-1">
                          <p className="font-bold text-red-700 text-sm">فشل إرسال الطلب</p>
                          <p className="text-red-600 text-xs mt-1">{orderError}</p>
                        </div>
                      </div>
                      <p className="text-red-500 text-xs">يرجى التحقق من البيانات والمحاولة مرة أخرى. إذا استمرت المشكلة تواصل معنا على 0564234231</p>
                    </div>
                  )}
                  <button onClick={handlePlaceOrder} disabled={placingOrder} className={`w-full py-4 rounded-xl font-bold text-lg transition-all text-white ${placingOrder ? 'bg-gray-400 cursor-not-allowed' : 'bg-[#102A52] hover:bg-[#0B1833] shadow-lg'}`}>{placingOrder ? '⏳ جاري إرسال الطلب لشركة التوصيل...' : orderError ? '🔄 إعادة المحاولة' : '✅ تأكيد الطلب'}</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Mobile Bottom Nav */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex md:hidden z-40">
        {[{ id: 'home', icon: '🏠', label: 'الرئيسية' }, { id: 'products', icon: '📚', label: 'المنتجات' }, { id: 'track', icon: '🔍', label: 'تتبع' }, { id: 'cart', icon: '🛒', label: `(${cartCount})` }, { id: 'contact', icon: '📞', label: 'تواصل' }].map(item => (
          <button key={item.id} onClick={() => item.id === 'cart' ? setCartOpen(true) : setActiveSection(item.id)} className={`flex-1 flex flex-col items-center py-2 text-xs font-bold transition-colors ${activeSection === item.id ? 'text-blue-700' : 'text-gray-400 hover:text-[#183C6B]'}`}><span className="text-lg">{item.icon}</span><span>{item.label}</span></button>
        ))}
      </nav>
      <div className="h-16 md:hidden" />
    </div>
  );
}

// ============================================================
// NOEST STATUS CARD COMPONENT (Admin Dashboard)
// ============================================================
function NoestStatusCard({ showToast }: { showToast: (msg: string, type?: 'success' | 'error' | 'info') => void }) {
  const [status, setStatus] = useState<'checking' | 'connected' | 'disconnected' | 'demo'>('checking');
  const [diagResult, setDiagResult] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const available = await pingProxy();
      setStatus(available ? 'connected' : 'demo');
    })();
  }, []);

  const runDiagnose = async () => {
    showToast('جاري فحص الاتصال بـ NOEST...', 'info');
    const result = await diagnoseNoest();
    if (result.ok) {
      const data = result.data as Record<string, unknown> | undefined;
      const idempotency = data?.idempotency as Record<string, unknown> | undefined;
      const store = idempotency?.store || 'unknown';
      setDiagResult(JSON.stringify(result.data, null, 2));
      showToast(`✅ تم الفحص — Dedup: ${store}`, 'success');
    } else {
      setDiagResult(`❌ Error: ${result.error}\n${result.debug || ''}`);
      showToast('⚠️ مشكلة في الاتصال', 'error');
    }
  };

  const statusColors = {
    checking: 'bg-gray-50 border-gray-300',
    connected: 'bg-blue-50 border-blue-300',
    disconnected: 'bg-red-50 border-red-300',
    demo: 'bg-amber-50 border-amber-300',
  };
  const statusIcons = { checking: '⏳', connected: '✅', disconnected: '❌', demo: '🎭' };
  const statusTexts = {
    checking: 'جاري الفحص...',
    connected: 'متصل بـ NOEST API عبر Vercel ✅',
    disconnected: 'غير متصل بالخادم ❌',
    demo: 'وضع تجريبي — NOEST API غير متوفر (يحتاج نشر على Vercel)',
  };

  return (
    <div className={`rounded-2xl p-4 border-2 ${statusColors[status]}`}>
      <div className="flex items-center gap-3 mb-2">
        <span className="text-2xl">{statusIcons[status]}</span>
        <div className="flex-1">
          <p className="font-bold text-sm text-gray-800">🚚 حالة NOEST (شركة التوصيل)</p>
          <p className="text-xs text-gray-500 mt-0.5">{statusTexts[status]}</p>
        </div>
        <button onClick={runDiagnose} className="bg-[#183C6B] hover:bg-[#102A52] text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap">🔍 فحص</button>
      </div>
      {status === 'demo' && (
        <div className="mt-3 bg-white rounded-xl p-3 text-xs space-y-2">
          <p className="font-bold text-amber-700">📋 للتفعيل الكامل على Vercel:</p>
          <ol className="list-decimal list-inside space-y-1 text-gray-600" dir="ltr">
            <li>Deploy to Vercel: <code className="bg-gray-100 px-1 rounded">vercel deploy</code></li>
            <li>Add Environment Variables in Vercel Dashboard:</li>
            <li className="mr-4"><code className="bg-gray-100 px-1 rounded">NOEST_API_TOKEN</code> = your NOEST API token</li>
            <li className="mr-4"><code className="bg-gray-100 px-1 rounded">NOEST_USER_GUID</code> = your NOEST user GUID</li>
            <li className="mr-4"><code className="bg-gray-100 px-1 rounded">ADMIN_USERNAME</code> = admin login</li>
            <li className="mr-4"><code className="bg-gray-100 px-1 rounded">ADMIN_PASSWORD</code> = admin password</li>
            <li>Redeploy after adding env vars</li>
          </ol>
          <div className="mt-2 pt-2 border-t border-amber-200">
            <p className="font-bold text-amber-700">🔒 لمنع تكرار الطلبات (Upstash Redis — مجاني):</p>
            <ol className="list-decimal list-inside space-y-1 text-gray-600" dir="ltr">
              <li>Create free account at <a href="https://upstash.com" target="_blank" rel="noopener noreferrer" className="text-[#183C6B] underline">upstash.com</a></li>
              <li>Create a Redis database (free tier)</li>
              <li className="mr-4"><code className="bg-gray-100 px-1 rounded">UPSTASH_REDIS_REST_URL</code></li>
              <li className="mr-4"><code className="bg-gray-100 px-1 rounded">UPSTASH_REDIS_REST_TOKEN</code></li>
            </ol>
          </div>
        </div>
      )}
      {diagResult && (
        <pre className="mt-3 bg-gray-900 text-blue-400 rounded-xl p-3 text-xs overflow-x-auto max-h-48" dir="ltr">{diagResult}</pre>
      )}
    </div>
  );
}

// ============================================================
// SUPABASE STATUS CARD COMPONENT (Admin Dashboard)
// ============================================================
function SupabaseStatusCard({ showToast }: { showToast: (msg: string, type?: 'success' | 'error' | 'info') => void }) {
  const [status, setStatus] = useState<'checking' | 'connected' | 'error' | 'not_configured'>('checking');
  const [details, setDetails] = useState<string | null>(null);
  const info = getSupabaseInfo();

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setStatus('not_configured');
      return;
    }
    (async () => {
      const result = await testSupabaseConnection();
      setStatus(result.ok ? 'connected' : 'error');
      setDetails(result.details || null);
    })();
  }, []);

  const runTest = async () => {
    showToast('جاري فحص اتصال Supabase...', 'info');
    const result = await testSupabaseConnection();
    setStatus(result.ok ? 'connected' : 'error');
    setDetails(result.details || null);
    showToast(result.ok ? '✅ Supabase متصل!' : `⚠️ ${result.message}`, result.ok ? 'success' : 'error');
  };

  const statusColors = {
    checking: 'bg-gray-50 border-gray-300',
    connected: 'bg-blue-50 border-blue-300',
    error: 'bg-red-50 border-red-300',
    not_configured: 'bg-amber-50 border-amber-300',
  };
  const statusIcons = { checking: '⏳', connected: '✅', error: '❌', not_configured: '⚠️' };
  const statusTexts = {
    checking: 'جاري فحص الاتصال...',
    connected: `متصل بـ Supabase Storage ✅ — رفع آمن عبر الخادم (SERVICE_ROLE)`,
    error: 'خطأ في الاتصال بخادم الرفع',
    not_configured: 'خادم رفع الصور غير مُكوّن — الصور تُحفظ محلياً فقط',
  };

  return (
    <div className={`rounded-2xl p-4 border-2 ${statusColors[status]}`}>
      <div className="flex items-center gap-3 mb-2">
        <span className="text-2xl">{statusIcons[status]}</span>
        <div className="flex-1">
          <p className="font-bold text-sm text-gray-800">🖼️ رفع صور المنتجات — {info.mode}</p>
          <p className="text-xs text-gray-500 mt-0.5">{statusTexts[status]}</p>
          {details && <p className="text-xs text-gray-400 mt-0.5">{details}</p>}
        </div>
        <button onClick={runTest} className="bg-[#183C6B] hover:bg-[#102A52] text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap">🔍 فحص</button>
      </div>
      {status === 'connected' && (
        <div className="mt-2 bg-blue-100 rounded-xl p-3 text-xs text-blue-700">
          <p className="font-bold">🔒 الرفع آمن:</p>
          <p className="mt-1">الصور تُرفع عبر <code>/api/upload-image</code> باستخدام SERVICE_ROLE — المفتاح السري موجود فقط على الخادم، لا يُكشف أبداً في الواجهة.</p>
        </div>
      )}
      {status === 'not_configured' && (
        <div className="mt-3 bg-white rounded-xl p-3 text-xs space-y-2">
          <p className="font-bold text-amber-700">📋 لتفعيل الرفع الآمن (Vercel + Supabase):</p>
          <ol className="list-decimal list-inside space-y-1 text-gray-600" dir="ltr">
            <li>Create project at <a href="https://supabase.com" target="_blank" rel="noopener noreferrer" className="text-[#183C6B] underline">supabase.com</a></li>
            <li>Storage → Create bucket: <code className="bg-gray-100 px-1 rounded">product-images</code></li>
            <li>Make bucket <strong>PRIVATE</strong> (no anon INSERT)</li>
            <li>Add policy: <strong>SELECT</strong> for anon (public read)</li>
            <li className="font-bold mt-2">Add to Vercel env vars (server-side only):</li>
            <li className="mr-4"><code className="bg-yellow-100 px-1 rounded font-bold">SUPABASE_URL</code> = project URL</li>
            <li className="mr-4"><code className="bg-yellow-100 px-1 rounded font-bold">SUPABASE_SERVICE_ROLE_KEY</code> = service_role key</li>
            <li className="mr-4"><code className="bg-gray-100 px-1 rounded">SUPABASE_BUCKET</code> = product-images</li>
            <li className="font-bold mt-2">Add to .env (client-side, for display only):</li>
            <li className="mr-4"><code className="bg-gray-100 px-1 rounded">VITE_SUPABASE_URL</code> = same project URL</li>
          </ol>
          <div className="mt-2 pt-2 border-t border-amber-200">
            <p className="text-amber-600 font-bold">⚠️ لا تضع SUPABASE_SERVICE_ROLE_KEY أبداً في متغيرات VITE_</p>
          </div>
        </div>
      )}
      {status === 'error' && (
        <div className="mt-2 bg-red-100 rounded-xl p-3 text-xs text-red-700">
          <p className="font-bold">💡 نصائح:</p>
          <ul className="list-disc list-inside space-y-1 mt-1">
            <li>تأكد من إضافة <code>SUPABASE_URL</code> و <code>SUPABASE_SERVICE_ROLE_KEY</code> في Vercel</li>
            <li>تأكد أن مفتاح <code>service_role</code> (ليس anon!) مضاف بشكل صحيح</li>
            <li>تأكد من إنشاء bucket باسم <code>{info.bucket}</code></li>
            <li>جلسة المسؤول قد تكون منتهية — أعد تسجيل الدخول</li>
          </ul>
        </div>
      )}
    </div>
  );
}

// ============================================================
// SYSTEM HEALTH CARD COMPONENT (Admin Dashboard)
// ============================================================
function SystemHealthCard({ showToast }: { showToast: (msg: string, type?: 'success' | 'error' | 'info') => void }) {
  const [resultText, setResultText] = useState('');
  const [loading, setLoading] = useState(false);
  const [checked, setChecked] = useState(false);
  const [allOk, setAllOk] = useState(false);

  const runCheck = async () => {
    setLoading(true);
    showToast('جاري فحص إعدادات Vercel...', 'info');
    try {
      const r = await fetch('/api/health');
      const data = await r.json();
      setChecked(true);
      setAllOk(data.ok === true);
      setResultText(JSON.stringify(data, null, 2));
      if (data.ok) {
        showToast('✅ جميع المتغيرات مُكوّنة!', 'success');
      } else {
        const missing = data.missing || [];
        showToast(`⚠️ يوجد ${missing.length} متغيرات مفقودة`, 'error');
      }
    } catch {
      setChecked(true);
      setAllOk(false);
      setResultText(JSON.stringify({ ok: false, error: 'API غير متوفر — يجب نشر المشروع على Vercel أولاً' }, null, 2));
      showToast('❌ API غير متوفر', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`rounded-2xl p-4 border-2 ${!checked ? 'bg-gray-50 border-gray-300' : allOk ? 'bg-blue-50 border-blue-300' : 'bg-red-50 border-red-300'}`}>
      <div className="flex items-center gap-3 mb-2">
        <span className="text-2xl">{!checked ? '🏥' : allOk ? '✅' : '⚠️'}</span>
        <div className="flex-1">
          <p className="font-bold text-sm text-gray-800">{'🏥 فحص صحة النظام (Vercel Env Vars + DB)'}</p>
          <p className="text-xs text-gray-500 mt-0.5">
            {!checked
              ? 'اضغط "فحص" للتحقق من إعدادات Vercel وقاعدة البيانات'
              : allOk
                ? '✅ جميع المتغيرات مُكوّنة وقاعدة البيانات متصلة'
                : '❌ يوجد مشاكل في الإعدادات — راجع التفاصيل أدناه'}
          </p>
        </div>
        <button onClick={runCheck} disabled={loading} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap text-white ${loading ? 'bg-gray-400' : 'bg-purple-600 hover:bg-purple-700'}`}>
          {loading ? '⏳' : '🏥 فحص'}
        </button>
      </div>

      {checked && resultText && (
        <pre className="mt-3 bg-gray-900 text-blue-400 rounded-xl p-3 text-xs overflow-x-auto max-h-64" dir="ltr">
          {resultText}
        </pre>
      )}

      {!checked && (
        <div className="mt-2 bg-white rounded-xl p-3 text-xs text-gray-500">
          <p>{'يتحقق من: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ADMIN_USERNAME, ADMIN_PASSWORD, NOEST_API_TOKEN, NOEST_USER_GUID + اتصال قاعدة البيانات + Storage bucket'}</p>
          <p className="mt-1">{'💡 بعد النشر على Vercel، يمكنك أيضاً زيارة /api/health مباشرة'}</p>
        </div>
      )}
    </div>
  );
}

// ============================================================
// ADMIN APP COMPONENT
// ============================================================
function AdminApp({
  products, setProducts, orders, setOrders, notifications, setNotifications, onBackToStore,
}: {
  products: Product[];
  setProducts: React.Dispatch<React.SetStateAction<Product[]>>;
  orders: Order[];
  setOrders: React.Dispatch<React.SetStateAction<Order[]>>;
  notifications: Notif[];
  setNotifications: React.Dispatch<React.SetStateAction<Notif[]>>;
  onBackToStore: () => void;
}) {
  const [isAdmin, setIsAdmin] = useState(() => { try { return localStorage.getItem('almiraj_admin') === 'true'; } catch { return false; } });
  const [adminUsername, setAdminUsername] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [adminLoginError, setAdminLoginError] = useState('');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [tab, setTab] = useState<'dashboard' | 'orders' | 'products' | 'landing' | 'system'>('dashboard');
  const [showNotif, setShowNotif] = useState(false);
  // ── Landing Pages State ──
  const [landingPages, setLandingPages] = useState<LandingPage[]>([]);
  const [lpLoading, setLpLoading] = useState(false);
  const [lpError, setLpError] = useState<string | null>(null);
  const [showLpForm, setShowLpForm] = useState(false);
  const [editingLp, setEditingLp] = useState<LandingPage | null>(null);
  const [lpForm, setLpForm] = useState<LandingPage>({ title: '', slug: '', product_id: null, headline: '', description: '', image_url: '', cta_text: 'اشتري الآن', cta_url: '', is_active: true });
  const [lpDelConfirm, setLpDelConfirm] = useState<string | null>(null);
  const [lpSaving, setLpSaving] = useState(false);
  const [lpImageUploading, setLpImageUploading] = useState(false);
  const lpFileInputRef = useRef<HTMLInputElement>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const [showProductForm, setShowProductForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [productForm, setProductForm] = useState({ name: '', description: '', price: '', category: 'تحضيري' as Product['category'], stock: '', benefits: '', contents: '', level: '', badge: '' });
  const [productImages, setProductImages] = useState<string[]>([]);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { try { localStorage.setItem('almiraj_admin', isAdmin ? 'true' : 'false'); } catch { /* */ } }, [isAdmin]);
  useEffect(() => {
    if (typeof window !== 'undefined' && window.location.pathname.includes('/admin/system')) {
      setTab('system');
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const basePath = tab === 'system' ? '/admin/system' : '/admin';
    if (window.location.pathname !== basePath) {
      window.history.pushState(null, '', basePath);
    }
  }, [tab]);


  useEffect(() => {
    if (!isAdmin) return;
    const interval = setInterval(() => {
      const msgs = ['طلب جديد وصل!', 'منتج على وشك النفاد!', 'تم تأكيد طلب!'];
      setNotifications(prev => [{ id: Date.now(), message: msgs[Math.floor(Math.random() * msgs.length)], read: false }, ...prev.slice(0, 9)]);
    }, 30000);
    return () => clearInterval(interval);
  }, [isAdmin, setNotifications]);

  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'success') => { setToast({ message, type }); }, []);
  const unread = notifications.filter(n => !n.read).length;
  const totalRevenue = orders.reduce((s, o) => s + o.total, 0);
  const pendingCount = orders.filter(o => o.status === 'pending').length;

  const [loginLoading, setLoginLoading] = useState(false);

  const handleLogin = async () => {
    if (!adminUsername || !adminPassword) {
      setAdminLoginError('يرجى إدخال اسم المستخدم وكلمة المرور');
      return;
    }
    setLoginLoading(true);
    setAdminLoginError('');
    try {
      // Try server-side auth first (Vercel deployment)
      const response = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: adminUsername, password: adminPassword }),
      });
      const result = await response.json();
      if (result.ok) {
        setIsAdmin(true);
        setAdminLoginError('');
        try { localStorage.setItem('almiraj_admin', 'true'); localStorage.setItem('almiraj_token', result.token || ''); } catch { /* */ }
        return;
      }
      setAdminLoginError(result.error || 'اسم المستخدم أو كلمة المرور غير صحيحة');
    } catch {
      // Server unreachable — no fallback credentials
      console.log('[AUTH] Server auth unavailable');
      setAdminLoginError('تعذر الاتصال بالخادم. يرجى التأكد من نشر المشروع على Vercel وإعداد بيانات الاعتماد.');
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = () => {
    setIsAdmin(false);
    try { localStorage.removeItem('almiraj_admin'); localStorage.removeItem('almiraj_token'); } catch { /* */ }
    setAdminUsername('');
    setAdminPassword('');
    onBackToStore();
  };

  const openAddProduct = () => { setEditingProduct(null); setProductForm({ name: '', description: '', price: '', category: 'تحضيري', stock: '', benefits: '', contents: '', level: '', badge: '' }); setProductImages([]); setShowProductForm(true); };
  const openEditProduct = (p: Product) => { setEditingProduct(p); setProductForm({ name: p.name, description: p.description, price: p.price.toString(), category: p.category, stock: p.stock.toString(), benefits: p.benefits.join('\n'), contents: safeArr(p.contents).join('\n'), level: p.level || '', badge: p.badge || '' }); setProductImages(p.images); setShowProductForm(true); };

  const handleSaveProduct = () => {
    if (!productForm.name || !productForm.price || !productForm.stock) { showToast('يرجى ملء الحقول المطلوبة', 'error'); return; }
    const data: Product = { id: editingProduct ? editingProduct.id : Date.now(), name: productForm.name, description: productForm.description, price: parseInt(productForm.price), category: productForm.category, stock: parseInt(productForm.stock), sales: editingProduct ? editingProduct.sales : 0, images: productImages.length > 0 ? productImages : ['https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=400'], benefits: productForm.benefits.split('\n').filter(b => b.trim()), contents: productForm.contents.split('\n').filter(c => c.trim()), level: productForm.level || undefined, badge: productForm.badge || undefined };
    if (editingProduct) { setProducts(prev => prev.map(p => p.id === editingProduct.id ? data : p)); showToast('تم تحديث المنتج بنجاح'); }
    else { setProducts(prev => [data, ...prev]); showToast('تم إضافة المنتج بنجاح'); }
    // ── Persist to Supabase ──
    db.saveProduct(data as any).then(r => {
      if (!r.ok) console.warn('[DB] ⚠️ Product save failed:', r.error);
    });
    setShowProductForm(false);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files; if (!files) return;
    const toUpload = Array.from(files).slice(0, 6 - productImages.length);
    if (toUpload.length === 0) return;

    for (const file of toUpload) {
      if (file.size > 10 * 1024 * 1024) {
        showToast(`الصورة "${file.name}" كبيرة جداً (أقصى 10MB)`, 'error');
        return;
      }
    }

    setUploadingImages(true);
    let cloudCount = 0;
    let localCount = 0;

    for (const file of toUpload) {
      const fileKey = `${file.name}-${Date.now()}`;
      setUploadProgress(prev => ({ ...prev, [fileKey]: 0 }));

      let uploaded = false;

      // ── Try secure server-side upload first (via SERVICE_ROLE) ──
      if (isSupabaseConfigured()) {
        const result = await uploadProductImage(file, (percent) => {
          setUploadProgress(prev => ({ ...prev, [fileKey]: percent }));
        });

        if ('url' in result) {
          setProductImages(prev => [...prev, result.url]);
          cloudCount++;
          uploaded = true;
        } else {
          console.warn(`[Upload] Server upload failed for "${file.name}":`, result.error);
          // Falls through to local fallback below
        }
      }

      // ── Fallback: compress and save as local base64 ──
      if (!uploaded) {
        try {
          const compressed = await compressImage(file, 800, 800, 0.7);
          const dataUrl = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onload = (ev) => resolve(ev.target!.result as string);
            reader.readAsDataURL(new File([compressed.blob], file.name, { type: 'image/jpeg' }));
          });
          setProductImages(prev => [...prev, dataUrl]);
        } catch {
          const dataUrl = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onload = (ev) => resolve(ev.target!.result as string);
            reader.readAsDataURL(file);
          });
          setProductImages(prev => [...prev, dataUrl]);
        }
        localCount++;
      }

      setUploadProgress(prev => {
        const next = { ...prev };
        delete next[fileKey];
        return next;
      });
    }

    setUploadingImages(false);

    if (cloudCount > 0 && localCount === 0) {
      showToast(`✅ تم رفع ${cloudCount} صورة إلى السحابة بأمان`, 'success');
    } else if (cloudCount > 0 && localCount > 0) {
      showToast(`☁️ ${cloudCount} سحابة + 💾 ${localCount} محلي`, 'info');
    } else if (localCount > 0) {
      showToast(`💾 ${localCount} صورة محفوظة محلياً (الخادم غير متوفر)`, 'info');
    }

    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // ── Handle image removal (delete from Supabase if applicable) ──
  const handleRemoveImage = async (index: number) => {
    const url = productImages[index];
    if (url && isSupabaseUrl(url)) {
      await deleteProductImage(url);
      showToast('تم حذف الصورة من Supabase', 'info');
    }
    setProductImages(prev => prev.filter((_, idx) => idx !== index));
  };

  // ═══════════════════════════════════════════════
  // LANDING PAGES — CRUD via API
  // ═══════════════════════════════════════════════
  const getAdminToken = (): string => {
    try { return localStorage.getItem('almiraj_token') || ''; } catch { return ''; }
  };

  const slugify = (text: string): string => {
    return text
      .toLowerCase()
      .trim()
      .replace(/[\s\u0600-\u06FF]+/g, (match) => {
        // Keep Arabic characters, replace spaces with dashes
        return match.replace(/\s+/g, '-');
      })
      .replace(/[^\w\u0600-\u06FF-]/g, '') // Remove special chars except Arabic, alphanumeric, dashes
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      || `page-${Date.now()}`;
  };

  const fetchLandingPages = useCallback(async () => {
    const token = getAdminToken();
    if (!token) { setLpError('يرجى تسجيل الدخول مرة أخرى'); return; }
    setLpLoading(true);
    setLpError(null);
    try {
      const r = await fetch('/api/admin/landing-pages', {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const data = await r.json();
      if (data.ok && Array.isArray(data.data)) {
        setLandingPages(data.data);
        console.log(`[LP] ✅ Loaded ${data.data.length} landing pages`);
      } else {
        setLpError(data.error || 'فشل تحميل صفحات الهبوط');
        console.error('[LP] ❌ Fetch error:', data.error);
      }
    } catch (e) {
      console.error('[LP] 💥 Fetch exception:', e);
      setLpError('تعذر الاتصال بالخادم — تأكد من النشر على Vercel');
    } finally {
      setLpLoading(false);
    }
  }, []);

  // Fetch landing pages when tab is opened
  useEffect(() => {
    if (tab === 'landing' && isAdmin) {
      fetchLandingPages();
    }
  }, [tab, isAdmin, fetchLandingPages]);

  const openAddLp = () => {
    setEditingLp(null);
    setLpForm({ title: '', slug: '', product_id: null, headline: '', description: '', image_url: '', cta_text: 'اشتري الآن', cta_url: '', is_active: true });
    setShowLpForm(true);
  };

  const openEditLp = (lp: LandingPage) => {
    setEditingLp(lp);
    setLpForm({ ...lp });
    setShowLpForm(true);
  };

  const handleLpTitleChange = (title: string) => {
    setLpForm(prev => ({
      ...prev,
      title,
      // Auto-generate slug only for new pages (not editing existing)
      slug: editingLp ? prev.slug : slugify(title),
    }));
  };

  const handleLpImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const file = files[0];
    if (file.size > 10 * 1024 * 1024) {
      showToast('حجم الصورة يجب أن لا يتجاوز 10MB', 'error');
      return;
    }
    setLpImageUploading(true);
    try {
      if (isSupabaseConfigured()) {
        const result = await uploadProductImage(file);
        if ('url' in result) {
          setLpForm(prev => ({ ...prev, image_url: result.url }));
          showToast('✅ تم رفع الصورة', 'success');
        } else {
          showToast('⚠️ فشل رفع الصورة — استخدم رابط URL بدلاً منها', 'error');
        }
      } else {
        // Fallback: compress + base64
        const compressed = await compressImage(file, 1200, 630, 0.8);
        const dataUrl = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = (ev) => resolve(ev.target!.result as string);
          reader.readAsDataURL(new File([compressed.blob], file.name, { type: 'image/jpeg' }));
        });
        setLpForm(prev => ({ ...prev, image_url: dataUrl }));
        showToast('💾 الصورة محفوظة محلياً', 'info');
      }
    } catch {
      showToast('❌ خطأ أثناء رفع الصورة', 'error');
    } finally {
      setLpImageUploading(false);
      if (lpFileInputRef.current) lpFileInputRef.current.value = '';
    }
  };

  const handleSaveLp = async () => {
    if (!lpForm.title.trim()) { showToast('عنوان الصفحة مطلوب', 'error'); return; }
    if (!lpForm.slug.trim()) { showToast('الـ Slug مطلوب', 'error'); return; }

    const token = getAdminToken();
    if (!token) { showToast('يرجى تسجيل الدخول مرة أخرى', 'error'); return; }

    setLpSaving(true);
    try {
      const isEdit = editingLp && editingLp.id;
      const url = isEdit ? `/api/admin/landing-pages/${editingLp.id}` : '/api/admin/landing-pages';
      const method = isEdit ? 'PUT' : 'POST';

      // Build payload — remove id/created_at/updated_at for create
      const payload: Record<string, unknown> = {
        title: lpForm.title.trim(),
        slug: lpForm.slug.trim(),
        product_id: lpForm.product_id || null,
        headline: lpForm.headline.trim(),
        description: lpForm.description.trim(),
        image_url: lpForm.image_url.trim(),
        cta_text: lpForm.cta_text.trim() || 'اشتري الآن',
        cta_url: lpForm.cta_url.trim(),
        is_active: lpForm.is_active,
      };

      const r = await fetch(url, {
        method,
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await r.json();

      if (data.ok) {
        showToast(isEdit ? '✅ تم تحديث صفحة الهبوط' : '✅ تم إنشاء صفحة الهبوط', 'success');
        setShowLpForm(false);
        fetchLandingPages();
      } else {
        const errMsg = data.error || 'فشل الحفظ';
        const details = data.errors ? `\n${JSON.stringify(data.errors)}` : '';
        showToast(`❌ ${errMsg}${details}`, 'error');
      }
    } catch (e) {
      console.error('[LP] Save error:', e);
      showToast('❌ تعذر الاتصال بالخادم', 'error');
    } finally {
      setLpSaving(false);
    }
  };

  const handleToggleLpActive = async (lp: LandingPage) => {
    const token = getAdminToken();
    if (!token || !lp.id) return;
    try {
      const r = await fetch(`/api/admin/landing-pages/${lp.id}`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !lp.is_active }),
      });
      const data = await r.json();
      if (data.ok) {
        setLandingPages(prev => prev.map(p => p.id === lp.id ? { ...p, is_active: !p.is_active } : p));
        showToast(lp.is_active ? '⏸️ تم تعطيل الصفحة' : '✅ تم تفعيل الصفحة');
      } else {
        showToast(`❌ ${data.error || 'فشل التحديث'}`, 'error');
      }
    } catch {
      showToast('❌ تعذر الاتصال بالخادم', 'error');
    }
  };

  const handleDeleteLp = async (id: string) => {
    const token = getAdminToken();
    if (!token) return;
    try {
      const r = await fetch(`/api/admin/landing-pages/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const data = await r.json();
      if (data.ok) {
        setLandingPages(prev => prev.filter(p => p.id !== id));
        showToast('🗑️ تم حذف صفحة الهبوط');
      } else {
        showToast(`❌ ${data.error || 'فشل الحذف'}`, 'error');
      }
    } catch {
      showToast('❌ تعذر الاتصال بالخادم', 'error');
    }
    setLpDelConfirm(null);
  };

  // ---- LOGIN PAGE ----
  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#071226] via-[#0B1833] to-[#183C6B] flex items-center justify-center p-4" dir="rtl">
        {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
        <div className="bg-white rounded-3xl shadow-2xl p-8 w-full max-w-md">
          <div className="text-center mb-8"><div className="flex justify-center mb-4"><Logo size="lg" /></div><h1 className="text-2xl font-bold text-blue-800">لوحة تحكم المعراج</h1><p className="text-gray-400 text-sm mt-1">للمسؤولين فقط</p></div>
          <div className="space-y-5">
            <div><label className="block text-sm font-bold text-gray-700 mb-2">👤 اسم المستخدم</label><input type="text" value={adminUsername} onChange={e => setAdminUsername(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleLogin()} className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 focus:border-[#183C6B] outline-none text-lg" placeholder="admin" /></div>
            <div><label className="block text-sm font-bold text-gray-700 mb-2">🔒 كلمة المرور</label><input type="password" value={adminPassword} onChange={e => setAdminPassword(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleLogin()} className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 focus:border-[#183C6B] outline-none text-lg" placeholder="••••••••" /></div>
            {adminLoginError && <div className="bg-red-50 border-2 border-red-200 rounded-xl p-3 text-red-600 text-sm font-bold text-center">❌ {adminLoginError}</div>}
            <button onClick={handleLogin} disabled={loginLoading} className={`w-full py-4 rounded-xl font-bold text-lg transition-all shadow-lg text-white ${loginLoading ? 'bg-gray-400 cursor-not-allowed' : 'bg-[#102A52] hover:bg-blue-800'}`}>{loginLoading ? '⏳ جاري التحقق...' : '🔐 دخول'}</button>
            <button onClick={onBackToStore} className="w-full border-2 border-gray-200 text-gray-600 py-3 rounded-xl font-bold transition-all hover:bg-gray-50">← العودة للمتجر</button>
          </div>
          <div className="mt-6 bg-blue-50 rounded-xl p-4 text-center"><p className="text-xs text-[#183C6B]">🔒 الوصول مخصص للمسؤولين فقط</p></div>
        </div>
      </div>
    );
  }

  // ---- ADMIN DASHBOARD ----
  return (
    <div className="min-h-screen bg-gray-100" dir="rtl">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* Header */}
      <header className="bg-[#0B1833] text-white px-4 py-3 flex items-center justify-between shadow-lg fixed top-0 left-0 right-0 z-50">
        <div className="flex items-center gap-3"><Logo size="sm" /><div><h1 className="font-bold text-base">لوحة تحكم المعراج</h1><p className="text-blue-200 text-xs">مرحباً بك أيها المسؤول</p></div></div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <button onClick={() => setShowNotif(!showNotif)} className="relative bg-[#102A52] hover:bg-[#183C6B] p-2 rounded-xl transition-all">🔔{unread > 0 && <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">{unread}</span>}</button>
            {showNotif && (<div className="absolute left-0 top-12 w-72 bg-white rounded-xl shadow-2xl border z-50"><div className="bg-[#0B1833] text-white px-4 py-3 font-bold flex justify-between rounded-t-xl"><span>الإشعارات</span><button onClick={() => setNotifications(prev => prev.map(n => ({ ...n, read: true })))} className="text-xs text-blue-200 hover:text-white">تعيين الكل كمقروء</button></div><div className="max-h-64 overflow-y-auto">{notifications.length === 0 ? <p className="text-center text-gray-400 py-6 text-sm">لا توجد إشعارات</p> : notifications.map(n => (<div key={n.id} className={`px-4 py-3 border-b text-sm ${n.read ? 'bg-white text-gray-500' : 'bg-blue-50 text-[#0B1833] font-bold'}`}>{n.message}</div>))}</div></div>)}
          </div>
          <button onClick={onBackToStore} className="bg-[#102A52] hover:bg-[#183C6B] px-3 py-2 rounded-xl text-sm transition-all font-bold">🏪 المتجر</button>
          <button onClick={handleLogout} className="bg-red-600 hover:bg-red-700 px-3 py-2 rounded-xl text-sm transition-all font-bold">🚪 خروج</button>
        </div>
      </header>

      <div className="flex pt-16">
        {/* Sidebar */}
        <aside className="w-56 bg-white shadow-lg fixed top-16 right-0 bottom-0 overflow-y-auto hidden md:block">
          <nav className="p-4 space-y-2">
            {[{ id: 'dashboard' as const, icon: '📊', label: 'لوحة المعلومات' }, { id: 'orders' as const, icon: '📋', label: `الطلبات (${orders.length})` }, { id: 'products' as const, icon: '📦', label: `المنتجات (${products.length})` }, { id: 'landing' as const, icon: '🚀', label: `صفحات الهبوط (${landingPages.length})` }].map(t => (
              <button key={t.id} onClick={() => setTab(t.id)} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-all text-right ${tab === t.id ? 'bg-[#183C6B] text-white shadow-md' : 'text-gray-600 hover:bg-blue-50 hover:text-blue-700'}`}><span className="text-xl">{t.icon}</span><span className="text-sm">{t.label}</span></button>
            ))}
          </nav>
          <div className="p-4 space-y-3 border-t mt-4"><div className="bg-blue-50 rounded-xl p-3"><p className="text-xs text-gray-500">الإيرادات الكلية</p><p className="text-lg font-bold text-blue-700">{totalRevenue.toLocaleString()} دج</p></div><div className="bg-yellow-50 rounded-xl p-3"><p className="text-xs text-gray-500">طلبات معلقة</p><p className="text-lg font-bold text-yellow-700">{pendingCount}</p></div></div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 md:mr-56 p-4 md:p-6">
          {/* Mobile Tabs */}
          <div className="flex md:hidden gap-2 mb-4 overflow-x-auto">
            {[{ id: 'dashboard' as const, label: '📊 لوحة' }, { id: 'orders' as const, label: '📋 الطلبات' }, { id: 'products' as const, label: '📦 المنتجات' }, { id: 'landing' as const, label: '🚀 هبوط' }].map(t => (
              <button key={t.id} onClick={() => setTab(t.id)} className={`px-4 py-2 rounded-xl font-bold text-sm whitespace-nowrap transition-all ${tab === t.id ? 'bg-[#183C6B] text-white' : 'bg-white text-gray-600'}`}>{t.label}</button>
            ))}
          </div>

          {/* DASHBOARD TAB */}
          {tab === 'dashboard' && (<div className="space-y-6">
            <h2 className="text-2xl font-bold text-gray-800">📊 لوحة المعلومات</h2>

            {/* System status bar - full diagnostics moved to /admin/system */}
          <div className="rounded-2xl border-2 p-4 flex flex-wrap items-center justify-between gap-3 bg-green-50 border-green-200">
            <div className="flex items-center gap-2">
              <span className="text-2xl">🟢</span>
              <span className="font-bold text-sm text-gray-800">جميع أنظمة المتجر تعمل بشكل طبيعي</span>
            </div>
            <button
              onClick={() => setTab('system')}
              className="text-sm font-bold text-blue-700 hover:text-blue-900 underline"
            >
              عرض التفاصيل →
            </button>
          </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[{ label: 'إجمالي الطلبات', value: orders.length, icon: '📋', bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700' }, { label: 'الطلبات المعلقة', value: pendingCount, icon: '⏳', bg: 'bg-yellow-50', border: 'border-yellow-200', text: 'text-yellow-700' }, { label: 'إجمالي الإيرادات', value: `${totalRevenue.toLocaleString()}`, icon: '💰', bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700' }, { label: 'عدد المنتجات', value: products.length, icon: '📦', bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-700' }].map((s, i) => (
                <div key={i} className={`${s.bg} border-2 ${s.border} rounded-2xl p-4`}><div className="flex items-center justify-between mb-2"><span className="text-2xl">{s.icon}</span><span className={`text-xl font-bold ${s.text}`}>{s.value}</span></div><p className="text-gray-600 text-sm font-medium">{s.label}</p></div>
              ))}
            </div>
            <div className="bg-white rounded-2xl shadow-md p-6">
              <h3 className="text-lg font-bold text-gray-800 mb-4">🕐 آخر الطلبات</h3>
              {orders.length === 0 ? <div className="text-center py-10"><p className="text-5xl mb-3">📭</p><p className="text-gray-400">لا توجد طلبات بعد</p></div> : (
                <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="bg-gray-50"><th className="px-3 py-3 text-right text-gray-600 font-bold rounded-r-xl">رقم التتبع</th><th className="px-3 py-3 text-right text-gray-600 font-bold">العميل</th><th className="px-3 py-3 text-right text-gray-600 font-bold">الولاية</th><th className="px-3 py-3 text-right text-gray-600 font-bold">المبلغ</th><th className="px-3 py-3 text-right text-gray-600 font-bold rounded-l-xl">الحالة</th></tr></thead><tbody>{orders.slice(0, 5).map(order => (<tr key={order.id} className="border-b hover:bg-gray-50"><td className="px-3 py-3 font-mono text-[#102A52] font-bold text-xs">{order.tracking}</td><td className="px-3 py-3 font-bold">{order.customer}</td><td className="px-3 py-3 text-gray-600">{order.wilaya}</td><td className="px-3 py-3 font-bold text-blue-700">{order.total.toLocaleString()} دج</td><td className="px-3 py-3"><span className={`px-2 py-1 rounded-full text-xs font-bold ${order.status === 'pending' ? 'bg-yellow-100 text-yellow-700' : order.status === 'confirmed' ? 'bg-blue-100 text-blue-700' : order.status === 'shipped' ? 'bg-purple-100 text-purple-700' : order.status === 'delivered' ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'}`}>{order.status === 'pending' ? '⏳ معلق' : order.status === 'confirmed' ? '✅ مؤكد' : order.status === 'shipped' ? '🚚 مشحون' : order.status === 'delivered' ? '📦 موصل' : '❌ ملغي'}</span></td></tr>))}</tbody></table></div>
              )}
            </div>
          </div>)}
          {/* SYSTEM TAB - separated diagnostics page (/admin/system) */}
          {tab === 'system' && (
            <div className="space-y-6">
              <button
                onClick={() => setTab('dashboard')}
                className="text-sm font-bold text-blue-700 hover:text-blue-900"
              >
                ← رجوع للوحة المعلومات
              </button>
              <h2 className="text-2xl font-bold text-gray-800">⚙️ النظام والتكاملات</h2>

              {/* Facebook Pixel Status */}
              <div className={`rounded-2xl p-4 border-2 flex items-center gap-3 ${typeof window !== 'undefined' && typeof window.fbq === 'function' ? 'bg-blue-50 border-blue-300' : 'bg-red-50 border-red-300'}`}>
                <span className="text-2xl">{typeof window !== 'undefined' && typeof window.fbq === 'function' ? '✅' : '⚠️'}</span>
                <div className="flex-1">
                  <p className={`font-bold text-sm ${typeof window !== 'undefined' && typeof window.fbq === 'function' ? 'text-blue-700' : 'text-red-700'}`}>
                    {typeof window !== 'undefined' && typeof window.fbq === 'function' ? 'فيسبوك بيكسل مفعّل ✅' : 'فيسبوك بيكسل غير مفعّل ⚠️'}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {typeof window !== 'undefined' && typeof window.fbq === 'function'
                      ? 'جميع أحداث الكتالوج تعمل: PageView, ViewContent, AddToCart, InitiateCheckout, Purchase, Search'
                      : 'استبدل YOUR_PIXEL_ID في index.html برقم البيكسل الخاص بك من Facebook Business Manager'}
                  </p>
                </div>
                <a href="https://business.facebook.com/events_manager" target="_blank" rel="noopener noreferrer" className="bg-[#183C6B] hover:bg-[#102A52] text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap">📊 Events Manager</a>
              </div>

              {/* NOEST API Status */}
              <NoestStatusCard showToast={showToast} />

              {/* Supabase Storage Status */}
              <SupabaseStatusCard showToast={showToast} />

              {/* System Health Check */}
              <SystemHealthCard showToast={showToast} />
            </div>
          )}

          {/* ORDERS TAB */}
          {tab === 'orders' && (<div className="space-y-4">
            <h2 className="text-2xl font-bold text-gray-800">📋 إدارة الطلبات</h2>
            {orders.length === 0 ? <div className="bg-white rounded-2xl shadow-md p-12 text-center"><p className="text-6xl mb-4">📭</p><p className="text-gray-400 text-lg">لا توجد طلبات بعد</p></div> : orders.map(order => (
              <div key={order.id} className="bg-white rounded-2xl shadow-md p-5">
                <div className="flex flex-wrap items-start justify-between gap-3 mb-3"><div><div className="flex items-center gap-2 mb-1 flex-wrap"><span className="font-mono text-[#102A52] font-bold">{order.tracking}</span>{order.noestId && <span className="bg-blue-100 text-[#102A52] text-xs px-2 py-0.5 rounded-full font-bold">✅ NOEST</span>}</div><p className="text-gray-600 text-sm">👤 {order.customer} | 📞 {order.phone}</p><p className="text-gray-600 text-sm">📍 {order.wilaya} - {order.address}</p><p className="text-gray-600 text-sm">🚚 {order.deliveryType === 'home' ? 'توصيل للمنزل' : `مكتب: ${order.selectedOffice || ''}`}</p></div><div className="text-left"><p className="text-xl font-bold text-blue-700">{order.total.toLocaleString()} دج</p><p className="text-gray-400 text-xs">{order.date}</p></div></div>
                <div className="bg-gray-50 rounded-xl p-3 mb-3">{order.items.map(item => (<div key={item.id} className="flex justify-between text-sm"><span>{item.name} × {item.quantity}</span><span className="font-bold">{(item.price * item.quantity).toLocaleString()} دج</span></div>))}</div>
                <div className="flex flex-wrap gap-2">{(['pending', 'confirmed', 'shipped', 'delivered', 'cancelled'] as Order['status'][]).map(status => (<button key={status} onClick={() => { setOrders(prev => prev.map(o => o.id === order.id ? { ...o, status } : o)); db.updateOrderStatus(order.id, status); showToast('تم تحديث حالة الطلب'); }} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${order.status === status ? 'bg-[#183C6B] text-white' : 'bg-gray-100 text-gray-600 hover:bg-blue-50 hover:text-blue-700'}`}>{status === 'pending' ? '⏳ معلق' : status === 'confirmed' ? '✅ مؤكد' : status === 'shipped' ? '🚚 مشحون' : status === 'delivered' ? '📦 موصل' : '❌ ملغي'}</button>))}</div>
              </div>
            ))}
          </div>)}

          {/* PRODUCTS TAB */}
          {tab === 'products' && (<div className="space-y-6">
            <div className="flex items-center justify-between"><h2 className="text-2xl font-bold text-gray-800">📦 إدارة المنتجات</h2><button onClick={openAddProduct} className="bg-[#183C6B] hover:bg-[#102A52] text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 transition-all shadow-md">➕ إضافة منتج</button></div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {products.map(product => (
                <div key={product.id} className="bg-white rounded-2xl shadow-md overflow-hidden hover:shadow-lg transition-all">
                  <div className="relative h-40"><img src={safeImage(product.images)} alt={product.name} className="w-full h-full object-cover" />{product.badge && <span className="absolute top-2 right-2 bg-amber-500 text-white text-xs px-2 py-1 rounded-full font-bold">{product.badge}</span>}<span className="absolute top-2 left-2 bg-[#102A52] text-white text-xs px-2 py-1 rounded-full font-bold">{product.category}</span></div>
                  <div className="p-4"><h3 className="font-bold text-gray-800 mb-1 text-sm">{product.name}</h3><div className="flex items-center justify-between mb-3"><span className="text-[#102A52] font-bold">{product.price.toLocaleString()} دج</span><span className="text-gray-400 text-xs">مخزون: {product.stock}</span></div><div className="flex gap-2"><button onClick={() => openEditProduct(product)} className="flex-1 bg-blue-50 hover:bg-blue-100 text-[#102A52] py-2 rounded-lg font-bold text-sm transition-all">✏️ تعديل</button><button onClick={() => setDeleteConfirm(product.id)} className="flex-1 bg-red-50 hover:bg-red-100 text-red-700 py-2 rounded-lg font-bold text-sm transition-all">🗑️ حذف</button></div></div>
                </div>
              ))}
            </div>
          </div>)}

          {/* ═══════════════════════════════════════════ */}
          {/* LANDING PAGES TAB                          */}
          {/* ═══════════════════════════════════════════ */}
          {tab === 'landing' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <h2 className="text-2xl font-bold text-gray-800">🚀 صفحات الهبوط</h2>
                <div className="flex items-center gap-2">
                  <button onClick={fetchLandingPages} disabled={lpLoading} className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-2.5 rounded-xl font-bold text-sm transition-all">
                    {lpLoading ? '⏳' : '🔄'}
                  </button>
                  <button onClick={openAddLp} className="bg-[#183C6B] hover:bg-[#102A52] text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 transition-all shadow-md">
                    ➕ إنشاء صفحة
                  </button>
                </div>
              </div>

              {/* Error Banner */}
              {lpError && (
                <div className="bg-red-50 border-2 border-red-200 rounded-2xl p-4 flex items-start gap-3">
                  <span className="text-xl">❌</span>
                  <div className="flex-1">
                    <p className="font-bold text-red-700 text-sm">فشل تحميل صفحات الهبوط</p>
                    <p className="text-red-600 text-xs mt-1">{lpError}</p>
                    <p className="text-red-500 text-xs mt-2">
                      💡 تأكد من: إنشاء جدول <code className="bg-red-100 px-1 rounded">landing_pages</code> في Supabase + نشر المشروع على Vercel + إضافة env vars
                    </p>
                  </div>
                  <button onClick={fetchLandingPages} className="bg-red-200 hover:bg-red-300 text-red-800 px-3 py-1 rounded-lg text-xs font-bold">إعادة المحاولة</button>
                </div>
              )}

              {/* Loading */}
              {lpLoading && !lpError && (
                <div className="bg-white rounded-2xl shadow-md p-12 text-center">
                  <div className="w-10 h-10 border-4 border-blue-200 border-t-[#102A52] rounded-full animate-spin mx-auto mb-3" />
                  <p className="text-gray-500 font-bold">جاري تحميل صفحات الهبوط...</p>
                </div>
              )}

              {/* Empty State */}
              {!lpLoading && !lpError && landingPages.length === 0 && (
                <div className="bg-white rounded-2xl shadow-md p-12 text-center">
                  <p className="text-6xl mb-4">🚀</p>
                  <h3 className="text-xl font-bold text-gray-800 mb-2">لا توجد صفحات هبوط بعد</h3>
                  <p className="text-gray-500 mb-6 text-sm">أنشئ صفحة هبوط مخصصة لكل منتج لاستخدامها في حملاتك الإعلانية على فيسبوك</p>
                  <button onClick={openAddLp} className="bg-[#183C6B] hover:bg-[#102A52] text-white px-6 py-3 rounded-xl font-bold transition-all shadow-md">
                    ➕ إنشاء أول صفحة هبوط
                  </button>
                </div>
              )}

              {/* Landing Pages List */}
              {!lpLoading && landingPages.length > 0 && (
                <div className="space-y-4">
                  {landingPages.map(lp => {
                    const linkedProduct = products.find(p => p.id === lp.product_id);
                    return (
                      <div key={lp.id} className={`bg-white rounded-2xl shadow-md overflow-hidden transition-all hover:shadow-lg ${!lp.is_active ? 'opacity-60' : ''}`}>
                        <div className="flex flex-col sm:flex-row">
                          {/* Image Preview */}
                          {lp.image_url && (
                            <div className="sm:w-48 h-32 sm:h-auto flex-shrink-0">
                              <img src={lp.image_url} alt={lp.title} className="w-full h-full object-cover" />
                            </div>
                          )}
                          {/* Content */}
                          <div className="flex-1 p-4">
                            <div className="flex items-start justify-between gap-3 mb-2">
                              <div>
                                <div className="flex items-center gap-2 flex-wrap mb-1">
                                  <h3 className="font-bold text-gray-800">{lp.title}</h3>
                                  <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${lp.is_active ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'}`}>
                                    {lp.is_active ? '✅ نشط' : '⏸️ معطّل'}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2 flex-wrap text-xs text-gray-500">
                                  <span className="bg-blue-100 text-[#102A52] px-2 py-0.5 rounded font-mono font-bold">/l/{lp.slug}</span>
                                  {linkedProduct && (
                                    <span className="bg-blue-50 text-[#102A52] px-2 py-0.5 rounded font-bold">
                                      📦 {linkedProduct.name}
                                    </span>
                                  )}
                                  {!linkedProduct && lp.product_id && (
                                    <span className="bg-amber-50 text-amber-600 px-2 py-0.5 rounded font-bold">
                                      ⚠️ منتج #{lp.product_id} غير موجود
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>

                            {lp.headline && <p className="text-gray-600 text-sm mb-2 line-clamp-1">{lp.headline}</p>}
                            {lp.cta_text && (
                              <span className="inline-block bg-amber-100 text-amber-700 text-xs px-2 py-0.5 rounded font-bold mb-2">
                                CTA: {lp.cta_text}
                              </span>
                            )}

                            {/* Actions */}
                            <div className="flex flex-wrap gap-2 mt-2">
                              <button onClick={() => handleToggleLpActive(lp)} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${lp.is_active ? 'bg-amber-50 hover:bg-amber-100 text-amber-700' : 'bg-blue-50 hover:bg-blue-100 text-blue-700'}`}>
                                {lp.is_active ? '⏸️ تعطيل' : '▶️ تفعيل'}
                              </button>
                              <button onClick={() => openEditLp(lp)} className="bg-blue-50 hover:bg-blue-100 text-[#102A52] px-3 py-1.5 rounded-lg text-xs font-bold transition-all">
                                ✏️ تعديل
                              </button>
                              <a href={`/l/${lp.slug}`} target="_blank" rel="noopener noreferrer" className="bg-purple-50 hover:bg-purple-100 text-purple-700 px-3 py-1.5 rounded-lg text-xs font-bold transition-all inline-flex items-center gap-1">
                                👁️ معاينة
                              </a>
                              <button onClick={() => {
                                const url = `${window.location.origin}/l/${lp.slug}`;
                                navigator.clipboard.writeText(url).then(() => showToast('✅ تم نسخ رابط الصفحة'));
                              }} className="bg-gray-50 hover:bg-gray-100 text-gray-600 px-3 py-1.5 rounded-lg text-xs font-bold transition-all">
                                🔗 نسخ الرابط
                              </button>
                              <button onClick={() => setLpDelConfirm(lp.id!)} className="bg-red-50 hover:bg-red-100 text-red-700 px-3 py-1.5 rounded-lg text-xs font-bold transition-all mr-auto">
                                🗑️ حذف
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* How to use */}
              {!lpLoading && landingPages.length > 0 && (
                <div className="bg-blue-50 border-2 border-blue-200 rounded-2xl p-4">
                  <h4 className="font-bold text-[#0B1833] text-sm mb-2">📋 كيف تستخدم صفحات الهبوط في حملاتك:</h4>
                  <ul className="text-[#102A52] text-xs space-y-1">
                    <li>1. أنشئ صفحة هبوط وربطها بمنتج</li>
                    <li>2. انسخ الرابط (مثل: <code className="bg-blue-100 px-1 rounded">/l/your-slug</code>)</li>
                    <li>3. استخدم الرابط كـ <strong>Destination URL</strong> في إعلان فيسبوك</li>
                    <li>4. البيكسل يتتبع ViewContent تلقائياً عند زيارة الصفحة</li>
                  </ul>
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      {/* Delete Confirm */}
      {deleteConfirm !== null && (<div className="fixed inset-0 bg-black/60 z-[9000] flex items-center justify-center p-4"><div className="bg-white rounded-2xl shadow-2xl p-8 max-w-sm w-full text-center"><p className="text-5xl mb-4">🗑️</p><h3 className="text-xl font-bold text-gray-800 mb-2">تأكيد الحذف</h3><p className="text-gray-500 mb-6">هل أنت متأكد من حذف هذا المنتج؟</p><div className="flex gap-3"><button onClick={() => { setProducts(prev => prev.filter(p => p.id !== deleteConfirm)); db.deleteProduct(deleteConfirm); setDeleteConfirm(null); showToast('تم حذف المنتج'); }} className="flex-1 bg-red-600 hover:bg-red-700 text-white py-3 rounded-xl font-bold transition-all">نعم، احذف</button><button onClick={() => setDeleteConfirm(null)} className="flex-1 border-2 border-gray-200 text-gray-600 py-3 rounded-xl font-bold hover:bg-gray-50 transition-all">إلغاء</button></div></div></div>)}

      {/* Product Form Modal */}
      {showProductForm && (
        <div className="fixed inset-0 bg-black/60 z-[9000] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="bg-[#102A52] text-white px-6 py-4 flex justify-between items-center"><h3 className="text-lg font-bold">{editingProduct ? '✏️ تعديل المنتج' : '➕ إضافة منتج جديد'}</h3><button onClick={() => setShowProductForm(false)} className="text-white hover:text-gray-200 text-xl">✕</button></div>
            <div className="p-6 space-y-4">
              <div><label className="block text-sm font-bold text-gray-700 mb-2">📸 صور المنتج (حتى 6 صور) {isSupabaseConfigured() ? <span className="text-[#183C6B] text-xs font-normal">🔒 رفع آمن عبر الخادم</span> : <span className="text-amber-500 text-xs font-normal">💾 محلي فقط</span>}</label><div className="grid grid-cols-3 gap-3 mb-3">{productImages.map((img, i) => (<div key={i} className="relative group aspect-square rounded-xl overflow-hidden border-2 border-blue-200"><img src={img} alt="" className="w-full h-full object-cover" />{i === 0 && <span className="absolute top-1 right-1 bg-[#183C6B] text-white text-xs px-1.5 py-0.5 rounded-full">رئيسية</span>}{isSupabaseUrl(img) && <span className="absolute bottom-1 right-1 bg-[#183C6B] text-white text-xs px-1 py-0.5 rounded-full">☁️</span>}<button onClick={() => handleRemoveImage(i)} className="absolute top-1 left-1 bg-red-500 text-white w-6 h-6 rounded-full opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center text-sm">✕</button></div>))}{Object.entries(uploadProgress).map(([key, percent]) => (<div key={key} className="aspect-square rounded-xl border-2 border-blue-300 bg-blue-50 flex flex-col items-center justify-center gap-2"><div className="w-10 h-10 border-4 border-blue-200 border-t-[#183C6B] rounded-full animate-spin" /><span className="text-xs font-bold text-blue-700">{percent}%</span></div>))}{!uploadingImages && productImages.length < 6 && <button onClick={() => fileInputRef.current?.click()} className="aspect-square rounded-xl border-2 border-dashed border-blue-300 hover:border-[#183C6B] flex flex-col items-center justify-center gap-2 text-[#183C6B] hover:bg-blue-50 transition-all"><span className="text-2xl">{isSupabaseConfigured() ? '🔒' : '+'}</span><span className="text-xs font-bold">{isSupabaseConfigured() ? 'رفع آمن' : 'رفع صورة'}</span></button>}</div><input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleImageUpload} /></div>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2"><label className="block text-sm font-bold text-gray-700 mb-1">اسم المنتج *</label><input type="text" value={productForm.name} onChange={e => setProductForm(p => ({ ...p, name: e.target.value }))} className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-[#183C6B] outline-none" placeholder="اسم المنتج" /></div>
                <div><label className="block text-sm font-bold text-gray-700 mb-1">السعر (دج) *</label><input type="number" value={productForm.price} onChange={e => setProductForm(p => ({ ...p, price: e.target.value }))} className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-[#183C6B] outline-none" placeholder="1500" /></div>
                <div><label className="block text-sm font-bold text-gray-700 mb-1">المخزون *</label><input type="number" value={productForm.stock} onChange={e => setProductForm(p => ({ ...p, stock: e.target.value }))} className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-[#183C6B] outline-none" placeholder="50" /></div>
                <div><label className="block text-sm font-bold text-gray-700 mb-1">الطور الدراسي</label><select value={productForm.category} onChange={e => { const newCat = e.target.value as Product['category']; setProductForm(p => ({ ...p, category: newCat, level: LEVELS_BY_CATEGORY[newCat].some(l => l.value === p.level) ? p.level : '' })); }} className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-[#183C6B] outline-none"><option value="تحضيري">تحضيري</option><option value="ابتدائي">ابتدائي</option><option value="متوسط">متوسط</option></select></div>
                <div><label className="block text-sm font-bold text-gray-700 mb-1">المستوى الدراسي (اختياري)</label><select value={productForm.level} onChange={e => setProductForm(p => ({ ...p, level: e.target.value }))} className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-[#183C6B] outline-none"><option value="">بدون تحديد</option>{LEVELS_BY_CATEGORY[productForm.category].map(l => <option key={l.value} value={l.value}>{l.label}</option>)}</select></div>
                <div><label className="block text-sm font-bold text-gray-700 mb-1">شارة (اختياري)</label><input type="text" value={productForm.badge} onChange={e => setProductForm(p => ({ ...p, badge: e.target.value }))} className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-[#183C6B] outline-none" placeholder="الأكثر مبيعاً" /></div>
                <div className="col-span-2"><label className="block text-sm font-bold text-gray-700 mb-1">الوصف</label><textarea value={productForm.description} onChange={e => setProductForm(p => ({ ...p, description: e.target.value }))} className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-[#183C6B] outline-none" rows={3} placeholder="وصف المنتج..." /></div>
                <div className="col-span-2"><label className="block text-sm font-bold text-gray-700 mb-1">الفوائد التعليمية (كل فائدة في سطر)</label><textarea value={productForm.benefits} onChange={e => setProductForm(p => ({ ...p, benefits: e.target.value }))} className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-[#183C6B] outline-none" rows={3} placeholder={"فائدة 1\nفائدة 2\nفائدة 3"} /></div>
                <div className="col-span-2"><label className="block text-sm font-bold text-gray-700 mb-1">محتويات المنتج (كل عنصر في سطر — تظهر في صفحة المنتج)</label><textarea value={productForm.contents} onChange={e => setProductForm(p => ({ ...p, contents: e.target.value }))} className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-[#183C6B] outline-none" rows={3} placeholder={"مثال: 20 بطاقة تعليمية ملونة\nدليل استخدام\nعلبة تغليف أنيقة"} /></div>
              </div>
              <div className="flex gap-3 pt-2"><button onClick={handleSaveProduct} className="flex-1 bg-[#183C6B] hover:bg-[#102A52] text-white py-3 rounded-xl font-bold transition-all">💾 {editingProduct ? 'حفظ التعديلات' : 'إضافة المنتج'}</button><button onClick={() => setShowProductForm(false)} className="flex-1 border-2 border-gray-200 text-gray-600 py-3 rounded-xl font-bold hover:bg-gray-50 transition-all">إلغاء</button></div>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════ */}
      {/* LANDING PAGE FORM MODAL                    */}
      {/* ═══════════════════════════════════════════ */}
      {showLpForm && (
        <div className="fixed inset-0 bg-black/60 z-[9000] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="bg-[#102A52] text-white px-6 py-4 flex justify-between items-center">
              <h3 className="text-lg font-bold">{editingLp ? '✏️ تعديل صفحة الهبوط' : '➕ إنشاء صفحة هبوط جديدة'}</h3>
              <button onClick={() => setShowLpForm(false)} className="text-white hover:text-gray-200 text-xl">✕</button>
            </div>
            <div className="p-6 space-y-4">
              {/* Title */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">عنوان الصفحة *</label>
                <input
                  type="text"
                  value={lpForm.title}
                  onChange={e => handleLpTitleChange(e.target.value)}
                  className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-[#183C6B] outline-none"
                  placeholder="مثال: بطاقات الأبجدية — عرض خاص"
                />
              </div>

              {/* Slug */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">
                  Slug (المعرّف في الرابط) *
                  <span className="text-xs text-gray-400 font-normal mr-2">— /l/{lpForm.slug || '...'}</span>
                </label>
                <input
                  type="text"
                  value={lpForm.slug}
                  onChange={e => setLpForm(prev => ({ ...prev, slug: e.target.value.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9\u0600-\u06FF-]/g, '') }))}
                  className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-[#183C6B] outline-none font-mono text-sm"
                  placeholder="alphabet-cards"
                  dir="ltr"
                />
                <p className="text-xs text-gray-400 mt-1">يتم توليده تلقائياً من العنوان. يمكنك تعديله يدوياً.</p>
              </div>

              {/* Product Select */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">المنتج المرتبط</label>
                <select
                  value={lpForm.product_id || ''}
                  onChange={e => {
                    const pid = e.target.value ? Number(e.target.value) : null;
                    const product = pid ? products.find(p => p.id === pid) : null;
                    setLpForm(prev => ({
                      ...prev,
                      product_id: pid,
                      // Auto-fill from product if fields are empty
                      headline: prev.headline || product?.name || '',
                      description: prev.description || safeStr(product?.description) || '',
                      image_url: prev.image_url || safeImage(product?.images) || '',
                      cta_url: pid ? `/?checkout=1` : prev.cta_url,
                    }));
                  }}
                  className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-[#183C6B] outline-none"
                >
                  <option value="">— بدون منتج مرتبط —</option>
                  {products.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.price.toLocaleString()} دج) — {p.category}
                    </option>
                  ))}
                </select>
              </div>

              {/* Headline */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">العنوان الرئيسي (Headline)</label>
                <input
                  type="text"
                  value={lpForm.headline}
                  onChange={e => setLpForm(prev => ({ ...prev, headline: e.target.value }))}
                  className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-[#183C6B] outline-none"
                  placeholder="علّم الحروف بطريقة تفاعلية وممتعة!"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">الوصف</label>
                <textarea
                  value={lpForm.description}
                  onChange={e => setLpForm(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-[#183C6B] outline-none"
                  rows={3}
                  placeholder="وصف جذاب يظهر في صفحة الهبوط..."
                />
              </div>

              {/* Image */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">صورة الغلاف</label>
                <div className="flex gap-3 items-start">
                  {/* Preview */}
                  {lpForm.image_url && (
                    <div className="relative w-32 h-20 rounded-xl overflow-hidden border-2 border-blue-200 flex-shrink-0">
                      <img src={lpForm.image_url} alt="Preview" className="w-full h-full object-cover" />
                      <button onClick={() => setLpForm(prev => ({ ...prev, image_url: '' }))} className="absolute top-1 left-1 bg-red-500 text-white w-5 h-5 rounded-full flex items-center justify-center text-xs">✕</button>
                    </div>
                  )}
                  <div className="flex-1 space-y-2">
                    <input
                      type="text"
                      value={lpForm.image_url}
                      onChange={e => setLpForm(prev => ({ ...prev, image_url: e.target.value }))}
                      className="w-full border-2 border-gray-200 rounded-xl px-4 py-2 focus:border-[#183C6B] outline-none text-sm"
                      placeholder="رابط الصورة (URL) أو ارفع من جهازك"
                      dir="ltr"
                    />
                    <button
                      onClick={() => lpFileInputRef.current?.click()}
                      disabled={lpImageUploading}
                      className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${lpImageUploading ? 'bg-gray-300 text-gray-500' : 'bg-blue-100 hover:bg-blue-200 text-blue-700'}`}
                    >
                      {lpImageUploading ? '⏳ جاري الرفع...' : '📤 رفع صورة'}
                    </button>
                    <input ref={lpFileInputRef} type="file" accept="image/*" className="hidden" onChange={handleLpImageUpload} />
                  </div>
                </div>
              </div>

              {/* CTA Text + URL */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">نص الزر (CTA)</label>
                  <input
                    type="text"
                    value={lpForm.cta_text}
                    onChange={e => setLpForm(prev => ({ ...prev, cta_text: e.target.value }))}
                    className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-[#183C6B] outline-none"
                    placeholder="اشتري الآن"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">رابط الزر (اختياري)</label>
                  <input
                    type="text"
                    value={lpForm.cta_url}
                    onChange={e => setLpForm(prev => ({ ...prev, cta_url: e.target.value }))}
                    className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-[#183C6B] outline-none text-sm"
                    placeholder="افتراضي: رابط Checkout المنتج"
                    dir="ltr"
                  />
                </div>
              </div>

              {/* Active Toggle */}
              <div className="flex items-center gap-3 bg-gray-50 rounded-xl p-4">
                <button
                  onClick={() => setLpForm(prev => ({ ...prev, is_active: !prev.is_active }))}
                  className={`w-12 h-7 rounded-full transition-all relative ${lpForm.is_active ? 'bg-[#183C6B]' : 'bg-gray-300'}`}
                >
                  <span className={`absolute top-0.5 w-6 h-6 bg-white rounded-full shadow transition-all ${lpForm.is_active ? 'left-0.5' : 'right-0.5'}`} />
                </button>
                <div>
                  <p className="font-bold text-sm text-gray-700">{lpForm.is_active ? '✅ الصفحة نشطة' : '⏸️ الصفحة معطّلة'}</p>
                  <p className="text-xs text-gray-500">{lpForm.is_active ? 'الصفحة مرئية للزوار' : 'الصفحة مخفية عن الزوار'}</p>
                </div>
              </div>

              {/* Preview URL */}
              {lpForm.slug && (
                <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-3 flex items-center gap-2">
                  <span className="text-[#102A52] font-bold text-sm">🔗 الرابط:</span>
                  <code className="text-[#0B1833] text-xs font-mono bg-blue-100 px-2 py-1 rounded flex-1" dir="ltr">
                    {window.location.origin}/l/{lpForm.slug}
                  </code>
                </div>
              )}

              {/* Buttons */}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={handleSaveLp}
                  disabled={lpSaving}
                  className={`flex-1 py-3 rounded-xl font-bold transition-all text-white ${lpSaving ? 'bg-gray-400 cursor-not-allowed' : 'bg-[#183C6B] hover:bg-blue-700'}`}
                >
                  {lpSaving ? '⏳ جاري الحفظ...' : `💾 ${editingLp ? 'حفظ التعديلات' : 'إنشاء الصفحة'}`}
                </button>
                <button
                  onClick={() => setShowLpForm(false)}
                  className="flex-1 border-2 border-gray-200 text-gray-600 py-3 rounded-xl font-bold hover:bg-gray-50 transition-all"
                >
                  إلغاء
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* LANDING PAGE DELETE CONFIRM */}
      {lpDelConfirm !== null && (
        <div className="fixed inset-0 bg-black/60 z-[9100] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-sm w-full text-center">
            <p className="text-5xl mb-4">🗑️</p>
            <h3 className="text-xl font-bold text-gray-800 mb-2">حذف صفحة الهبوط</h3>
            <p className="text-gray-500 mb-6">هل أنت متأكد؟ لا يمكن التراجع عن هذا الإجراء.</p>
            <div className="flex gap-3">
              <button onClick={() => handleDeleteLp(lpDelConfirm)} className="flex-1 bg-red-600 hover:bg-red-700 text-white py-3 rounded-xl font-bold transition-all">نعم، احذف</button>
              <button onClick={() => setLpDelConfirm(null)} className="flex-1 border-2 border-gray-200 text-gray-600 py-3 rounded-xl font-bold hover:bg-gray-50 transition-all">إلغاء</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// STORE WRAPPER — handles ?checkout=1 from landing page
// ============================================================
function StoreAppWrapper({
  products, cart, setCart, orders, setOrders, setNotifications, onOpenAdmin,
}: {
  products: Product[];
  cart: CartItem[];
  setCart: React.Dispatch<React.SetStateAction<CartItem[]>>;
  orders: Order[];
  setOrders: React.Dispatch<React.SetStateAction<Order[]>>;
  setNotifications: React.Dispatch<React.SetStateAction<Notif[]>>;
  onOpenAdmin: () => void;
}) {
  const [searchParams, setSearchParams] = useSearchParams();

  // If ?checkout=1 is present (from landing page "Buy Now"), auto-open checkout
  useEffect(() => {
    if (searchParams.get('checkout') === '1' && cart.length > 0) {
      // Remove the param so it doesn't re-trigger
      setSearchParams({}, { replace: true });
      // Small delay to let the store render first
      setTimeout(() => {
        // Dispatch a custom event that StoreApp listens for
        window.dispatchEvent(new CustomEvent('open-checkout'));
      }, 300);
    }
  }, [searchParams, cart.length, setSearchParams]);

  return (
    <StoreApp
      products={products}
      cart={cart}
      setCart={setCart}
      orders={orders}
      setOrders={setOrders}
      setNotifications={setNotifications}
      onOpenAdmin={onOpenAdmin}
    />
  );
}

// ============================================================
// MAIN APP - MINIMAL (STABLE HOOKS)
// ============================================================
export function App() {
  const [view, setView] = useState<'store' | 'admin'>('store');
  // ── START EMPTY — no hardcoded data. DB is the source of truth. ──
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [notifications, setNotifications] = useState<Notif[]>([]);
  const [dbError, setDbError] = useState<string | null>(null);
  const [dbLoading, setDbLoading] = useState(true);
  const [dbSource, setDbSource] = useState<'supabase' | 'fallback' | 'loading'>('loading');
  const navigate = useNavigate();

  // ── Fetch products from Supabase on mount ──────────────────
  useEffect(() => {
    let cancelled = false;

    (async () => {
      setDbLoading(true);
      setDbSource('loading');
      console.log('[DB] 🔄 Fetching products...');

      try {
        const result = await db.fetchProducts();
        if (cancelled) return;

        if (result.ok && result.data && result.data.length > 0) {
          // ✅ DB has real products — sanitize then use them
          console.log(`[DB] ✅ Loaded ${result.data.length} products from Supabase`);
          // Sanitize: ensure images/benefits are always arrays, description is always string
          const sanitized = (result.data as Product[]).map(p => ({
            ...p,
            images: safeImages(p.images).length > 0 ? safeImages(p.images) : [PLACEHOLDER_IMAGE],
            description: safeStr(p.description),
            benefits: safeArr(p.benefits),
            contents: safeArr(p.contents),
            level: p.level || undefined,
          }));
          setProducts(sanitized);
          setDbSource('supabase');
          setDbError(null);
        } else if (result.ok && result.data && result.data.length === 0) {
          // DB connected but empty — seed then use initialProducts
          console.log('[DB] 📦 Empty database — seeding initial products...');
          const seedResult = await db.seedProducts(initialProducts as unknown as Parameters<typeof db.seedProducts>[0]);
          if (seedResult.ok) {
            console.log('[DB] ✅ Database seeded — reloading from DB...');
            // Re-fetch to confirm seed worked
            const refetch = await db.fetchProducts();
            if (!cancelled && refetch.ok && refetch.data && refetch.data.length > 0) {
              setProducts(refetch.data as Product[]);
              setDbSource('supabase');
            } else {
              // Seed wrote but re-fetch failed — use local copy
              setProducts(initialProducts);
              setDbSource('fallback');
            }
          } else {
            console.warn('[DB] ⚠️ Seed failed:', seedResult.error);
            setProducts(initialProducts);
            setDbSource('fallback');
          }
        } else if (result.error === 'TABLE_NOT_FOUND') {
          console.error('[DB] ❌ Table "products" does not exist');
          setDbError('⚠️ جدول products غير موجود في Supabase — شغّل SQL الإعداد من لوحة التحكم أو Supabase Dashboard. زُر /api/health للحصول على كود SQL.');
          setProducts(initialProducts);
          setDbSource('fallback');
        } else if (result.error === 'RLS_DENIED') {
          console.error('[DB] ❌ RLS permission denied');
          setDbError('🔒 صلاحيات قراءة المنتجات مرفوضة — أضف RLS Policy: SELECT for anon with USING (true) على جدول products. زُر /api/health للتفاصيل.');
          setProducts(initialProducts);
          setDbSource('fallback');
        } else if (result.error === 'SUPABASE_NOT_CONFIGURED') {
          console.warn('[DB] ⚠️ Supabase not configured — using fallback data');
          setProducts(initialProducts);
          setDbSource('fallback');
          // No error banner for this — expected in dev mode
        } else if (result.error === 'API_UNREACHABLE') {
          console.warn('[DB] ⚠️ API unreachable — using fallback data');
          setProducts(initialProducts);
          setDbSource('fallback');
        } else {
          // Unknown/unexpected error
          console.error('[DB] ❌ Unexpected error:', result.error, result.code);
          setDbError(`❌ فشل تحميل المنتجات من قاعدة البيانات: ${result.error || 'خطأ غير معروف'}`);
          setProducts(initialProducts);
          setDbSource('fallback');
        }
      } catch (e) {
        if (!cancelled) {
          console.error('[DB] 💥 Critical fetch error:', e);
          setDbError('❌ خطأ غير متوقع أثناء تحميل المنتجات — تحقق من اتصال الإنترنت وأعد المحاولة');
          setProducts(initialProducts);
          setDbSource('fallback');
        }
      } finally {
        if (!cancelled) setDbLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, []);

  // ── Fetch orders from Supabase when admin opens ────────────
  useEffect(() => {
    if (view !== 'admin') return;
    let cancelled = false;

    (async () => {
      console.log('[DB] 🔄 Fetching orders...');
      try {
        const result = await db.fetchOrders();
        if (cancelled) return;

        if (result.ok && result.data) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const mapped = result.data.map((o: any) => ({
            id: o.id as string,
            tracking: o.tracking as string,
            customer: o.customer as string,
            phone: o.phone as string,
            wilaya: o.wilaya as string,
            address: o.address as string,
            items: o.items as CartItem[],
            total: o.total as number,
            shipping: o.shipping as number,
            deliveryType: (o.delivery_type || o.deliveryType || 'home') as 'home' | 'office',
            selectedOffice: (o.selected_office || o.selectedOffice) as string | undefined,
            status: o.status as Order['status'],
            date: o.date as string,
            noestId: (o.noest_id || o.noestId) as string | undefined,
          }));
          console.log(`[DB] ✅ Loaded ${mapped.length} orders from Supabase`);
          setOrders(mapped);
        } else if (result.error === 'TABLE_NOT_FOUND') {
          console.error('[DB] ❌ Table "orders" does not exist');
          setDbError('⚠️ جدول orders غير موجود في Supabase — شغّل SQL الإعداد');
        } else if (result.error && result.error !== 'NO_TOKEN' && result.error !== 'SUPABASE_NOT_CONFIGURED' && result.error !== 'API_UNREACHABLE') {
          console.error('[DB] ❌ Orders fetch error:', result.error);
          setDbError(`⚠️ فشل تحميل الطلبات: ${result.error}`);
        }
      } catch (e) {
        if (!cancelled) {
          console.error('[DB] 💥 Orders critical error:', e);
        }
      }
    })();

    return () => { cancelled = true; };
  }, [view]);

  // ── Hash-based admin navigation ────────────────────────────
  useEffect(() => {
    const checkHash = () => {
      if (window.location.hash === '#admin' || window.location.pathname.includes('admin')) {
        setView('admin');
      }
    };
    checkHash();
    window.addEventListener('hashchange', checkHash);
    return () => window.removeEventListener('hashchange', checkHash);
  }, []);

  // ── LOADING SCREEN — shows while fetching from DB ──────────
  if (dbLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-white flex items-center justify-center" dir="rtl">
        <div className="text-center space-y-6">
          <Logo size="lg" />
          <div className="flex items-center justify-center gap-3">
            <div className="w-8 h-8 border-4 border-blue-200 border-t-[#102A52] rounded-full animate-spin" />
            <span className="text-[#102A52] font-bold text-lg">جاري تحميل المنتجات...</span>
          </div>
          <p className="text-gray-400 text-sm">الاتصال بقاعدة البيانات</p>
        </div>
      </div>
    );
  }

  // ── Error Banner (persistent, dismissible, with retry) ─────
  const errorBanner = dbError ? (
    <div className="bg-red-100 border-b-2 border-red-300 text-red-800 px-4 py-3 flex items-center gap-3 text-sm font-bold sticky top-0 z-[9999]" dir="rtl">
      <span className="text-lg">⚠️</span>
      <span className="flex-1">{dbError}</span>
      <button onClick={() => window.location.reload()} className="bg-red-200 hover:bg-red-300 text-red-800 px-3 py-1 rounded-lg text-xs font-bold whitespace-nowrap">🔄 إعادة تحميل</button>
      <button onClick={() => setDbError(null)} className="text-red-500 hover:text-red-700 font-bold text-lg">✕</button>
    </div>
  ) : null;

  // ── Data source warning (non-critical, auto-dismiss) ───────
  const sourceWarning = dbSource === 'fallback' && !dbError ? (
    <div className="bg-amber-50 border-b border-amber-200 text-amber-700 px-4 py-2 flex items-center gap-2 text-xs font-medium sticky top-0 z-[9998]" dir="rtl">
      <span>💾</span>
      <span>البيانات محلية مؤقتة — التغييرات لن تُحفظ بعد إعادة التحميل. <button onClick={() => { setView('admin'); window.location.hash = 'admin'; }} className="underline font-bold">افتح لوحة التحكم</button> لإعداد قاعدة البيانات.</span>
    </div>
  ) : null;

  if (view === 'admin') {
    return (
      <>
        {errorBanner}
        {sourceWarning}
        <AdminApp
          products={products}
          setProducts={setProducts}
          orders={orders}
          setOrders={setOrders}
          notifications={notifications}
          setNotifications={setNotifications}
          onBackToStore={() => { setView('store'); window.location.hash = ''; navigate('/'); }}
        />
      </>
    );
  }

  return (
    <>
      {errorBanner}
      {sourceWarning}
      <Routes>
        <Route
          path="/l/:slug"
          element={<DynamicLanding />}
        />
        <Route
          path="/lp/:slug"
          element={
            <ProductLanding
              products={products}
              cart={cart}
              setCart={setCart}
            />
          }
        />
        <Route
          path="*"
          element={
            <StoreAppWrapper
              products={products}
              cart={cart}
              setCart={setCart}
              orders={orders}
              setOrders={setOrders}
              setNotifications={setNotifications}
              onOpenAdmin={() => { setView('admin'); window.location.hash = 'admin'; }}
            />
          }
        />
      </Routes>
    </>
  );
}