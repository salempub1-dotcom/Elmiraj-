const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

function cleanJsonText(value = '') {
  return String(value)
    .replace(/^\uFEFF/, '')
    .replace(/```json\s*/gi, '')
    .replace(/```\s*/g, '')
    .trim();
}

function extractJsonObject(value = '') {
  const cleaned = cleanJsonText(value);

  // Fast path: provider returned perfect JSON.
  try { return JSON.parse(cleaned); } catch { /* continue */ }

  // Some free models prepend/append a short sentence around the JSON object.
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
  return String(value || '').trim().slice(0, max);
}

function normalizeGenerated(raw, product) {
  const benefits = Array.isArray(raw?.benefits)
    ? raw.benefits.map((x) => clampString(x, 120)).filter(Boolean).slice(0, 4)
    : [];
  const faq = Array.isArray(raw?.faq)
    ? raw.faq
        .map((item) => ({
          question: clampString(item?.question, 140),
          answer: clampString(item?.answer, 260),
        }))
        .filter((item) => item.question && item.answer)
        .slice(0, 4)
    : [];

  return {
    hero_title: clampString(raw?.hero_title || product.name, 110),
    hero_subtitle: clampString(raw?.hero_subtitle, 220),
    benefits,
    contents_heading: clampString(raw?.contents_heading || 'ماذا ستجد داخل المنتج؟', 90),
    faq,
    final_cta_heading: clampString(raw?.final_cta_heading || `احصل على ${product.name} الآن`, 120),
    cta_text: clampString(raw?.cta_text || 'اطلب الآن', 40),
  };
}

async function requestLandingJson({ apiKey, model, messages, maxTokens = 1300 }) {
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

  const prompt = `You write conversion-focused Arabic landing-page copy for Al Miraj Education in Algeria.
Return ONLY one valid JSON object. Do not use markdown fences and do not write any text before or after the JSON.

STRICT RULES:
- Use only PRODUCT_CONTEXT facts.
- Never invent quantity, price, stock, delivery price, promotion, reviews, sales counts, guarantees, PDFs, certifications or included items.
- Do not repeat the exact product description verbatim; improve clarity while preserving facts.
- Audience: Algerian teachers.
- Arabic should be clear, professional, concise and natural.
- Benefits must be practical and grounded in the supplied description/benefits/contents.
- FAQ answers must not make claims not present in PRODUCT_CONTEXT.
- The checkout system displays price and shipping separately; do not include prices in generated text.
- Every string must be valid JSON with double quotes and escaped characters when needed.

Return this exact JSON shape:
{
  "hero_title": "...",
  "hero_subtitle": "...",
  "benefits": ["...", "...", "...", "..."],
  "contents_heading": "...",
  "faq": [
    {"question":"...","answer":"..."},
    {"question":"...","answer":"..."},
    {"question":"...","answer":"..."},
    {"question":"...","answer":"..."}
  ],
  "final_cta_heading": "...",
  "cta_text": "..."
}

PRODUCT_CONTEXT:\n${JSON.stringify(factualContext)}`;

  try {
    const messages = [
      { role: 'system', content: 'Return only a syntactically valid JSON object for customer-facing landing-page copy. Never reveal hidden reasoning.' },
      { role: 'user', content: prompt },
    ];

    let result = await requestLandingJson({ apiKey, model, messages });
    if (!result.response.ok) {
      console.error('[AI_LANDING] OpenRouter error:', result.response.status, result.data);
      return res.status(502).json({ ok: false, error: result.data?.error?.message || 'AI provider request failed' });
    }

    if (!result.text) return res.status(502).json({ ok: false, error: 'AI returned an empty response' });

    let parsed = extractJsonObject(result.text);

    // Free models occasionally ignore JSON mode or truncate punctuation. Give the
    // provider one cheap repair attempt instead of surfacing a technical error to admin.
    if (!parsed) {
      console.warn('[AI_LANDING] malformed JSON, attempting repair:', String(result.text).slice(0, 1200));
      const repairPrompt = `Convert the following malformed response into ONE syntactically valid JSON object matching the requested schema. Preserve the Arabic meaning. Do not add facts. Return JSON only.\n\nMALFORMED_RESPONSE:\n${String(result.text).slice(0, 5000)}`;
      result = await requestLandingJson({
        apiKey,
        model,
        maxTokens: 1400,
        messages: [
          { role: 'system', content: 'You are a JSON repair tool. Output one valid JSON object only, with no markdown or explanation.' },
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
