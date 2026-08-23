// ============================================================
// Social Preview (bot-only server-rendered HTML) — Vercel Serverless Function
// ============================================================
// WHY THIS FILE EXISTS: Al Miraj Education is a fully client-side SPA
// (Vite/React, `vite-plugin-singlefile`, one static index.html served for
// every non-API route via vercel.json's catch-all rewrite). Facebook,
// Messenger, WhatsApp, and Telegram's link-preview crawlers do NOT
// execute JavaScript — they read the RAW HTML response only. So a
// product page at /lp/:id or a landing page at /l/:slug, which both set
// their <meta> tags via React after mount (see ProductLanding.tsx /
// DynamicLanding.tsx's setSEO()), would always show the generic
// homepage preview to those crawlers, never the actual product.
//
// This endpoint is ONLY ever reached for known social-crawler
// User-Agents — see the `has` user-agent condition on the /lp/:id and
// /l/:slug rewrites in vercel.json. Real visitors (any normal browser)
// never hit this file; they get the full SPA exactly as before. This is
// intentionally the lightest possible fix — no prerendering service, no
// new framework, no new dependency — it reuses the exact same Supabase
// tables/columns the existing public `/api/products` and
// `/api/landing-page/:slug` endpoints already expose.
//
// GET /api/social-preview?type=product&id=123
// GET /api/social-preview?type=landing&slug=some-slug
//
// Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
// ============================================================

import { createClient } from '@supabase/supabase-js';

export const config = { api: { bodyParser: false } };

const SITE_URL = 'https://elm3raj.com';
const SITE_NAME = 'Al Miraj Education';
const FALLBACK_IMAGE = `${SITE_URL}/og-image.jpg`;
const FALLBACK_TITLE = 'المعراج للوسائل التعليمية | Al Miraj Education';
const FALLBACK_DESC = 'وسائل تعليمية وموارد احترافية تساعد الأستاذ على تحضير دروسه وتقديم حصص أكثر تنظيماً وتفاعلاً.';

function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

/** Minimal, dependency-free HTML-attribute escaping — this is the only place we build HTML by hand. */
function esc(v) {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Collapse whitespace/newlines/emoji-heavy product descriptions into one clean line, capped for a preview card. */
function toPreviewText(raw, maxLen = 200) {
  const clean = String(raw || '').replace(/\s+/g, ' ').trim();
  if (clean.length <= maxLen) return clean;
  return clean.slice(0, maxLen - 1).trimEnd() + '…';
}

function renderHtml({ title, description, image, url, type, priceAmount, priceCurrency }) {
  const productTags = type === 'product' && priceAmount != null
    ? `\n<meta property="product:price:amount" content="${esc(priceAmount)}" />\n<meta property="product:price:currency" content="${esc(priceCurrency || 'DZD')}" />\n<meta property="product:availability" content="in stock" />\n<meta property="product:condition" content="new" />`
    : '';

  return `<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8" />
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}" />
<link rel="canonical" href="${esc(url)}" />
<meta property="og:type" content="${type === 'product' ? 'product' : 'website'}" />
<meta property="og:title" content="${esc(title)}" />
<meta property="og:description" content="${esc(description)}" />
<meta property="og:url" content="${esc(url)}" />
<meta property="og:image" content="${esc(image)}" />
<meta property="og:site_name" content="${esc(SITE_NAME)}" />
<meta property="og:locale" content="ar_DZ" />${productTags}
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${esc(title)}" />
<meta name="twitter:description" content="${esc(description)}" />
<meta name="twitter:image" content="${esc(image)}" />
</head>
<body>
<p><a href="${esc(url)}">${esc(title)}</a></p>
</body>
</html>
`;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // Short public cache — social crawlers hit this once per share/re-scrape,
  // not per pageview (real visitors never reach this route at all).
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=3600');

  const type = String(req.query?.type || '');
  const supabase = getSupabase();

  // ── PRODUCT: /lp/:id ─────────────────────────────────────────
  if (type === 'product') {
    const id = Number(req.query?.id);
    const url = `${SITE_URL}/lp/${req.query?.id ?? ''}`;

    if (!supabase || !Number.isFinite(id)) {
      return res.status(200).send(renderHtml({ title: FALLBACK_TITLE, description: FALLBACK_DESC, image: FALLBACK_IMAGE, url, type: 'website' }));
    }

    try {
      const { data: product } = await supabase
        .from('products')
        .select('id, name, description, price, images')
        .eq('id', id)
        .maybeSingle();

      if (!product) {
        res.status(404);
        return res.send(renderHtml({ title: FALLBACK_TITLE, description: FALLBACK_DESC, image: FALLBACK_IMAGE, url, type: 'website' }));
      }

      const image = (Array.isArray(product.images) && product.images[0]) || FALLBACK_IMAGE;
      return res.status(200).send(renderHtml({
        title: `${product.name} | ${SITE_NAME}`,
        description: toPreviewText(product.description) || FALLBACK_DESC,
        image,
        url,
        type: 'product',
        priceAmount: product.price,
        priceCurrency: 'DZD',
      }));
    } catch {
      return res.status(200).send(renderHtml({ title: FALLBACK_TITLE, description: FALLBACK_DESC, image: FALLBACK_IMAGE, url, type: 'website' }));
    }
  }

  // ── LANDING PAGE: /l/:slug ───────────────────────────────────
  if (type === 'landing') {
    const slug = String(req.query?.slug || '').trim();
    const url = `${SITE_URL}/l/${slug}`;

    if (!supabase || !slug) {
      return res.status(200).send(renderHtml({ title: FALLBACK_TITLE, description: FALLBACK_DESC, image: FALLBACK_IMAGE, url, type: 'website' }));
    }

    try {
      const { data: page } = await supabase
        .from('landing_pages')
        .select('title, headline, description, image_url, product_id, is_active')
        .eq('slug', slug.toLowerCase())
        .eq('is_active', true)
        .maybeSingle();

      if (!page) {
        res.status(404);
        return res.send(renderHtml({ title: FALLBACK_TITLE, description: FALLBACK_DESC, image: FALLBACK_IMAGE, url, type: 'website' }));
      }

      let productImage = null;
      if (!page.image_url && page.product_id) {
        const { data: prod } = await supabase.from('products').select('images').eq('id', page.product_id).maybeSingle();
        productImage = (prod && Array.isArray(prod.images) && prod.images[0]) || null;
      }

      const title = page.headline || page.title || FALLBACK_TITLE;
      return res.status(200).send(renderHtml({
        title: `${title} | ${SITE_NAME}`,
        description: toPreviewText(page.description || page.headline || page.title) || FALLBACK_DESC,
        image: page.image_url || productImage || FALLBACK_IMAGE,
        url,
        type: 'website',
      }));
    } catch {
      return res.status(200).send(renderHtml({ title: FALLBACK_TITLE, description: FALLBACK_DESC, image: FALLBACK_IMAGE, url, type: 'website' }));
    }
  }

  // Unknown/missing type — generic site card, never a hard error for a crawler.
  return res.status(200).send(renderHtml({ title: FALLBACK_TITLE, description: FALLBACK_DESC, image: FALLBACK_IMAGE, url: `${SITE_URL}/`, type: 'website' }));
}
