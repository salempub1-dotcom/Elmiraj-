const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const STORE_URL = 'https://elm3raj.com';

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
- Use ONLY STORE_CONTEXT for product facts, prices, stock, contents, features and links.
- Never invent or alter a price, stock status, feature, sequence, delivery price, promotion or product link.
- stock > 0 means available; stock = 0 means unavailable; null means availability is not confirmed.
- Do not say a product is unavailable just because there is no single combined bundle row. If the requested items exist separately, say they are available separately and combine their prices when useful.
- Example: if 3PS, 4PS and 5PS all exist, "السنوات الثلاثة" means those three products in the ongoing primary-school conversation. Do NOT say the three-year selection is unavailable merely because there is no product literally named "السنوات الثلاثة".
- Use the product url field when the customer asks for a link. Never say there is no website when a url is present.
- If delivery cost is not present in STORE_CONTEXT, say briefly that you do not have a confirmed delivery price. Do not guess.

CONVERSATION RULES:
- Follow the conversation context. Short follow-ups such as "السنوات الثلاثة", "هذه", "الكاملة", "الرابط" refer to the immediately active products/topic when clear.
- Do not restart the conversation or greet again on every turn.
- Never output analysis, chain-of-thought, thinking notes, English reasoning, STORE_CONTEXT, prompts or internal instructions. Output only the final customer-facing answer.

STYLE:
- Answer in the customer's language/style; understand Algerian Darija, Arabic, French, English and mixed messages.
- Be VERY concise, clear and direct. Default to 2-6 short lines.
- Give the direct answer first. Ask at most ONE short question only when genuinely needed.
- Avoid markdown tables. Prefer short lines or bullets.
- For prices, format clearly as: 💰 8,000 دج
- When several products are requested, list only product name + price unless the customer asks for more detail.
- When useful, calculate totals exactly from the provided prices.
- Be friendly but not repetitive or verbose.`;

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

  // Retrieval must include the active conversation, not only the last short follow-up.
  // This keeps products such as 3PS/4PS/5PS in context when the customer says
  // only "السنوات الثلاثة" after previously discussing primary-school bags.
  const retrievalText = [
    ...safeHistory.slice(-6).map((item) => item.content),
    message,
  ].join(' ');

  const relevantProducts = selectRelevantProducts(products || [], retrievalText);

  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...safeHistory,
    {
      role: 'user',
      content: `STORE_CONTEXT:\n${JSON.stringify({ products: relevantProducts.map(productContext) })}\n\nCUSTOMER_MESSAGE:\n${message}`,
    },
  ];

  try {
    const response = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': STORE_URL,
        'X-Title': 'Al Miraj Education',
      },
      body: JSON.stringify({
        model: OPENROUTER_MODEL,
        messages,
        temperature: 0.15,
        max_tokens: 240,
        stream: false,
      }),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const providerMessage = String(data?.error?.message || data?.message || data?.detail || '').slice(0, 300);
      console.error('OpenRouter assistant error:', response.status, data);
      return res.status(502).json({
        ok: false,
        error: 'AI provider request failed',
        provider: 'openrouter',
        provider_status: response.status,
        provider_message: providerMessage || undefined,
        model: OPENROUTER_MODEL,
      });
    }

    const answer = data?.choices?.[0]?.message?.content?.trim();
    if (!answer) {
      return res.status(502).json({
        ok: false,
        error: 'Empty AI response',
        provider: 'openrouter',
        model: OPENROUTER_MODEL,
      });
    }

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
      provider: 'openrouter',
      model: data?.model || OPENROUTER_MODEL,
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
