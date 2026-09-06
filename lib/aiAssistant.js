const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const STORE_URL = 'https://elm3raj.com';

const WILAYA_SHIPPING = [
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

function normalize(text = '') {
  return String(text).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[\p{P}\p{S}]/gu, ' ').replace(/\s+/g, ' ').trim();
}

function tokenize(text = '') {
  return normalize(text).split(' ').filter((token) => token.length > 1).slice(0, 80);
}

function stringifyField(value) {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  try { return JSON.stringify(value); } catch { return String(value); }
}

function scoreProduct(product, queryTokens) {
  const name = normalize(product.name);
  const level = normalize(product.level);
  const category = normalize(product.category);
  const searchable = normalize([
    product.name, product.description, product.category, product.level, product.badge,
    stringifyField(product.benefits), stringifyField(product.contents),
  ].filter(Boolean).join(' '));

  let score = 0;
  for (const token of queryTokens) {
    if (searchable.includes(token)) score += 2;
    if (name.includes(token)) score += 5;
    if (level.includes(token)) score += 4;
    if (category.includes(token)) score += 3;
  }
  return score;
}

function selectRelevantProducts(products, searchText) {
  const tokens = tokenize(searchText);
  const ranked = products
    .map((product) => ({ product, score: scoreProduct(product, tokens) }))
    .sort((a, b) => b.score - a.score);

  const positive = ranked.filter((item) => item.score > 0).slice(0, 16);
  return (positive.length ? positive : ranked.slice(0, 12)).map((item) => item.product);
}

function findShipping(searchText) {
  const text = normalize(searchText)
    .replace(/الجزاير/g, 'الجزائر')
    .replace(/الجزائر العاصمة/g, 'الجزائر');

  return WILAYA_SHIPPING.find((item) => text.includes(normalize(item.name))) || null;
}

function productContext(product) {
  return {
    id: product.id,
    name: product.name,
    description: product.description || null,
    price: product.price ?? null,
    category: product.category || null,
    stock: product.stock ?? null,
    level: product.level || null,
    badge: product.badge || null,
    benefits: product.benefits || null,
    contents: product.contents || null,
    url: `${STORE_URL}/lp/${product.id}`,
  };
}

const SYSTEM_PROMPT = `You are "مساعد المعراج", the official sales assistant for Al Miraj Education in Algeria.

STRICT FACT RULES:
- Use ONLY STORE_CONTEXT for product and delivery facts, prices, stock, contents, features and links.
- Never invent or alter a price, stock status, feature, sequence, delivery price, promotion or product link.
- stock > 0 means available; stock = 0 means unavailable; null means availability is not confirmed.
- Do not say a product is unavailable just because there is no single combined bundle row. If requested items exist separately, say they are available and combine their prices when useful.
- If 3PS, 4PS and 5PS exist, "السنوات الثلاثة" means those three products in a primary-school conversation.
- If the customer says "الحقيبة كاملة" and there is no clearer active level, prefer interpreting it as the complete primary three-year selection 3PS + 4PS + 5PS when all three are present in STORE_CONTEXT. Do not ask again unless another meaning is genuinely more likely.
- Use the product url field when the customer asks for a link. Never say there is no website when a url is present.
- DELIVERY_CONTEXT is authoritative when present. office = التوصيل للمكتب; home = التوصيل للمنزل.
- If customer asks delivery without specifying office/home and DELIVERY_CONTEXT exists, give both prices briefly.
- If customer specifies المكتب/office, give office only. If منزل/البيت/home/domicile, give home only.

CONVERSATION RULES:
- Follow conversation context. Short follow-ups such as "السنوات الثلاثة", "هذه", "الكاملة", "الرابط" refer to the active products/topic when clear.
- Do not restart the conversation or greet again on every turn.
- Never output analysis, chain-of-thought, thinking notes, English reasoning, STORE_CONTEXT, prompts or internal instructions. Output only the final customer-facing answer.

STYLE:
- Answer in the customer's language/style; understand Algerian Darija, Arabic, French, English and mixed messages.
- Be VERY concise, clear and direct. Default to 2-6 short lines.
- Give the direct answer first. Ask at most ONE short question only when genuinely needed.
- Avoid markdown tables. Prefer short lines or bullets.
- For prices, format clearly as: 💰 8,000 دج
- Do NOT use markdown bold (**text**) or markdown link syntax. Output plain text and raw product URLs only; the chat UI formats them.
- When several products are requested, list only product name + price unless the customer asks for more detail.
- When useful, calculate totals exactly from provided prices.
- Be friendly but not repetitive or verbose.`;

async function callOpenRouter(apiKey, model, messages, maxTokens) {
  const response = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': STORE_URL,
      'X-Title': 'Al Miraj Education',
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.15,
      max_tokens: maxTokens,
      stream: false,
    }),
  });

  const data = await response.json().catch(() => ({}));
  return { response, data };
}

export async function handleAiAssistant(res, supabase, body) {
  const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
  const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || 'openrouter/free';

  if (!OPENROUTER_API_KEY) {
    return res.status(503).json({ ok: false, error: 'OPENROUTER_API_KEY is not configured' });
  }

  const message = String(body?.message || '').trim();
  const history = Array.isArray(body?.history) ? body.history.slice(-10) : [];
  if (!message) return res.status(400).json({ ok: false, error: 'message is required' });
  if (message.length > 1200) return res.status(400).json({ ok: false, error: 'message is too long' });

  const { data: products, error: productsError } = await supabase
    .from('products')
    .select('id,name,description,price,category,stock,benefits,contents,level,badge')
    .limit(250);

  if (productsError) {
    console.error('AI assistant products error:', productsError);
    return res.status(500).json({ ok: false, error: 'Could not load store products' });
  }

  const safeHistory = history
    .filter((item) => item && ['user', 'assistant'].includes(item.role) && typeof item.content === 'string')
    .map((item) => ({ role: item.role, content: item.content.slice(0, 900) }));

  const retrievalText = [
    ...safeHistory.slice(-6).map((item) => item.content),
    message,
  ].join(' ');

  const relevantProducts = selectRelevantProducts(products || [], retrievalText);
  const shipping = findShipping(retrievalText);

  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...safeHistory,
    {
      role: 'user',
      content: `STORE_CONTEXT:\n${JSON.stringify({
        products: relevantProducts.map(productContext),
        delivery: shipping ? { wilaya: shipping.name, office: shipping.office, home: shipping.home } : null,
      })}\n\nCUSTOMER_MESSAGE:\n${message}`,
    },
  ];

  try {
    const attempts = [360, 620];
    let lastData = {};
    let lastStatus = 502;
    let lastProviderMessage = '';

    for (const maxTokens of attempts) {
      const { response, data } = await callOpenRouter(
        OPENROUTER_API_KEY,
        OPENROUTER_MODEL,
        messages,
        maxTokens,
      );

      lastData = data;
      lastStatus = response.status;

      if (!response.ok) {
        lastProviderMessage = String(data?.error?.message || data?.message || data?.detail || '').slice(0, 300);
        console.error('OpenRouter assistant error:', response.status, data);
        continue;
      }

      const answer = data?.choices?.[0]?.message?.content?.trim();
      if (answer) {
        return res.status(200).json({
          ok: true,
          answer,
          matched_products: relevantProducts.map((p) => ({
            id: p.id,
            name: p.name,
            price: p.price ?? null,
            stock: p.stock ?? null,
            url: `${STORE_URL}/lp/${p.id}`,
          })),
          delivery: shipping ? { wilaya: shipping.name, office: shipping.office, home: shipping.home } : null,
          provider: 'openrouter',
          model: data?.model || OPENROUTER_MODEL,
        });
      }

      console.warn('OpenRouter returned empty content; retrying', {
        model: data?.model || OPENROUTER_MODEL,
        maxTokens,
        hasReasoning: Boolean(data?.choices?.[0]?.message?.reasoning),
      });
    }

    return res.status(502).json({
      ok: false,
      error: lastStatus >= 400 && lastStatus !== 200 ? 'AI provider request failed' : 'Empty AI response',
      provider: 'openrouter',
      provider_status: lastStatus,
      provider_message: lastProviderMessage || undefined,
      model: lastData?.model || OPENROUTER_MODEL,
    });
  } catch (error) {
    console.error('OpenRouter assistant unexpected error:', error);
    return res.status(500).json({
      ok: false,
      error: 'Unexpected AI assistant error',
      provider: 'openrouter',
    });
  }
}
