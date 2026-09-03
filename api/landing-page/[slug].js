import { createClient } from '@supabase/supabase-js';
import { SITE_URL, SITE_NAME, FALLBACK_IMAGE, FALLBACK_TITLE, FALLBACK_DESC, toPreviewText, renderSocialPreviewHtml } from '../../lib/socialPreviewHtml.js';
import { proxyProductImages, toMediaProxyUrl } from '../../lib/mediaProxy.js';

export const config = { api: { bodyParser: false } };

function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

function extractSlug(req) {
  if (req.query && req.query.slug) return req.query.slug;
  const url = req.url || '';
  const match = url.match(/\/landing-page\/([^/?]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') {
    return res.status(405).json({ ok: false, error: 'METHOD_NOT_ALLOWED', message: 'فقط GET مدعوم.' });
  }

  const supabase = getSupabase();
  if (!supabase) return res.status(503).json({ ok: false, error: 'SUPABASE_NOT_CONFIGURED' });

  const slug = extractSlug(req);

  if (req.query?.social_preview === '1') {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=86400, stale-while-revalidate=604800');
    const url = `${SITE_URL}/l/${slug || ''}`;

    if (!slug) {
      return res.status(200).send(renderSocialPreviewHtml({ title: FALLBACK_TITLE, description: FALLBACK_DESC, image: FALLBACK_IMAGE, url, type: 'website' }));
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
        return res.send(renderSocialPreviewHtml({ title: FALLBACK_TITLE, description: FALLBACK_DESC, image: FALLBACK_IMAGE, url, type: 'website' }));
      }

      let productImage = null;
      if (!page.image_url && page.product_id) {
        const { data: prod } = await supabase.from('products').select('images').eq('id', page.product_id).maybeSingle();
        productImage = (prod && Array.isArray(prod.images) && prod.images[0]) || null;
      }

      const title = page.headline || page.title || FALLBACK_TITLE;
      const sourceImage = page.image_url || productImage || FALLBACK_IMAGE;
      const image = toMediaProxyUrl(sourceImage, SITE_URL);
      return res.status(200).send(renderSocialPreviewHtml({
        title: `${title} | ${SITE_NAME}`,
        description: toPreviewText(page.description || page.headline || page.title) || FALLBACK_DESC,
        image,
        url,
        type: 'website',
      }));
    } catch {
      return res.status(200).send(renderSocialPreviewHtml({ title: FALLBACK_TITLE, description: FALLBACK_DESC, image: FALLBACK_IMAGE, url, type: 'website' }));
    }
  }

  if (!slug) {
    return res.status(400).json({ ok: false, error: 'MISSING_SLUG', message: 'slug مطلوب في المسار: /api/landing-page/:slug' });
  }

  try {
    const { data: page, error } = await supabase
      .from('landing_pages')
      .select('*')
      .eq('slug', slug.toLowerCase())
      .eq('is_active', true)
      .maybeSingle();

    if (error) {
      if (error.code === '42P01') {
        return res.status(200).json({ ok: false, error: 'TABLE_NOT_FOUND', message: 'جدول landing_pages غير موجود.' });
      }
      return res.status(200).json({ ok: false, error: error.message, code: error.code });
    }

    if (!page) {
      return res.status(404).json({ ok: false, error: 'NOT_FOUND', message: `صفحة الهبوط "${slug}" غير موجودة أو غير نشطة.` });
    }

    let product = null;
    if (page.product_id) {
      const { data: prod, error: prodErr } = await supabase
        .from('products')
        .select('*')
        .eq('id', page.product_id)
        .maybeSingle();
      if (!prodErr && prod) product = proxyProductImages(prod);
    }

    // Landing data changes infrequently; edge caching removes repeated DB reads.
    res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=300, stale-while-revalidate=3600');
    return res.status(200).json({
      ok: true,
      data: {
        ...page,
        image_url: page.image_url ? toMediaProxyUrl(page.image_url) : page.image_url,
        product,
      },
    });
  } catch (e) {
    return res.status(500).json({ ok: false, error: 'INTERNAL_ERROR', message: e.message });
  }
}
