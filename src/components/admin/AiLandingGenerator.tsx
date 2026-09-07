import { useEffect, useMemo, useState } from 'react';

type Product = {
  id: number;
  name: string;
  description?: string;
  price: number;
  category: string;
  images?: string[];
  level?: string;
};

type GeneratedLanding = {
  hero_title: string;
  hero_subtitle: string;
  benefits: string[];
  contents_heading: string;
  faq: { question: string; answer: string }[];
  final_cta_heading: string;
  cta_text: string;
};

function slugify(text: string) {
  return text
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w\u0600-\u06FF-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || `landing-${Date.now()}`;
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

  const selectedProduct = useMemo(
    () => products.find((product) => product.id === productId) || null,
    [products, productId],
  );

  useEffect(() => {
    const update = () => {
      const isAdmin = window.location.pathname.startsWith('/admin');
      const hasToken = Boolean(localStorage.getItem('almiraj_token'));
      setVisible(isAdmin && hasToken);
    };
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
    if (!token) {
      setError('انتهت جلسة المسؤول. أعد تسجيل الدخول.');
      return;
    }
    setGenerating(true);
    setError('');
    setMessage('');
    setGenerated(null);
    try {
      const response = await fetch('/api/products', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ action: 'generate_landing_content', product_id: Number(productId) }),
      });
      const data = await response.json();
      if (!response.ok || !data?.ok || !data.data) throw new Error(data?.error || 'فشل توليد الصفحة');
      setGenerated(data.data);
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
      const slug = slugify(selectedProduct.name);
      const payload = {
        title: generated.hero_title || selectedProduct.name,
        slug,
        product_id: selectedProduct.id,
        headline: generated.hero_title || selectedProduct.name,
        description: generated.hero_subtitle || selectedProduct.description || '',
        image_url: selectedProduct.images?.[0] || '',
        cta_text: generated.cta_text || 'اطلب الآن',
        cta_url: '/?checkout=1',
        is_active: false,
      };
      const response = await fetch('/api/admin/landing-pages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok || !data?.ok) throw new Error(data?.error || 'تعذر حفظ المسودة');
      setMessage(`✅ تم حفظ مسودة غير منشورة: /l/${slug}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'تعذر حفظ المسودة');
    } finally {
      setSaving(false);
    }
  };

  if (!visible) return null;

  return (
    <>
      <button
        type="button"
        onClick={openGenerator}
        className="fixed left-5 bottom-5 z-[8500] rounded-2xl bg-gradient-to-l from-[#D4AF37] to-amber-400 px-4 py-3 text-sm font-extrabold text-[#0B1833] shadow-2xl ring-1 ring-amber-200 hover:-translate-y-0.5 transition-all"
      >
        ✨ مولد صفحة هبوط
      </button>

      {open && (
        <div className="fixed inset-0 z-[9500] bg-black/65 p-3 sm:p-6 flex items-center justify-center" dir="rtl">
          <div className="w-full max-w-5xl max-h-[94vh] overflow-y-auto rounded-3xl bg-[#F7F8FB] dark:bg-gray-900 shadow-2xl border border-white/20">
            <div className="sticky top-0 z-10 flex items-center justify-between gap-3 bg-[#0B1833] text-white px-5 sm:px-7 py-4 rounded-t-3xl">
              <div>
                <h2 className="font-extrabold text-lg sm:text-xl">✨ مولد صفحات الهبوط الذكي</h2>
                <p className="text-xs text-blue-100 mt-1">اختر المنتج، راجع النتيجة، ثم احفظها كمسودة فقط.</p>
              </div>
              <button onClick={() => setOpen(false)} className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 font-bold">✕</button>
            </div>

            <div className="p-5 sm:p-7 grid lg:grid-cols-[340px_1fr] gap-6">
              <aside className="space-y-4">
                <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-4 shadow-sm">
                  <label className="block text-sm font-bold mb-2 text-gray-700 dark:text-gray-200">المنتج</label>
                  {loadingProducts ? (
                    <div className="py-6 text-center text-sm text-gray-400">⏳ جاري تحميل المنتجات...</div>
                  ) : (
                    <select
                      value={productId}
                      onChange={(e) => { setProductId(e.target.value ? Number(e.target.value) : ''); setGenerated(null); setMessage(''); }}
                      className="w-full border-2 border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-900 px-3 py-3 text-sm font-bold outline-none focus:border-[#D4AF37]"
                    >
                      {products.map((product) => (
                        <option key={product.id} value={product.id}>{product.name} — {product.price.toLocaleString()} دج</option>
                      ))}
                    </select>
                  )}

                  {selectedProduct && (
                    <div className="mt-4 rounded-xl bg-slate-50 dark:bg-gray-900/60 p-3 text-xs text-gray-600 dark:text-gray-300 space-y-1">
                      <p><strong>الطور:</strong> {selectedProduct.category}</p>
                      {selectedProduct.level && <p><strong>المستوى:</strong> {selectedProduct.level}</p>}
                      <p className="text-gray-400">السعر والحقائق التجارية لا يكتبها AI؛ تبقى من قاعدة البيانات.</p>
                    </div>
                  )}

                  <button
                    onClick={generate}
                    disabled={!productId || generating}
                    className="mt-4 w-full rounded-xl bg-[#0B1833] hover:bg-[#13264d] disabled:bg-gray-400 text-white py-3 font-extrabold transition-all"
                  >
                    {generating ? '⏳ الذكاء الاصطناعي يجهز الصفحة...' : '✨ توليد المحتوى الآن'}
                  </button>
                </div>

                {error && <div className="rounded-xl bg-red-50 border border-red-200 p-3 text-sm font-bold text-red-700">❌ {error}</div>}
                {message && <div className="rounded-xl bg-green-50 border border-green-200 p-3 text-sm font-bold text-green-700">{message}</div>}
              </aside>

              <main>
                {!generated ? (
                  <div className="min-h-[430px] rounded-3xl border-2 border-dashed border-gray-200 dark:border-gray-700 bg-white/70 dark:bg-gray-800/60 flex items-center justify-center text-center p-8">
                    <div>
                      <div className="text-6xl mb-4">🪄</div>
                      <h3 className="font-extrabold text-xl text-[#0B1833] dark:text-white">معاينة الصفحة ستظهر هنا</h3>
                      <p className="text-sm text-gray-500 mt-2 max-w-md">سيولد AI النصوص فقط، بينما التصميم والسعر والصور والشراء تبقى تحت تحكم المتجر.</p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="overflow-hidden rounded-3xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-lg">
                      <div className="grid sm:grid-cols-2">
                        <div className="min-h-[260px] bg-slate-100 dark:bg-gray-900">
                          {selectedProduct?.images?.[0] ? (
                            <img src={selectedProduct.images[0]} alt="" className="w-full h-full min-h-[260px] object-cover" />
                          ) : <div className="h-full min-h-[260px] flex items-center justify-center text-6xl">📦</div>}
                        </div>
                        <div className="p-6 flex flex-col justify-center">
                          <span className="text-xs font-bold text-[#B38A16] mb-2">{selectedProduct?.category}</span>
                          <h1 className="text-2xl sm:text-3xl font-extrabold leading-tight text-[#0B1833] dark:text-white">{generated.hero_title}</h1>
                          <p className="mt-3 text-gray-600 dark:text-gray-300 leading-7">{generated.hero_subtitle}</p>
                          {selectedProduct && <p className="mt-4 text-3xl font-extrabold text-[#0B1833] dark:text-amber-300">{selectedProduct.price.toLocaleString()} دج</p>}
                          <button className="mt-4 rounded-xl bg-[#D4AF37] text-[#0B1833] py-3 font-extrabold">{generated.cta_text}</button>
                        </div>
                      </div>
                    </div>

                    <div className="grid sm:grid-cols-2 gap-3">
                      {generated.benefits.map((benefit, index) => (
                        <div key={index} className="rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-4 flex gap-3 items-start">
                          <span className="w-9 h-9 flex-shrink-0 rounded-xl bg-amber-50 text-xl flex items-center justify-center">✓</span>
                          <p className="font-bold text-sm text-gray-700 dark:text-gray-200 leading-6">{benefit}</p>
                        </div>
                      ))}
                    </div>

                    {generated.faq.length > 0 && (
                      <div className="rounded-3xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-5">
                        <h3 className="font-extrabold text-lg text-[#0B1833] dark:text-white mb-3">أسئلة شائعة</h3>
                        <div className="space-y-3">
                          {generated.faq.map((item, index) => (
                            <div key={index} className="rounded-xl bg-slate-50 dark:bg-gray-900/60 p-3">
                              <p className="font-bold text-sm">{item.question}</p>
                              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 leading-5">{item.answer}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="rounded-3xl bg-[#0B1833] p-6 text-center text-white">
                      <h3 className="text-xl font-extrabold">{generated.final_cta_heading}</h3>
                      <p className="mt-2 text-sm text-blue-100">الدفع عند الاستلام — التوصيل حسب الولاية</p>
                      <button className="mt-4 min-w-48 rounded-xl bg-[#D4AF37] text-[#0B1833] py-3 px-6 font-extrabold">{generated.cta_text}</button>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3">
                      <button onClick={generate} disabled={generating} className="flex-1 border-2 border-[#D4AF37] text-[#8A6A11] dark:text-amber-300 py-3 rounded-xl font-extrabold">🔄 إعادة التوليد</button>
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
