import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

// ============================================================
// TYPES (shared with App.tsx — keep in sync)
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
  // محتويات المنتج — تظهر فقط إن كانت موجودة (بيانات ديناميكية من لوحة التحكم)
  contents?: string[];
  // المستوى الدراسي (رمز مختصر مثل 1AP أو 1MS) — اختياري، تابع للطور الدراسي (category)
  level?: string;
  badge?: string;
}
// خريطة مسطحة: رمز المستوى → التسمية العربية الكاملة (مطابقة لِـ App.tsx — أبقِها متزامنة)
const LEVEL_LABELS: Record<string, string> = {
  PREP: 'تحضيري',
  '1AP': 'السنة الأولى ابتدائي',
  '2AP': 'السنة الثانية ابتدائي',
  '3AP': 'السنة الثالثة ابتدائي',
  '4AP': 'السنة الرابعة ابتدائي',
  '5AP': 'السنة الخامسة ابتدائي',
  '1MS': 'السنة الأولى متوسط',
  '2MS': 'السنة الثانية متوسط',
  '3MS': 'السنة الثالثة متوسط',
  '4MS': 'السنة الرابعة متوسط',
};

interface CartItem extends Product {
  quantity: number;
}

// ── Facebook Pixel helpers ───────────────────────────────────
declare global {
  interface Window {
    fbq: (action: string, event: string, data?: object) => void;
  }
}

const fbTrack = (event: string, data?: object) => {
  try {
    if (typeof window !== 'undefined' && typeof window.fbq === 'function') {
      window.fbq('track', event, data);
    }
  } catch { /* silent */ }
};

const buildCatalogData = (product: Product, quantity = 1) => ({
  content_name: product.name,
  content_category: product.category,
  content_ids: [String(product.id)],
  content_type: 'product' as const,
  contents: [{ id: String(product.id), quantity }],
  value: product.price * quantity,
  currency: 'DZD',
});

// ── Safe accessors (prevent crashes from null/undefined DB data) ──
const PLACEHOLDER_IMAGE = 'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=400&h=400&fit=crop&auto=format';
const safeImage = (images?: string[] | null, index = 0): string => {
  if (!images || !Array.isArray(images) || images.length === 0) return PLACEHOLDER_IMAGE;
  return images[Math.min(index, images.length - 1)] || PLACEHOLDER_IMAGE;
};
const safeImages = (images?: string[] | null): string[] => (!images || !Array.isArray(images)) ? [] : images;
const safeStr = (str?: string | null, fallback = ''): string => str || fallback;
const safeArr = <T,>(arr?: T[] | null): T[] => (!arr || !Array.isArray(arr)) ? [] : arr;

// ── Slugify helper ───────────────────────────────────────────
function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[\s_]+/g, '-')
    .replace(/[^؀-ۿa-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function findProductBySlug(products: Product[], slug: string): Product | undefined {
  // Try numeric ID first
  const id = parseInt(slug);
  if (!isNaN(id)) {
    return products.find(p => p.id === id);
  }
  // Try slug match
  return products.find(p => slugify(p.name) === slug);
}

// ── Shared Components ────────────────────────────────────────
const Logo = ({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) => {
  const sizes = { sm: 'h-8 w-8', md: 'h-10 w-10', lg: 'h-16 w-16' };
  return <img src="https://i.ibb.co/jkq94GGC/logo.jpg" alt="المعراج" className={`${sizes[size]} rounded-full object-contain`} onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />;
};

const socialLinks = [
  { href: 'https://www.facebook.com/profile.php?id=100068623115888', bg: 'bg-[#183C6B] hover:bg-blue-700', label: 'فيسبوك', icon: 'M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z' },
  { href: 'https://wa.me/213782272080', bg: 'bg-[#183C6B] hover:bg-[#102A52]', label: 'واتساب', icon: 'M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z' },
];

// ── Static FAQ template (dynamic values interpolated per product) ──
function buildFAQs(product: Product): { q: string; a: string }[] {
  return [
    {
      q: 'هل الدفع يكون عند الاستلام؟',
      a: `نعم، الدفع عند استلام "${product.name}" مباشرة من الموصل — بدون أي دفع مسبق أو مخاطرة.`,
    },
    {
      q: 'كم تستغرق مدة التوصيل؟',
      a: 'عادةً بين يومين و5 أيام عمل حسب الولاية، ونغطي جميع ولايات الجزائر الـ58 (توصيل للمنزل أو لأقرب مكتب استلام).',
    },
    {
      q: `هل السعر ${product.price.toLocaleString()} دج يشمل تكلفة التوصيل؟`,
      a: 'السعر المعروض هو سعر المنتج فقط؛ تُحسب تكلفة التوصيل حسب ولايتك وتظهر لك بوضوح قبل تأكيد الطلب.',
    },
    {
      q: 'هل يمكن الاستبدال أو الإرجاع؟',
      a: 'نعم، يمكنك إرجاع أو استبدال المنتج إذا وصل تالفاً أو غير مطابق للوصف — تواصل معنا عبر واتساب فور الاستلام.',
    },
    {
      q: 'كيف أطلب المنتج الآن؟',
      a: 'اضغط على زر "⚡ اطلب الآن" لإتمام الطلب مباشرة، أو "🛒 أضف للسلة" لإضافته مع منتجات أخرى، أو راسلنا عبر واتساب لطلب سريع.',
    },
  ];
}

// ============================================================
// LANDING PAGE COMPONENT
// ============================================================
export default function ProductLanding({
  products,
  cart,
  setCart,
}: {
  products: Product[];
  cart: CartItem[];
  setCart: React.Dispatch<React.SetStateAction<CartItem[]>>;
}) {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const product = slug ? findProductBySlug(products, slug) : undefined;

  const [currentImage, setCurrentImage] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [lightbox, setLightbox] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [showQuickOrder, setShowQuickOrder] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [openFAQ, setOpenFAQ] = useState<number | null>(0);
  const pixelFired = useRef(false);
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  // ── Show toast ─────────────────────────────────────────────
  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }, []);

  // ── Fire ViewContent on mount ──────────────────────────────
  useEffect(() => {
    if (product && !pixelFired.current) {
      pixelFired.current = true;
      fbTrack('ViewContent', buildCatalogData(product));

      // Update page title
      document.title = `${product.name} | المعراج`;
    }
  }, [product]);

  // ── Auto-scroll to top ────────────────────────────────────
  useEffect(() => {
    window.scrollTo(0, 0);
    setCurrentImage(0);
    setQuantity(1);
  }, [slug]);

  // ── Add to cart ────────────────────────────────────────────
  const handleAddToCart = () => {
    if (!product) return;
    setCart(prev => {
      const existing = prev.find(i => i.id === product.id);
      if (existing) {
        return prev.map(i => i.id === product.id ? { ...i, quantity: i.quantity + quantity } : i);
      }
      return [...prev, { ...product, quantity }];
    });
    fbTrack('AddToCart', buildCatalogData(product, quantity));
    showToast(`تمت إضافة "${product.name}" إلى السلة`);
  };

  // ── Buy Now → add to cart and go to store checkout ─────────
  const handleBuyNow = () => {
    handleAddToCart();
    fbTrack('AddToWishlist', buildCatalogData(product!, quantity));
    // Navigate to store and trigger checkout
    navigate('/?checkout=1');
  };

  // ── Quick Order (WhatsApp) ─────────────────────────────────
  const handleQuickOrder = () => {
    if (!customerName || !customerPhone || customerPhone.length < 10) {
      showToast('يرجى ملء الاسم ورقم الهاتف (10 أرقام)');
      return;
    }
    const msg = encodeURIComponent(
      `🛒 طلب جديد من صفحة المنتج\n\n` +
      `📦 المنتج: ${product!.name}\n` +
      `🔢 الكمية: ${quantity}\n` +
      `💰 السعر: ${(product!.price * quantity).toLocaleString()} دج\n\n` +
      `👤 الاسم: ${customerName}\n` +
      `📞 الهاتف: ${customerPhone}`
    );
    window.open(`https://wa.me/213782272080?text=${msg}`, '_blank');
    fbTrack('Lead', { content_name: product!.name, value: product!.price * quantity, currency: 'DZD' });
    showToast('تم تحويلك إلى واتساب لإتمام الطلب');
    setShowQuickOrder(false);
  };

  // ── 404 — Product not found ────────────────────────────────
  if (!product) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center" dir="rtl">
        <div className="text-center p-8 max-w-md">
          <p className="text-6xl mb-4">🔍</p>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">المنتج غير موجود</h1>
          <p className="text-gray-500 mb-6">عذراً، لم نتمكن من العثور على هذا المنتج</p>
          <button
            onClick={() => navigate('/')}
            className="bg-[#102A52] hover:bg-[#0B1833] text-white px-8 py-3 rounded-xl font-bold transition-all"
          >
            🏠 العودة للمتجر
          </button>
        </div>
      </div>
    );
}

  const catEmoji = product.category === 'تحضيري' ? '🎨' : product.category === 'ابتدائي' ? '📚' : '🎓';
  const gallery = safeImages(product.images);
  const contentsList = safeArr(product.contents);
  const faqs = buildFAQs(product);

  // ── Related products (same category, exclude current) ──────
  const related = products
    .filter(p => p.category === product.category && p.id !== product.id)
    .slice(0, 4);

  return (
    <div className="min-h-screen bg-gray-50 font-sans" dir="rtl">
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[9999] bg-[#183C6B] text-white px-6 py-3 rounded-xl shadow-2xl flex items-center gap-3">
          <span>✅</span>
          <span className="font-bold">{toast}</span>
        </div>
      )}

      {/* ── HEADER ──────────────────────────────────────────── */}
      <header className="bg-white shadow-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <button onClick={() => navigate('/')} className="flex items-center gap-3 hover:opacity-80 transition-all">
            <Logo size="md" />
            <div>
              <h1 className="text-xl font-bold text-blue-800">المعراج</h1>
              <p className="text-xs text-[#183C6B]">متجر تعليمي للأساتذة</p>
            </div>
          </button>
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/')}
              className="hidden md:flex items-center gap-2 text-gray-600 hover:text-[#102A52] font-bold text-sm transition-colors"
            >
              🏠 الرئيسية
            </button>
            <button
              onClick={() => navigate('/')}
              className="relative bg-[#102A52] hover:bg-[#0B1833] text-white p-3 rounded-xl transition-all"
            >
              🛒
              {cartCount > 0 && (
                <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center">
                  {cartCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* ── ANNOUNCEMENT BAR ──────────────────────────────────── */}
      <div className="bg-[#0B1833] text-white text-center py-2 text-sm font-medium px-2">
        🎓 أداة تعليمية مبتكرة للأساتذة | 🚚 توصيل لجميع الولايات | 💵 الدفع عند الاستلام
      </div>

      {/* ── BREADCRUMB ─────────────────────────────────────────── */}
      <div className="max-w-6xl mx-auto px-4 pt-4 text-xs text-gray-400 flex items-center gap-2 flex-wrap">
        <button onClick={() => navigate('/')} className="hover:text-[#102A52] font-bold">المتجر</button>
        <span>‹</span>
        <span className="text-gray-500">{catEmoji} {product.category}</span>
        <span>‹</span>
        <span className="text-gray-700 font-bold truncate max-w-[200px]">{product.name}</span>
      </div>

      {/* ── PRODUCT HERO SECTION ─────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-4 py-6 md:py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8">
          {/* ── Image Gallery ─────────────────────────────────── */}
          <div className="space-y-3 md:space-y-4">
            <div className="relative bg-white rounded-2xl overflow-hidden shadow-lg aspect-square cursor-pointer group" onClick={() => setLightbox(true)}>
              <img
                src={safeImage(product.images, currentImage)}
                alt={product.name}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              />
              {product.badge && (
                <span className="absolute top-4 right-4 bg-amber-500 text-white text-sm px-4 py-1.5 rounded-full font-bold shadow-lg">
                  {product.badge}
                </span>
              )}
              <span className="absolute top-4 left-4 bg-[#102A52] text-white text-sm px-3 py-1.5 rounded-full font-bold">
                {catEmoji} {product.category}
              </span>
              <div className="absolute bottom-4 left-4 bg-black/50 text-white text-xs px-3 py-1.5 rounded-full hidden sm:block">
                🔍 اضغط لتكبير الصورة
              </div>
              {gallery.length > 1 && (
                <>
                  <button
                    onClick={(e) => { e.stopPropagation(); setCurrentImage(i => (i - 1 + gallery.length) % gallery.length); }}
                    className="absolute left-3 top-1/2 -translate-y-1/2 bg-white/90 w-10 h-10 rounded-full flex items-center justify-center shadow-md font-bold text-lg hover:bg-white"
                    aria-label="الصورة السابقة"
                  >‹</button>
                  <button
                    onClick={(e) => { e.stopPropagation(); setCurrentImage(i => (i + 1) % gallery.length); }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 bg-white/90 w-10 h-10 rounded-full flex items-center justify-center shadow-md font-bold text-lg hover:bg-white"
                    aria-label="الصورة التالية"
                  >›</button>
                  <div className="absolute bottom-4 right-4 bg-black/50 text-white text-xs px-2.5 py-1 rounded-full">
                    {currentImage + 1} / {gallery.length}
                  </div>
                </>
  )}
            </div>
            {gallery.length > 1 && (
              <div className="flex gap-2.5 overflow-x-auto pb-1">
                {gallery.map((img, i) => (
                  <img
                    key={i}
                    src={img}
                    alt={`${product.name} — صورة ${i + 1}`}
                    onClick={() => setCurrentImage(i)}
                    className={`h-16 w-16 md:h-20 md:w-20 object-cover rounded-xl cursor-pointer flex-shrink-0 transition-all border-2 ${
                      currentImage === i ? 'border-[#183C6B] scale-105 shadow-md' : 'border-transparent opacity-60 hover:opacity-100'
                    }`}
                  />
            ))}
              </div>
            )}
          </div>

          {/* ── Product Info ──────────────────────────────────── */}
          <div className="space-y-5 md:space-y-6">
            {/* Title & Category */}
            <div>
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <span className="bg-blue-100 text-[#102A52] text-xs px-3 py-1 rounded-full font-bold">
                  {catEmoji} المستوى: {product.category}
                </span>
                {product.sales > 80 && (
                  <span className="bg-amber-100 text-amber-700 text-xs px-3 py-1 rounded-full font-bold">
                    🔥 مطلوب بكثرة
                  </span>
                )}
              </div>
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-800 leading-tight">
                {product.name}
              </h1>
              {product.level && LEVEL_LABELS[product.level] && (
                <p className="mt-2 inline-flex items-center gap-1.5 bg-[#0B1833] text-white text-xs sm:text-sm px-3 py-1.5 rounded-full font-bold">
                  📘 {LEVEL_LABELS[product.level]}
                </p>
              )}
            </div>

            {/* Price */}
            <div className="bg-blue-50 border-2 border-blue-200 rounded-2xl p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500 mb-1">السعر</p>
                  <p className="text-3xl sm:text-4xl font-bold text-blue-700">{product.price.toLocaleString()} <span className="text-lg">دج</span></p>
                </div>
                <div className="text-left">
                  <p className="text-sm text-gray-500">المخزون</p>
                  <p className={`font-bold ${product.stock > 10 ? 'text-[#183C6B]' : product.stock > 0 ? 'text-amber-600' : 'text-red-600'}`}>
                    {product.stock > 10 ? '✅ متوفر' : product.stock > 0 ? `⚠️ ${product.stock} فقط` : '❌ نفذ'}
                  </p>
                </div>
              </div>
              {product.sales > 0 && (
                <p className="text-[#183C6B] text-sm mt-2 font-bold">
                  📊 تم بيع {product.sales}+ نسخة
                </p>
              )}
            </div>

            {/* Description */}
            <div>
              <h3 className="text-lg font-bold text-gray-800 mb-2 flex items-center gap-2">📝 الوصف</h3>
              <p className="text-gray-600 leading-relaxed text-base whitespace-pre-line">{safeStr(product.description, 'لا يوجد وصف متاح')}</p>
            </div>

            {/* Benefits */}
            {safeArr(product.benefits).length > 0 && (
              <div className="bg-white rounded-2xl border-2 border-gray-100 p-5">
                <h3 className="text-lg font-bold text-[#0B1833] mb-3 flex items-center gap-2">✅ أهم المميزات</h3>
                <ul className="space-y-2">
                  {safeArr(product.benefits).map((benefit, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <span className="bg-blue-100 text-[#183C6B] w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold mt-0.5">
                        {i + 1}
                      </span>
                      <span className="text-gray-700">{benefit}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Product Contents — dynamic, hidden when empty */}
            {contentsList.length > 0 && (
              <div className="bg-white rounded-2xl border-2 border-gray-100 p-5">
                <h3 className="text-lg font-bold text-[#0B1833] mb-3 flex items-center gap-2">📦 محتويات المنتج</h3>
                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {contentsList.map((item, i) => (
                    <li key={i} className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2 text-sm text-gray-700">
                      <span className="text-[#183C6B]">◆</span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Quantity + CTA */}
            <div className="space-y-4">
              <div className="flex items-center gap-4 flex-wrap">
                <label className="text-sm font-bold text-gray-700">الكمية:</label>
                <div className="flex items-center gap-2 bg-gray-100 rounded-xl p-1">
                  <button
                    onClick={() => setQuantity(q => Math.max(1, q - 1))}
                    className="w-10 h-10 bg-white hover:bg-gray-50 rounded-lg font-bold text-lg flex items-center justify-center shadow-sm"
                  >−</button>
                  <span className="font-bold text-xl w-10 text-center">{quantity}</span>
                  <button
                    onClick={() => setQuantity(q => Math.min(Math.max(product.stock, 1), q + 1))}
                    className="w-10 h-10 bg-white hover:bg-gray-50 rounded-lg font-bold text-lg flex items-center justify-center shadow-sm"
                  >+</button>
                </div>
                {quantity > 1 && (
                  <span className="text-[#102A52] font-bold">
                    = {(product.price * quantity).toLocaleString()} دج
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  onClick={handleBuyNow}
                  disabled={product.stock <= 0}
                  className="bg-amber-500 hover:bg-amber-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white py-4 rounded-xl font-bold text-lg transition-all shadow-lg hover:shadow-xl flex items-center justify-center gap-2"
                >
                  ⚡ اطلب الآن
                </button>
                <button
                  onClick={handleAddToCart}
                  disabled={product.stock <= 0}
                  className="bg-[#102A52] hover:bg-[#0B1833] disabled:bg-gray-300 disabled:cursor-not-allowed text-white py-4 rounded-xl font-bold text-lg transition-all shadow-lg hover:shadow-xl flex items-center justify-center gap-2"
                >
                  🛒 أضف للسلة
                </button>
              </div>

              <button
                onClick={() => setShowQuickOrder(true)}
                className="w-full bg-[#183C6B] hover:bg-[#102A52] text-white py-3 rounded-xl font-bold transition-all flex items-center justify-center gap-2"
              >
                📱 طلب سريع عبر واتساب
              </button>
            </div>

            {/* Delivery info + Trust Badges */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { icon: '🚚', label: 'توصيل لكل الولايات', desc: '58 ولاية' },
                { icon: '💵', label: 'الدفع عند الاستلام', desc: 'بدون دفع مسبق' },
                { icon: '✅', label: 'جودة مضمونة', desc: 'إرجاع خلال 7 أيام' },
              ].map((badge, i) => (
                <div key={i} className="bg-gray-50 rounded-xl p-3 text-center border border-gray-100">
                  <span className="text-2xl block mb-1">{badge.icon}</span>
                  <span className="text-xs font-bold text-gray-600 block">{badge.label}</span>
                  <span className="text-[10px] text-gray-400">{badge.desc}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── WHY CHOOSE US ─────────────────────────────────────── */}
      <section className="bg-white py-10 md:py-12 px-4">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-xl md:text-2xl font-bold text-center text-[#0B1833] mb-8">🎯 لماذا تختار المعراج؟</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { icon: '🎨', title: 'تصميم احترافي', desc: 'بطاقات مصممة بعناية لتجذب انتباه التلاميذ وتحفّزهم على التعلم' },
              { icon: '📋', title: 'مبنية على المنهاج', desc: 'محتوى متوافق مع المناهج الدراسية الجزائرية لكل الأطوار' },
              { icon: '🏆', title: 'ثقة الأساتذة', desc: `أكثر من ${products.reduce((s, p) => s + p.sales, 0)}+ أستاذ يستخدمون أدواتنا` },
            ].map((feature, i) => (
              <div key={i} className="bg-blue-50 rounded-2xl p-6 text-center hover:shadow-md transition-all">
                <span className="text-4xl block mb-3">{feature.icon}</span>
                <h3 className="text-lg font-bold text-[#0B1833] mb-2">{feature.title}</h3>
                <p className="text-gray-600 text-sm">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ─────────────────────────────────────────────────── */}
      <section className="py-10 md:py-12 px-4 bg-gray-50">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-xl md:text-2xl font-bold text-center text-[#0B1833] mb-8">❓ الأسئلة الشائعة</h2>
          <div className="space-y-3">
            {faqs.map((item, i) => (
              <div key={i} className="bg-white rounded-2xl border-2 border-gray-100 overflow-hidden">
                <button
                  onClick={() => setOpenFAQ(openFAQ === i ? null : i)}
                  className="w-full flex items-center justify-between gap-3 px-5 py-4 text-right"
                >
                  <span className="font-bold text-gray-800">{item.q}</span>
                  <span className={`text-[#183C6B] text-xl font-bold transition-transform flex-shrink-0 ${openFAQ === i ? 'rotate-45' : ''}`}>+</span>
                </button>
                {openFAQ === i && (
                  <div className="px-5 pb-4 text-gray-600 text-sm leading-relaxed">
                    {item.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── RELATED PRODUCTS ──────────────────────────────────── */}
      {related.length > 0 && (
        <section className="py-10 md:py-12 px-4 bg-white">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-xl md:text-2xl font-bold text-center text-[#0B1833] mb-8">
              📚 منتجات مشابهة — {product.category}
            </h2>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
              {related.map(rp => (
                <button
                  key={rp.id}
                  onClick={() => navigate(`/lp/${rp.id}`)}
                  className="bg-white rounded-2xl shadow-md hover:shadow-xl transition-all overflow-hidden text-right group border border-gray-100"
                >
                  <div className="relative h-32 sm:h-40 overflow-hidden">
                    <img src={safeImage(rp.images)} alt={rp.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                    {rp.badge && <span className="absolute top-2 right-2 bg-amber-500 text-white text-xs px-2 py-1 rounded-full font-bold">{rp.badge}</span>}
                  </div>
                  <div className="p-3 md:p-4">
                    <h3 className="font-bold text-gray-800 text-xs md:text-sm mb-1 leading-tight line-clamp-2">{rp.name}</h3>
                    <p className="text-[#102A52] font-bold text-sm md:text-base">{rp.price.toLocaleString()} دج</p>
                  </div>
                </button>
      ))}
            </div>
          </div>
        </section>
      )}

      {/* ── CTA SECTION ──────────────────────────────────────── */}
      <section className="bg-gradient-to-br from-[#071226] via-[#0B1833] to-[#102A52] text-white py-12 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-2xl md:text-3xl font-bold mb-4">🎓 جهّز حصتك بأدوات احترافية</h2>
          <p className="text-blue-100 mb-8 text-lg">اطلب الآن واحصل على توصيل لباب بيتك أو أقرب مكتب — الدفع عند الاستلام</p>
          <div className="flex flex-wrap justify-center gap-4">
            <button
              onClick={handleBuyNow}
              disabled={product.stock <= 0}
              className="bg-amber-500 hover:bg-amber-600 disabled:bg-gray-400 disabled:cursor-not-allowed text-white px-10 py-4 rounded-xl font-bold text-lg transition-all shadow-xl"
            >
              ⚡ اطلب {product.name} الآن
            </button>
            <button
              onClick={() => navigate('/')}
              className="bg-white/20 hover:bg-white/30 border border-white/40 text-white px-8 py-4 rounded-xl font-bold transition-all"
            >
              🛍️ تصفح المزيد
            </button>
          </div>
        </div>
      </section>

      {/* ── FOOTER ────────────────────────────────────────────── */}
      <footer className="bg-[#071226] text-white py-10 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
            <div>
              <div className="flex items-center gap-3 mb-3">
                <Logo size="sm" />
                <div>
                  <h3 className="font-bold text-lg">المعراج</h3>
                  <p className="text-blue-300 text-xs">متجر تعليمي للأساتذة</p>
                </div>
              </div>
              <p className="text-blue-300 text-sm">أدوات مساعدة لإعداد الدروس وتفعيل التلاميذ</p>
            </div>
            <div>
              <h4 className="font-bold mb-3 text-amber-400">تواصل معنا</h4>
              <div className="space-y-2 text-blue-300 text-sm">
                <p>📞 <a href="tel:0782272080" className="hover:text-white">0782272080</a></p>
                <p>📧 <a href="mailto:contact@almiraj.dz" className="hover:text-white">contact@almiraj.dz</a></p>
                <p>📍 الجزائر العاصمة، الجزائر 🇩🇿</p>
              </div>
            </div>
            <div>
              <h4 className="font-bold mb-3 text-amber-400">تابعنا</h4>
              <div className="flex gap-3 flex-wrap">
                {socialLinks.map((s, i) => (
                  <a key={i} href={s.href} target="_blank" rel="noopener noreferrer" className={`${s.bg} p-2.5 rounded-xl transition-all`}>
                    <svg className="w-5 h-5 fill-white" viewBox="0 0 24 24"><path d={s.icon} /></svg>
                  </a>
                ))}
              </div>
            </div>
          </div>
          <div className="border-t border-[#102A52] pt-6 text-center">
            <p className="text-blue-400 text-sm">2024 المعراج - جميع الحقوق محفوظة 🇩🇿</p>
          </div>
        </div>
      </footer>

      {/* ── LIGHTBOX ──────────────────────────────────────────── */}
      {lightbox && (
        <div className="fixed inset-0 bg-black/95 z-[9000] flex items-center justify-center" onClick={() => setLightbox(false)}>
          <img src={safeImage(product.images, currentImage)} alt="" className="max-h-[90vh] max-w-[90vw] object-contain" onClick={e => e.stopPropagation()} />
          <button onClick={() => setLightbox(false)} className="absolute top-4 left-4 text-white text-3xl font-bold hover:text-gray-300">✕</button>
          {gallery.length > 1 && (
            <>
              <button onClick={(e) => { e.stopPropagation(); setCurrentImage(i => (i - 1 + gallery.length) % gallery.length); }} className="absolute left-4 top-1/2 -translate-y-1/2 bg-white/20 hover:bg-white/30 w-12 h-12 rounded-full flex items-center justify-center text-white text-2xl">‹</button>
              <button onClick={(e) => { e.stopPropagation(); setCurrentImage(i => (i + 1) % gallery.length); }} className="absolute right-4 top-1/2 -translate-y-1/2 bg-white/20 hover:bg-white/30 w-12 h-12 rounded-full flex items-center justify-center text-white text-2xl">›</button>
            </>
          )}
        </div>
      )}

      {/* ── QUICK ORDER MODAL (WhatsApp) ──────────────────────── */}
      {showQuickOrder && (
        <div className="fixed inset-0 bg-black/60 z-[8000] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="bg-[#183C6B] text-white px-6 py-4 flex justify-between items-center">
              <h3 className="font-bold text-lg">📱 طلب سريع عبر واتساب</h3>
              <button onClick={() => setShowQuickOrder(false)} className="text-white hover:text-gray-200 text-xl font-bold">✕</button>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-gray-50 rounded-xl p-4 flex gap-3 items-center">
                <img src={safeImage(product.images)} alt="" className="w-14 h-14 rounded-lg object-cover" />
                <div className="flex-1">
                  <p className="font-bold text-gray-800 text-sm">{product.name}</p>
                  <p className="text-[#102A52] font-bold">{(product.price * quantity).toLocaleString()} دج × {quantity}</p>
                </div>
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">الاسم الكامل *</label>
                <input
                  type="text"
                  value={customerName}
                  onChange={e => setCustomerName(e.target.value)}
                  className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-[#183C6B] outline-none"
                  placeholder="أدخل اسمك"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">رقم الهاتف * (10 أرقام)</label>
                <input
                  type="tel"
                  value={customerPhone}
                  onChange={e => {
                    const v = e.target.value.replace(/\D/g, '');
                    if (v.length <= 10) setCustomerPhone(v);
                  }}
                  className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-[#183C6B] outline-none"
                  placeholder="05XXXXXXXX"
                />
                <p className={`text-xs mt-1 ${customerPhone.length === 10 ? 'text-[#183C6B] font-bold' : 'text-gray-400'}`}>
                  {customerPhone.length}/10
                </p>
              </div>
              <button
                onClick={handleQuickOrder}
                className="w-full bg-[#183C6B] hover:bg-[#102A52] text-white py-4 rounded-xl font-bold text-lg transition-all flex items-center justify-center gap-2"
              >
                📲 إرسال الطلب عبر واتساب
              </button>
              <p className="text-center text-gray-400 text-xs">سيتم تحويلك إلى واتساب لتأكيد الطلب وتفاصيل التوصيل</p>
            </div>
          </div>
        </div>
      )}

      {/* ── STICKY BOTTOM CTA (Mobile) ───────────────────────── */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t-2 border-gray-100 p-3 flex gap-2 md:hidden z-40 shadow-2xl">
        <button
          onClick={handleBuyNow}
          disabled={product.stock <= 0}
          className="flex-1 bg-amber-500 hover:bg-amber-600 disabled:bg-gray-300 text-white py-3 rounded-xl font-bold transition-all flex items-center justify-center gap-1"
        >
          ⚡ اطلب الآن
        </button>
        <button
          onClick={handleAddToCart}
          disabled={product.stock <= 0}
          className="flex-1 bg-[#102A52] hover:bg-[#0B1833] disabled:bg-gray-300 text-white py-3 rounded-xl font-bold transition-all flex items-center justify-center gap-1"
        >
          🛒 أضف للسلة
        </button>
      </div>
      <div className="h-16 md:hidden" />
    </div>
  );
}
