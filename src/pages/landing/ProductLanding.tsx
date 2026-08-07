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
  badge?: string;
}

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
    .replace(/[^\u0600-\u06FFa-z0-9-]/g, '')
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
  { href: 'https://www.facebook.com/profile.php?id=100068623115888', bg: 'bg-blue-600 hover:bg-blue-700', label: 'فيسبوك', icon: 'M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z' },
  { href: 'https://wa.me/213782272080', bg: 'bg-blue-500 hover:bg-blue-600', label: 'واتساب', icon: 'M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z' },
];

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
            className="bg-blue-700 hover:bg-blue-800 text-white px-8 py-3 rounded-xl font-bold transition-all"
          >
            🏠 العودة للمتجر
          </button>
        </div>
      </div>
    );
  }

  const catEmoji = product.category === 'تحضيري' ? '🎨' : product.category === 'ابتدائي' ? '📚' : '🎓';

  // ── Related products (same category, exclude current) ──────
  const related = products
    .filter(p => p.category === product.category && p.id !== product.id)
    .slice(0, 4);

  return (
    <div className="min-h-screen bg-gray-50 font-sans" dir="rtl">
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[9999] bg-blue-500 text-white px-6 py-3 rounded-xl shadow-2xl flex items-center gap-3">
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
              <p className="text-xs text-blue-600">متجر تعليمي للأساتذة</p>
            </div>
          </button>
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/')}
              className="hidden md:flex items-center gap-2 text-gray-600 hover:text-blue-700 font-bold text-sm transition-colors"
            >
              🏠 الرئيسية
            </button>
            <button
              onClick={() => navigate('/')}
              className="relative bg-blue-700 hover:bg-blue-800 text-white p-3 rounded-xl transition-all"
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
      <div className="bg-blue-800 text-white text-center py-2 text-sm font-medium">
        🎓 أداة تعليمية مبتكرة للأساتذة | 🚚 توصيل لجميع الولايات | 💵 الدفع عند الاستلام
      </div>

      {/* ── PRODUCT HERO SECTION ─────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Image Gallery */}
          <div className="space-y-4">
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
              <span className="absolute top-4 left-4 bg-blue-700 text-white text-sm px-3 py-1.5 rounded-full font-bold">
                {catEmoji} {product.category}
              </span>
              <div className="absolute bottom-4 left-4 bg-black/50 text-white text-xs px-3 py-1.5 rounded-full">
                🔍 اضغط لتكبير الصورة
              </div>
              {safeImages(product.images).length > 1 && (
                <>
                  <button
                    onClick={(e) => { e.stopPropagation(); setCurrentImage(i => (i - 1 + safeImages(product.images).length) % safeImages(product.images).length); }}
                    className="absolute left-3 top-1/2 -translate-y-1/2 bg-white/90 w-10 h-10 rounded-full flex items-center justify-center shadow-md font-bold text-lg hover:bg-white"
                  >‹</button>
                  <button
                    onClick={(e) => { e.stopPropagation(); setCurrentImage(i => (i + 1) % safeImages(product.images).length); }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 bg-white/90 w-10 h-10 rounded-full flex items-center justify-center shadow-md font-bold text-lg hover:bg-white"
                  >›</button>
                </>
              )}
            </div>
            {safeImages(product.images).length > 1 && (
              <div className="flex gap-3 overflow-x-auto pb-2">
                {safeImages(product.images).map((img, i) => (
                  <img
                    key={i}
                    src={img}
                    alt=""
                    onClick={() => setCurrentImage(i)}
                    className={`h-20 w-20 object-cover rounded-xl cursor-pointer flex-shrink-0 transition-all border-2 ${
                      currentImage === i ? 'border-blue-500 scale-105 shadow-md' : 'border-transparent opacity-60 hover:opacity-100'
                    }`}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Product Info */}
          <div className="space-y-6">
            {/* Title & Category */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="bg-blue-100 text-blue-700 text-xs px-3 py-1 rounded-full font-bold">
                  {catEmoji} {product.category}
                </span>
                {product.sales > 80 && (
                  <span className="bg-amber-100 text-amber-700 text-xs px-3 py-1 rounded-full font-bold">
                    🔥 مطلوب بكثرة
                  </span>
                )}
              </div>
              <h1 className="text-3xl md:text-4xl font-bold text-gray-800 leading-tight">
                {product.name}
              </h1>
            </div>

            {/* Price */}
            <div className="bg-blue-50 border-2 border-blue-200 rounded-2xl p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500 mb-1">السعر</p>
                  <p className="text-4xl font-bold text-blue-700">{product.price.toLocaleString()} <span className="text-lg">دج</span></p>
                </div>
                <div className="text-left">
                  <p className="text-sm text-gray-500">المخزون</p>
                  <p className={`font-bold ${product.stock > 10 ? 'text-blue-600' : product.stock > 0 ? 'text-amber-600' : 'text-red-600'}`}>
                    {product.stock > 10 ? '✅ متوفر' : product.stock > 0 ? `⚠️ ${product.stock} فقط` : '❌ نفذ'}
                  </p>
                </div>
              </div>
              {product.sales > 0 && (
                <p className="text-blue-600 text-sm mt-2 font-bold">
                  📊 تم بيع {product.sales}+ نسخة
                </p>
              )}
            </div>

            {/* Description */}
            <div>
              <h3 className="text-lg font-bold text-gray-800 mb-2">📝 الوصف</h3>
              <p className="text-gray-600 leading-relaxed text-base">{safeStr(product.description, 'لا يوجد وصف متاح')}</p>
            </div>

            {/* Benefits */}
            {safeArr(product.benefits).length > 0 && (
              <div className="bg-white rounded-2xl border-2 border-gray-100 p-5">
                <h3 className="text-lg font-bold text-blue-800 mb-3">✅ الفوائد التعليمية</h3>
                <ul className="space-y-2">
                  {safeArr(product.benefits).map((benefit, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <span className="bg-blue-100 text-blue-600 w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold mt-0.5">
                        {i + 1}
                      </span>
                      <span className="text-gray-700">{benefit}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Quantity + CTA */}
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <label className="text-sm font-bold text-gray-700">الكمية:</label>
                <div className="flex items-center gap-2 bg-gray-100 rounded-xl p-1">
                  <button
                    onClick={() => setQuantity(q => Math.max(1, q - 1))}
                    className="w-10 h-10 bg-white hover:bg-gray-50 rounded-lg font-bold text-lg flex items-center justify-center shadow-sm"
                  >−</button>
                  <span className="font-bold text-xl w-10 text-center">{quantity}</span>
                  <button
                    onClick={() => setQuantity(q => Math.min(product.stock, q + 1))}
                    className="w-10 h-10 bg-white hover:bg-gray-50 rounded-lg font-bold text-lg flex items-center justify-center shadow-sm"
                  >+</button>
                </div>
                {quantity > 1 && (
                  <span className="text-blue-700 font-bold">
                    = {(product.price * quantity).toLocaleString()} دج
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  onClick={handleBuyNow}
                  className="bg-amber-500 hover:bg-amber-600 text-white py-4 rounded-xl font-bold text-lg transition-all shadow-lg hover:shadow-xl flex items-center justify-center gap-2"
                >
                  ⚡ اشتري الآن
                </button>
                <button
                  onClick={handleAddToCart}
                  className="bg-blue-700 hover:bg-blue-800 text-white py-4 rounded-xl font-bold text-lg transition-all shadow-lg hover:shadow-xl flex items-center justify-center gap-2"
                >
                  🛒 أضف للسلة
                </button>
              </div>

              <button
                onClick={() => setShowQuickOrder(true)}
                className="w-full bg-blue-500 hover:bg-blue-600 text-white py-3 rounded-xl font-bold transition-all flex items-center justify-center gap-2"
              >
                📱 طلب سريع عبر واتساب
              </button>
            </div>

            {/* Trust Badges */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { icon: '🚚', label: 'توصيل لكل الولايات' },
                { icon: '💵', label: 'الدفع عند الاستلام' },
                { icon: '✅', label: 'جودة مضمونة' },
              ].map((badge, i) => (
                <div key={i} className="bg-gray-50 rounded-xl p-3 text-center border border-gray-100">
                  <span className="text-2xl block mb-1">{badge.icon}</span>
                  <span className="text-xs font-bold text-gray-600">{badge.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── WHY CHOOSE US ─────────────────────────────────────── */}
      <section className="bg-white py-12 px-4">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-center text-blue-800 mb-8">🎯 لماذا تختار المعراج؟</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { icon: '🎨', title: 'تصميم احترافي', desc: 'بطاقات مصممة بعناية لتجذب انتباه التلاميذ وتحفّزهم على التعلم' },
              { icon: '📋', title: 'مبنية على المنهاج', desc: 'محتوى متوافق مع المناهج الدراسية الجزائرية لكل الأطوار' },
              { icon: '🏆', title: 'ثقة الأساتذة', desc: `أكثر من ${products.reduce((s, p) => s + p.sales, 0)}+ أستاذ يستخدمون أدواتنا` },
            ].map((feature, i) => (
              <div key={i} className="bg-blue-50 rounded-2xl p-6 text-center hover:shadow-md transition-all">
                <span className="text-4xl block mb-3">{feature.icon}</span>
                <h3 className="text-lg font-bold text-blue-800 mb-2">{feature.title}</h3>
                <p className="text-gray-600 text-sm">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── RELATED PRODUCTS ──────────────────────────────────── */}
      {related.length > 0 && (
        <section className="py-12 px-4 bg-gray-50">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-2xl font-bold text-center text-blue-800 mb-8">
              📚 منتجات مشابهة — {product.category}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {related.map(rp => (
                <button
                  key={rp.id}
                  onClick={() => navigate(`/lp/${rp.id}`)}
                  className="bg-white rounded-2xl shadow-md hover:shadow-xl transition-all overflow-hidden text-right group"
                >
                  <div className="relative h-40 overflow-hidden">
                    <img src={safeImage(rp.images)} alt={rp.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                    {rp.badge && <span className="absolute top-2 right-2 bg-amber-500 text-white text-xs px-2 py-1 rounded-full font-bold">{rp.badge}</span>}
                  </div>
                  <div className="p-4">
                    <h3 className="font-bold text-gray-800 text-sm mb-1 leading-tight">{rp.name}</h3>
                    <p className="text-blue-700 font-bold">{rp.price.toLocaleString()} دج</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── CTA SECTION ──────────────────────────────────────── */}
      <section className="bg-gradient-to-br from-blue-900 via-blue-800 to-blue-700 text-white py-12 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-4">🎓 جهّز حصتك بأدوات احترافية</h2>
          <p className="text-blue-100 mb-8 text-lg">اطلب الآن واحصل على توصيل لباب بيتك أو أقرب مكتب — الدفع عند الاستلام</p>
          <div className="flex flex-wrap justify-center gap-4">
            <button
              onClick={handleBuyNow}
              className="bg-amber-500 hover:bg-amber-600 text-white px-10 py-4 rounded-xl font-bold text-lg transition-all shadow-xl"
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
      <footer className="bg-blue-900 text-white py-10 px-4">
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
          <div className="border-t border-blue-700 pt-6 text-center">
            <p className="text-blue-400 text-sm">2024 المعراج - جميع الحقوق محفوظة 🇩🇿</p>
          </div>
        </div>
      </footer>

      {/* ── LIGHTBOX ──────────────────────────────────────────── */}
      {lightbox && (
        <div className="fixed inset-0 bg-black/95 z-[9000] flex items-center justify-center" onClick={() => setLightbox(false)}>
          <img src={safeImage(product.images, currentImage)} alt="" className="max-h-[90vh] max-w-[90vw] object-contain" onClick={e => e.stopPropagation()} />
          <button onClick={() => setLightbox(false)} className="absolute top-4 left-4 text-white text-3xl font-bold hover:text-gray-300">✕</button>
          {safeImages(product.images).length > 1 && (
            <>
              <button onClick={(e) => { e.stopPropagation(); setCurrentImage(i => (i - 1 + safeImages(product.images).length) % safeImages(product.images).length); }} className="absolute left-4 top-1/2 -translate-y-1/2 bg-white/20 hover:bg-white/30 w-12 h-12 rounded-full flex items-center justify-center text-white text-2xl">‹</button>
              <button onClick={(e) => { e.stopPropagation(); setCurrentImage(i => (i + 1) % safeImages(product.images).length); }} className="absolute right-4 top-1/2 -translate-y-1/2 bg-white/20 hover:bg-white/30 w-12 h-12 rounded-full flex items-center justify-center text-white text-2xl">›</button>
            </>
          )}
        </div>
      )}

      {/* ── QUICK ORDER MODAL (WhatsApp) ──────────────────────── */}
      {showQuickOrder && (
        <div className="fixed inset-0 bg-black/60 z-[8000] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="bg-blue-500 text-white px-6 py-4 flex justify-between items-center">
              <h3 className="font-bold text-lg">📱 طلب سريع عبر واتساب</h3>
              <button onClick={() => setShowQuickOrder(false)} className="text-white hover:text-gray-200 text-xl font-bold">✕</button>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-gray-50 rounded-xl p-4 flex gap-3 items-center">
                <img src={safeImage(product.images)} alt="" className="w-14 h-14 rounded-lg object-cover" />
                <div className="flex-1">
                  <p className="font-bold text-gray-800 text-sm">{product.name}</p>
                  <p className="text-blue-700 font-bold">{(product.price * quantity).toLocaleString()} دج × {quantity}</p>
                </div>
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">الاسم الكامل *</label>
                <input
                  type="text"
                  value={customerName}
                  onChange={e => setCustomerName(e.target.value)}
                  className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-blue-500 outline-none"
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
                  className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 focus:border-blue-500 outline-none"
                  placeholder="05XXXXXXXX"
                />
                <p className={`text-xs mt-1 ${customerPhone.length === 10 ? 'text-blue-500 font-bold' : 'text-gray-400'}`}>
                  {customerPhone.length}/10
                </p>
              </div>
              <button
                onClick={handleQuickOrder}
                className="w-full bg-blue-500 hover:bg-blue-600 text-white py-4 rounded-xl font-bold text-lg transition-all flex items-center justify-center gap-2"
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
          className="flex-1 bg-amber-500 hover:bg-amber-600 text-white py-3 rounded-xl font-bold transition-all flex items-center justify-center gap-1"
        >
          ⚡ اشتري الآن
        </button>
        <button
          onClick={handleAddToCart}
          className="flex-1 bg-blue-700 hover:bg-blue-800 text-white py-3 rounded-xl font-bold transition-all flex items-center justify-center gap-1"
        >
          🛒 أضف للسلة
        </button>
      </div>
      <div className="h-16 md:hidden" />
    </div>
  );
}
