import { FormEvent, ReactNode, useEffect, useRef, useState } from 'react';
import { WILAYA_SHIPPING, normalizeRuleText } from '../../lib/aiRules.js';
import './AiAssistant.css';

type ChatMessage = {
  role: 'user' | 'assistant';
  content: string;
};

type AssistantErrorData = {
  error?: string;
  provider?: string;
  provider_status?: number;
  provider_message?: string;
  model?: string;
};

type CheckoutProduct = {
  id: number;
  name: string;
  price: number;
  stock?: number;
  images?: string[];
  description?: string;
  category?: string;
  benefits?: string[];
  contents?: string[];
  level?: string;
  badge?: string;
};

type WilayaShipping = {
  code: number;
  name: string;
  home: number;
  office: number;
};

type CheckoutStep = 'name' | 'phone' | 'wilaya' | 'commune' | 'delivery' | 'office' | 'address' | 'confirm';

type CheckoutState = {
  step: CheckoutStep;
  items: CheckoutProduct[];
  subtotal: number;
  customer?: string;
  phone?: string;
  wilaya?: WilayaShipping;
  commune?: string;
  deliveryType?: 'home' | 'office';
  officeName?: string;
  address?: string;
};

const WELCOME: ChatMessage = {
  role: 'assistant',
  content: 'السلام عليكم 🌟 أنا مساعد المعراج. نعاونك تعرف المنتجات والأسعار ونختاروا معًا الأنسب ليك.',
};

const QUICK_QUESTIONS = [
  'شنو عندكم للسنة الرابعة ابتدائي؟',
  'واش البطاقات ممغنطة؟',
  'ساعدني نختار المنتج المناسب',
  'نحب نشري حقيبة السنوات الثلاثة',
];

const SHIPPING = WILAYA_SHIPPING as WilayaShipping[];

function money(value: number) {
  return `${Number(value || 0).toLocaleString('en-US')} دج`;
}

function normalize(text = '') {
  return normalizeRuleText(text);
}

function findWilaya(raw: string): WilayaShipping | undefined {
  let value = normalize(raw);

  // Common aliases after the same normalization used by the backend rules.
  if (value === 'الجزاير' || value === 'الجزائر العاصمه' || value === 'الجزاير العاصمه') {
    value = normalize('الجزائر');
  }

  return SHIPPING.find((wilaya) => {
    const name = normalize(wilaya.name);
    return value === name || value.includes(name) || name.includes(value);
  });
}

function isPurchaseIntent(message: string, history: ChatMessage[]) {
  const current = normalize(message);
  const context = normalize(history.slice(-6).map((item) => item.content).join(' '));
  const wantsOrder = /(نحب نشري|حاب نشري|اريد شراء|اريد الشراء|نحب نطلب|حاب نطلب|اريد الطلب|اكمل الطلب|كمل الطلب|اطلبها|نطلبها)/.test(current);
  const fullPrimary = /(السنوات الثلاثه|الحقيبه كامله|حقيبه السنوات الثلاثه|3ps.*4ps.*5ps)/.test(`${context} ${current}`);
  return wantsOrder && fullPrimary;
}

function generateOrderReference() {
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `AM-${Date.now().toString(36).toUpperCase()}${rand}`;
}

function renderAssistantText(content: string): ReactNode[] {
  const tokenRegex = /(\[[^\]]+\]\(https?:\/\/[^\s)]+\)|https?:\/\/[^\s]+|\*\*[^*]+\*\*|\b\d{1,3}(?:[\s,.]\d{3})*(?:[.,]\d+)?\s*(?:دج|DA|DZD)\b)/gi;
  const parts = content.split(tokenRegex);

  return parts.map((part, index) => {
    if (!part) return null;

    const markdownLink = part.match(/^\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)$/i);
    if (markdownLink) {
      return (
        <a key={`md-link-${index}`} className="miraj-ai__product-link" href={markdownLink[2]} target="_blank" rel="noreferrer">
          فتح المنتج ↗
        </a>
      );
    }

    if (/^https?:\/\//i.test(part)) {
      const cleanUrl = part.replace(/[.,،؛]+$/, '');
      const trailing = part.slice(cleanUrl.length);
      return (
        <span key={`raw-link-${index}`}>
          <a className="miraj-ai__product-link" href={cleanUrl} target="_blank" rel="noreferrer">فتح المنتج ↗</a>
          {trailing}
        </span>
      );
    }

    if (/^\*\*[^*]+\*\*$/.test(part)) {
      return <strong key={`bold-${index}`}>{part.slice(2, -2)}</strong>;
    }

    if (/\b\d{1,3}(?:[\s,.]\d{3})*(?:[.,]\d+)?\s*(?:دج|DA|DZD)\b/i.test(part)) {
      return <span key={`price-${index}`} className="miraj-ai__price">{part}</span>;
    }

    return part;
  });
}

export default function AiAssistant() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [checkout, setCheckout] = useState<CheckoutState | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading, checkout?.step]);

  function addAssistant(content: string) {
    setMessages((current) => [...current, { role: 'assistant', content }]);
  }

  async function startPrimaryCheckout(userText = 'إكمال الطلب هنا') {
    if (loading) return;

    setMessages((current) => [...current, { role: 'user', content: userText }]);
    setLoading(true);

    try {
      const response = await fetch('/api/products');
      const payload = await response.json();
      const list: CheckoutProduct[] = Array.isArray(payload)
        ? payload
        : Array.isArray(payload?.products)
          ? payload.products
          : Array.isArray(payload?.data)
            ? payload.data
            : [];

      const items = ['3PS', '4PS', '5PS']
        .map((code) => list.find((product) => normalize(product.name || '').includes(code.toLowerCase())))
        .filter(Boolean) as CheckoutProduct[];

      if (items.length !== 3) throw new Error('Primary bundle products not found');

      if (items.some((item) => Number(item.stock ?? 1) <= 0)) {
        addAssistant('واحدة من حقائب السنوات الثلاثة غير متوفرة حاليًا، لذلك ما نقدرش نكمل الطلب تلقائيًا.');
        return;
      }

      const subtotal = items.reduce((sum, item) => sum + Number(item.price || 0), 0);
      setCheckout({ step: 'name', items, subtotal });
      addAssistant(`نكمّل الطلب هنا ✅\n3PS + 4PS + 5PS\nالمجموع قبل التوصيل: 💰 ${money(subtotal)}\nاكتب الاسم الكامل للعميل.`);
    } catch (error) {
      console.error('Assistant checkout products error:', error);
      addAssistant('تعذر تجهيز الحقيبة للطلب الآن. جرب مرة أخرى بعد قليل.');
    } finally {
      setLoading(false);
    }
  }

  function checkoutSummary(state: CheckoutState) {
    if (!state.wilaya || !state.deliveryType) return '';

    const shipping = state.deliveryType === 'office' ? state.wilaya.office : state.wilaya.home;
    const deliveryLabel = state.deliveryType === 'office'
      ? `المكتب: ${state.officeName || state.commune || ''}`
      : `المنزل: ${state.address || ''}`;

    return [
      'راجع الطلب قبل التأكيد:',
      `العميل: ${state.customer}`,
      `الهاتف: ${state.phone}`,
      `الولاية: ${state.wilaya.name} — ${state.commune}`,
      `التوصيل: ${deliveryLabel}`,
      'المنتجات: 3PS + 4PS + 5PS',
      `المنتجات: 💰 ${money(state.subtotal)}`,
      `التوصيل: 💰 ${money(shipping)}`,
      `الإجمالي: 💰 ${money(state.subtotal + shipping)}`,
    ].join('\n');
  }

  async function createCheckoutOrder(state: CheckoutState) {
    if (!state.customer || !state.phone || !state.wilaya || !state.commune || !state.deliveryType) return;

    const shipping = state.deliveryType === 'office' ? state.wilaya.office : state.wilaya.home;
    const tracking = generateOrderReference();
    const now = new Date().toISOString();

    const order = {
      id: `ORD-${Date.now()}`,
      tracking,
      customer: state.customer,
      phone: state.phone,
      wilaya: state.wilaya.name,
      wilayaId: state.wilaya.code,
      commune: state.commune,
      address: state.deliveryType === 'office'
        ? `${state.commune} - ${state.officeName || 'مكتب الاستلام'}`
        : state.address || state.commune,
      items: state.items.map((item) => ({ ...item, quantity: 1 })),
      total: state.subtotal + shipping,
      shipping,
      deliveryType: state.deliveryType,
      selectedOffice: state.deliveryType === 'office' ? state.officeName || undefined : undefined,
      status: 'pending',
      date: now,
      archived: false,
    };

    setLoading(true);

    try {
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'save', order }),
      });
      const result = await response.json();
      if (!response.ok || !result?.ok) throw new Error(result?.error || 'Order save failed');

      setCheckout(null);
      addAssistant(`تم إنشاء الطلب بنجاح ✅\nرقم الطلب: ${tracking}\nالإجمالي: 💰 ${money(order.total)}\nالطلب الآن قيد المراجعة والتأكيد.`);
    } catch (error) {
      console.error('Assistant checkout save error:', error);
      addAssistant('ما قدرناش نحفظ الطلب الآن. بياناتك ما تضيعش، اضغط «تأكيد الطلب» وجرب مرة أخرى.');
    } finally {
      setLoading(false);
    }
  }

  async function handleCheckoutInput(raw: string) {
    if (!checkout) return;

    const value = raw.trim();
    if (!value || loading) return;

    setMessages((current) => [...current, { role: 'user', content: value }]);
    setInput('');

    if (/^(الغاء|إلغاء|الغي|cancel)$/i.test(value)) {
      setCheckout(null);
      addAssistant('تم إلغاء عملية الطلب. نقدر نعاونك في أي منتج آخر.');
      return;
    }

    if (checkout.step === 'name') {
      if (value.length < 3) return addAssistant('اكتب الاسم الكامل من فضلك.');
      setCheckout({ ...checkout, customer: value, step: 'phone' });
      addAssistant('ممتاز. اكتب رقم الهاتف.');
      return;
    }

    if (checkout.step === 'phone') {
      const digits = value.replace(/\D/g, '');
      if (digits.length < 9 || digits.length > 12) {
        return addAssistant('رقم الهاتف غير واضح. اكتب رقمًا صحيحًا مثل 05xxxxxxxx.');
      }
      setCheckout({ ...checkout, phone: value, step: 'wilaya' });
      addAssistant('اكتب الولاية للتوصيل.');
      return;
    }

    if (checkout.step === 'wilaya') {
      const wilaya = findWilaya(value);
      if (!wilaya) {
        return addAssistant('ما تعرفتش على الولاية. اكتب اسم الولاية فقط، مثال: الجزائر أو غرداية.');
      }
      setCheckout({ ...checkout, wilaya, step: 'commune' });
      addAssistant(`تمام، ${wilaya.name}. اكتب البلدية.`);
      return;
    }

    if (checkout.step === 'commune') {
      if (value.length < 2) return addAssistant('اكتب اسم البلدية من فضلك.');
      setCheckout({ ...checkout, commune: value, step: 'delivery' });
      addAssistant('كيف تحب التوصيل؟ للمكتب أو للمنزل؟');
      return;
    }

    if (checkout.step === 'delivery') {
      const normalized = normalize(value);
      if (normalized.includes('مكتب') || normalized.includes('bureau') || normalized.includes('office')) {
        setCheckout({ ...checkout, deliveryType: 'office', step: 'office' });
        addAssistant('اكتب اسم مكتب الاستلام الذي تفضله.');
        return;
      }
      if (normalized.includes('منزل') || normalized.includes('بيت') || normalized.includes('home') || normalized.includes('domicile')) {
        setCheckout({ ...checkout, deliveryType: 'home', step: 'address' });
        addAssistant('اكتب عنوان التوصيل بالتفصيل.');
        return;
      }
      addAssistant('اختر «للمكتب» أو «للمنزل».');
      return;
    }

    if (checkout.step === 'office') {
      const next = { ...checkout, officeName: value, step: 'confirm' as const };
      setCheckout(next);
      addAssistant(`${checkoutSummary(next)}\n\nاضغط «تأكيد الطلب» لإنشائه.`);
      return;
    }

    if (checkout.step === 'address') {
      if (value.length < 5) return addAssistant('اكتب عنوانًا أوضح من فضلك.');
      const next = { ...checkout, address: value, step: 'confirm' as const };
      setCheckout(next);
      addAssistant(`${checkoutSummary(next)}\n\nاضغط «تأكيد الطلب» لإنشائه.`);
      return;
    }

    if (checkout.step === 'confirm') {
      const normalized = normalize(value);
      if (normalized.includes('تاكيد') || normalized === 'نعم' || normalized === 'وافق') {
        await createCheckoutOrder(checkout);
      } else {
        addAssistant('لإنشاء الطلب اضغط «تأكيد الطلب»، أو «إلغاء».');
      }
    }
  }

  async function sendMessage(raw: string) {
    const message = raw.trim();
    if (!message || loading) return;

    if (checkout) {
      await handleCheckoutInput(message);
      return;
    }

    const previous = messages.filter((m) => m !== WELCOME).slice(-10);

    if (isPurchaseIntent(message, previous)) {
      setInput('');
      await startPrimaryCheckout(message);
      return;
    }

    const userMessage: ChatMessage = { role: 'user', content: message };
    setMessages((current) => [...current, userMessage]);
    setInput('');
    setLoading(true);

    let failureData: AssistantErrorData | null = null;

    try {
      const response = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'ai_assistant', message, history: previous }),
      });
      const data = await response.json();
      if (!response.ok || !data?.ok) {
        failureData = data || {};
        throw new Error(data?.error || 'Request failed');
      }
      setMessages((current) => [...current, { role: 'assistant', content: data.answer }]);
    } catch (error) {
      console.error('AI assistant error:', error, failureData);
      const diagnostic = failureData
        ? [
            failureData.error,
            failureData.provider_status ? `${failureData.provider || 'provider'} ${failureData.provider_status}` : null,
            failureData.provider_message,
            failureData.model ? `model: ${failureData.model}` : null,
          ].filter(Boolean).join(' | ')
        : 'NETWORK_OR_PARSE_ERROR';
      setMessages((current) => [
        ...current,
        { role: 'assistant', content: `سمحلي، المساعد غير متاح مؤقتًا.\n\nرمز التشخيص: ${diagnostic}` },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    void sendMessage(input);
  }

  const lastAssistant = [...messages].reverse().find((message) => message.role === 'assistant')?.content || '';
  const canOfferCheckout = !checkout && /الحقيبة الكاملة للسنوات الثلاثة|السنوات الثلاثة/.test(lastAssistant);

  return (
    <div className="miraj-ai" dir="rtl">
      {open && (
        <section className="miraj-ai__panel" aria-label="مساعد المعراج">
          <header className="miraj-ai__header">
            <div className="miraj-ai__identity">
              <div className="miraj-ai__avatar" aria-hidden="true">🤖</div>
              <div>
                <strong>مساعد المعراج</strong>
                <span>مساعد المنتجات الذكي</span>
              </div>
            </div>
            <button type="button" onClick={() => setOpen(false)} aria-label="إغلاق">×</button>
          </header>

          <div className="miraj-ai__messages">
            {messages.map((message, index) => (
              <div key={`${message.role}-${index}`} className={`miraj-ai__message miraj-ai__message--${message.role}`}>
                {message.role === 'assistant' ? renderAssistantText(message.content) : message.content}
              </div>
            ))}

            {messages.length === 1 && (
              <div className="miraj-ai__quick">
                {QUICK_QUESTIONS.map((question) => (
                  <button key={question} type="button" onClick={() => void sendMessage(question)}>{question}</button>
                ))}
              </div>
            )}

            {canOfferCheckout && (
              <div className="miraj-ai__checkout-actions">
                <button type="button" onClick={() => void startPrimaryCheckout()}>🛒 إكمال الطلب هنا</button>
              </div>
            )}

            {checkout?.step === 'delivery' && (
              <div className="miraj-ai__checkout-actions">
                <button type="button" onClick={() => void handleCheckoutInput('للمكتب')}>📦 للمكتب</button>
                <button type="button" onClick={() => void handleCheckoutInput('للمنزل')}>🏠 للمنزل</button>
              </div>
            )}

            {checkout?.step === 'confirm' && (
              <div className="miraj-ai__checkout-actions miraj-ai__checkout-actions--confirm">
                <button type="button" onClick={() => void handleCheckoutInput('تأكيد الطلب')}>✅ تأكيد الطلب</button>
                <button type="button" className="miraj-ai__cancel" onClick={() => void handleCheckoutInput('إلغاء')}>إلغاء</button>
              </div>
            )}

            {loading && <div className="miraj-ai__typing">يكتب الآن…</div>}
            <div ref={endRef} />
          </div>

          <form className="miraj-ai__form" onSubmit={submit}>
            <input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder={checkout?.step === 'phone' ? '05xxxxxxxx' : checkout ? 'اكتب المعلومة المطلوبة…' : 'اكتب سؤالك حول المنتجات…'}
              maxLength={1200}
              disabled={loading}
              inputMode={checkout?.step === 'phone' ? 'tel' : 'text'}
              aria-label="رسالتك"
            />
            <button type="submit" disabled={loading || !input.trim()} aria-label="إرسال">إرسال</button>
          </form>

          <p className="miraj-ai__note">الأسعار والطلب تُحسب من بيانات متجر المعراج مباشرة.</p>
        </section>
      )}

      <button
        className="miraj-ai__launcher"
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-label={open ? 'إغلاق مساعد المعراج' : 'فتح مساعد المعراج'}
        title="مساعد المعراج"
      >
        <span aria-hidden="true">🤖</span>
      </button>
    </div>
  );
}
