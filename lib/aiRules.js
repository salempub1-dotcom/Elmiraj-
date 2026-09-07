const STORE_URL = 'https://elm3raj.com';

export const WILAYA_SHIPPING = [
  { code: 16, name: 'الجزائر', home: 500, office: 300 },
  { code: 35, name: 'بومرداس', home: 600, office: 400 },
  { code: 9, name: 'البليدة', home: 600, office: 400 },
  { code: 42, name: 'تيبازة', home: 600, office: 400 },
  { code: 15, name: 'تيزي وزو', home: 700, office: 450 },
  { code: 10, name: 'البويرة', home: 700, office: 450 },
  { code: 26, name: 'المدية', home: 700, office: 450 },
  { code: 6, name: 'بجاية', home: 800, office: 500 },
  { code: 34, name: 'برج بوعريريج', home: 800, office: 500 },
  { code: 44, name: 'عين الدفلى', home: 800, office: 500 },
  { code: 46, name: 'عين تيموشنت', home: 800, office: 500 },
  { code: 23, name: 'عنابة', home: 800, office: 500 },
  { code: 5, name: 'باتنة', home: 800, office: 500 },
  { code: 2, name: 'الشلف', home: 800, office: 500 },
  { code: 25, name: 'قسنطينة', home: 800, office: 500 },
  { code: 29, name: 'معسكر', home: 800, office: 500 },
  { code: 43, name: 'ميلة', home: 800, office: 500 },
  { code: 27, name: 'مستغانم', home: 800, office: 500 },
  { code: 28, name: 'المسيلة', home: 800, office: 500 },
  { code: 31, name: 'وهران', home: 800, office: 500 },
  { code: 4, name: 'أم البواقي', home: 800, office: 500 },
  { code: 48, name: 'غليزان', home: 800, office: 500 },
  { code: 38, name: 'تيسمسيلت', home: 800, office: 500 },
  { code: 13, name: 'تلمسان', home: 800, office: 500 },
  { code: 19, name: 'سطيف', home: 800, office: 500 },
  { code: 22, name: 'سيدي بلعباس', home: 800, office: 500 },
  { code: 21, name: 'سكيكدة', home: 800, office: 500 },
  { code: 18, name: 'جيجل', home: 800, office: 500 },
  { code: 36, name: 'الطارف', home: 900, office: 600 },
  { code: 24, name: 'قالمة', home: 900, office: 600 },
  { code: 40, name: 'خنشلة', home: 900, office: 600 },
  { code: 20, name: 'سعيدة', home: 900, office: 600 },
  { code: 41, name: 'سوق أهراس', home: 900, office: 600 },
  { code: 12, name: 'تبسة', home: 900, office: 600 },
  { code: 14, name: 'تيارت', home: 900, office: 600 },
  { code: 51, name: 'أولاد جلال', home: 1000, office: 1000 },
  { code: 17, name: 'الجلفة', home: 1000, office: 600 },
  { code: 3, name: 'الأغواط', home: 1000, office: 600 },
  { code: 7, name: 'بسكرة', home: 1000, office: 600 },
  { code: 47, name: 'غرداية', home: 1100, office: 700 },
  { code: 39, name: 'الوادي', home: 1100, office: 700 },
  { code: 57, name: 'المغير', home: 1100, office: 1100 },
  { code: 30, name: 'ورقلة', home: 1100, office: 700 },
  { code: 55, name: 'تقرت', home: 1100, office: 700 },
  { code: 58, name: 'المنيعة', home: 1200, office: 800 },
  { code: 32, name: 'البيض', home: 1200, office: 800 },
  { code: 45, name: 'النعامة', home: 1200, office: 800 },
  { code: 8, name: 'بشار', home: 1200, office: 800 },
  { code: 52, name: 'بني عباس', home: 1200, office: 1200 },
  { code: 1, name: 'أدرار', home: 1500, office: 1000 },
  { code: 49, name: 'تيميمون', home: 1500, office: 1000 },
  { code: 37, name: 'تندوف', home: 1700, office: 1000 },
  { code: 53, name: 'عين صالح', home: 1800, office: 1200 },
  { code: 33, name: 'إليزي', home: 1900, office: 1500 },
  { code: 11, name: 'تمنراست', home: 2000, office: 1500 },
  { code: 56, name: 'جانت', home: 2200, office: 2200 },
];

const COMMUNE_TO_WILAYA = {
  'براقي': 'الجزائر',
  'baraki': 'الجزائر',
  'الحراش': 'الجزائر',
  'باب الزوار': 'الجزائر',
  'الدار البيضاء': 'الجزائر',
  'الرويبة': 'الجزائر',
  'rouiba': 'الجزائر',
  'الرغاية': 'الجزائر',
  'رغاية': 'الجزائر',
  'reghaia': 'الجزائر',
  'دالي ابراهيم': 'الجزائر',
  'dely ibrahim': 'الجزائر',
  'برج الكيفان': 'الجزائر',
  'درارية': 'الجزائر',
  'زرالدة': 'الجزائر',
};

export function normalizeRuleText(text = '') {
  return String(text)
    .toLowerCase()
    .replace(/[أإآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/[\u064B-\u065F]/g, '')
    .replace(/\b(?:algeria|algerie|algérie|alger|algiers)\b/g, ' الجزائر ')
    .replace(/نحب نشري|حاب نشري|اريد شراء|اريد الشراء|نحب نطلب|حاب نطلب|اريد الطلب/g, ' مهتم ')
    .replace(/انشاء الطلب|انشي الطلب|انشئ الطلب/g, ' كمل الطلب ')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function money(value) {
  return `${Number(value || 0).toLocaleString('en-US')} دج`;
}

function allText(message, history) {
  return [
    ...(Array.isArray(history) ? history.slice(-8).map((m) => m?.content || '') : []),
    message,
  ].join(' ');
}

export function findShippingDeterministic(text) {
  const n = normalizeRuleText(text)
    .replace(/الجزاير/g, 'الجزائر')
    .replace(/الجزاير العاصمة/g, 'الجزائر')
    .replace(/الجزائر العاصمة/g, 'الجزائر');

  for (const [commune, wilaya] of Object.entries(COMMUNE_TO_WILAYA)) {
    if (n.includes(normalizeRuleText(commune))) {
      return WILAYA_SHIPPING.find((x) => normalizeRuleText(x.name) === normalizeRuleText(wilaya)) || null;
    }
  }
  return WILAYA_SHIPPING.find((x) => n.includes(normalizeRuleText(x.name))) || null;
}

function primaryBags(products = []) {
  const wanted = ['3PS', '4PS', '5PS'];
  return wanted
    .map((code) => products.find((p) => normalizeRuleText(p.name).includes(normalizeRuleText(code))))
    .filter(Boolean);
}

function productByCode(products, code) {
  return products.find((p) => normalizeRuleText(p.name).includes(normalizeRuleText(code))) || null;
}

function isPrimaryContext(text) {
  const n = normalizeRuleText(text);
  return n.includes('ابتدايي') || n.includes('3ps') || n.includes('4ps') || n.includes('5ps') || n.includes('3ap') || n.includes('4ap') || n.includes('5ap');
}

function wantsOffice(text) {
  const n = normalizeRuleText(text);
  return n.includes('مكتب') || n.includes('bureau') || n.includes('office');
}

function wantsHome(text) {
  const n = normalizeRuleText(text);
  return n.includes('منزل') || n.includes('البيت') || n.includes('domicile') || n.includes('home');
}

function wantsLink(text) {
  const n = normalizeRuleText(text);
  return n.includes('رابط') || n.includes('لينك') || n.includes('link') || n.includes('شراء') || n.includes('الشراء');
}

function wantsRecommendation(text) {
  const n = normalizeRuleText(text);
  return n.includes('ساعدني نختار') || n.includes('اختار المنتج') || n.includes('اختيار المنتج') || n.includes('واش تنصح') || n.includes('شنو تنصح');
}

function wantsFullPrimary(text) {
  const n = normalizeRuleText(text);
  return n.includes('الحقيبه كامله') || n.includes('حقيبه كامله') || n.includes('السنوات الثلاثه') || n.includes('3ps 4ps 5ps');
}

function formatPrimaryList(bags) {
  return bags.map((p) => `• ${p.name.split('|')[0].trim()} — 💰 ${money(p.price)}`).join('\n');
}

function collectHighlights(items = []) {
  const values = items.flatMap((item) => [
    ...(Array.isArray(item?.benefits) ? item.benefits : []),
    ...(Array.isArray(item?.contents) ? item.contents : []),
  ]);
  const seen = new Set();
  const unique = [];
  for (const value of values) {
    const text = String(value || '').trim();
    if (!text) continue;
    const key = normalizeRuleText(text);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    unique.push(text);
    if (unique.length >= 4) break;
  }
  return unique;
}

export function tryDeterministicAnswer({ message, history, products }) {
  const context = allText(message, history);
  const nMessage = normalizeRuleText(message);
  const primary = primaryBags(products);
  const shippingCurrent = findShippingDeterministic(message);
  const shipping = shippingCurrent || findShippingDeterministic(context);
  const asksDeliveryNow = nMessage.includes('توصيل') || nMessage.includes('شحن') || nMessage.includes('livraison') || nMessage.includes('delivery');

  if (shippingCurrent && asksDeliveryNow) {
    if (wantsOffice(message)) {
      return { answer: `التوصيل للمكتب إلى ${shippingCurrent.name}: 💰 ${money(shippingCurrent.office)}`, source: 'rules' };
    }
    if (wantsHome(message)) {
      return { answer: `التوصيل للمنزل إلى ${shippingCurrent.name}: 💰 ${money(shippingCurrent.home)}`, source: 'rules' };
    }
    return { answer: `التوصيل إلى ${shippingCurrent.name}:\n• المكتب: 💰 ${money(shippingCurrent.office)}\n• المنزل: 💰 ${money(shippingCurrent.home)}`, source: 'rules' };
  }

  if (wantsRecommendation(message)) {
    if (!isPrimaryContext(context)) {
      return { answer: 'أكيد 👍 قولي فقط الطور: ابتدائي ولا متوسط؟', source: 'rules' };
    }
    if (primary.length === 3) {
      return {
        answer: `للابتدائي عندنا 3 حقائب كاملة:\n${formatPrimaryList(primary)}\nقولي السنة اللي تقريها ونشرح لك محتوى الحقيبة والمميزات باش تختاري الأنسب.`,
        source: 'rules',
      };
    }
  }

  if (nMessage === normalizeRuleText('ابتدائي') && primary.length === 3) {
    return {
      answer: `للابتدائي متوفرة:\n${formatPrimaryList(primary)}\nقولي السنة اللي تقريها ونشرح لك المحتوى والمميزات قبل أي طلب.`,
      source: 'rules',
    };
  }

  for (const code of ['3PS', '4PS', '5PS']) {
    if (normalizeRuleText(message).includes(normalizeRuleText(code))) {
      const p = productByCode(products, code);
      if (!p) continue;
      if (wantsLink(message)) {
        return { answer: `${p.name.split('|')[0].trim()}\n💰 ${money(p.price)}\n${STORE_URL}/lp/${p.id}`, source: 'rules' };
      }
      if (nMessage.includes('سعر') || nMessage.includes('ثمن') || nMessage.includes('price')) {
        return { answer: `${p.name.split('|')[0].trim()}: 💰 ${money(p.price)}`, source: 'rules' };
      }
    }
  }

  if (primary.length === 3 && (wantsFullPrimary(message) || (isPrimaryContext(context) && nMessage.includes('كامله')))) {
    const subtotal = primary.reduce((sum, p) => sum + Number(p.price || 0), 0);
    const highlights = collectHighlights(primary);
    const lines = [
      'الحقيبة الكاملة للسنوات الثلاثة تشمل:',
      ...primary.map((p) => `• ${p.name.split('|')[0].trim()} — 💰 ${money(p.price)}`),
      `المجموع: 💰 ${money(subtotal)}`,
    ];

    if (highlights.length) {
      lines.push('أهم المميزات:');
      lines.push(...highlights.map((item) => `• ${item}`));
    }

    if (shipping && asksDeliveryNow) {
      if (wantsOffice(message)) {
        lines.push(`التوصيل للمكتب إلى ${shipping.name}: 💰 ${money(shipping.office)}`);
        lines.push(`الإجمالي مع التوصيل: 💰 ${money(subtotal + shipping.office)}`);
      } else if (wantsHome(message)) {
        lines.push(`التوصيل للمنزل إلى ${shipping.name}: 💰 ${money(shipping.home)}`);
        lines.push(`الإجمالي مع التوصيل: 💰 ${money(subtotal + shipping.home)}`);
      } else {
        lines.push(`التوصيل إلى ${shipping.name}: المكتب 💰 ${money(shipping.office)} | المنزل 💰 ${money(shipping.home)}`);
      }
    }

    if (wantsLink(message)) {
      lines.push(...primary.map((p) => `${STORE_URL}/lp/${p.id}`));
    }

    lines.push('إذا حبيت، نقدر ننشئ لك الطلب كامل من داخل البوت بدون ما تخرج من المحادثة.');
    return { answer: lines.join('\n'), source: 'rules' };
  }

  if (shipping && asksDeliveryNow) {
    if (wantsOffice(message)) {
      return { answer: `التوصيل للمكتب إلى ${shipping.name}: 💰 ${money(shipping.office)}`, source: 'rules' };
    }
    if (wantsHome(message)) {
      return { answer: `التوصيل للمنزل إلى ${shipping.name}: 💰 ${money(shipping.home)}`, source: 'rules' };
    }
    return { answer: `التوصيل إلى ${shipping.name}:\n• المكتب: 💰 ${money(shipping.office)}\n• المنزل: 💰 ${money(shipping.home)}`, source: 'rules' };
  }

  if (wantsLink(message) && isPrimaryContext(context) && primary.length === 3) {
    return {
      answer: `روابط الشراء:\n${primary.map((p) => `${p.name.split('|')[0].trim()} — ${STORE_URL}/lp/${p.id}`).join('\n')}`,
      source: 'rules',
    };
  }

  return null;
}