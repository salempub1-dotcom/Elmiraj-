import { useEffect, useMemo, useState } from 'react';

type Product = {
  id: number;
  name: string;
  description?: string;
  price: number;
  category: string;
  images?: string[];
  level?: string;
  contents?: string[];
};

type GeneratedBenefit = { text: string; icon_key: string };
type GeneratedStep = { title: string; text: string; icon_key: string };
type GeneratedLanding = {
  hero_title: string;
  hero_subtitle: string;
  problem_heading: string;
  problem_text: string;
  outcome_heading: string;
  outcome_text: string;
  benefits: GeneratedBenefit[];
  contents_heading: string;
  use_heading: string;
  use_steps: GeneratedStep[];
  faq: { question: string; answer: string }[];
  final_cta_heading: string;
  cta_text: string;
};

const ICONS: Record<string, string> = {
  time: '⏱️', classroom: '🏫', visual: '👁️', organize: '🗂️', students: '🧒',
  ready: '✅', quality: '⭐', protect: '🛡️', content: '📚', teaching: '🎓', check: '✔️', idea: '💡',
};

function slugify(text: string) {
  return text.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^\w\u0600-\u06FF-]/g, '').replace(/-+/g, '-').replace(/^-|-$/g, '') || `landing-${Date.now()}`;
}

export default function AiLandingGenerator() {
  const [visible, setVisible] = useState(false);
  const [open, setOpen] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [productId, setProductId] = useState<number | ''>('');
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [generated, setGenerated] = useState<GeneratedLanding | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [galleryIndex, setGalleryIndex] = useState(0);

  const selectedProduct = useMemo(
    () => products.find((product) => product.id === productId) || null,
    [products, productId],
  );

  useEffect(() => {
    const update = () => setVisible(window.location.pathname.startsWith('/admin') && Boolean(localStorage.getItem('almiraj_token')));
    update();
    window.addEventListener('popstate', update);
    window.addEventListener('hashchange', update);
    const timer = window.setInterval(update, 1500);
    return () => {
      window.removeEventListener('popstate', update);
      window.removeEventListener('hashchange', update);
      window.clearInterval(timer);
    };
  }, []);

  const loadProducts = async () => {
    if (products.length > 0) return;
    setLoadingProducts(true);
    setError('');
    try {
      const response = await fetch('/api/products');
      const data = await response.json();
      if (!data?.ok || !Array.isArray(data.data)) throw new Error(data?.error || 'تعذر تحميل المنتجات');
      setProducts(data.data);
      if (data.data.length) setProductId(data.data[0].id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'تعذر تحميل المنتجات');
    } finally {
      setLoadingProducts(false);
    }
  };

  const openGenerator = () => {
    setOpen(true);
    setMessage('');
    setError('');
    void loadProducts();
  };

  const generate = async () => {
    if (!productId) return;
    const token = localStorage.getItem('almiraj_token') || '';
    if (!token) { setError('انتهت جلسة المسؤول. أعد تسجيل الدخول.'); return; }
    setGenerating(true);
    setError('');
    setMessage('');
    try {
      const response = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: 'generate_landing_content', product_id: Number(productId) }),
      });
      const data = await response.json();
      if (!response.ok || !data?.ok || !data.data) throw new Error(data?.error || 'فشل توليد الصفحة');
      const normalized: GeneratedLanding = {
        ...data.data,
        benefits: Array.isArray(data.data.benefits)
          ? data.data.benefits.map((b: string | GeneratedBenefit, i: number) => typeof b === 'string' ? ({ text: b, icon_key: ['teaching', 'visual', 'students', 'time'][i % 4] }) : b)
          : [],
        use_steps: Array.isArray(data.data.use_steps) ? data.data.use_steps : [],
      };
      setGenerated(normalized);
      setGalleryIndex(0);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'فشل توليد الصفحة');
    } finally {
      setGenerating(false);
    }
  };

  const saveDraft = async () => {
    if (!generated || !selectedProduct) return;
    const token = localStorage.getItem('almiraj_token') || '';
    if (!token) return;
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const slug = `${slugify(selectedProduct.name)}-${Date.now().toString(36).slice(-4)}`;
      const payload = {
        title: generated.hero_title || selectedProduct.name,
        slug,
        product_id: selectedProduct.id,
        headline: generated.hero_title || selectedProduct.name,
        description: generated.hero_subtitle || selectedProduct.description || '',
        image_url: selectedProduct.images?.[0] || '',
        cta_text: generated.cta_text || 'اطلب الآن',
        cta_url: `/lp/${selectedProduct.id}`,
        is_active: false,
      };
      const response = await fetch('/api/admin/landing-pages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok || !data?.ok) throw new Error(data?.message || data?.error || 'تعذر حفظ المسودة');
      setMessage(`✅ تم حفظ صفحة غير منشورة: /l/${slug}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'تعذر حفظ المسودة');
    } finally {
      setSaving(false);
    }
  };

  if (!visible) return null;

  const images = selectedProduct?.images?.filter(Boolean) || [];
  const contents = selectedProduct?.contents?.filter(Boolean) || [];

  return (
    <>
      <button type="button" onClick={openGenerator} className="fixed left-5 bottom-5 z-[8500] rounded-2xl bg-gradient-to-l from-[#D4AF37] to-amber-400 px-4 py-3 text-sm font-extrabold text-[#0B1833] shadow-2xl ring-1 ring-amber-200 hover:-translate-y-0.5 transition-all">
        ✨ مولد صفحة هبوط
      </button>

      {open && (
        <div className="fixed inset-0 z-[9500] bg-black/70 p-2 sm:p-5 flex items-center justify-center" dir="rtl">
          <div className="w-full max-w-7xl max-h-[96vh] overflow-y-auto rounded-[28px] bg-[#F5F6F8] dark:bg-gray-900 shadow-2xl border border-white/20">
            <div className="sticky top-0 z-30 flex items-center justify-between gap-3 bg-[#0B1833] text-white px-5 sm:px-7 py-4 rounded-t-[28px]">
              <div>
                <h2 className="font-extrabold text-lg sm:text-xl">✨ مولد صفحات الهبوط الذكي</h2>
                <p className="text-xs text-blue-100 mt-1">أسلوب بيع احترافي موجه للأستاذ، بدون ادعاءات أو معلومات غير موثقة.</p>
              </div>
              <button onClick={() => setOpen(false)} className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 font-bold">✕</button>
            </div>

            <div className="p-4 sm:p-7 grid xl:grid-cols-[320px_1fr] gap-6">
              <aside className="space-y-4 xl:sticky xl:top-24 xl:self-start">
                <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-4 shadow-sm">
                  <label className="block text-sm font-bold mb-2 text-gray-700 dark:text-gray-200">المنتج</label>
                  {loadingProducts ? (
                    <div className="py-6 text-center text-sm text-gray-400">⏳ جاري تحميل المنتجات...</div>
                  ) : (
                    <select
                      value={productId}
                      onChange={(e) => { setProductId(e.target.value ? Number(e.target.value) : ''); setGenerated(null); setMessage(''); setGalleryIndex(0); }}
                      className="w-full border-2 border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-900 px-3 py-3 text-sm font-bold outline-none focus:border-[#D4AF37]"
                    >
                      {products.map((product) => <option key={product.id} value={product.id}>{product.name} — {product.price.toLocaleString()} دج</option>)}
                    </select>
                  )}

                  {selectedProduct && (
                    <div className="mt-4 rounded-xl bg-slate-50 dark:bg-gray-900/60 p-3 text-xs text-gray-600 dark:text-gray-300 space-y-1">
                      <p><strong>الطور:</strong> {selectedProduct.category}</p>
                      {selectedProduct.level && <p><strong>المستوى:</strong> {selectedProduct.level}</p>}
                      <p><strong>الصور:</strong> {images.length}</p>
                      <p><strong>المحتويات:</strong> {contents.length}</p>
                      <p className="pt-1 text-gray-400">السعر والصور والمحتوى التجاري تأتي من قاعدة البيانات.</p>
                    </div>
                  )}

                  <button onClick={generate} disabled={!productId || generating} className="mt-4 w-full rounded-xl bg-[#0B1833] hover:bg-[#13264d] disabled:bg-gray-400 text-white py-3 font-extrabold transition-all">
                    {generating ? '⏳ AI يبني الصفحة...' : generated ? '♻️ إعادة توليد الصفحة' : '✨ توليد صفحة احترافية'}
                  </button>
                </div>
                {error && <div className="rounded-xl bg-red-50 border border-red-200 p-3 text-sm font-bold text-red-700">❌ {error}</div>}
                {message && <div className="rounded-xl bg-green-50 border border-green-200 p-3 text-sm font-bold text-green-700 break-words">{message}</div>}
              </aside>

              <main>
                {!generated ? (
                  <div className="min-h-[560px] rounded-3xl border-2 border-dashed border-gray-200 dark:border-gray-700 bg-white/75 dark:bg-gray-800/60 flex items-center justify-center text-center p-8">
                    <div>
                      <div className="text-7xl mb-5">🪄</div>
                      <h3 className="font-extrabold text-2xl text-[#0B1833] dark:text-white">الصفحة التسويقية ستظهر هنا</h3>
                      <p className="text-sm text-gray-500 mt-3 max-w-lg leading-7">سيبني المولد تسلسلًا كاملًا: المشكلة، الحل، الفوائد، المحتوى، طريقة الاستعمال، الثقة، الأسئلة الشائعة ثم الطلب.</p>
                    </div>
                  </div>
                ) : (
                  <div className="overflow-hidden rounded-[30px] bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 shadow-xl">
                    <section className="relative overflow-hidden bg-gradient-to-bl from-white via-[#FFFCF2] to-[#F2F5FA] dark:from-gray-900 dark:via-gray-900 dark:to-gray-950">
                      <div className="absolute -left-20 -top-20 h-56 w-56 rounded-full bg-[#D4AF37]/10 blur-3xl" />
                      <div className="grid lg:grid-cols-[1.05fr_.95fr] items-stretch">
                        <div className="p-7 sm:p-10 lg:p-12 flex flex-col justify-center relative z-10">
                          <div className="flex flex-wrap gap-2 mb-5">
                            <span className="rounded-full bg-[#0B1833] px-3 py-1.5 text-[11px] font-extrabold text-white">{selectedProduct?.category}</span>
                            {selectedProduct?.level && <span className="rounded-full bg-amber-100 px-3 py-1.5 text-[11px] font-extrabold text-[#8A6810]">{selectedProduct.level}</span>}
                          </div>
                          <h1 className="text-3xl sm:text-5xl font-black leading-[1.15] text-[#0B1833] dark:text-white">{generated.hero_title}</h1>
                          <p className="mt-4 max-w-xl text-base sm:text-lg text-slate-600 dark:text-gray-300 leading-8">{generated.hero_subtitle}</p>
                          {selectedProduct && <p className="mt-6 text-4xl font-black text-[#0B1833] dark:text-amber-300">{selectedProduct.price.toLocaleString()} <span className="text-xl">دج</span></p>}
                          <button className="mt-5 max-w-sm rounded-2xl bg-[#D4AF37] px-7 py-4 text-lg font-black text-[#0B1833] shadow-lg shadow-amber-200/50">{generated.cta_text} ←</button>
                          <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs font-bold text-slate-500"><span>💵 الدفع عند الاستلام</span><span>🚚 التوصيل حسب الولاية</span></div>
                        </div>
                        <div className="relative min-h-[390px] bg-slate-100 dark:bg-gray-900">
                          {images[galleryIndex] ? <img src={images[galleryIndex]} alt="" className="absolute inset-0 h-full w-full object-cover" /> : <div className="h-full min-h-[390px] flex items-center justify-center text-7xl">📦</div>}
                          <div className="absolute inset-0 bg-gradient-to-t from-[#0B1833]/25 via-transparent to-transparent" />
                        </div>
                      </div>
                    </section>

                    {images.length > 1 && (
                      <section className="border-y border-slate-100 dark:border-gray-800 bg-white dark:bg-gray-900 px-5 py-4">
                        <div className="flex gap-3 overflow-x-auto justify-start lg:justify-center">
                          {images.slice(0, 6).map((img, index) => (
                            <button key={img + index} onClick={() => setGalleryIndex(index)} className={`w-24 h-20 rounded-2xl overflow-hidden flex-shrink-0 border-2 transition ${galleryIndex === index ? 'border-[#D4AF37] shadow-md' : 'border-slate-100'}`}>
                              <img src={img} alt="" className="w-full h-full object-cover" />
                            </button>
                          ))}
                        </div>
                      </section>
                    )}

                    <section className="px-6 sm:px-10 py-12 bg-[#0B1833] text-white text-center">
                      <div className="mx-auto max-w-3xl">
                        <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-2xl">⏳</span>
                        <p className="mt-4 text-xs font-extrabold tracking-wider text-amber-300">المشكل الذي نحاول حله</p>
                        <h2 className="mt-2 text-2xl sm:text-4xl font-black">{generated.problem_heading}</h2>
                        <p className="mt-4 text-sm sm:text-base leading-8 text-blue-100">{generated.problem_text}</p>
                        <div className="mt-6 text-3xl text-amber-300">↓</div>
                      </div>
                    </section>

                    <section className="px-6 sm:px-10 py-12 bg-[#FFF9E9] dark:bg-gray-900 text-center">
                      <div className="mx-auto max-w-3xl">
                        <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-2xl shadow-sm">✨</span>
                        <h2 className="mt-4 text-2xl sm:text-4xl font-black text-[#0B1833] dark:text-white">{generated.outcome_heading}</h2>
                        <p className="mt-3 text-slate-600 dark:text-gray-300 leading-8">{generated.outcome_text}</p>
                      </div>
                    </section>

                    <section className="px-6 sm:px-10 py-12 bg-white dark:bg-gray-950">
                      <div className="text-center mb-8"><p className="text-xs font-extrabold text-[#B38A16]">لماذا هذا المنتج؟</p><h2 className="mt-2 text-2xl sm:text-3xl font-black text-[#0B1833] dark:text-white">فوائد عملية للأستاذ داخل القسم</h2></div>
                      <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4">
                        {generated.benefits.map((benefit, index) => (
                          <div key={index} className="rounded-3xl border border-slate-100 bg-[#F8F9FB] dark:border-gray-800 dark:bg-gray-900 p-5 text-center shadow-sm">
                            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-100 text-2xl">{ICONS[benefit.icon_key] || '✔️'}</span>
                            <p className="mt-4 font-extrabold text-sm leading-7 text-[#0B1833] dark:text-white">{benefit.text}</p>
                          </div>
                        ))}
                      </div>
                      <div className="mt-8 text-center"><button className="rounded-2xl bg-[#0B1833] px-8 py-3.5 font-black text-white">{generated.cta_text} ←</button></div>
                    </section>

                    {contents.length > 0 && (
                      <section className="px-6 sm:px-10 py-12 bg-[#F5F7FA] dark:bg-gray-900">
                        <div className="grid lg:grid-cols-[.9fr_1.1fr] gap-8 items-center">
                          <div>
                            <p className="text-xs font-extrabold text-[#B38A16]">محتوى حقيقي من بيانات المنتج</p>
                            <h2 className="mt-2 text-2xl sm:text-3xl font-black text-[#0B1833] dark:text-white">{generated.contents_heading}</h2>
                            <div className="mt-6 grid gap-3">
                              {contents.slice(0, 12).map((item, index) => (
                                <div key={index} className="flex items-start gap-3 rounded-2xl bg-white dark:bg-gray-950 px-4 py-3 shadow-sm">
                                  <span className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-amber-100 text-xs font-black text-[#8A6810]">✓</span>
                                  <span className="text-sm font-bold leading-6 text-slate-700 dark:text-gray-200">{item}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                          <div className="overflow-hidden rounded-[28px] bg-white shadow-lg min-h-[330px]">
                            {images[1] || images[0] ? <img src={images[1] || images[0]} alt="" className="h-full min-h-[330px] w-full object-cover" /> : <div className="min-h-[330px] flex items-center justify-center text-7xl">📚</div>}
                          </div>
                        </div>
                      </section>
                    )}

                    {generated.use_steps.length > 0 && (
                      <section className="px-6 sm:px-10 py-12 bg-white dark:bg-gray-950">
                        <div className="text-center mb-9"><p className="text-xs font-extrabold text-[#B38A16]">تطبيق بسيط</p><h2 className="mt-2 text-2xl sm:text-3xl font-black text-[#0B1833] dark:text-white">{generated.use_heading}</h2></div>
                        <div className="grid md:grid-cols-3 gap-5">
                          {generated.use_steps.map((step, index) => (
                            <div key={index} className="relative rounded-3xl border border-slate-100 bg-[#FCFCFD] dark:border-gray-800 dark:bg-gray-900 p-6 text-center">
                              <span className="absolute -top-4 right-5 flex h-9 w-9 items-center justify-center rounded-full bg-[#D4AF37] font-black text-[#0B1833] shadow">{index + 1}</span>
                              <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#0B1833] text-2xl">{ICONS[step.icon_key] || '💡'}</span>
                              <h3 className="mt-4 text-lg font-black text-[#0B1833] dark:text-white">{step.title}</h3>
                              <p className="mt-2 text-sm leading-7 text-slate-500 dark:text-gray-400">{step.text}</p>
                              {index < generated.use_steps.length - 1 && <span className="hidden md:block absolute -left-4 top-1/2 text-2xl text-[#D4AF37]">←</span>}
                            </div>
                          ))}
                        </div>
                      </section>
                    )}

                    <section className="px-6 sm:px-10 py-8 bg-[#FFF9E9] dark:bg-gray-900">
                      <div className="grid sm:grid-cols-3 gap-3 text-center">
                        <div className="rounded-2xl bg-white dark:bg-gray-950 p-4"><div className="text-2xl">💵</div><p className="mt-2 font-black text-[#0B1833] dark:text-white">الدفع عند الاستلام</p></div>
                        <div className="rounded-2xl bg-white dark:bg-gray-950 p-4"><div className="text-2xl">🚚</div><p className="mt-2 font-black text-[#0B1833] dark:text-white">التوصيل حسب الولاية</p></div>
                        <div className="rounded-2xl bg-white dark:bg-gray-950 p-4"><div className="text-2xl">📦</div><p className="mt-2 font-black text-[#0B1833] dark:text-white">بيانات المنتج من المتجر</p></div>
                      </div>
                    </section>

                    {generated.faq.length > 0 && (
                      <section className="px-6 sm:px-10 py-12 bg-white dark:bg-gray-950">
                        <div className="mx-auto max-w-3xl">
                          <div className="text-center mb-7"><p className="text-xs font-extrabold text-[#B38A16]">قبل الطلب</p><h2 className="mt-2 text-2xl sm:text-3xl font-black text-[#0B1833] dark:text-white">أسئلة شائعة</h2></div>
                          <div className="space-y-3">
                            {generated.faq.map((item, index) => (
                              <div key={index} className="rounded-2xl border border-slate-100 bg-[#F8F9FB] dark:border-gray-800 dark:bg-gray-900 p-5">
                                <p className="font-black text-[#0B1833] dark:text-white">{item.question}</p>
                                <p className="mt-2 text-sm leading-7 text-slate-500 dark:text-gray-400">{item.answer}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      </section>
                    )}

                    <section className="px-6 sm:px-10 py-14 bg-[#0B1833] text-center text-white">
                      <div className="mx-auto max-w-3xl">
                        <div className="text-4xl">🎓</div>
                        <h2 className="mt-4 text-2xl sm:text-4xl font-black">{generated.final_cta_heading}</h2>
                        {selectedProduct && <p className="mt-4 text-4xl font-black text-[#D4AF37]">{selectedProduct.price.toLocaleString()} دج</p>}
                        <button className="mt-6 min-w-56 rounded-2xl bg-[#D4AF37] px-9 py-4 text-lg font-black text-[#0B1833] shadow-xl">{generated.cta_text} ←</button>
                        <p className="mt-4 text-xs text-blue-100">الدفع عند الاستلام • التوصيل حسب الولاية</p>
                      </div>
                    </section>

                    <div className="flex flex-col sm:flex-row gap-3 p-5 bg-[#F5F6F8] dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800">
                      <button onClick={generate} disabled={generating} className="flex-1 border-2 border-[#D4AF37] text-[#8A6A11] dark:text-amber-300 py-3 rounded-xl font-extrabold disabled:opacity-50">♻️ إعادة توليد الصفحة</button>
                      <button onClick={saveDraft} disabled={saving} className="flex-1 bg-[#0B1833] text-white py-3 rounded-xl font-extrabold disabled:bg-gray-400">{saving ? '⏳ جاري الحفظ...' : '💾 حفظ كمسودة غير منشورة'}</button>
                    </div>
                  </div>
                )}
              </main>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
