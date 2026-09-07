import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

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
  contents?: string[];
  level?: string;
  badge?: string;
}

interface CartItem extends Product {
  quantity: number;
}

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

const PLACEHOLDER_IMAGE = 'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=800&h=800&fit=crop&auto=format';
const safeImage = (images?: string[] | null, index = 0): string => {
  if (!images || !Array.isArray(images) || images.length === 0) return PLACEHOLDER_IMAGE;
  return images[Math.min(index, images.length - 1)] || PLACEHOLDER_IMAGE;
};
const safeImages = (images?: string[] | null): string[] => (!images || !Array.isArray(images)) ? [] : images;
const safeArr = <T,>(arr?: T[] | null): T[] => (!arr || !Array.isArray(arr)) ? [] : arr;

function setSEO(title: string, description: string, image: string, canonicalUrl: string) {
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
  canonical.href = canonicalUrl;

  const ogTags: Record<string, string> = {
    'og:type': 'product',
    'og:title': title,
    'og:description': description,
    'og:url': canonicalUrl,
    'og:image': image,
  };
  Object.entries(ogTags).forEach(([property, content]) => {
    let tag = document.querySelector(`meta[property="${property}"]`) as HTMLMetaElement | null;
    if (!tag) {
      tag = document.createElement('meta');
      tag.setAttribute('property', property);
      document.head.appendChild(tag);
    }
    tag.content = content;
  });
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[\s_]+/g, '-')
    .replace(/[^؀-ۿa-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function findProductBySlug(products: Product[], slug: string): Product | undefined {
  const id = parseInt(slug, 10);
  if (!Number.isNaN(id)) return products.find(p => p.id === id);
  return products.find(p => slugify(p.name) === slug);
}

const Logo = () => (
  <img
    src="https://i.ibb.co/YFNY7gKg/logo-header-transparent.png"
    alt="المعراج"
    className="h-10 w-10 sm:h-11 sm:w-11 object-contain"
    onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
  />
);

function buildFAQs(product: Product): { q: string; a: string }[] {
  return [
    {
      q: 'هل الدفع عند الاستلام؟',
      a: 'نعم، الدفع يكون عند استلام الطلبية.',
    },
    {
      q: 'هل التوصيل متوفر لكل الولايات؟',
      a: 'نعم، التوصيل متوفر لجميع ولايات الجزائر، ويتم حساب السعر حسب الولاية ونوع التوصيل.',
    },
    {
      q: `هل السعر ${product.price.toLocaleString()} دج يشمل التوصيل؟`,
      a: 'السعر المعروض هو سعر المنتج. تكلفة التوصيل تُحسب بشكل منفصل حسب الوجهة وتظهر أثناء إتمام الطلب.',
    },
    {
      q: 'كيف أطلب المنتج؟',
      a: 'اضغط «اطلب الآن»، ثم أكمل معلومات التوصيل داخل المتجر. يمكنك أيضًا إضافة المنتج إلى السلة مع منتجات أخرى.',
    },
  ];
}

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
  const [openFAQ, setOpenFAQ] = useState<number | null>(0);
  const pixelFired = useRef(false);

  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2600);
  }, []);

  useEffect(() => {
    if (!product || pixelFired.current) return;
    pixelFired.current = true;
    fbTrack('ViewContent', buildCatalogData(product));
    setSEO(
      `${product.name} | المعراج`,
      (product.description || '').replace(/\s+/g, ' ').trim().slice(0, 200) || 'وسائل تعليمية للأساتذة من مؤسسة المعراج.',
      safeImage(product.images),
      `https://elm3raj.com/lp/${product.id}`,
    );
  }, [product]);

  useEffect(() => {
    window.scrollTo(0, 0);
    setCurrentImage(0);
    setQuantity(1);
  }, [slug]);

  if (!product) {
    return (
      <div className="min-h-screen bg-[#F7F8FA] flex items-center justify-center p-6" dir="rtl">
        <div className="bg-white rounded-3xl shadow-lg border border-slate-100 text-center p-8 max-w-md w-full">
          <div className="text-6xl mb-4">🔎</div>
          <h1 className="text-2xl font-black text-[#0B1833] mb-2">المنتج غير موجود</h1>
          <p className="text-slate-500 mb-6">تعذر العثور على هذا المنتج.</p>
          <button onClick={() => navigate('/')} className="w-full bg-[#0B1833] text-white py-3.5 rounded-xl font-black">العودة للمتجر</button>
        </div>
      </div>
    );
  }

  const gallery = safeImages(product.images);
  const benefits = safeArr(product.benefits).filter(Boolean).slice(0, 6);
  const contents = safeArr(product.contents).filter(Boolean).slice(0, 12);
  const faqs = buildFAQs(product);
  const levelLabel = product.level ? LEVEL_LABELS[product.level] : undefined;
  const categoryIcon = product.category === 'تحضيري' ? '🎨' : product.category === 'ابتدائي' ? '📚' : '🎓';
  const related = products.filter(p => p.id !== product.id && p.category === product.category).slice(0, 4);

  const addToCart = () => {
    if (product.stock <= 0) return;
    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        return prev.map(item => item.id === product.id ? { ...item, quantity: item.quantity + quantity } : item);
      }
      return [...prev, { ...product, quantity }];
    });
    fbTrack('AddToCart', buildCatalogData(product, quantity));
    showToast('تمت إضافة المنتج إلى السلة');
  };

  const buyNow = () => {
    if (product.stock <= 0) return;
    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        return prev.map(item => item.id === product.id ? { ...item, quantity: item.quantity + quantity } : item);
      }
      return [...prev, { ...product, quantity }];
    });
    fbTrack('AddToCart', buildCatalogData(product, quantity));
    fbTrack('InitiateCheckout', buildCatalogData(product, quantity));
    navigate('/?checkout=1');
  };

  const scrollToContents = () => {
    document.getElementById('product-details')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="min-h-screen bg-[#F7F8FA] text-[#0B1833] font-sans pb-24 md:pb-0" dir="rtl">
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[9999] bg-[#0B1833] text-white px-5 py-3 rounded-2xl shadow-2xl font-bold text-sm">
          ✅ {toast}
        </div>
      )}

      <div className="bg-[#07152F] text-white text-center px-3 py-2 text-xs sm:text-sm font-bold">
        🚚 التوصيل لجميع الولايات <span className="mx-2 text-white/30">|</span> 💵 الدفع عند الاستلام
      </div>

      <header className="bg-white/95 backdrop-blur border-b border-slate-100 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 h-[68px] flex items-center justify-between">
          <button onClick={() => navigate('/')} className="flex items-center gap-2 text-right">
            <Logo />
            <div>
              <div className="font-black text-lg leading-none">المعراج</div>
              <div className="text-[10px] text-slate-400 mt-1">Al Miraj Education</div>
            </div>
          </button>

          <div className="flex items-center gap-2">
            <button onClick={() => navigate('/')} className="hidden sm:block px-3 py-2 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50">المنتجات</button>
            <button onClick={() => navigate('/')} className="relative h-10 w-10 rounded-xl bg-[#0B1833] text-white flex items-center justify-center">
              🛒
              {cartCount > 0 && <span className="absolute -top-2 -left-2 min-w-5 h-5 px-1 rounded-full bg-[#E2A929] text-[#0B1833] text-[10px] font-black flex items-center justify-center">{cartCount}</span>}
            </button>
          </div>
        </div>
      </header>

      <main>
        <section className="bg-white overflow-hidden">
          <div className="max-w-7xl mx-auto px-4 py-5 md:py-9">
            <div className="grid lg:grid-cols-[1.05fr_.95fr] gap-6 lg:gap-10 items-start">
              <div className="lg:sticky lg:top-[92px]">
                <div className="relative rounded-[28px] overflow-hidden bg-[#EEF2F7] aspect-[1.08/1] sm:aspect-[1.18/1] shadow-sm border border-slate-100 group">
                  <img
                    src={safeImage(product.images, currentImage)}
                    alt={product.name}
                    className="w-full h-full object-cover cursor-zoom-in transition-transform duration-500 group-hover:scale-[1.02]"
                    onClick={() => setLightbox(true)}
                  />
                  {product.badge && <span className="absolute top-4 right-4 bg-[#E2A929] text-[#0B1833] px-3 py-1.5 rounded-full text-xs font-black shadow">{product.badge}</span>}
                  {gallery.length > 1 && <span className="absolute bottom-4 left-4 bg-[#07152F]/80 text-white px-3 py-1.5 rounded-full text-xs font-bold">{currentImage + 1} / {gallery.length}</span>}
                </div>

                {gallery.length > 1 && (
                  <div className="flex gap-2.5 mt-3 overflow-x-auto pb-2 snap-x">
                    {gallery.map((image, index) => (
                      <button
                        key={`${image}-${index}`}
                        onClick={() => setCurrentImage(index)}
                        className={`flex-none w-[72px] h-[72px] sm:w-[82px] sm:h-[82px] rounded-2xl overflow-hidden border-2 snap-start transition-all ${currentImage === index ? 'border-[#D4AF37] shadow-md' : 'border-transparent opacity-70 hover:opacity-100'}`}
                      >
                        <img src={image} alt="" className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="pt-1 lg:pt-4">
                <div className="flex flex-wrap gap-2 mb-3">
                  <span className="inline-flex items-center gap-1.5 bg-[#F2F5F9] px-3 py-1.5 rounded-full text-xs font-black">{categoryIcon} {product.category}</span>
                  {levelLabel && <span className="inline-flex items-center bg-[#FFF7DF] text-[#8B6713] px-3 py-1.5 rounded-full text-xs font-black">{levelLabel}</span>}
                  {product.stock > 0 && <span className="inline-flex items-center bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-full text-xs font-black">● متوفر</span>}
                </div>

                <h1 className="text-[29px] sm:text-4xl lg:text-[44px] leading-[1.18] font-black tracking-tight text-[#081A37]">{product.name}</h1>
                {product.description && <p className="text-slate-600 text-base sm:text-lg leading-8 mt-4 max-w-2xl">{product.description}</p>}

                <div className="mt-6 p-4 sm:p-5 rounded-3xl bg-gradient-to-l from-[#FFF8E5] to-white border border-[#EAD79B]">
                  <div className="flex items-end justify-between gap-4">
                    <div>
                      <div className="text-xs text-slate-500 font-bold mb-1">السعر</div>
                      <div className="text-3xl sm:text-[38px] leading-none font-black text-[#0B1833]">{product.price.toLocaleString()} <span className="text-lg">دج</span></div>
                    </div>
                    <div className="text-left text-xs text-slate-500 leading-5">التوصيل يُحسب<br />حسب الولاية</div>
                  </div>
                </div>

                <div className="grid sm:grid-cols-[1fr_auto] gap-3 mt-5">
                  <button
                    onClick={buyNow}
                    disabled={product.stock <= 0}
                    className="h-14 rounded-2xl bg-[#DDAE32] hover:bg-[#C99A24] disabled:bg-slate-300 text-[#07152F] font-black text-lg shadow-lg shadow-amber-900/10 transition-all active:scale-[.99]"
                  >
                    🛒 {product.stock > 0 ? 'اطلب الآن' : 'غير متوفر حاليًا'}
                  </button>
                  <button onClick={scrollToContents} className="h-14 px-6 rounded-2xl border-2 border-[#0B1833] text-[#0B1833] font-black hover:bg-[#0B1833] hover:text-white transition-colors">شاهد التفاصيل</button>
                </div>

                <div className="grid grid-cols-3 gap-2 mt-5">
                  {[
                    ['🚚', 'لكل الولايات'],
                    ['💵', 'الدفع عند الاستلام'],
                    ['🔒', 'طلب آمن'],
                  ].map(([icon, label]) => (
                    <div key={label} className="rounded-2xl bg-[#F7F9FC] border border-slate-100 p-3 text-center">
                      <div className="text-xl mb-1">{icon}</div>
                      <div className="text-[11px] sm:text-xs font-black text-slate-700 leading-4">{label}</div>
                    </div>
                  ))}
                </div>

                <div className="flex items-center gap-3 mt-5">
                  <span className="text-sm font-black text-slate-600">الكمية</span>
                  <div className="inline-flex items-center rounded-xl bg-[#F2F4F7] p-1">
                    <button onClick={() => setQuantity(q => Math.max(1, q - 1))} className="w-9 h-9 bg-white rounded-lg font-black shadow-sm">−</button>
                    <span className="w-10 text-center font-black">{quantity}</span>
                    <button onClick={() => setQuantity(q => Math.min(Math.max(product.stock, 1), q + 1))} className="w-9 h-9 bg-white rounded-lg font-black shadow-sm">+</button>
                  </div>
                  <button onClick={addToCart} disabled={product.stock <= 0} className="mr-auto text-sm font-black text-[#0B1833] underline underline-offset-4 disabled:opacity-40">أضف للسلة</button>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="border-y border-slate-100 bg-[#F9FBFD]">
          <div className="max-w-6xl mx-auto px-4 py-6 grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              ['🧲', 'جاهز للسبورة', 'وسيلة عملية داخل القسم'],
              ['💧', 'مناسب للاستعمال المتكرر', 'مصمم للاستخدام الصفي'],
              ['📚', 'منظم حسب المستوى', levelLabel || product.category],
              ['✨', 'جاهز للاستعمال', 'يوفر وقت التحضير'],
            ].map(([icon, title, desc]) => (
              <div key={title} className="bg-white border border-slate-100 rounded-2xl p-4 text-center shadow-sm">
                <div className="text-2xl mb-2">{icon}</div>
                <div className="font-black text-sm text-[#0B1833]">{title}</div>
                <div className="text-[11px] text-slate-400 mt-1">{desc}</div>
              </div>
            ))}
          </div>
        </section>

        <section id="product-details" className="max-w-6xl mx-auto px-4 py-12 md:py-16 scroll-mt-24">
          <div className="text-center mb-8">
            <span className="text-[#B48517] text-xs font-black tracking-wide">تفاصيل المنتج</span>
            <h2 className="text-2xl sm:text-3xl font-black mt-2">ماذا ستجد مع هذا المنتج؟</h2>
            <div className="w-16 h-1 bg-[#D4AF37] rounded-full mx-auto mt-3" />
          </div>

          {contents.length > 0 ? (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {contents.map((item, index) => (
                <div key={`${item}-${index}`} className="bg-white rounded-2xl border border-slate-100 p-4 flex items-start gap-3 shadow-sm">
                  <span className="w-8 h-8 rounded-xl bg-[#FFF5D8] text-[#9B7212] flex-none flex items-center justify-center font-black">✓</span>
                  <span className="font-bold text-slate-700 leading-6">{item}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-white border border-slate-100 rounded-3xl p-6 sm:p-8 text-center text-slate-500">يمكنك الاطلاع على الصور والوصف للتعرف على المنتج بالتفصيل.</div>
          )}
        </section>

        {gallery.length > 1 && (
          <section className="bg-white py-12 md:py-16">
            <div className="max-w-6xl mx-auto px-4">
              <div className="flex items-end justify-between gap-4 mb-7">
                <div>
                  <span className="text-[#B48517] text-xs font-black">صور حقيقية للمنتج</span>
                  <h2 className="text-2xl sm:text-3xl font-black mt-2">شاهد المنتج عن قرب</h2>
                </div>
                <div className="text-xs text-slate-400 hidden sm:block">اضغط على أي صورة للتكبير</div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
                {gallery.slice(0, 6).map((image, index) => (
                  <button
                    key={`${image}-gallery-${index}`}
                    onClick={() => { setCurrentImage(index); setLightbox(true); }}
                    className={`overflow-hidden rounded-2xl sm:rounded-3xl bg-slate-100 ${index === 0 ? 'col-span-2 md:row-span-2 md:col-span-2' : ''}`}
                  >
                    <img src={image} alt={`${product.name} ${index + 1}`} className={`w-full object-cover hover:scale-105 transition-transform duration-500 ${index === 0 ? 'h-[260px] md:h-full min-h-[360px]' : 'h-[170px] md:h-[220px]'}`} />
                  </button>
                ))}
              </div>
            </div>
          </section>
        )}

        <section className="max-w-6xl mx-auto px-4 py-12 md:py-16">
          <div className="text-center mb-8">
            <span className="text-[#B48517] text-xs font-black">قيمة عملية داخل القسم</span>
            <h2 className="text-2xl sm:text-3xl font-black mt-2">لماذا يفيد الأستاذ؟</h2>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {(benefits.length > 0 ? benefits.slice(0, 4) : [
              'يوفر وقت التحضير داخل القسم',
              'يساعد على تقديم المحتوى بصريًا',
              'يدعم التفاعل والمراجعة السريعة',
              'جاهز للاستعمال مباشرة',
            ]).map((benefit, index) => (
              <div key={`${benefit}-${index}`} className="bg-white border border-slate-100 rounded-3xl p-5 shadow-sm">
                <div className="w-11 h-11 rounded-2xl bg-[#0B1833] text-white flex items-center justify-center font-black mb-4">{index + 1}</div>
                <p className="font-black text-slate-700 leading-7">{benefit}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="bg-[#07152F] text-white py-10 md:py-12">
          <div className="max-w-5xl mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-6 text-center md:text-right">
            <div>
              <div className="text-[#F0C65A] text-sm font-black mb-2">جاهز لطلب المنتج؟</div>
              <h2 className="text-2xl sm:text-3xl font-black">احصل على {product.name}</h2>
              <p className="text-blue-100/70 mt-2 text-sm">الدفع عند الاستلام والتوصيل متوفر لجميع الولايات.</p>
            </div>
            <div className="flex items-center gap-4 w-full md:w-auto">
              <div className="text-left md:text-center flex-none">
                <div className="text-xs text-blue-100/60">السعر</div>
                <div className="text-2xl font-black">{product.price.toLocaleString()} دج</div>
              </div>
              <button onClick={buyNow} disabled={product.stock <= 0} className="flex-1 md:flex-none md:min-w-[220px] bg-[#DDAE32] hover:bg-[#C99A24] disabled:bg-slate-500 text-[#07152F] py-4 px-8 rounded-2xl font-black text-lg">🛒 اطلب الآن</button>
            </div>
          </div>
        </section>

        <section className="max-w-4xl mx-auto px-4 py-12 md:py-16">
          <div className="text-center mb-7">
            <h2 className="text-2xl sm:text-3xl font-black">أسئلة شائعة</h2>
            <p className="text-slate-400 mt-2 text-sm">أهم المعلومات قبل إتمام الطلب</p>
          </div>
          <div className="space-y-3">
            {faqs.map((faq, index) => {
              const isOpen = openFAQ === index;
              return (
                <div key={faq.q} className="bg-white border border-slate-100 rounded-2xl overflow-hidden shadow-sm">
                  <button onClick={() => setOpenFAQ(isOpen ? null : index)} className="w-full px-5 py-4 flex items-center justify-between gap-4 text-right">
                    <span className="font-black text-slate-700">{faq.q}</span>
                    <span className={`w-8 h-8 rounded-full bg-[#F3F5F8] flex items-center justify-center font-black transition-transform ${isOpen ? 'rotate-45' : ''}`}>+</span>
                  </button>
                  {isOpen && <div className="px-5 pb-5 text-sm sm:text-base text-slate-500 leading-7 border-t border-slate-50 pt-4">{faq.a}</div>}
                </div>
              );
            })}
          </div>
        </section>

        {related.length > 0 && (
          <section className="bg-white py-12">
            <div className="max-w-6xl mx-auto px-4">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl sm:text-2xl font-black">منتجات قد تناسبك أيضًا</h2>
                <button onClick={() => navigate('/')} className="text-sm font-black text-[#8E6914]">كل المنتجات ←</button>
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                {related.map(item => (
                  <button key={item.id} onClick={() => navigate(`/lp/${item.id}`)} className="text-right border border-slate-100 bg-[#FAFBFC] rounded-2xl overflow-hidden hover:shadow-md transition-shadow">
                    <img src={safeImage(item.images)} alt={item.name} className="w-full aspect-square object-cover" />
                    <div className="p-3">
                      <div className="font-black text-sm leading-5 line-clamp-2 min-h-10">{item.name}</div>
                      <div className="text-[#0B1833] font-black mt-2">{item.price.toLocaleString()} دج</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </section>
        )}
      </main>

      <footer className="bg-[#050F22] text-white border-t border-white/5">
        <div className="max-w-6xl mx-auto px-4 py-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-right">
          <div className="flex items-center gap-3">
            <Logo />
            <div>
              <div className="font-black">المعراج للوسائل التعليمية</div>
              <div className="text-xs text-white/40 mt-1">Al Miraj Education</div>
            </div>
          </div>
          <div className="text-xs text-white/45">وسائل تعليمية للأساتذة • الدفع عند الاستلام • توصيل داخل الجزائر</div>
        </div>
      </footer>

      <div className="fixed md:hidden bottom-0 left-0 right-0 z-50 bg-[#07152F] text-white p-3 pb-[calc(.75rem+env(safe-area-inset-bottom))] shadow-[0_-8px_30px_rgba(0,0,0,.18)]">
        <div className="flex items-center gap-3 max-w-lg mx-auto">
          <div className="min-w-[105px]">
            <div className="text-[10px] text-white/55">السعر</div>
            <div className="font-black text-xl leading-tight">{product.price.toLocaleString()} <span className="text-xs">دج</span></div>
          </div>
          <button onClick={buyNow} disabled={product.stock <= 0} className="flex-1 bg-[#DDAE32] disabled:bg-slate-500 text-[#07152F] h-12 rounded-xl font-black text-base">🛒 {product.stock > 0 ? 'اطلب الآن' : 'غير متوفر'}</button>
        </div>
      </div>

      {lightbox && (
        <div className="fixed inset-0 z-[9999] bg-black/95 flex items-center justify-center p-3 sm:p-8" onClick={() => setLightbox(false)}>
          <button onClick={() => setLightbox(false)} className="absolute top-4 left-4 w-11 h-11 bg-white/10 hover:bg-white/20 text-white rounded-full text-xl">×</button>
          {gallery.length > 1 && (
            <>
              <button onClick={e => { e.stopPropagation(); setCurrentImage(i => (i - 1 + gallery.length) % gallery.length); }} className="absolute left-3 sm:left-8 w-11 h-11 bg-white/10 hover:bg-white/20 text-white rounded-full text-2xl">‹</button>
              <button onClick={e => { e.stopPropagation(); setCurrentImage(i => (i + 1) % gallery.length); }} className="absolute right-3 sm:right-8 w-11 h-11 bg-white/10 hover:bg-white/20 text-white rounded-full text-2xl">›</button>
            </>
          )}
          <img src={safeImage(product.images, currentImage)} alt={product.name} onClick={e => e.stopPropagation()} className="max-h-[88vh] max-w-[92vw] object-contain rounded-xl" />
        </div>
      )}
    </div>
  );
}
