import { FormEvent, ReactNode, useEffect, useRef, useState } from 'react';
import { WILAYA_SHIPPING, normalizeRuleText } from '../../lib/aiRules.js';
import {
  encodeCheckoutDeliverySelection,
  fetchZrCheckoutOptions,
  fetchZrShippingQuote,
  type ZrPickupHub,
} from '../services/deliveryCheckout';
import {
  INITIAL_CONVERSATION_STATE,
  SMART_QUICK_QUESTIONS,
  detectLevel,
  detectProductCode,
  inferQuestionTypeFromAssistant,
  isAffirmativeReply,
  isExplicitCheckoutRequest,
  normalizeStage,
  quickQuestionResponse,
  updateConversationFromUser,
  type ConversationState,
} from '../services/conversationEngine';
import GuidedAssistantChoices from './GuidedAssistantChoices';
import './AiAssistant.css';

type ChatMessage = { role: 'user' | 'assistant'; content: string };
type AssistantErrorData = { error?: string; provider?: string; provider_status?: number; provider_message?: string; model?: string };
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
type WilayaShipping = { code: number; name: string; home: number; office: number };
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
  content: 'السلام عليكم 🌟 أنا مساعد المعراج. نقدر نعاونك تختار الوسيلة المناسبة، تعرف الأسعار والمحتوى، نحسبلك التوصيل، وحتى ننشئلك الطلب من هنا إذا حبيت.',
};
const SHIPPING = WILAYA_SHIPPING as WilayaShipping[];

function money(value: number) { return `${Number(value || 0).toLocaleString('en-US')} دج`; }
function normalize(text = '') { return normalizeRuleText(text); }
function productShortName(product: CheckoutProduct) { return product.name.split('|')[0].trim(); }
function officeLabel(hub: ZrPickupHub) { return hub.name || hub.address || hub.communeName || 'مكتب ZR Express'; }
function generateOrderReference() {
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `AM-${Date.now().toString(36).toUpperCase()}${rand}`;
}
function findWilaya(raw: string): WilayaShipping | undefined {
  let value = normalize(raw);
  const aliases: Record<string, string> = {
    alger: 'الجزائر', algiers: 'الجزائر', algeria: 'الجزائر', dz: 'الجزائر',
    'الجزاير': 'الجزائر', 'الجزائر العاصمه': 'الجزائر', 'الجزاير العاصمه': 'الجزائر',
  };
  if (aliases[value]) value = normalize(aliases[value]);
  return SHIPPING.find((wilaya) => {
    const name = normalize(wilaya.name);
    return value === name || value.includes(name) || name.includes(value);
  });
}
function renderAssistantText(content: string): ReactNode[] {
  const tokenRegex = /(\[[^\]]+\]\(https?:\/\/[^\s)]+\)|https?:\/\/[^\s]+|\*\*[^*]+\*\*|\b\d{1,3}(?:[\s,.]\d{3})*(?:[.,]\d+)?\s*(?:دج|DA|DZD)\b)/gi;
  return content.split(tokenRegex).map((part, index) => {
    if (!part) return null;
    const markdownLink = part.match(/^\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)$/i);
    if (markdownLink) return <a key={`md-${index}`} className="miraj-ai__product-link" href={markdownLink[2]} target="_blank" rel="noreferrer">فتح المنتج ↗</a>;
    if (/^https?:\/\//i.test(part)) {
      const cleanUrl = part.replace(/[.,،؛]+$/, '');
      return <a key={`url-${index}`} className="miraj-ai__product-link" href={cleanUrl} target="_blank" rel="noreferrer">فتح المنتج ↗</a>;
    }
    if (/^\*\*[^*]+\*\*$/.test(part)) return <strong key={`bold-${index}`}>{part.slice(2, -2)}</strong>;
    if (/\b\d{1,3}(?:[\s,.]\d{3})*(?:[.,]\d+)?\s*(?:دج|DA|DZD)\b/i.test(part)) return <span key={`price-${index}`} className="miraj-ai__price">{part}</span>;
    return part;
  });
}
function extractCodes(text: string) {
  const matches = String(text).toUpperCase().match(/\b(?:[1-4]MS|[3-5]PS|[3-5]AP)\b/g) || [];
  return matches.map((code) => code.replace('AP', 'PS'));
}
function isFullPrimaryContext(text: string) {
  const n = normalize(text);
  return n.includes('السنوات الثلاثه') || n.includes('حقيبه السنوات الثلاثه') || n.includes('الحقيبه كامله') || (text.toUpperCase().includes('3PS') && text.toUpperCase().includes('4PS') && text.toUpperCase().includes('5PS'));
}
function productContextScore(product: CheckoutProduct, text: string) {
  const n = normalize(text);
  const name = normalize(product.name);
  let score = 0;
  if (name && n.includes(name)) score += 100;
  const short = normalize(productShortName(product));
  if (short && n.includes(short)) score += 70;
  const level = normalize(product.level || '');
  if (level && n.includes(level)) score += 25;
  for (const code of extractCodes(text)) {
    if (normalize(product.name).includes(normalize(code)) || level.includes(normalize(code))) score += 45;
  }
  return score;
}

export default function AiAssistant() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [checkout, setCheckout] = useState<CheckoutState | null>(null);
  const [conversation, setConversation] = useState<ConversationState>(INITIAL_CONVERSATION_STATE);
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, loading, checkout?.step, conversation.lastQuestionType]);
  useEffect(() => {
    const closeForStorePurchase = () => setOpen(false);
    window.addEventListener('miraj:store-purchase', closeForStorePurchase);
    return () => window.removeEventListener('miraj:store-purchase', closeForStorePurchase);
  }, []);

  function addAssistant(content: string) {
    setMessages((current) => [...current, { role: 'assistant', content }]);
    const questionType = inferQuestionTypeFromAssistant(content);
    const code = detectProductCode(content);
    setConversation((current) => ({
      ...current,
      currentProductCode: code || current.currentProductCode,
      lastQuestionType: questionType === 'none' ? current.lastQuestionType : questionType,
    }));
  }

  async function loadProducts(): Promise<CheckoutProduct[]> {
    const response = await fetch('/api/products');
    const payload = await response.json();
    return Array.isArray(payload) ? payload : Array.isArray(payload?.products) ? payload.products : Array.isArray(payload?.data) ? payload.data : [];
  }

  async function resolveDiscussedItems(products: CheckoutProduct[]) {
    if (conversation.selectedProductIds.length) {
      const selected = conversation.selectedProductIds.map((id) => products.find((product) => product.id === id)).filter(Boolean) as CheckoutProduct[];
      if (selected.length) return selected;
    }
    if (conversation.currentProductCode) {
      const matched = products.find((product) => normalize(product.name).includes(normalize(conversation.currentProductCode || '')) || normalize(product.level || '').includes(normalize(conversation.currentProductCode || '')));
      if (matched) return [matched];
    }
    const recent = messages.slice(-12).map((message) => message.content).join(' ');
    if (isFullPrimaryContext(recent)) {
      const bundle = ['3PS', '4PS', '5PS'].map((code) => products.find((product) => normalize(product.name).includes(normalize(code)))).filter(Boolean) as CheckoutProduct[];
      if (bundle.length === 3) return bundle;
    }
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      const ranked = products.map((product) => ({ product, score: productContextScore(product, messages[i].content) })).filter((entry) => entry.score > 0).sort((a, b) => b.score - a.score);
      if (ranked.length) return [ranked[0].product];
    }
    return [];
  }

  async function startCheckoutFromConversation(userText = 'إنشاء الطلب من هنا') {
    if (loading) return;
    setMessages((current) => [...current, { role: 'user', content: userText }]);
    setInput('');
    setLoading(true);
    setConversation((current) => ({ ...current, currentIntent: 'start_checkout', lastQuestionType: 'checkout_field' }));
    try {
      const products = await loadProducts();
      const items = await resolveDiscussedItems(products);
      if (!items.length) {
        addAssistant('أكيد نقدر ننشئ لك الطلب من هنا 👍 قولي فقط اسم المنتج أو المستوى اللي حاب تطلبه.');
        return;
      }
      const unavailable = items.find((item) => Number(item.stock ?? 1) <= 0);
      if (unavailable) {
        addAssistant(`${productShortName(unavailable)} غير متوفر حاليًا، لذلك ما نقدرش ننشئ الطلب عليه الآن.`);
        return;
      }
      const subtotal = items.reduce((sum, item) => sum + Number(item.price || 0), 0);
      setConversation((current) => ({ ...current, selectedProductIds: items.map((item) => item.id), lastQuestionType: 'checkout_field' }));
      setCheckout({ step: 'name', items, subtotal });
      addAssistant(`تمام 👍 الطلب فيه:\n${items.map((item) => `• ${productShortName(item)} — ${money(item.price)}`).join('\n')}\nالمجموع قبل التوصيل: 💰 ${money(subtotal)}\nاكتب الاسم الكامل.`);
    } catch (error) {
      console.error('Assistant checkout start error:', error);
      addAssistant('تعذر تجهيز الطلب الآن. جرب مرة أخرى بعد قليل.');
    } finally { setLoading(false); }
  }

  function checkoutSummary(state: CheckoutState) {
    if (!state.wilaya || !state.deliveryType || state.shipping == null) return '';
    const deliveryLabel = state.deliveryType === 'office' ? `مكتب ZR Express: ${state.officeName || state.commune || ''}` : `ZR Express للمنزل: ${state.address || ''}`;
    return [
      'راجع الطلب قبل التأكيد:',
      `العميل: ${state.customer}`,
      `الهاتف: ${state.phone}`,
      `الولاية: ${state.wilaya.name} — ${state.commune}`,
      `التوصيل: ${deliveryLabel}`,
      'المنتجات:',
      ...state.items.map((item) => `• ${productShortName(item)} — ${money(item.price)}`),
      `مجموع المنتجات: 💰 ${money(state.subtotal)}`,
      `توصيل ZR Express: 💰 ${money(state.shipping)}`,
      `الإجمالي: 💰 ${money(state.subtotal + state.shipping)}`,
    ].join('\n');
  }

  function checkoutProductInfo(state: CheckoutState) {
    const details: string[] = [];
    const seen = new Set<string>();
    for (const item of state.items) {
      for (const value of [...(item.contents || []), ...(item.benefits || [])]) {
        const text = String(value || '').trim();
        const key = normalize(text);
        if (!key || seen.has(key)) continue;
        seen.add(key);
        details.push(text);
        if (details.length >= 7) break;
      }
      if (details.length >= 7) break;
    }
    return ['أكيد، هذه تفاصيل المنتجات الموجودة في طلبك:', ...state.items.map((item) => `• ${productShortName(item)} — ${money(item.price)}`), ...(details.length ? ['أهم المحتويات والمميزات:', ...details.map((detail) => `• ${detail}`)] : []), `المجموع قبل التوصيل: ${money(state.subtotal)}`].join('\n');
  }

  function checkoutStepReminder(state: CheckoutState) {
    const reminders: Record<CheckoutStep, string> = {
      name: 'إذا حبيت تكمل الطلب، اكتب الاسم الكامل.',
      phone: 'إذا حبيت تكمل، اكتب رقم الهاتف (10 أرقام).',
      wilaya: 'إذا حبيت تكمل، اكتب الولاية.',
      commune: 'إذا حبيت تكمل، اكتب البلدية.',
      delivery: 'إذا حبيت تكمل، اختر للمكتب أو للمنزل.',
      office: 'إذا حبيت تكمل، اختر مكتب ZR Express من القائمة.',
      address: 'إذا حبيت تكمل، اكتب عنوان التوصيل.',
      confirm: 'الطلب مازال محفوظ. تقدر تسألني أي سؤال، ولما تكون جاهز اضغط «تأكيد الطلب».',
    };
    return reminders[state.step];
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
      const [optionsResult, quote] = await Promise.all([fetchZrCheckoutOptions(state.wilaya.code, state.commune), loadZrQuote(state)]);
      const offices = optionsResult.ok && optionsResult.data ? (optionsResult.data.pickup_hubs || []).filter((hub) => hub.isPickupPoint !== false) : [];
      if (!offices.length) {
        setCheckout({ ...state, deliveryType: undefined, step: 'delivery', offices: [] });
        addAssistant('ما لقيتش مكتب ZR Express مناسب لهذه البلدية. تقدر تختار التوصيل للمنزل أو تراجع اسم البلدية.');
        return;
      }
      if (quote?.office == null) {
        setCheckout({ ...state, deliveryType: undefined, step: 'delivery', offices: [] });
        addAssistant('تعذر جلب تسعيرة ZR Express للمكتب الآن. جرب مرة أخرى بعد قليل.');
        return;
      }
      const commune = normalize(state.commune);
      const sorted = [...offices].sort((a, b) => {
        const aMatch = normalize(`${a.name} ${a.communeName} ${a.address}`).includes(commune) ? 1 : 0;
        const bMatch = normalize(`${b.name} ${b.communeName} ${b.address}`).includes(commune) ? 1 : 0;
        return bMatch - aMatch;
      }).slice(0, 12);
      setCheckout({ ...state, deliveryType: 'office', shipping: quote.office, step: 'office', offices: sorted, officeId: undefined, officeName: undefined });
      addAssistant(`اختر مكتب ZR Express من القائمة.\nسعر التوصيل للمكتب: 💰 ${money(quote.office)}`);
    } catch (error) {
      console.error('Assistant ZR offices error:', error);
      setCheckout({ ...state, deliveryType: undefined, step: 'delivery', offices: [] });
      addAssistant('تعذر تحميل مكاتب ZR Express الآن. جرب مرة أخرى بعد قليل.');
    } finally { setLoading(false); }
  }
  async function prepareHomeDelivery(state: CheckoutState) {
    if (!state.wilaya || !state.commune) return;
    setLoading(true);
    try {
      const quote = await loadZrQuote(state);
      if (quote?.home == null) {
        addAssistant('تعذر جلب تسعيرة ZR Express للمنزل الآن. جرب مرة أخرى بعد قليل.');
        return;
      }
      setCheckout({ ...state, deliveryType: 'home', shipping: quote.home, step: 'address', offices: undefined, officeId: undefined, officeName: undefined });
      addAssistant(`سعر توصيل ZR Express للمنزل: 💰 ${money(quote.home)}\nاكتب عنوان التوصيل بالتفصيل.`);
    } catch (error) {
      console.error('Assistant ZR home error:', error);
      addAssistant('تعذر تحميل تسعيرة ZR Express الآن. جرب مرة أخرى بعد قليل.');
    } finally { setLoading(false); }
  }
  function chooseOffice(hub: ZrPickupHub) {
    if (!checkout || checkout.step !== 'office') return;
    const label = officeLabel(hub);
    setMessages((current) => [...current, { role: 'user', content: label }]);
    const next = { ...checkout, officeId: hub.id, officeName: label, step: 'confirm' as const };
    setCheckout(next);
    addAssistant(`${checkoutSummary(next)}\n\nإذا كل شيء مناسب اضغط «تأكيد الطلب». وتقدر تسألني قبل التأكيد عادي.`);
  }
  async function createCheckoutOrder(state: CheckoutState) {
    if (!state.customer || !state.phone || !state.wilaya || !state.commune || !state.deliveryType || state.shipping == null) return;
    if (state.deliveryType === 'office' && !state.officeId) return addAssistant('اختر مكتب ZR Express صحيح قبل تأكيد الطلب.');
    const tracking = generateOrderReference();
    const selectedOffice = encodeCheckoutDeliverySelection({ provider: 'zrexpress', officeId: state.deliveryType === 'office' ? state.officeId : undefined, officeName: state.deliveryType === 'office' ? state.officeName : undefined });
    const order = {
      id: `ORD-${Date.now()}`,
      tracking,
      customer: state.customer,
      phone: state.phone,
      wilaya: state.wilaya.name,
      wilayaId: state.wilaya.code,
      commune: state.commune,
      address: state.deliveryType === 'office' ? `${state.commune} - ${state.officeName || 'مكتب ZR Express'}` : state.address || state.commune,
      items: state.items.map((item) => ({ ...item, quantity: 1 })),
      total: state.subtotal + state.shipping,
      shipping: state.shipping,
      deliveryType: state.deliveryType,
      selectedOffice,
      status: 'pending',
      date: new Date().toISOString(),
      archived: false,
    };
    setLoading(true);
    try {
      const response = await fetch('/api/orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'save', order }) });
      const result = await response.json();
      if (!response.ok || !result?.ok) throw new Error(result?.error || 'Order save failed');
      setCheckout(null);
      setConversation((current) => ({ ...current, currentIntent: 'idle', selectedProductIds: [], lastQuestionType: 'none' }));
      addAssistant(`تم إنشاء الطلب بنجاح ✅\nرقم الطلب: ${tracking}\nشركة التوصيل: ZR Express\nالإجمالي: 💰 ${money(order.total)}\nالطلب الآن قيد المراجعة والتأكيد.`);
    } catch (error) {
      console.error('Assistant checkout save error:', error);
      addAssistant('ما قدرناش نحفظ الطلب الآن. بياناتك ما تضيعش، اضغط «تأكيد الطلب» وجرب مرة أخرى.');
    } finally { setLoading(false); }
  }

  async function handleCheckoutInput(raw: string) {
    if (!checkout) return;
    const value = raw.trim();
    if (!value || loading) return;
    setMessages((current) => [...current, { role: 'user', content: value }]);
    setInput('');
    const n = normalize(value);

    if (/^(الغاء|إلغاء|الغي|cancel)$/i.test(value)) {
      setCheckout(null);
      setConversation((current) => ({ ...current, currentIntent: 'general_question', selectedProductIds: [], lastQuestionType: 'none' }));
      addAssistant('تم إلغاء عملية الطلب. عادي، نقدر نجاوبك على أي سؤال أو نعاونك تختار منتج آخر.');
      return;
    }
    if (n.includes('واش فيها') || n.includes('واش فيهم') || n.includes('شنو فيها') || n.includes('شنو فيهم') || n.includes('محتوي') || n.includes('مميزات')) {
      addAssistant(`${checkoutProductInfo(checkout)}\n\n${checkoutStepReminder(checkout)}`);
      return;
    }
    if ((n.includes('توصيل') || n.includes('شحن') || n.includes('livraison')) && checkout.shipping != null) {
      addAssistant(`سعر التوصيل المحدد في طلبك: 💰 ${money(checkout.shipping)}\n${checkoutStepReminder(checkout)}`);
      return;
    }
    if (checkout.step === 'name') {
      if (value.length < 3) return addAssistant('اكتب الاسم الكامل من فضلك.');
      setCheckout({ ...checkout, customer: value, step: 'phone' });
      addAssistant('ممتاز. اكتب رقم الهاتف (10 أرقام).'); return;
    }
    if (checkout.step === 'phone') {
      const digits = value.replace(/\D/g, '');
      if (digits.length !== 10) return addAssistant('رقم الهاتف يجب أن يكون 10 أرقام بالضبط، مثال: 05xxxxxxxx.');
      setCheckout({ ...checkout, phone: digits, step: 'wilaya' });
      addAssistant('اكتب الولاية للتوصيل.'); return;
    }
    if (checkout.step === 'wilaya') {
      const wilaya = findWilaya(value);
      if (!wilaya) return addAssistant('ما تعرفتش على الولاية. تقدر تكتبها بالعربية أو الفرنسية، مثال: الجزائر / Alger.');
      setCheckout({ ...checkout, wilaya, step: 'commune' });
      addAssistant(`تمام، ${wilaya.name}. اكتب البلدية.`); return;
    }
    if (checkout.step === 'commune') {
      if (value.length < 2) return addAssistant('اكتب اسم البلدية من فضلك.');
      setCheckout({ ...checkout, commune: value, step: 'delivery' });
      addAssistant('كيف تحب توصيل ZR Express؟ للمكتب أو للمنزل؟'); return;
    }
    if (checkout.step === 'delivery') {
      if (n.includes('مكتب') || n.includes('bureau') || n.includes('office')) return void await prepareOfficeSelection(checkout);
      if (n.includes('منزل') || n.includes('بيت') || n.includes('home') || n.includes('domicile')) return void await prepareHomeDelivery(checkout);
      addAssistant('اختر «للمكتب» أو «للمنزل».'); return;
    }
    if (checkout.step === 'office') {
      const matched = checkout.offices?.find((hub) => normalize(`${hub.id} ${hub.name} ${hub.communeName} ${hub.address}`).includes(n));
      if (!matched) return addAssistant('اختار مكتب ZR Express من الأزرار الظاهرة باش نحفظ المكتب الصحيح.');
      chooseOffice(matched); return;
    }
    if (checkout.step === 'address') {
      if (value.length < 5) return addAssistant('اكتب عنوانًا أوضح من فضلك.');
      const next = { ...checkout, address: value, step: 'confirm' as const };
      setCheckout(next);
      addAssistant(`${checkoutSummary(next)}\n\nإذا كل شيء مناسب اضغط «تأكيد الطلب».`); return;
    }
    if (checkout.step === 'confirm') {
      if (n.includes('تاكيد') || n === 'نعم' || n === 'yes' || n === 'oui' || n === 'وافق') {
        await createCheckoutOrder(checkout); return;
      }
      addAssistant(`مازال الطلب محفوظ 👍 ${checkoutStepReminder(checkout)}`);
    }
  }

  function effectiveAffirmativeMessage() {
    const code = conversation.currentProductCode;
    if (conversation.lastQuestionType === 'offer_details') return code ? `اعطيني تفاصيل ${code}` : 'اعطيني التفاصيل أكثر';
    if (conversation.lastQuestionType === 'offer_contents') return code ? `اعطيني محتوى ${code} بالتفصيل` : 'اعطيني المحتوى بالتفصيل';
    if (conversation.lastQuestionType === 'offer_delivery') return code ? `نحسب التوصيل لـ ${code}` : 'نحسب التوصيل';
    return null;
  }

  async function sendMessage(raw: string) {
    const message = raw.trim();
    if (!message || loading) return;
    if (checkout) return void await handleCheckoutInput(message);

    const quick = quickQuestionResponse(message);
    if (quick) {
      setMessages((current) => [...current, { role: 'user', content: message }, { role: 'assistant', content: quick.answer }]);
      setInput('');
      setConversation((current) => ({ ...current, ...quick.patch, lastUserMessage: message }));
      return;
    }

    if (conversation.lastQuestionType === 'choose_stage') {
      const stage = normalizeStage(message);
      if (stage) {
        setMessages((current) => [...current, { role: 'user', content: message }, { role: 'assistant', content: `تمام 👍 اختر السنة المتاحة في طور ${stage}.` }]);
        setInput('');
        setConversation((current) => ({ ...current, currentStage: stage, currentLevel: undefined, currentProductCode: undefined, currentIntent: 'discover_products', lastQuestionType: 'choose_level', lastUserMessage: message }));
        return;
      }
    }

    if (conversation.lastQuestionType === 'choose_level') {
      const level = detectLevel(message);
      if (level && !['PRIMARY', 'MIDDLE'].includes(level)) {
        setMessages((current) => [...current, { role: 'user', content: message }, { role: 'assistant', content: `ممتاز 👍 هذه المنتجات المتوفرة لـ ${message}. اختار المنتج اللي تحب تعرف عليه أكثر.` }]);
        setInput('');
        setConversation((current) => ({ ...current, currentLevel: level, currentProductCode: detectProductCode(message), currentIntent: 'discover_products', lastQuestionType: 'choose_product', lastUserMessage: message }));
        return;
      }
    }

    const nextConversation = updateConversationFromUser(conversation, message);
    setConversation(nextConversation);
    if (isExplicitCheckoutRequest(message) || (isAffirmativeReply(message) && conversation.lastQuestionType === 'offer_checkout')) {
      return void await startCheckoutFromConversation(message);
    }

    const affirmativeReplacement = isAffirmativeReply(message) ? effectiveAffirmativeMessage() : null;
    const messageForAssistant = affirmativeReplacement || message;
    const previous = messages.filter((messageItem) => messageItem !== WELCOME).slice(-10);
    setMessages((current) => [...current, { role: 'user', content: message }]);
    setInput('');
    setLoading(true);
    let failureData: AssistantErrorData | null = null;
    try {
      const response = await fetch('/api/products', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'ai_assistant', message: messageForAssistant, history: previous }) });
      const data = await response.json();
      if (!response.ok || !data?.ok) {
        failureData = data || {};
        throw new Error(data?.error || 'Request failed');
      }
      addAssistant(data.answer);
      const code = detectProductCode(data.answer) || detectProductCode(messageForAssistant);
      const questionType = inferQuestionTypeFromAssistant(data.answer);
      setConversation((current) => ({ ...current, currentProductCode: code || current.currentProductCode, lastQuestionType: questionType === 'none' ? current.lastQuestionType : questionType }));
    } catch (error) {
      console.error('AI assistant error:', error, failureData);
      addAssistant('سمحلي، المساعد غير متاح مؤقتًا. حاول مرة أخرى بعد لحظات.');
    } finally { setLoading(false); }
  }

  function submit(event: FormEvent) { event.preventDefault(); void sendMessage(input); }
  const canOfferCheckout = !checkout && conversation.lastQuestionType === 'offer_checkout';

  return (
    <div className="miraj-ai" dir="rtl">
      {open && (
        <section className="miraj-ai__panel" aria-label="مساعد المعراج">
          <header className="miraj-ai__header">
            <div className="miraj-ai__identity"><div className="miraj-ai__avatar" aria-hidden="true">🤖</div><div><strong>مساعد المعراج</strong><span>مساعد المنتجات الذكي</span></div></div>
            <button type="button" onClick={() => setOpen(false)} aria-label="إغلاق">×</button>
          </header>
          <div className="miraj-ai__messages">
            {messages.map((messageItem, index) => <div key={`${messageItem.role}-${index}`} className={`miraj-ai__message miraj-ai__message--${messageItem.role}`}>{messageItem.role === 'assistant' ? renderAssistantText(messageItem.content) : messageItem.content}</div>)}
            {messages.length === 1 && <div className="miraj-ai__quick">{SMART_QUICK_QUESTIONS.map((question) => <button key={question} type="button" onClick={() => void sendMessage(question)}>{question}</button>)}</div>}
            {!checkout && <GuidedAssistantChoices conversation={conversation} disabled={loading} onSelect={(value) => void sendMessage(value)} />}
            {canOfferCheckout && <div className="miraj-ai__checkout-actions"><button type="button" onClick={() => void startCheckoutFromConversation()}>🛒 إنشاء الطلب من هنا</button></div>}
            {checkout?.step === 'delivery' && <div className="miraj-ai__checkout-actions"><button type="button" onClick={() => void handleCheckoutInput('للمكتب')}>📦 مكتب ZR Express</button><button type="button" onClick={() => void handleCheckoutInput('للمنزل')}>🏠 ZR Express للمنزل</button></div>}
            {checkout?.step === 'office' && checkout.offices && <div className="miraj-ai__checkout-actions miraj-ai__office-list">{checkout.offices.map((hub) => <button key={hub.id} type="button" onClick={() => chooseOffice(hub)}>📍 {officeLabel(hub)}</button>)}</div>}
            {checkout?.step === 'confirm' && <div className="miraj-ai__checkout-actions miraj-ai__checkout-actions--confirm"><button type="button" onClick={() => void handleCheckoutInput('تأكيد الطلب')}>✅ تأكيد الطلب</button><button type="button" className="miraj-ai__cancel" onClick={() => void handleCheckoutInput('إلغاء')}>إلغاء</button></div>}
            {loading && <div className="miraj-ai__typing">يكتب الآن…</div>}
            <div ref={endRef} />
          </div>
          <form className="miraj-ai__form" onSubmit={submit}>
            <input value={input} onChange={(event) => setInput(checkout?.step === 'phone' ? event.target.value.replace(/\D/g, '').slice(0, 10) : event.target.value)} placeholder={checkout?.step === 'phone' ? '05xxxxxxxx' : checkout?.step === 'office' ? 'اختر مكتب ZR Express من القائمة…' : checkout ? 'اكتب المعلومة المطلوبة…' : 'اكتب سؤالك حول المنتجات…'} maxLength={checkout?.step === 'phone' ? 10 : 1200} disabled={loading || checkout?.step === 'office'} inputMode={checkout?.step === 'phone' ? 'tel' : 'text'} aria-label="رسالتك" />
            <button type="submit" disabled={loading || checkout?.step === 'office' || !input.trim()} aria-label="إرسال">إرسال</button>
          </form>
          <p className="miraj-ai__note">الأسعار والطلب والتوصيل تُحسب من بيانات المتجر وZR Express مباشرة.</p>
        </section>
      )}
      <button className="miraj-ai__launcher" type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open} aria-label={open ? 'إغلاق مساعد المعراج' : 'فتح مساعد المعراج'} title="مساعد المعراج"><span aria-hidden="true">🤖</span></button>
    </div>
  );
}
