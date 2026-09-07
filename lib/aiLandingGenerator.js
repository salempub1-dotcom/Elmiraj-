const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

const ALLOWED_ICON_KEYS = new Set([
  'time', 'classroom', 'visual', 'organize', 'students', 'ready', 'quality', 'protect', 'content', 'teaching',
]);

function cleanJsonText(value = '') {
  return String(value)
    .replace(/^\uFEFF/, '')
    .replace(/```json\s*/gi, '')
    .replace(/```\s*/g, '')
    .trim();
}

function extractJsonObject(value = '') {
  const cleaned = cleanJsonText(value);
  try { return JSON.parse(cleaned); } catch { /* continue */ }

  const first = cleaned.indexOf('{');
  const last = cleaned.lastIndexOf('}');
  if (first !== -1 && last > first) {
    const candidate = cleaned.slice(first, last + 1)
      .replace(/[“”]/g, '"')
      .replace(/[‘’]/g, "'");
    try { return JSON.parse(candidate); } catch { /* continue */ }
  }
  return null;
}

function clampString(value, max = 180) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, max);
}

function shortAtWord(value, max = 58) {
  const text = clampString(value, max + 40);
  if (text.length <= max) return text;
  const cut = text.slice(0, max + 1);
  const lastSpace = cut.lastIndexOf(' ');
  return (lastSpace > Math.floor(max * 0.55) ? cut.slice(0, lastSpace) : cut.slice(0, max)).trim();
}

function cleanHeroTitle(value, productName) {
  let title = clampString(value || productName, 100)
    .replace(/من\s+مؤسسة\s+المعراج/gi, '')
    .replace(/مؤسسة\s+المعراج/gi, '')
    .replace(/المعراج\s+لـ?/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
  if (!title) title = productName;
  return shortAtWord(title, 58);
}

function normalizeBenefit(item, index) {
  if (typeof item === 'string') {
    return { text: clampString(item, 112), icon_key: ['teaching', 'visual', 'students', 'time'][index % 4] };
  }
  const text = clampString(item?.text || item?.label || item?.benefit, 112);
  const candidate = clampString(item?.icon_key, 30).toLowerCase();
  const iconKey = ALLOWED_ICON_KEYS.has(candidate) ? candidate : ['teaching', 'visual', 'students', 'time'][index % 4];
  return { text, icon_key: iconKey };
}

function normalizeGenerated(raw, product) {
  const benefits = Array.isArray(raw?.benefits)
    ? raw.benefits.map(normalizeBenefit).filter((x) => x.text).slice(0, 4)
    : [];
  const faq = Array.isArray(raw?.faq)
    ? raw.faq
        .map((item) => ({
          question: clampString(item?.question, 105),
          answer: clampString(item?.answer, 230),
        }))
        .filter((item) => item.question && item.answer)
        .slice(0, 4)
    : [];

  return {
    hero_title: cleanHeroTitle(raw?.hero_title, product.name),
    hero_subtitle: clampString(raw?.hero_subtitle, 145),
    benefits,
    contents_heading: clampString(raw?.contents_heading || 'ماذا ستجد داخل المنتج؟', 72),
    faq,
    final_cta_heading: shortAtWord(raw?.final_cta_heading || `احصل على ${product.name} الآن`, 78),
    cta_text: clampString(raw?.cta_text || 'اطلب الآن', 28),
  };
}

async function requestLandingJson({ apiKey, model, messages, maxTokens = 1400 }) {
  const response = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://elm3raj.com',
      'X-Title': 'Al Miraj Landing Generator',
    },
    body: JSON.stringify({
      model,
      temperature: 0.18,
      max_tokens: maxTokens,
      response_format: { type: 'json_object' },
      messages,
    }),
  });

  const data = await response.json().catch(() => ({}));
  return { response, data, text: data?.choices?.[0]?.message?.content || '' };
}

export async function handleAiLandingGenerator(res, supabase, body, admin) {
  if (!admin) return res.status(401).json({ ok: false, error: 'Admin authentication required' });

  const productId = Number(body?.product_id);
  if (!Number.isFinite(productId)) {
    return res.status(400).json({ ok: false, error: 'product_id is required' });
  }

  const { data: product, error } = await supabase
    .from('products')
    .select('id,name,description,price,category,stock,benefits,contents,level,badge')
    .eq('id', productId)
    .maybeSingle();

  if (error || !product) {
    return res.status(404).json({ ok: false, error: error?.message || 'Product not found' });
  }

  const apiKey = process.env.OPENROUTER_API_KEY;
  const model = process.env.OPENROUTER_MODEL || 'openrouter/free';
  if (!apiKey) return res.status(503).json({ ok: false, error: 'OPENROUTER_API_KEY is not configured' });

  const factualContext = {
    name: product.name,
    description: product.description || '',
    category: product.category || '',
    level: product.level || '',
    benefits: Array.isArray(product.benefits) ? product.benefits : [],
    contents: Array.isArray(product.contents) ? product.contents : [],
  };

  const prompt = `You create concise Arabic landing-page copy for Al Miraj Education in Algeria.
Return ONLY one valid JSON object. No markdown and no text before or after JSON.

STRICT FACT RULES:
- Use only PRODUCT_CONTEXT facts.
- Never invent quantities, price, stock, delivery price, discounts, reviews, sales numbers, guarantees, PDFs, certifications, or included items.
- Do not mention a feature unless supported by PRODUCT_CONTEXT.
- Price, stock, images and shipping are rendered by the store, not by AI.

COPY RULES:
- Audience: Algerian teachers.
- Professional, warm, concise Arabic.
- hero_title: MAX 45 characters. Prefer the real product name or a shorter clean version. NEVER append "من مؤسسة المعراج" and never write a sentence in the title.
- hero_subtitle: one short sentence, MAX 120 characters.
- Each benefit: MAX 85 characters and practical.
- final_cta_heading: MAX 65 characters.
- FAQ answers: concise and factual.

ICON KEYS:
Choose one icon_key for each benefit from ONLY:
"time", "classroom", "visual", "organize", "students", "ready", "quality", "protect", "content", "teaching".

Return exactly this shape:
{
  "hero_title": "...",
  "hero_subtitle": "...",
  "benefits": [
    {"text":"...","icon_key":"teaching"},
    {"text":"...","icon_key":"visual"},
    {"text":"...","icon_key":"students"},
    {"text":"...","icon_key":"time"}
  ],
  "contents_heading": "...",
  "faq": [
    {"question":"...","answer":"..."},
    {"question":"...","answer":"..."},
    {"question":"...","answer":"..."},
    {"question":"...","answer":"..."}
  ],
  "final_cta_heading": "...",
  "cta_text": "اطلب الآن"
}

PRODUCT_CONTEXT:\n${JSON.stringify(factualContext)}`;

  try {
    const messages = [
      { role: 'system', content: 'Return one syntactically valid customer-facing landing-page JSON object only. Never reveal hidden reasoning.' },
      { role: 'user', content: prompt },
    ];

    let result = await requestLandingJson({ apiKey, model, messages });
    if (!result.response.ok) {
      console.error('[AI_LANDING] OpenRouter error:', result.response.status, result.data);
      return res.status(502).json({ ok: false, error: result.data?.error?.message || 'AI provider request failed' });
    }
    if (!result.text) return res.status(502).json({ ok: false, error: 'AI returned an empty response' });

    let parsed = extractJsonObject(result.text);
    if (!parsed) {
      console.warn('[AI_LANDING] malformed JSON, attempting repair:', String(result.text).slice(0, 1200));
      const repairPrompt = `Repair the malformed response into ONE valid JSON object with the same schema and meaning. Do not add facts. JSON only.\n\nMALFORMED_RESPONSE:\n${String(result.text).slice(0, 5000)}`;
      result = await requestLandingJson({
        apiKey,
        model,
        maxTokens: 1500,
        messages: [
          { role: 'system', content: 'You are a JSON repair tool. Output one valid JSON object only.' },
          { role: 'user', content: repairPrompt },
        ],
      });
      if (result.response.ok && result.text) parsed = extractJsonObject(result.text);
    }

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      console.error('[AI_LANDING] invalid JSON after repair:', String(result.text).slice(0, 1200));
      return res.status(502).json({ ok: false, error: 'تعذر تنسيق المحتوى هذه المرة. أعد المحاولة.' });
    }

    return res.status(200).json({
      ok: true,
      data: normalizeGenerated(parsed, product),
      product: { id: product.id, name: product.name, category: product.category, level: product.level || null },
      model: result.data?.model || model,
    });
  } catch (e) {
    console.error('[AI_LANDING] unexpected error:', e);
    return res.status(500).json({ ok: false, error: e.message || 'Unexpected AI generator error' });
  }
}
