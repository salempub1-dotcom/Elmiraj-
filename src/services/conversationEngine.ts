export type ConversationIntent =
  | 'idle'
  | 'discover_products'
  | 'product_details'
  | 'product_usage'
  | 'product_comparison'
  | 'price'
  | 'availability'
  | 'delivery_quote'
  | 'purchase_interest'
  | 'start_checkout'
  | 'modify_checkout'
  | 'checkout_question'
  | 'general_question';

export type LastQuestionType =
  | 'none'
  | 'choose_stage'
  | 'choose_level'
  | 'choose_product'
  | 'offer_details'
  | 'offer_contents'
  | 'offer_delivery'
  | 'offer_checkout'
  | 'checkout_field';

export type ConversationState = {
  currentIntent: ConversationIntent;
  currentProductCode?: string;
  currentLevel?: string;
  selectedProductIds: number[];
  lastQuestionType: LastQuestionType;
  lastUserMessage?: string;
};

export const INITIAL_CONVERSATION_STATE: ConversationState = {
  currentIntent: 'idle',
  selectedProductIds: [],
  lastQuestionType: 'none',
};

export const SMART_QUICK_QUESTIONS = [
  '🎒 اختارلي حسب السنة',
  '📚 شوف المنتجات والمحتوى',
  '💰 السعر والتوصيل',
  '🛒 نحب نطلب منتج',
];

function normalize(text = '') {
  return String(text)
    .toLowerCase()
    .replace(/[أإآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/[\u064B-\u065F]/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function isAffirmativeReply(text: string) {
  const value = normalize(text);
  return ['نعم', 'ايه', 'ايوه', 'اوك', 'ok', 'okay', 'yes', 'oui'].includes(value);
}

export function isNegativeReply(text: string) {
  const value = normalize(text);
  return ['لا', 'لالا', 'لا شكرا', 'non', 'no', 'nope'].includes(value);
}

export function isExplicitCheckoutRequest(text: string) {
  const value = normalize(text);
  return value.includes('انشاء الطلب')
    || value.includes('اكمل الطلب')
    || value.includes('كمل الطلب')
    || value.includes('ابدا الطلب')
    || value.includes('نبدا الطلب')
    || value.includes('ديرلي الطلب')
    || value.includes('دير الطلب');
}

export function detectProductCode(text: string) {
  const upper = String(text).toUpperCase();
  const match = upper.match(/\b(?:[1-4]MS|[3-5](?:PS|AP))\b/);
  if (!match) return undefined;
  return match[0].replace('AP', 'PS');
}

export function detectLevel(text: string) {
  const value = normalize(text);
  const code = detectProductCode(text);
  if (code) return code;
  if (value.includes('تحضيري') || value.includes('prep')) return 'PREP';
  if (value.includes('ابتدايي') || value.includes('ابتدائي') || value.includes('primary')) return 'PRIMARY';
  if (value.includes('متوسط') || value.includes('middle')) return 'MIDDLE';
  return undefined;
}

export function classifyIntent(text: string, state: ConversationState): ConversationIntent {
  const value = normalize(text);
  if (isExplicitCheckoutRequest(text)) return 'start_checkout';
  if (value.includes('بدل') || value.includes('غير') || value.includes('نحي') || value.includes('زيدلي') || value.includes('زيد لي')) return 'modify_checkout';
  if (value.includes('توصيل') || value.includes('شحن') || value.includes('livraison') || value.includes('delivery')) return 'delivery_quote';
  if (value.includes('سعر') || value.includes('ثمن') || value.includes('شحال') || value.includes('قداه') || value.includes('price')) return 'price';
  if (value.includes('متوفر') || value.includes('stock') || value.includes('disponible')) return 'availability';
  if (value.includes('فرق') || value.includes('نقارن') || value.includes('مقارنه') || value.includes('افضل') || value.includes('خير')) return 'product_comparison';
  if (value.includes('كيفاش نستعمل') || value.includes('كيف نستعمل') || value.includes('kifech') || value.includes('استعمال')) return 'product_usage';
  if (value.includes('واش فيها') || value.includes('واش فيهم') || value.includes('شنو فيها') || value.includes('محتوي') || value.includes('مميزات') || value.includes('تفاصيل')) return 'product_details';
  if (value.includes('نحب نشري') || value.includes('حاب نشري') || value.includes('نحب نطلب') || value.includes('حاب نطلب') || value.includes('اريد شراء') || value.includes('اريد الطلب')) return 'purchase_interest';
  if (value.includes('اختارلي') || value.includes('ساعدني نختار') || value.includes('واش عندكم') || value.includes('شنو عندكم') || value.includes('شوف المنتجات')) return 'discover_products';
  if (state.currentIntent === 'start_checkout') return 'checkout_question';
  return 'general_question';
}

export function updateConversationFromUser(state: ConversationState, message: string): ConversationState {
  const code = detectProductCode(message);
  const level = detectLevel(message);
  return {
    ...state,
    currentIntent: classifyIntent(message, state),
    currentProductCode: code || state.currentProductCode,
    currentLevel: level || state.currentLevel,
    lastUserMessage: message,
  };
}

export function clearProductContext(state: ConversationState): ConversationState {
  return {
    ...state,
    currentProductCode: undefined,
    currentLevel: undefined,
    selectedProductIds: [],
    lastQuestionType: 'none',
  };
}

export function quickQuestionResponse(label: string): { answer: string; patch: Partial<ConversationState> } | null {
  const clean = label.replace(/^[^\p{L}\p{N}]+/u, '').trim();
  if (clean.includes('اختارلي حسب السنة')) {
    return {
      answer: 'أكيد 👍 اختار الطور أولًا: تحضيري، ابتدائي ولا متوسط؟',
      patch: { currentIntent: 'discover_products', lastQuestionType: 'choose_stage' },
    };
  }
  if (clean.includes('شوف المنتجات والمحتوى')) {
    return {
      answer: 'أكيد 📚 قولي الطور اللي حاب تشوف منتجاته: تحضيري، ابتدائي ولا متوسط؟',
      patch: { currentIntent: 'discover_products', lastQuestionType: 'choose_stage' },
    };
  }
  if (clean.includes('السعر والتوصيل')) {
    return {
      answer: 'أكيد 💰 قولي المنتج أو السنة اللي تهمك، وإذا حاب نحسب التوصيل اكتب الولاية والبلدية.',
      patch: { currentIntent: 'price', lastQuestionType: 'choose_product' },
    };
  }
  if (clean.includes('نحب نطلب منتج')) {
    return {
      answer: 'أكيد 🛒 قولي اسم المنتج أو المستوى اللي حاب تطلبه. نوريك التفاصيل والسعر أولًا، وبعدها إذا حبيت نقدر ننشئ لك الطلب من هنا.',
      patch: { currentIntent: 'purchase_interest', lastQuestionType: 'choose_product' },
    };
  }
  return null;
}

export function inferQuestionTypeFromAssistant(text: string): LastQuestionType {
  const value = normalize(text);
  if (value.includes('تحضيري') && value.includes('ابتدايي') && value.includes('متوسط')) return 'choose_stage';
  if (value.includes('اي سنه') || value.includes('السنه اللي') || value.includes('المستوي')) return 'choose_level';
  if (value.includes('تفاصيل اكثر') || value.includes('تفاصيل اكثر عليها') || value.includes('تحب تفاصيل')) return 'offer_details';
  if (value.includes('محتوي كل') || value.includes('المحتوي بالتفصيل')) return 'offer_contents';
  if (value.includes('نحسبلك التوصيل') || value.includes('نحسب التوصيل')) return 'offer_delivery';
  if (value.includes('ننشئ لك الطلب') || value.includes('انشاء الطلب من هنا') || value.includes('نبداو طلبيه')) return 'offer_checkout';
  return 'none';
}
