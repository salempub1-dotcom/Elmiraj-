const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

function cleanJsonText(value = '') {
  return String(value)
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```$/i, '')
    .trim();
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
Return ONLY valid JSON, no markdown.

STRICT RULES:
- Use only PRODUCT_CONTEXT facts.
- Never invent quantity, price, stock, delivery price, promotion, reviews, sales counts, guarantees, PDFs, certifications or included items.
- Do not repeat the exact product description verbatim; improve clarity while preserving facts.
- Audience: Algerian teachers.
- Arabic should be clear, professional, concise and natural.
- Benefits must be practical and grounded in the supplied description/benefits/contents.
- FAQ answers must not make claims not present in PRODUCT_CONTEXT.
- The checkout system displays price and shipping separately; do not include prices in generated text.

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
        temperature: 0.25,
        max_tokens: 900,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: 'Return only customer-facing landing-page JSON. Never reveal hidden reasoning.' },
          { role: 'user', content: prompt },
        ],
      }),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      console.error('[AI_LANDING] OpenRouter error:', response.status, data);
      return res.status(502).json({ ok: false, error: data?.error?.message || 'AI provider request failed' });
    }

    const text = data?.choices?.[0]?.message?.content;
    if (!text) return res.status(502).json({ ok: false, error: 'AI returned an empty response' });

    let parsed;
    try {
      parsed = JSON.parse(cleanJsonText(text));
    } catch {
      console.error('[AI_LANDING] invalid JSON:', String(text).slice(0, 1000));
      return res.status(502).json({ ok: false, error: 'AI returned invalid JSON' });
    }

    return res.status(200).json({
      ok: true,
      data: normalizeGenerated(parsed, product),
      product: { id: product.id, name: product.name, category: product.category, level: product.level || null },
      model: data?.model || model,
    });
  } catch (e) {
    console.error('[AI_LANDING] unexpected error:', e);
    return res.status(500).json({ ok: false, error: e.message || 'Unexpected AI generator error' });
  }
}
