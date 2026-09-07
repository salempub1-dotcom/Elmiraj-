const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

const ALLOWED_ICON_KEYS = new Set([
  'time', 'classroom', 'visual', 'organize', 'students', 'ready', 'quality', 'protect', 'content', 'teaching', 'check', 'idea',
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
  return shortAtWord(title, 56);
}

function iconKey(value, fallback) {
  const candidate = clampString(value, 30).toLowerCase();
  return ALLOWED_ICON_KEYS.has(candidate) ? candidate : fallback;
}

function normalizeBenefit(item, index) {
  if (typeof item === 'string') {
    return { text: clampString(item, 106), icon_key: ['teaching', 'visual', 'students', 'time'][index % 4] };
  }
  return {
    text: clampString(item?.text || item?.label || item?.benefit, 106),
    icon_key: iconKey(item?.icon_key, ['teaching', 'visual', 'students', 'time'][index % 4]),
  };
}

function normalizeStep(item, index) {
  return {
    title: shortAtWord(item?.title || `الخطوة ${index + 1}`, 42),
    text: clampString(item?.text || item?.description, 150),
    icon_key: iconKey(item?.icon_key, ['content', 'teaching', 'students'][index % 3]),
  };
}

function normalizeGenerated(raw, product) {
  const benefits = Array.isArray(raw?.benefits)
    ? raw.benefits.map(normalizeBenefit).filter((x) => x.text).slice(0, 4)
    : [];

  const useSteps = Array.isArray(raw?.use_steps)
    ? raw.use_steps.map(normalizeStep).filter((x) => x.title && x.text).slice(0, 3)
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
    hero_subtitle: clampString(raw?.hero_subtitle, 140),
    problem_heading: shortAtWord(raw?.problem_heading || 'هل يأخذ التحضير منك وقتًا كبيرًا؟', 74),
    problem_text: clampString(raw?.problem_text, 210),
    outcome_heading: shortAtWord(raw?.outcome_heading || 'اجعل تقديم المحتوى أوضح وأسهل', 74),
    outcome_text: clampString(raw?.outcome_text, 190),
    benefits,
    contents_heading: clampString(raw?.contents_heading || 'ماذا ستجد داخل المنتج؟', 72),
    use_heading: shortAtWord(raw?.use_heading || 'كيف تستعمله داخل القسم؟', 72),
    use_steps: useSteps,
    faq,
    final_cta_heading: shortAtWord(raw?.final_cta_heading || `احصل على ${product.name} الآن`, 76),
    cta_text: clampString(raw?.cta_text || 'اطلب الآن', 28),
  };
}

async function requestLandingJson({ apiKey, model, messages, maxTokens = 1900 }) {
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
      temperature: 0.2,
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

  const prompt = `You create conversion-focused Arabic landing-page copy for Al Miraj Education in Algeria.
The structure is inspired by strong direct-response landing pages: problem -> desired outcome -> solution benefits -> product contents -> classroom use -> FAQ -> CTA.
Return ONLY one valid JSON object. No markdown and no text before or after JSON.

STRICT FACT RULES:
- Use only PRODUCT_CONTEXT facts.
- Never invent quantities, price, stock, delivery price, discounts, reviews, sales numbers, guarantees, return policies, PDFs, certifications, results, or included items.
- Never claim "best seller", "guaranteed", "instant result", percentages, ratings, or customer testimonials.
- Do not mention a feature unless supported by PRODUCT_CONTEXT.
- Price, stock, images, payment and shipping are rendered by the store, not by AI.
- The problem section must describe a realistic teacher workflow difficulty, not a dramatic or manipulative fear claim.
- The outcome section must describe a practical classroom benefit, not a guaranteed result.

COPY RULES:
- Audience: Algerian teachers.
- Professional, warm, persuasive, concise Arabic.
- hero_title: MAX 45 characters. Prefer the real product name or a short clean version. Never append the store name.
- hero_subtitle: one short sentence, MAX 120 characters.
- problem_heading: a short question or observation, MAX 60 characters.
- problem_text: 1-2 short sentences.
- outcome_heading: MAX 60 characters.
- outcome_text: 1 short sentence.
- Each benefit: MAX 85 characters and practical.
- use_steps: exactly 3 practical steps grounded in the product context.
- FAQ answers: concise and factual.
- final_cta_heading: MAX 65 characters.

ICON KEYS:
Choose only from: "time", "classroom", "visual", "organize", "students", "ready", "quality", "protect", "content", "teaching", "check", "idea".

Return exactly this shape:
{
  "hero_title":"...",
  "hero_subtitle":"...",
  "problem_heading":"...",
  "problem_text":"...",
  "outcome_heading":"...",
  "outcome_text":"...",
  "benefits":[
    {"text":"...","icon_key":"time"},
    {"text":"...","icon_key":"visual"},
    {"text":"...","icon_key":"classroom"},
    {"text":"...","icon_key":"organize"}
  ],
  "contents_heading":"...",
  "use_heading":"...",
  "use_steps":[
    {"title":"...","text":"...","icon_key":"content"},
    {"title":"...","text":"...","icon_key":"teaching"},
    {"title":"...","text":"...","icon_key":"students"}
  ],
  "faq":[
    {"question":"...","answer":"..."},
    {"question":"...","answer":"..."},
    {"question":"...","answer":"..."},
    {"question":"...","answer":"..."}
  ],
  "final_cta_heading":"...",
  "cta_text":"اطلب الآن"
}

PRODUCT_CONTEXT:\n${JSON.stringify(factualContext)}`;

  try {
    const messages = [
      { role: 'system', content: 'Return one valid customer-facing landing-page JSON object only. Never reveal hidden reasoning and never invent commercial facts.' },
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
      console.warn('[AI_LANDING] malformed JSON, attempting repair:', String(result.text).slice(0, 1400));
      const repairPrompt = `Repair the malformed response into ONE valid JSON object with the same schema and meaning. Do not add facts. JSON only.\n\nMALFORMED_RESPONSE:\n${String(result.text).slice(0, 6500)}`;
      result = await requestLandingJson({
        apiKey,
        model,
        maxTokens: 2000,
        messages: [
          { role: 'system', content: 'You are a JSON repair tool. Output one valid JSON object only.' },
          { role: 'user', content: repairPrompt },
        ],
      });
      if (result.response.ok && result.text) parsed = extractJsonObject(result.text);
    }

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      console.error('[AI_LANDING] invalid JSON after repair:', String(result.text).slice(0, 1400));
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
