import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

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
    contents?: string[];
    level?: string;
    badge?: string;
  } | null;
}

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
  } catch {
    // Analytics must never block the landing page.
  }
};

function setSEO(title: string, description: string, image?: string) {
  document.title = title;

  let metaDesc = document.querySelector('meta[name="description"]') as HTMLMetaElement | null;
  if (!metaDesc) {
    metaDesc = document.createElement('meta');
    metaDesc.name = 'description';
    document.head.appendChild(metaDesc);
  }
  metaDesc.content = description;

  let canonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
  if (!canonical) {
    canonical = document.createElement('link');
    canonical.rel = 'canonical';
    document.head.appendChild(canonical);
  }
  canonical.href = window.location.href;

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

const Logo = ({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) => {
  const sizes = { sm: 'h-8 w-8', md: 'h-10 w-10', lg: 'h-16 w-16' };
  return (
    <img
      src="https://i.ibb.co/jkq94GGC/logo.jpg"
      alt="المعراج"
      className={`${sizes[size]} rounded-full object-contain`}
      onError={(event) => { (event.target as HTMLImageElement).style.display = 'none'; }}
    />
  );
};

function SectionTitle({ eyebrow, title, description }: { eyebrow?: string; title: string; description?: string }) {
  return (
    <div className="mx-auto mb-7 max-w-2xl text-center">
      {eyebrow && <p className="mb-2 text-xs font-extrabold tracking-wide text-[#B88916]">{eyebrow}</p>}
      <h2 className="text-2xl font-black text-[#0B1833] sm:text-3xl">{title}</h2>
      {description && <p className="mt-2 text-sm leading-7 text-slate-500 sm:text-base">{description}</p>}
      <span className="mx-auto mt-4 block h-1 w-14 rounded-full bg-[#D4AF37]" />
    </div>
  );
}

export default function DynamicLanding() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();

  const [page, setPage] = useState<LandingPageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [currentImage, setCurrentImage] = useState(0);
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const pixelFired = useRef(false);

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
        const response = await fetch(`/api/landing-page/${encodeURIComponent(slug)}`);
        const data = await response.json();
        if (cancelled) return;

        if (response.status === 404 || data.error === 'NOT_FOUND') {
          setNotFound(true);
          setSEO('صفحة غير موجودة | المعراج', 'عذراً، الصفحة المطلوبة غير موجودة');
        } else if (!data.ok) {
          setError(data.message || data.error || 'فشل تحميل الصفحة');
        } else {
          setPage(data.data);
        }
      } catch {
        if (!cancelled) setError('تعذر الاتصال بالخادم — تحقق من اتصال الإنترنت');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [slug]);

  useEffect(() => {
    if (!page) return;
    const seoTitle = `${page.headline || page.title} | المعراج`;
    const seoDesc = page.description || page.headline || page.title;
    const seoImage = page.image_url || page.product?.images?.[0] || '';
    setSEO(seoTitle, seoDesc, seoImage);

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

  useEffect(() => {
    window.scrollTo(0, 0);
    setCurrentImage(0);
  }, [slug]);

  const resolveCTAUrl = (): string => {
    if (!page) return '/';
    if (page.cta_url && page.cta_url.trim()) return page.cta_url;
    if (page.product_id) return `/lp/${page.product_id}`;
    return '/';
  };

  const handleCTAClick = () => {
    if (!page) return;
    const pixelData: Record<string, unknown> = {
      content_name: page.title,
      value: page.product?.price || 0,
      currency: 'DZD',
    };
    if (page.product) pixelData.content_ids = [String(page.product.id)];
    fbTrack('AddToWishlist', pixelData);

    const url = resolveCTAUrl();
    if (url.startsWith('http')) window.open(url, '_blank');
    else navigate(url);
  };

  const product = page?.product;
  const displayHeadline = page?.headline || product?.name || page?.title || '';
  const displayDescription = page?.description || product?.description || '';
  const displayPrice = product?.price;
  const displayCTA = page?.cta_text || 'اطلب الآن';
  const catEmoji = product?.category === 'تحضيري' ? '🎨' : product?.category === 'ابتدائي' ? '📚' : product?.category === 'متوسط' ? '🎓' : '📦';

  const gallery = useMemo(() => {
    const values = [page?.image_url, ...(product?.images || [])].filter(Boolean) as string[];
    return [...new Set(values)];
  }, [page?.image_url, product?.images]);

  const benefits = (product?.benefits || []).filter(Boolean).slice(0, 8);
  const contents = (product?.contents || []).filter(Boolean).slice(0, 16);

  const faqs = [
    {
      q: 'هل الدفع يكون عند الاستلام؟',
      a: 'نعم، يمكنك إتمام الطلب والدفع عند استلامه. لا تحتاج إلى دفع قيمة المنتج مسبقًا.',
    },
    {
      q: 'هل التوصيل متوفر لجميع الولايات؟',
      a: 'نعم، التوصيل متوفر عبر شبكة التوصيل المعتمدة، وتظهر تكلفة التوصيل أثناء إتمام الطلب حسب الولاية والبلدية.',
    },
    {
      q: 'هل هذا المنتج مناسب للمستوى المذكور؟',
      a: product?.category
        ? `المنتج مصنف في متجر المعراج ضمن طور ${product.category}${product.level ? ` (${product.level})` : ''}. راجع المحتوى الظاهر في الصفحة للتأكد من أنه يناسب احتياجك.`
        : 'راجع اسم المنتج والمحتوى الظاهر في الصفحة، وإذا احتجت مساعدة يمكنك التواصل معنا قبل الطلب.',
    },
    {
      q: 'كيف أطلب المنتج؟',
      a: 'اضغط على زر «اطلب الآن» وسيتم نقلك مباشرة إلى مسار الطلب الخاص بالمنتج لإكمال بيانات التوصيل.',
    },
  ];

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F7F8FA]" dir="rtl">
        <div className="text-center">
          <Logo size="lg" />
          <div className="mx-auto mt-6 h-9 w-9 animate-spin rounded-full border-4 border-slate-200 border-t-[#D4AF37]" />
          <p className="mt-4 font-bold text-[#0B1833]">جاري تحميل الصفحة...</p>
        </div>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="min-h-screen bg-[#F7F8FA]" dir="rtl">
        <header className="border-b border-slate-100 bg-white">
          <div className="mx-auto flex max-w-6xl items-center px-4 py-3">
            <button onClick={() => navigate('/')} className="flex items-center gap-3">
              <Logo size="md" />
              <div className="text-right">
                <p className="font-black text-[#0B1833]">المعراج</p>
                <p className="text-[11px] text-slate-500">متجر تعليمي للأساتذة</p>
              </div>
            </button>
          </div>
        </header>
        <div className="flex min-h-[75vh] items-center justify-center px-4">
          <div className="max-w-md text-center">
            <p className="text-7xl">🔍</p>
            <h1 className="mt-5 text-3xl font-black text-[#0B1833]">404</h1>
            <h2 className="mt-2 text-xl font-bold text-slate-700">صفحة غير موجودة</h2>
            <p className="mt-3 leading-7 text-slate-500">الصفحة المطلوبة غير موجودة أو تم تعطيلها من لوحة التحكم.</p>
            <button onClick={() => navigate('/')} className="mt-7 rounded-xl bg-[#0B1833] px-7 py-3 font-bold text-white">العودة للمتجر</button>
          </div>
        </div>
      </div>
    );
  }

  if (error || !page) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F7F8FA] px-4" dir="rtl">
        <div className="max-w-md text-center">
          <p className="text-6xl">⚠️</p>
          <h1 className="mt-4 text-2xl font-black text-[#0B1833]">تعذر تحميل الصفحة</h1>
          <p className="mt-2 text-slate-500">{error || 'حدث خطأ غير متوقع'}</p>
          <button onClick={() => window.location.reload()} className="mt-6 rounded-xl bg-[#0B1833] px-7 py-3 font-bold text-white">إعادة المحاولة</button>
        </div>
      </div>
    );
  }

  const heroImage = gallery[currentImage] || '';

  return (
    <div className="min-h-screen bg-[#F7F8FA] pb-20 font-sans text-[#0B1833] md:pb-0" dir="rtl">
      <header className="sticky top-0 z-50 border-b border-slate-100 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-2.5 sm:py-3">
          <button onClick={() => navigate('/')} className="flex items-center gap-2.5">
            <Logo size="md" />
            <div className="text-right leading-tight">
              <p className="text-lg font-black text-[#0B1833]">المعراج</p>
              <p className="text-[10px] text-slate-500 sm:text-xs">Al Miraj Education</p>
            </div>
          </button>
          <button onClick={() => navigate('/')} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-[#0B1833] shadow-sm sm:px-4 sm:text-sm">
            🛍️ تصفح المنتجات
          </button>
        </div>
      </header>

      <div className="bg-[#0B1833] px-3 py-2 text-center text-[11px] font-bold text-white sm:text-sm">
        🚚 توصيل لجميع الولايات <span className="mx-2 text-[#D4AF37]">•</span> 💵 الدفع عند الاستلام
      </div>

      <main>
        <section className="overflow-hidden bg-white">
          <div className="mx-auto grid max-w-7xl grid-cols-1 lg:grid-cols-2 lg:min-h-[610px]">
            <div className="order-1 flex items-center px-4 py-7 sm:px-8 sm:py-10 lg:order-2 lg:px-14 lg:py-14">
              <div className="w-full">
                <div className="mb-4 flex flex-wrap items-center gap-2">
                  {product?.category && (
                    <span className="rounded-full bg-[#FFF7DE] px-3 py-1.5 text-xs font-extrabold text-[#956A00]">
                      {catEmoji} {product.category}
                    </span>
                  )}
                  {product?.badge && (
                    <span className="rounded-full bg-[#0B1833] px-3 py-1.5 text-xs font-bold text-white">{product.badge}</span>
                  )}
                </div>

                <h1 className="max-w-xl text-3xl font-black leading-[1.25] text-[#0B1833] sm:text-4xl lg:text-5xl">
                  {displayHeadline}
                </h1>

                {displayDescription && (
                  <p className="mt-5 line-clamp-5 max-w-xl whitespace-pre-line text-sm leading-7 text-slate-600 sm:text-base sm:leading-8">
                    {displayDescription}
                  </p>
                )}

                {displayPrice != null && (
                  <div className="mt-6 flex flex-wrap items-end gap-x-6 gap-y-3 rounded-2xl border border-[#E7D7A8] bg-[#FFFDF6] p-4 sm:p-5">
                    <div>
                      <p className="text-xs font-bold text-slate-400">السعر</p>
                      <p className="mt-1 text-3xl font-black text-[#0B1833] sm:text-4xl">
                        {displayPrice.toLocaleString()} <span className="text-base font-bold">دج</span>
                      </p>
                    </div>
                    {product && (
                      <p className={`mb-1 rounded-full px-3 py-1 text-xs font-bold ${product.stock > 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>
                        {product.stock > 0 ? '✓ متوفر' : 'غير متوفر حاليًا'}
                      </p>
                    )}
                  </div>
                )}

                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <button
                    onClick={handleCTAClick}
                    disabled={product?.stock === 0}
                    className="rounded-xl bg-[#D4AF37] px-6 py-4 text-base font-black text-[#0B1833] shadow-lg shadow-[#D4AF37]/20 transition hover:-translate-y-0.5 hover:bg-[#E2BF52] disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500 sm:text-lg"
                  >
                    🛒 {displayCTA}
                  </button>
                  <button
                    onClick={() => document.getElementById('details')?.scrollIntoView({ behavior: 'smooth' })}
                    className="rounded-xl border-2 border-[#0B1833] bg-white px-6 py-4 text-base font-black text-[#0B1833] transition hover:bg-slate-50"
                  >
                    شاهد التفاصيل
                  </button>
                </div>

                <div className="mt-5 grid grid-cols-3 gap-2 text-center">
                  {[
                    ['🚚', 'توصيل', 'لكل الولايات'],
                    ['💵', 'الدفع', 'عند الاستلام'],
                    ['🔒', 'طلب آمن', 'بياناتك محفوظة'],
                  ].map(([icon, title, sub]) => (
                    <div key={title} className="rounded-xl bg-slate-50 px-2 py-3">
                      <span className="text-xl">{icon}</span>
                      <p className="mt-1 text-[11px] font-extrabold text-[#0B1833] sm:text-xs">{title}</p>
                      <p className="mt-0.5 text-[9px] text-slate-400 sm:text-[10px]">{sub}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="order-2 bg-[#EEF2F7] p-3 sm:p-6 lg:order-1 lg:flex lg:items-center lg:justify-center lg:p-8">
              <div className="w-full max-w-2xl">
                <div className="overflow-hidden rounded-2xl bg-white shadow-xl shadow-slate-900/10">
                  {heroImage ? (
                    <img src={heroImage} alt={displayHeadline} className="aspect-[4/3] w-full object-cover sm:aspect-square lg:aspect-[4/3]" />
                  ) : (
                    <div className="flex aspect-[4/3] items-center justify-center text-6xl">📦</div>
                  )}
                </div>
                {gallery.length > 1 && (
                  <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
                    {gallery.slice(0, 8).map((image, index) => (
                      <button
                        key={`${image}-${index}`}
                        onClick={() => setCurrentImage(index)}
                        className={`h-16 w-16 flex-none overflow-hidden rounded-xl border-2 bg-white p-0.5 transition sm:h-20 sm:w-20 ${currentImage === index ? 'border-[#D4AF37] shadow-md' : 'border-transparent opacity-70 hover:opacity-100'}`}
                      >
                        <img src={image} alt={`صورة ${index + 1}`} className="h-full w-full rounded-lg object-cover" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        <section className="border-y border-slate-100 bg-white px-4 py-5">
          <div className="mx-auto grid max-w-6xl grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              ['🧲', 'جاهز للاستعمال', 'وسيلة عملية داخل القسم'],
              ['✨', 'تصميم واضح', 'محتوى بصري منظم'],
              ['📚', 'مخصص للأستاذ', 'يسهل التقديم والمراجعة'],
              ['🇩🇿', 'من المعراج', 'منتج تعليمي جزائري'],
            ].map(([icon, title, sub]) => (
              <div key={title} className="rounded-2xl border border-slate-100 bg-[#FAFBFC] p-4 text-center">
                <span className="text-2xl">{icon}</span>
                <p className="mt-2 text-sm font-black text-[#0B1833]">{title}</p>
                <p className="mt-1 text-[11px] leading-5 text-slate-400">{sub}</p>
              </div>
            ))}
          </div>
        </section>

        {(contents.length > 0 || benefits.length > 0) && (
          <section id="details" className="px-4 py-12 sm:py-16">
            <div className="mx-auto max-w-6xl">
              <SectionTitle eyebrow="كل ما تحتاج معرفته" title="ماذا ستجد في المنتج؟" description="المعلومات التالية مأخوذة مباشرة من بيانات المنتج في متجر المعراج." />
              <div className={`grid gap-5 ${contents.length > 0 && benefits.length > 0 ? 'lg:grid-cols-2' : 'mx-auto max-w-3xl'}`}>
                {contents.length > 0 && (
                  <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm sm:p-7">
                    <div className="mb-5 flex items-center gap-3">
                      <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#FFF7DE] text-xl">📦</span>
                      <div>
                        <h3 className="text-xl font-black text-[#0B1833]">محتويات المنتج</h3>
                        <p className="text-xs text-slate-400">منظمة وسهلة القراءة</p>
                      </div>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {contents.map((item, index) => (
                        <div key={`${item}-${index}`} className="flex items-start gap-2 rounded-xl bg-slate-50 px-3 py-3 text-sm leading-6 text-slate-700">
                          <span className="mt-0.5 font-black text-[#D4AF37]">✓</span>
                          <span>{item}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {benefits.length > 0 && (
                  <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm sm:p-7">
                    <div className="mb-5 flex items-center gap-3">
                      <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#EAF1FA] text-xl">🎯</span>
                      <div>
                        <h3 className="text-xl font-black text-[#0B1833]">لماذا يفيد الأستاذ؟</h3>
                        <p className="text-xs text-slate-400">الفوائد المسجلة لهذا المنتج</p>
                      </div>
                    </div>
                    <div className="space-y-2.5">
                      {benefits.map((benefit, index) => (
                        <div key={`${benefit}-${index}`} className="flex items-start gap-3 rounded-xl border border-slate-100 px-3 py-3">
                          <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-[#0B1833] text-[11px] font-black text-white">{index + 1}</span>
                          <span className="text-sm leading-6 text-slate-700">{benefit}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </section>
        )}

        {gallery.length > 1 && (
          <section className="bg-white px-4 py-12 sm:py-16">
            <div className="mx-auto max-w-6xl">
              <SectionTitle eyebrow="شاهد المنتج عن قرب" title="معرض صور المنتج" />
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {gallery.slice(0, 8).map((image, index) => (
                  <button key={`${image}-gallery-${index}`} onClick={() => { setCurrentImage(index); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="group overflow-hidden rounded-2xl bg-slate-100 shadow-sm">
                    <img src={image} alt={`${displayHeadline} - صورة ${index + 1}`} className="aspect-square w-full object-cover transition duration-300 group-hover:scale-105" />
                  </button>
                ))}
              </div>
            </div>
          </section>
        )}

        <section className="px-4 py-12 sm:py-16">
          <div className="mx-auto max-w-5xl">
            <SectionTitle eyebrow="معلومات قبل الطلب" title="أسئلة شائعة" />
            <div className="space-y-3">
              {faqs.map((faq, index) => (
                <div key={faq.q} className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
                  <button onClick={() => setOpenFaq(openFaq === index ? null : index)} className="flex w-full items-center justify-between gap-4 px-4 py-4 text-right sm:px-6">
                    <span className="font-extrabold text-[#0B1833]">{faq.q}</span>
                    <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-slate-50 text-lg font-bold text-[#0B1833]">{openFaq === index ? '−' : '+'}</span>
                  </button>
                  {openFaq === index && <p className="border-t border-slate-100 px-4 py-4 text-sm leading-7 text-slate-600 sm:px-6">{faq.a}</p>}
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="px-4 pb-14 sm:pb-20">
          <div className="mx-auto max-w-6xl overflow-hidden rounded-[28px] bg-[#0B1833] px-5 py-8 text-white shadow-xl sm:px-10 sm:py-10">
            <div className="flex flex-col items-center justify-between gap-6 text-center md:flex-row md:text-right">
              <div>
                <p className="text-sm font-bold text-[#D4AF37]">جاهز للطلب؟</p>
                <h2 className="mt-2 text-2xl font-black sm:text-3xl">{product?.name || displayHeadline}</h2>
                <p className="mt-2 text-sm text-slate-300">التوصيل متوفر والدفع عند الاستلام.</p>
              </div>
              <div className="flex w-full flex-col items-center gap-3 sm:w-auto sm:flex-row">
                {displayPrice != null && <p className="whitespace-nowrap text-2xl font-black text-white">{displayPrice.toLocaleString()} دج</p>}
                <button onClick={handleCTAClick} disabled={product?.stock === 0} className="w-full rounded-xl bg-[#D4AF37] px-8 py-4 font-black text-[#0B1833] transition hover:bg-[#E2BF52] disabled:bg-slate-600 disabled:text-slate-300 sm:w-auto">
                  🛒 {displayCTA}
                </button>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="bg-[#071226] px-4 py-8 text-white">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-5 border-b border-white/10 pb-6 text-center sm:flex-row sm:text-right">
          <div className="flex items-center gap-3">
            <Logo size="sm" />
            <div>
              <p className="font-black">المعراج</p>
              <p className="text-xs text-slate-400">Al Miraj Education</p>
            </div>
          </div>
          <div className="flex flex-wrap justify-center gap-4 text-sm text-slate-300">
            <a href="https://wa.me/213782272080" target="_blank" rel="noopener noreferrer" className="hover:text-white">واتساب</a>
            <button onClick={() => navigate('/')} className="hover:text-white">المتجر</button>
          </div>
        </div>
        <p className="mx-auto mt-5 max-w-6xl text-center text-xs text-slate-500">المعراج للوسائل التعليمية — جميع الحقوق محفوظة</p>
      </footer>

      <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-slate-200 bg-white/95 p-2.5 shadow-[0_-8px_30px_rgba(15,23,42,0.12)] backdrop-blur md:hidden">
        <div className="mx-auto flex max-w-md items-center gap-3">
          {displayPrice != null && (
            <div className="min-w-[92px] text-center">
              <p className="text-[10px] font-bold text-slate-400">السعر</p>
              <p className="text-lg font-black text-[#0B1833]">{displayPrice.toLocaleString()} <span className="text-xs">دج</span></p>
            </div>
          )}
          <button onClick={handleCTAClick} disabled={product?.stock === 0} className="flex-1 rounded-xl bg-[#D4AF37] py-3.5 text-sm font-black text-[#0B1833] disabled:bg-slate-200 disabled:text-slate-500">
            🛒 {displayCTA}
          </button>
        </div>
      </div>
    </div>
  );
}
