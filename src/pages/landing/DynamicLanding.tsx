import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

// ── Types ────────────────────────────────────────────────────
interface LandingPageData {
  id: string;
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
  product?: {
    id: number;
    name: string;
    description: string;
    price: number;
    category: string;
    images: string[];
    stock: number;
    sales: number;
    benefits: string[];
    badge?: string;
  } | null;
}

// ── Facebook Pixel ───────────────────────────────────────────
declare global {
  interface Window {
    fbq: (action: string, event: string, data?: object) => void;
  }
}

const fbTrack = (event: string, data?: object) => {
  try {
    if (typeof window !== 'undefined' && typeof window.fbq === 'function') {
      window.fbq('track', event, data);
      console.log(`[FB Pixel] ✅ ${event}`, data || '');
    }
  } catch { /* silent */ }
};

// ── SEO helper ───────────────────────────────────────────────
function setSEO(title: string, description: string, image?: string) {
  // Title
  document.title = title;

  // Meta description
  let metaDesc = document.querySelector('meta[name="description"]') as HTMLMetaElement | null;
  if (!metaDesc) {
    metaDesc = document.createElement('meta');
    metaDesc.name = 'description';
    document.head.appendChild(metaDesc);
  }
  metaDesc.content = description;

  // Open Graph tags for Facebook/social sharing
  const ogTags: Record<string, string> = {
    'og:title': title,
    'og:description': description,
    'og:type': 'product',
    'og:url': window.location.href,
  };
  if (image) ogTags['og:image'] = image;

  Object.entries(ogTags).forEach(([property, content]) => {
    let tag = document.querySelector(`meta[property="${property}"]`) as HTMLMetaElement | null;
    if (!tag) {
      tag = document.createElement('meta');
      tag.setAttribute('property', property);
      document.head.appendChild(tag);
    }
    tag.content = content;
  });

  // Twitter card
  const twitterTags: Record<string, string> = {
    'twitter:card': 'summary_large_image',
    'twitter:title': title,
    'twitter:description': description,
  };
  if (image) twitterTags['twitter:image'] = image;

  Object.entries(twitterTags).forEach(([name, content]) => {
    let tag = document.querySelector(`meta[name="${name}"]`) as HTMLMetaElement | null;
    if (!tag) {
      tag = document.createElement('meta');
      tag.name = name;
      document.head.appendChild(tag);
    }
    tag.content = content;
  });
}

// ── Shared Components ────────────────────────────────────────
const Logo = ({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) => {
  const sizes = { sm: 'h-8 w-8', md: 'h-10 w-10', lg: 'h-16 w-16' };
  return (
    <img
      src="https://i.ibb.co/jkq94GGC/logo.jpg"
      alt="المعراج"
      className={`${sizes[size]} rounded-full object-contain`}
      onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
    />
  );
};

const socialLinks = [
  { href: 'https://www.facebook.com/profile.php?id=100068623115888', bg: 'bg-#183C6B hover:bg-blue-700', label: 'فيسبوك', icon: 'M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z' },
  { href: 'https://wa.me/213782272080', bg: 'bg-#183C6B hover:bg-#183C6B', label: 'واتساب', icon: 'M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z' },
  { href: 'https://t.me/PrintinginAlgeria', bg: 'bg-sky-500 hover:bg-sky-600', label: 'تيليغرام', icon: 'M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z' },
];

// ============================================================
// DYNAMIC LANDING PAGE COMPONENT
// ============================================================
export default function DynamicLanding() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();

  const [page, setPage] = useState<LandingPageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const pixelFired = useRef(false);

  // ── Fetch landing page from API ────────────────────────────
  useEffect(() => {
    if (!slug) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    setNotFound(false);
    pixelFired.current = false;

    (async () => {
      try {
        console.log(`[LP] 🔄 Fetching landing page: /api/landing-page/${slug}`);
        const r = await fetch(`/api/landing-page/${encodeURIComponent(slug)}`);
        const data = await r.json();

        if (cancelled) return;

        if (r.status === 404 || data.error === 'NOT_FOUND') {
          console.log(`[LP] ❌ Not found: ${slug}`);
          setNotFound(true);
          setSEO('صفحة غير موجودة | المعراج', 'عذراً، الصفحة المطلوبة غير موجودة');
        } else if (!data.ok) {
          console.error(`[LP] ❌ API error:`, data.error);
          setError(data.message || data.error || 'فشل تحميل الصفحة');
        } else {
          console.log(`[LP] ✅ Loaded:`, data.data.title);
          setPage(data.data);
        }
      } catch (e) {
        if (!cancelled) {
          console.error(`[LP] 💥 Fetch error:`, e);
          setError('تعذر الاتصال بالخادم — تحقق من اتصال الإنترنت');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [slug]);

  // ── Set SEO + Fire Pixel when page loaded ──────────────────
  useEffect(() => {
    if (!page) return;

    // SEO
    const seoTitle = `${page.headline || page.title} | المعراج`;
    const seoDesc = page.description || page.headline || page.title;
    const seoImage = page.image_url || page.product?.images?.[0] || '';
    setSEO(seoTitle, seoDesc, seoImage);

    // Facebook Pixel — ViewContent
    if (!pixelFired.current) {
      pixelFired.current = true;
      const pixelData: Record<string, unknown> = {
        content_name: page.title,
        content_type: 'product',
        value: page.product?.price || 0,
        currency: 'DZD',
      };
      if (page.product) {
        pixelData.content_ids = [String(page.product.id)];
        pixelData.content_category = page.product.category;
        pixelData.contents = [{ id: String(page.product.id), quantity: 1 }];
      }
      fbTrack('ViewContent', pixelData);
    }
  }, [page]);

  // ── Scroll to top ──────────────────────────────────────────
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [slug]);

  // ── Resolve CTA URL ────────────────────────────────────────
  const resolveCTAUrl = (): string => {
    if (!page) return '/';
    if (page.cta_url && page.cta_url.trim()) return page.cta_url;
    if (page.product_id) return `/lp/${page.product_id}`;
    return '/';
  };

  const handleCTAClick = () => {
    if (!page) return;

    // Track CTA click
    const pixelData: Record<string, unknown> = {
      content_name: page.title,
      value: page.product?.price || 0,
      currency: 'DZD',
    };
    if (page.product) {
      pixelData.content_ids = [String(page.product.id)];
    }
    fbTrack('AddToWishlist', pixelData);

    const url = resolveCTAUrl();
    if (url.startsWith('http')) {
      window.open(url, '_blank');
    } else {
      navigate(url);
    }
  };

  // ── Determine display values (page overrides or product fallback) ──
  const displayImage = page?.image_url || page?.product?.images?.[0] || '';
  const displayHeadline = page?.headline || page?.product?.name || page?.title || '';
  const displayDescription = page?.description || page?.product?.description || '';
  const displayPrice = page?.product?.price;
  const displayCTA = page?.cta_text || 'اشتري الآن';
  const product = page?.product;

  // ════════════════════════════════════════════════════════════
  // LOADING STATE
  // ════════════════════════════════════════════════════════════
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-white flex items-center justify-center" dir="rtl">
        <div className="text-center space-y-6">
          <Logo size="lg" />
          <div className="flex items-center justify-center gap-3">
            <div className="w-8 h-8 border-4 border-blue-200 border-t-#102A52rounded-full animate-spin" />
            <span className="text-#102A52font-bold text-lg">جاري تحميل الصفحة...</span>
          </div>
        </div>
      </div>
    );
  }

  // ════════════════════════════════════════════════════════════
  // 404 NOT FOUND
  // ════════════════════════════════════════════════════════════
  if (notFound) {
    return (
      <div className="min-h-screen bg-gray-50" dir="rtl">
        {/* Header */}
        <header className="bg-white shadow-md">
          <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
            <button onClick={() => navigate('/')} className="flex items-center gap-3 hover:opacity-80 transition-all">
              <Logo size="md" />
              <div>
                <h1 className="text-xl font-bold text-blue-800">المعراج</h1>
                <p className="text-xs text-#183C6B">متجر تعليمي للأساتذة</p>
              </div>
            </button>
          </div>
        </header>

        <div className="flex items-center justify-center min-h-[70vh]">
          <div className="text-center p-8 max-w-md">
            <p className="text-8xl mb-6">🔍</p>
            <h1 className="text-3xl font-bold text-gray-800 mb-3">404</h1>
            <h2 className="text-xl font-bold text-gray-600 mb-2">صفحة غير موجودة</h2>
            <p className="text-gray-500 mb-8">
              عذراً، الصفحة <span className="font-mono bg-gray-100 px-2 py-0.5 rounded text-sm" dir="ltr">/l/{slug}</span> غير موجودة أو تم تعطيلها
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={() => navigate('/')}
                className="bg-#102A52hover:bg-#0B1833text-white px-8 py-3 rounded-xl font-bold transition-all"
              >
                🏠 العودة للمتجر
              </button>
              <a
                href="https://wa.me/213782272080"
                target="_blank"
                rel="noopener noreferrer"
                className="bg-#183C6B hover:bg-#183C6B text-white px-8 py-3 rounded-xl font-bold transition-all text-center"
              >
                📱 تواصل معنا
              </a>
            </div>
          </div>
        </div>

        {/* Minimal Footer */}
        <footer className="bg-#071226 text-white py-6 px-4 text-center">
          <p className="text-blue-400 text-sm">2024 المعراج - جميع الحقوق محفوظة 🇩🇿</p>
        </footer>
      </div>
    );
  }

  // ════════════════════════════════════════════════════════════
  // ERROR STATE
  // ════════════════════════════════════════════════════════════
  if (error || !page) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center" dir="rtl">
        <div className="text-center p-8 max-w-md">
          <p className="text-6xl mb-4">⚠️</p>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">خطأ في تحميل الصفحة</h1>
          <p className="text-gray-500 mb-6">{error || 'حدث خطأ غير متوقع'}</p>
          <div className="flex flex-col gap-3">
            <button
              onClick={() => window.location.reload()}
              className="bg-#102A52hover:bg-#0B1833text-white px-8 py-3 rounded-xl font-bold transition-all"
            >
              🔄 إعادة المحاولة
            </button>
            <button
              onClick={() => navigate('/')}
              className="border-2 border-gray-200 text-gray-600 px-8 py-3 rounded-xl font-bold hover:bg-gray-50 transition-all"
            >
              🏠 العودة للمتجر
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ════════════════════════════════════════════════════════════
  // LANDING PAGE RENDER
  // ════════════════════════════════════════════════════════════
  const catEmoji = product?.category === 'تحضيري' ? '🎨' : product?.category === 'ابتدائي' ? '📚' : product?.category === 'متوسط' ? '🎓' : '📦';

  return (
    <div className="min-h-screen bg-gray-50 font-sans" dir="rtl">

      {/* ── HEADER ──────────────────────────────────────────── */}
      <header className="bg-white shadow-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <button onClick={() => navigate('/')} className="flex items-center gap-3 hover:opacity-80 transition-all">
            <Logo size="md" />
            <div>
              <h1 className="text-xl font-bold text-blue-800">المعراج</h1>
              <p className="text-xs text-#183C6B">متجر تعليمي للأساتذة</p>
            </div>
          </button>
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/')}
              className="hidden md:flex items-center gap-2 text-gray-600 hover:text-#102A52font-bold text-sm transition-colors"
            >
              🛍️ تصفح المنتجات
            </button>
            <button
              onClick={() => navigate('/')}
              className="bg-#102A52hover:bg-#0B1833text-white p-3 rounded-xl transition-all"
            >
              🛒
            </button>
          </div>
        </div>
      </header>

      {/* ── ANNOUNCEMENT BAR ──────────────────────────────────── */}
      <div className="bg-#0B1833text-white text-center py-2 text-sm font-medium">
        🎓 أداة تعليمية مبتكرة للأساتذة | 🚚 توصيل لجميع الولايات | 💵 الدفع عند الاستلام
      </div>

      {/* ── HERO SECTION ──────────────────────────────────────── */}
      <section className="relative">
        {/* Hero Image */}
        {displayImage && (
          <div className="relative h-[50vh] md:h-[60vh] overflow-hidden">
            <img
              src={displayImage}
              alt={displayHeadline}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />

            {/* Overlay Content */}
            <div className="absolute bottom-0 left-0 right-0 p-6 md:p-12">
              <div className="max-w-4xl mx-auto">
                {product?.category && (
                  <span className="inline-block bg-#183C6B text-white text-sm px-4 py-1.5 rounded-full font-bold mb-4">
                    {catEmoji} {product.category}
                  </span>
                )}
                <h1 className="text-3xl md:text-5xl font-bold text-white leading-tight mb-4">
                  {displayHeadline}
                </h1>
                {displayPrice && (
                  <p className="text-2xl md:text-3xl font-bold text-amber-400">
                    {displayPrice.toLocaleString()} <span className="text-lg">دج</span>
                  </p>
                )}
              </div>
            </div>

            {/* Badges */}
            {product?.badge && (
              <span className="absolute top-6 right-6 bg-amber-500 text-white text-sm px-4 py-2 rounded-full font-bold shadow-lg">
                {product.badge}
              </span>
            )}
          </div>
        )}

        {/* No image — text-only hero */}
        {!displayImage && (
          <div className="bg-gradient-to-br from-#071226 via-#0B1833to-#102A52text-white py-20 px-4">
            <div className="max-w-4xl mx-auto text-center">
              {product?.category && (
                <span className="inline-block bg-white/20 text-white text-sm px-4 py-1.5 rounded-full font-bold mb-4">
                  {catEmoji} {product.category}
                </span>
              )}
              <h1 className="text-3xl md:text-5xl font-bold leading-tight mb-4">
                {displayHeadline}
              </h1>
              {displayPrice && (
                <p className="text-2xl md:text-3xl font-bold text-amber-400">
                  {displayPrice.toLocaleString()} <span className="text-lg">دج</span>
                </p>
              )}
            </div>
          </div>
        )}
      </section>

      {/* ── MAIN CONTENT ──────────────────────────────────────── */}
      <section className="max-w-4xl mx-auto px-4 py-12">
        <div className="space-y-8">

          {/* Description */}
          {displayDescription && (
            <div className="bg-white rounded-2xl shadow-md p-6 md:p-8">
              <p className="text-gray-700 text-lg leading-relaxed whitespace-pre-line">
                {displayDescription}
              </p>
            </div>
          )}

          {/* Product Details (if linked) */}
          {product && (
            <div className="bg-white rounded-2xl shadow-md overflow-hidden">
              <div className="grid grid-cols-1 md:grid-cols-2">
                {/* Product Image */}
                {product.images?.[0] && product.images[0] !== displayImage && (
                  <div className="h-64 md:h-auto">
                    <img
                      src={product.images[0]}
                      alt={product.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}

                {/* Product Info */}
                <div className="p-6 md:p-8 space-y-4">
                  <h2 className="text-2xl font-bold text-gray-800">{product.name}</h2>

                  {/* Price Box */}
                  <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-500">السعر</p>
                        <p className="text-3xl font-bold text-blue-700">
                          {product.price.toLocaleString()} <span className="text-base">دج</span>
                        </p>
                      </div>
                      <div className="text-left">
                        <p className={`font-bold text-sm ${product.stock > 10 ? 'text-#183C6B' : product.stock > 0 ? 'text-amber-600' : 'text-red-600'}`}>
                          {product.stock > 10 ? '✅ متوفر' : product.stock > 0 ? `⚠️ ${product.stock} فقط` : '❌ نفذ'}
                        </p>
                        {product.sales > 0 && (
                          <p className="text-gray-400 text-xs mt-1">📊 {product.sales}+ مبيعات</p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Benefits */}
                  {product.benefits && product.benefits.length > 0 && (
                    <div>
                      <h3 className="font-bold text-#0B1833mb-2">✅ الفوائد التعليمية</h3>
                      <ul className="space-y-2">
                        {product.benefits.map((b, i) => (
                          <li key={i} className="flex items-start gap-2">
                            <span className="bg-blue-100 text-#183C6B w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold mt-0.5">
                              {i + 1}
                            </span>
                            <span className="text-gray-700 text-sm">{b}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* CTA inside product card */}
                  <button
                    onClick={handleCTAClick}
                    className="w-full bg-amber-500 hover:bg-amber-600 text-white py-4 rounded-xl font-bold text-lg transition-all shadow-lg hover:shadow-xl flex items-center justify-center gap-2"
                  >
                    ⚡ {displayCTA}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Primary CTA (always visible) */}
          <div className="bg-gradient-to-r from-#102A52to-#0B1833rounded-2xl p-8 text-center text-white shadow-xl">
            <h2 className="text-2xl md:text-3xl font-bold mb-3">
              {product ? `🎓 احصل على ${product.name} الآن` : '🎓 اطلب الآن'}
            </h2>
            <p className="text-blue-100 mb-6 text-lg">
              توصيل لجميع ولايات الجزائر — الدفع عند الاستلام
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button
                onClick={handleCTAClick}
                className="bg-amber-500 hover:bg-amber-600 text-white px-10 py-4 rounded-xl font-bold text-lg transition-all shadow-lg"
              >
                ⚡ {displayCTA}
              </button>
              <a
                href="https://wa.me/213782272080"
                target="_blank"
                rel="noopener noreferrer"
                className="bg-#183C6B hover:bg-#183C6B text-white px-8 py-4 rounded-xl font-bold transition-all text-center"
              >
                📱 تواصل عبر واتساب
              </a>
            </div>
          </div>

          {/* Trust Badges */}
          <div className="grid grid-cols-3 gap-4">
            {[
              { icon: '🚚', label: 'توصيل لكل الولايات', desc: '58 ولاية' },
              { icon: '💵', label: 'الدفع عند الاستلام', desc: 'لا دفع مسبق' },
              { icon: '✅', label: 'جودة مضمونة', desc: 'إرجاع مجاني' },
            ].map((badge, i) => (
              <div key={i} className="bg-white rounded-xl p-4 text-center shadow-sm border border-gray-100">
                <span className="text-3xl block mb-2">{badge.icon}</span>
                <span className="text-sm font-bold text-gray-700 block">{badge.label}</span>
                <span className="text-xs text-gray-400">{badge.desc}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FOOTER ────────────────────────────────────────────── */}
      <footer className="bg-#071226 text-white py-10 px-4">
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
          <div className="border-t border-#102A52pt-6 text-center">
            <p className="text-blue-400 text-sm">2024 المعراج - جميع الحقوق محفوظة 🇩🇿</p>
          </div>
        </div>
      </footer>

      {/* ── STICKY BOTTOM CTA (Mobile) ───────────────────────── */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t-2 border-gray-100 p-3 flex gap-2 md:hidden z-40 shadow-2xl">
        <button
          onClick={handleCTAClick}
          className="flex-1 bg-amber-500 hover:bg-amber-600 text-white py-3 rounded-xl font-bold transition-all flex items-center justify-center gap-1"
        >
          ⚡ {displayCTA}
        </button>
        <a
          href="https://wa.me/213782272080"
          target="_blank"
          rel="noopener noreferrer"
          className="bg-#183C6B hover:bg-#183C6B text-white px-4 py-3 rounded-xl font-bold transition-all flex items-center justify-center"
        >
          📱
        </a>
      </div>
      <div className="h-16 md:hidden" />
    </div>
  );
}
