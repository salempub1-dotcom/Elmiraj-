import { FormEvent, ReactNode, useEffect, useRef, useState } from 'react';
import { WILAYA_SHIPPING, normalizeRuleText } from '../../lib/aiRules.js';
import {
  encodeCheckoutDeliverySelection,
  fetchZrCheckoutOptions,
  fetchZrShippingQuote,
  type ZrPickupHub,
} from '../services/deliveryCheckout';
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
  shipping?: number;
  offices?: ZrPickupHub[];
  officeId?: string;
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
  const explicitOrder = /(اكمل الطلب|كمل الطلب|ابدا الطلب|نبدا الطلب|اطلبها|نطلبها)/.test(current);
  const fullPrimary = /(السنوات الثلاثه|الحقيبه كامله|حقيبه السنوات الثلاثه|3ps.*4ps.*5ps)/.test(`${context} ${current}`);
  return explicitOrder && fullPrimary;
}

function generateOrderReference() {
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `AM-${Date.now().toString(36).toUpperCase()}${rand}`;
}

function officeLabel(hub: ZrPickupHub) {
  return hub.name || hub.address || hub.communeName || 'مكتب ZR Express';
}

function productShortName(product: CheckoutProduct) {
  return product.name.split('|')[0].trim();
}

function uniqueCheckoutDetails(state: CheckoutState) {
  const values = state.items.flatMap((item) => [
    ...(Array.isArray(item.benefits) ? item.benefits : []),
    ...(Array.isArray(item.contents) ? item.contents : []),
  ]);
  const seen = new Set<string>();
  const details: string[] = [];
  for (const value of values) {
    const text = String(value || '').trim();
    const key = normalize(text);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    details.push(text);
    if (details.length >= 6) break;
  }
  return details;
}

function asksProductInfo(raw: string) {
  const n = normalize(raw);
  return n.includes('واش فيهم')
    || n.includes('واش فيها')
    || n.includes('شنو فيهم')
    || n.includes('شنو فيها')
    || n.includes('محتوي')
    || n.includes('المحتوي')
    || n.includes('مميزات')
    || n.includes('المميزات')
    || n.includes('وش فيها')
    || n.includes('وش فيهم');
}

function asksCurrentDelivery(raw: string) {
  const n = normalize(raw);
  return (n.includes('توصيل') || n.includes('شحن') || n.includes('livraison'))
    && (n.includes('كم') || n.includes('سعر') || n.includes('ثمن'));
}

function checkoutStepReminder(state: CheckoutState) {
  switch (state.step) {
    case 'name': return 'إذا حبيت تكمل الطلب، اكتب الاسم الكامل.';
    case 'phone': return 'إذا حبيت تكمل، اكتب رقم الهاتف (10 أرقام).';
    case 'wilaya': return 'إذا حبيت تكمل، اكتب الولاية.';
    case 'commune': return 'إذا حبيت تكمل، اكتب البلدية.';
    case 'delivery': return 'إذا حبيت تكمل، اختر التوصيل للمكتب أو للمنزل.';
    case 'office': return 'إذا حبيت تكمل، اختر مكتب ZR Express من القائمة.';
    case 'address': return 'إذا حبيت تكمل، اكتب عنوان التوصيل.';
    case 'confirm': return 'طلبك يبقى محفوظ هنا. إذا كل شيء مناسب اضغط «تأكيد الطلب»، أو اسألني أي سؤال قبل التأكيد.';
    default: return '';
  }
}

function checkoutProductInfo(state: CheckoutState) {
  const lines = [
    'أكيد، نخليك تعرف واش راه داخل الطلب قبل ما تقرر:',
    ...state.items.map((item) => `• ${productShortName(item)} — ${money(item.price)}`),
  ];
  const details = uniqueCheckoutDetails(state);
  if (details.length) {
    lines.push('أهم المحتويات والمميزات:');
    lines.push(...details.map((detail) => `• ${detail}`));
  }
  lines.push(`مجموع المنتجات قبل التوصيل: ${money(state.subtotal)}`);
  return lines.join('\n');
}

function renderAssistantText(content: string): ReactNode[] {
  const tokenRegex = /(\[[^\]]+\]\(https?:\/\/[^\s)]+\)|https?:\/\/[^\s]+|\*\*[^*]+\*\*|\b\d{1,3}(?:[\s,.]\d{3})*(?:[.,]\d+)?\s*(?:دج|DA|DZD)\b)/gi;
  const parts = content.split(tokenRegex);

  return parts.map((part, index) => {
    if (!part) return null;
    const markdownLink = part.match(/^\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)$/i);
    if (markdownLink) {
      return <a key={`md-link-${index}`} className="miraj-ai__product-link" href={markdownLink[2]} target="_blank" rel="noreferrer">فتح المنتج ↗</a>;
    }
    if (/^https?:\/\//i.test(part)) {
      const cleanUrl = part.replace(/[.,،؛]+$/, '');
      const trailing = part.slice(cleanUrl.length);
      return <span key={`raw-link-${index}`}><a className="miraj-ai__product-link" href={cleanUrl} target="_blank" rel="noreferrer">فتح المنتج ↗</a>{trailing}</span>;
    }
    if (/^\*\*[^*]+\*\*$/.test(part)) return <strong key={`bold-${index}`}>{part.slice(2, -2)}</strong>;
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

  async function startPrimaryCheckout(userText = 'إنشاء الطلب من هنا') {
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
      addAssistant(`تمام 👍 نقدر ننشئ لك الطلب من هنا.\n3PS + 4PS + 5PS\nالمجموع قبل التوصيل: 💰 ${money(subtotal)}\nاكتب الاسم الكامل للعميل.`);
    } catch (error) {
      console.error('Assistant checkout products error:', error);
      addAssistant('تعذر تجهيز الحقيبة للطلب الآن. جرب مرة أخرى بعد قليل.');
    } finally {
      setLoading(false);
    }
  }

  function checkoutSummary(state: CheckoutState) {
    if (!state.wilaya || !state.deliveryType || state.shipping == null) return '';
    const deliveryLabel = state.deliveryType === 'office'
      ? `مكتب ZR Express: ${state.officeName || state.commune || ''}`
      : `ZR Express للمنزل: ${state.address || ''}`;
    return [
      'راجع الطلب قبل التأكيد:',
      `العميل: ${state.customer}`,
      `الهاتف: ${state.phone}`,
      `الولاية: ${state.wilaya.name} — ${state.commune}`,
      `التوصيل: ${deliveryLabel}`,
      'المنتجات: 3PS + 4PS + 5PS',
      `المنتجات: 💰 ${money(state.subtotal)}`,
      `توصيل ZR Express: 💰 ${money(state.shipping)}`,
      `الإجمالي: 💰 ${money(state.subtotal + state.shipping)}`,
    ].join('\n');
  }

  async function loadZrQuote(state: CheckoutState) {
    if (!state.wilaya || !state.commune) return null;
    const result = await fetchZrShippingQuote(state.wilaya.code, state.commune);
    return result.ok && result.data ? result.data : null;
  }

  async function prepareOfficeSelection(state: CheckoutState) {
    if (!state.wilaya || !state.commune) return;
    setLoading(true);
    try {
      const [optionsResult, quote] = await Promise.all([
        fetchZrCheckoutOptions(state.wilaya.code, state.commune),
        loadZrQuote(state),
      ]);

      const offices = optionsResult.ok && optionsResult.data
        ? (optionsResult.data.pickup_hubs || []).filter((hub) => hub.isPickupPoint !== false)
        : [];
      const officePrice = quote?.office;

      if (!offices.length) {
        setCheckout({ ...state, deliveryType: undefined, step: 'delivery', offices: [] });
        addAssistant('ما لقيتش مكاتب ZR Express متوفرة لهذه البلدية حاليًا. تقدر تختار التوصيل للمنزل أو تعاود المحاولة.');
        return;
      }
      if (officePrice == null) {
        setCheckout({ ...state, deliveryType: undefined, step: 'delivery', offices: [] });
        addAssistant('تعذر جلب تسعيرة ZR Express للمكتب الآن. ما راحش نحسب سعر تقريبي؛ عاود المحاولة بعد قليل.');
        return;
      }

      const commune = normalize(state.commune);
      const sorted = [...offices].sort((a, b) => {
        const aMatch = normalize(`${a.name} ${a.communeName} ${a.address}`).includes(commune) ? 1 : 0;
        const bMatch = normalize(`${b.name} ${b.communeName} ${b.address}`).includes(commune) ? 1 : 0;
        return bMatch - aMatch;
      }).slice(0, 12);

      setCheckout({
        ...state,
        deliveryType: 'office',
        shipping: officePrice,
        step: 'office',
        offices: sorted,
        officeId: undefined,
        officeName: undefined,
      });
      addAssistant(`اختر مكتب ZR Express من القائمة.\nسعر التوصيل للمكتب: 💰 ${money(officePrice)}`);
    } catch (error) {
      console.error('Assistant ZR Express offices error:', error);
      setCheckout({ ...state, deliveryType: undefined, step: 'delivery', offices: [] });
      addAssistant('تعذر تحميل مكاتب ZR Express الآن. عاود المحاولة بعد قليل.');
    } finally {
      setLoading(false);
    }
  }

  async function prepareHomeDelivery(state: CheckoutState) {
    if (!state.wilaya || !state.commune) return;
    setLoading(true);
    try {
      const quote = await loadZrQuote(state);
      if (quote?.home == null) {
        addAssistant('تعذر جلب تسعيرة ZR Express للمنزل الآن. ما راحش نحسب سعر تقريبي؛ عاود المحاولة بعد قليل.');
        return;
      }
      setCheckout({
        ...state,
        deliveryType: 'home',
        shipping: quote.home,
        step: 'address',
        offices: undefined,
        officeId: undefined,
        officeName: undefined,
      });
      addAssistant(`سعر توصيل ZR Express للمنزل: 💰 ${money(quote.home)}\nاكتب عنوان التوصيل بالتفصيل.`);
    } catch (error) {
      console.error('Assistant ZR Express home quote error:', error);
      addAssistant('تعذر تحميل تسعيرة ZR Express الآن. عاود المحاولة بعد قليل.');
    } finally {
      setLoading(false);
    }
  }

  function chooseOffice(hub: ZrPickupHub) {
    if (!checkout || checkout.step !== 'office') return;
    const label = officeLabel(hub);
    setMessages((current) => [...current, { role: 'user', content: label }]);
    const next: CheckoutState = {
      ...checkout,
      officeId: hub.id,
      officeName: label,
      step: 'confirm',
    };
    setCheckout(next);
    addAssistant(`${checkoutSummary(next)}\n\nإذا حبيت تأكد الطلب اضغط «تأكيد الطلب». وإذا عندك أي سؤال قبل التأكيد اسألني عادي.`);
  }

  async function createCheckoutOrder(state: CheckoutState) {
    if (!state.customer || !state.phone || !state.wilaya || !state.commune || !state.deliveryType || state.shipping == null) return;
    if (state.deliveryType === 'office' && !state.officeId) {
      addAssistant('اختر مكتب ZR Express صحيح قبل تأكيد الطلب.');
      return;
    }

    const tracking = generateOrderReference();
    const now = new Date().toISOString();
    const selectedOffice = encodeCheckoutDeliverySelection({
      provider: 'zrexpress',
      officeId: state.deliveryType === 'office' ? state.officeId : undefined,
      officeName: state.deliveryType === 'office' ? state.officeName : undefined,
    });

    const order = {
      id: `ORD-${Date.now()}`,
      tracking,
      customer: state.customer,
      phone: state.phone,
      wilaya: state.wilaya.name,
      wilayaId: state.wilaya.code,
      commune: state.commune,
      address: state.deliveryType === 'office'
        ? `${state.commune} - ${state.officeName || 'مكتب ZR Express'}`
        : state.address || state.commune,
      items: state.items.map((item) => ({ ...item, quantity: 1 })),
      total: state.subtotal + state.shipping,
      shipping: state.shipping,
      deliveryType: state.deliveryType,
      selectedOffice,
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
      addAssistant(`تم إنشاء الطلب بنجاح ✅\nرقم الطلب: ${tracking}\nشركة التوصيل: ZR Express\nالإجمالي: 💰 ${money(order.total)}\nالطلب الآن قيد المراجعة والتأكيد.`);
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
      addAssistant('تم إلغاء عملية الطلب. عادي، نقدر نجاوبك على أي سؤال أو نعاونك تختار منتج آخر.');
      return;
    }

    if (asksProductInfo(value)) {
      addAssistant(`${checkoutProductInfo(checkout)}\n\n${checkoutStepReminder(checkout)}`);
      return;
    }

    if (asksCurrentDelivery(value) && checkout.shipping != null) {
      addAssistant(`سعر التوصيل المحدد في طلبك هو: 💰 ${money(checkout.shipping)}\n${checkoutStepReminder(checkout)}`);
      return;
    }

    if (checkout.step === 'name') {
      if (value.length < 3) return addAssistant('اكتب الاسم الكامل من فضلك.');
      setCheckout({ ...checkout, customer: value, step: 'phone' });
      addAssistant('ممتاز. اكتب رقم الهاتف (10 أرقام).');
      return;
    }
    if (checkout.step === 'phone') {
      const digits = value.replace(/\D/g, '');
      if (digits.length !== 10) return addAssistant('رقم الهاتف يجب أن يكون 10 أرقام بالضبط، مثال: 05xxxxxxxx.');
      setCheckout({ ...checkout, phone: digits, step: 'wilaya' });
      addAssistant('اكتب الولاية للتوصيل.');
      return;
    }
    if (checkout.step === 'wilaya') {
      const wilaya = findWilaya(value);
      if (!wilaya) return addAssistant('ما تعرفتش على الولاية. تقدر تكتبها بالعربية أو الفرنسية، مثال: الجزائر / Alger.');
      setCheckout({ ...checkout, wilaya, step: 'commune' });
      addAssistant(`تمام، ${wilaya.name}. اكتب البلدية.`);
      return;
    }
    if (checkout.step === 'commune') {
      if (value.length < 2) return addAssistant('اكتب اسم البلدية من فضلك.');
      setCheckout({ ...checkout, commune: value, step: 'delivery' });
      addAssistant('كيف تحب توصيل ZR Express؟ للمكتب أو للمنزل؟');
      return;
    }
    if (checkout.step === 'delivery') {
      const normalized = normalize(value);
      if (normalized.includes('مكتب') || normalized.includes('bureau') || normalized.includes('office')) {
        await prepareOfficeSelection(checkout);
        return;
      }
      if (normalized.includes('منزل') || normalized.includes('بيت') || normalized.includes('home') || normalized.includes('domicile')) {
        await prepareHomeDelivery(checkout);
        return;
      }
      addAssistant('اختر «للمكتب» أو «للمنزل».');
      return;
    }
    if (checkout.step === 'office') {
      const wanted = normalize(value);
      const matched = checkout.offices?.find((hub) => {
        const label = normalize(`${hub.id} ${hub.name} ${hub.communeName} ${hub.address}`);
        return label.includes(wanted) || wanted.includes(normalize(hub.id));
      });
      if (!matched) {
        addAssistant('اختار مكتب ZR Express من الأزرار الظاهرة باش نحفظ معرف المكتب الصحيح.');
        return;
      }
      chooseOffice(matched);
      return;
    }
    if (checkout.step === 'address') {
      if (value.length < 5) return addAssistant('اكتب عنوانًا أوضح من فضلك.');
      const next = { ...checkout, address: value, step: 'confirm' as const };
      setCheckout(next);
      addAssistant(`${checkoutSummary(next)}\n\nإذا حبيت تأكد الطلب اضغط «تأكيد الطلب». وإذا عندك سؤال قبل التأكيد اسألني.`);
      return;
    }
    if (checkout.step === 'confirm') {
      const normalized = normalize(value);
      if (normalized.includes('تاكيد') || normalized === 'نعم' || normalized === 'وافق') {
        await createCheckoutOrder(checkout);
      } else {
        addAssistant('أكيد، ما لازمش تأكد الآن. تقدر تسألني على المحتوى، المميزات أو التوصيل، وطلبك يبقى محفوظ هنا.');
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
      setMessages((current) => [...current, {
        role: 'assistant',
        content: 'سمحلي، المساعد غير متاح مؤقتًا. حاول مرة أخرى بعد لحظات.',
      }]);
    } finally {
      setLoading(false);
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    void sendMessage(input);
  }

  const lastAssistant = [...messages].reverse().find((message) => message.role === 'assistant')?.content || '';
  const canOfferCheckout = !checkout && /نقدر ننشئ لك الطلب|نقدر ننشئ لك الطلب كامل|إنشاء الطلب من داخل البوت/.test(lastAssistant);

  return (
    <div className="miraj-ai" dir="rtl">
      {open && (
        <section className="miraj-ai__panel" aria-label="مساعد المعراج">
          <header className="miraj-ai__header">
            <div className="miraj-ai__identity">
              <div className="miraj-ai__avatar" aria-hidden="true">🤖</div>
              <div><strong>مساعد المعراج</strong><span>مساعد المنتجات الذكي</span></div>
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
                {QUICK_QUESTIONS.map((question) => <button key={question} type="button" onClick={() => void sendMessage(question)}>{question}</button>)}
              </div>
            )}

            {canOfferCheckout && (
              <div className="miraj-ai__checkout-actions">
                <button type="button" onClick={() => void startPrimaryCheckout()}>🛒 إنشاء الطلب من هنا</button>
              </div>
            )}

            {checkout?.step === 'delivery' && (
              <div className="miraj-ai__checkout-actions">
                <button type="button" onClick={() => void handleCheckoutInput('للمكتب')}>📦 مكتب ZR Express</button>
                <button type="button" onClick={() => void handleCheckoutInput('للمنزل')}>🏠 ZR Express للمنزل</button>
              </div>
            )}

            {checkout?.step === 'office' && checkout.offices && checkout.offices.length > 0 && (
              <div className="miraj-ai__checkout-actions miraj-ai__office-list">
                {checkout.offices.map((hub) => (
                  <button key={hub.id} type="button" onClick={() => chooseOffice(hub)}>
                    📍 {officeLabel(hub)}
                  </button>
                ))}
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
              onChange={(event) => {
                const next = checkout?.step === 'phone'
                  ? event.target.value.replace(/\D/g, '').slice(0, 10)
                  : event.target.value;
                setInput(next);
              }}
              placeholder={checkout?.step === 'phone' ? '05xxxxxxxx' : checkout?.step === 'office' ? 'اختر مكتب ZR Express من القائمة…' : checkout ? 'اكتب المعلومة أو اسأل أي سؤال…' : 'اكتب سؤالك حول المنتجات…'}
              maxLength={checkout?.step === 'phone' ? 10 : 1200}
              disabled={loading || checkout?.step === 'office'}
              inputMode={checkout?.step === 'phone' ? 'tel' : 'text'}
              aria-label="رسالتك"
            />
            <button type="submit" disabled={loading || checkout?.step === 'office' || !input.trim()} aria-label="إرسال">إرسال</button>
          </form>

          <p className="miraj-ai__note">الأسعار والطلب والتوصيل تُحسب من بيانات المتجر وZR Express مباشرة.</p>
        </section>
      )}

      <button className="miraj-ai__launcher" type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open} aria-label={open ? 'إغلاق مساعد المعراج' : 'فتح مساعد المعراج'} title="مساعد المعراج">
        <span aria-hidden="true">🤖</span>
      </button>
    </div>
  );
}