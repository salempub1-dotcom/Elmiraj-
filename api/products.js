import { createHmac } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { SITE_URL, SITE_NAME, FALLBACK_IMAGE, FALLBACK_TITLE, FALLBACK_DESC, toPreviewText, renderSocialPreviewHtml } from '../lib/socialPreviewHtml.js';
import { getAllowedSupabaseMediaPath, normalizeProductImagesForStorage, proxyProductImages, toMediaProxyUrl } from '../lib/mediaProxy.js';

export const config = { api: { bodyParser: { sizeLimit: '2mb' } } };

function verifyAdminToken(authHeader) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.substring(7);
  try {
    const decoded = Buffer.from(token, 'base64').toString();
    const c1 = decoded.indexOf(':');
    const c2 = decoded.indexOf(':', c1 + 1);
    if (c1 === -1 || c2 === -1) return null;
    const user = decoded.substring(0, c1);
    const ts = decoded.substring(c1 + 1, c2);
    const sig = decoded.substring(c2 + 1);
    const AU = process.env.ADMIN_USERNAME;
    const AP = process.env.ADMIN_PASSWORD;
    if (!AU || !AP || user !== AU) return null;
    const age = Date.now() - parseInt(ts);
    if (isNaN(age) || age > 86400000 || age < 0) return null;
    const expected = createHmac('sha256', AP).update(`${user}:${ts}`).digest('hex').substring(0, 16);
    if (sig !== expected) return null;
    return { username: user };
  } catch {
    return null;
  }
}

function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

function publicProducts(rows) {
  return (rows || []).map((product) => proxyProductImages(product));
}

function contentTypeForPath(path, blobType) {
  if (blobType && blobType !== 'application/octet-stream') return blobType;
  const lower = String(path || '').toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.gif')) return 'image/gif';
  if (lower.endsWith('.svg')) return 'image/svg+xml';
  return 'image/jpeg';
}

async function serveMediaProxy(req, res) {
  const source = typeof req.query?.src === 'string' ? req.query.src : '';
  const objectPath = source ? getAllowedSupabaseMediaPath(source) : null;
  if (!objectPath) {
    return res.status(400).json({ ok: false, error: 'INVALID_MEDIA_SOURCE' });
  }

  const supabase = getSupabase();
  if (!supabase) {
    return res.status(503).json({ ok: false, error: 'SUPABASE_NOT_CONFIGURED' });
  }

  try {
    const bucket = process.env.SUPABASE_BUCKET || 'product-images';
    const { data, error } = await supabase.storage.from(bucket).download(objectPath);
    if (error || !data) {
      console.error('[MEDIA_PROXY] storage download failed:', error?.message || 'no data');
      return res.status(error?.status || 404).end();
    }

    const body = Buffer.from(await data.arrayBuffer());
    const contentType = contentTypeForPath(objectPath, data.type);

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Length', String(body.length));
    res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=31536000, stale-while-revalidate=604800');
    res.setHeader('CDN-Cache-Control', 'public, max-age=31536000, immutable');
    res.setHeader('Vercel-CDN-Cache-Control', 'public, max-age=31536000, immutable');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    return res.status(200).send(body);
  } catch (error) {
    console.error('[MEDIA_PROXY] failed:', error?.message || error);
    return res.status(502).end();
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'GET' && req.query?.media === '1') {
    return serveMediaProxy(req, res);
  }

  const supabase = getSupabase();
  if (!supabase) {
    return res.status(200).json({
      ok: false,
      error: 'SUPABASE_NOT_CONFIGURED',
      message: 'أضف SUPABASE_URL و SUPABASE_SERVICE_ROLE_KEY في Vercel',
    });
  }

  if (req.method === 'GET' && req.query?.social_preview === '1') {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=86400, stale-while-revalidate=604800');
    const id = Number(req.query?.id);
    const url = `${SITE_URL}/lp/${req.query?.id ?? ''}`;

    if (!Number.isFinite(id)) {
      return res.status(200).send(renderSocialPreviewHtml({ title: FALLBACK_TITLE, description: FALLBACK_DESC, image: FALLBACK_IMAGE, url, type: 'website' }));
    }

    try {
      const { data: product } = await supabase
        .from('products')
        .select('id, name, description, price, images')
        .eq('id', id)
        .maybeSingle();

      if (!product) {
        res.status(404);
        return res.send(renderSocialPreviewHtml({ title: FALLBACK_TITLE, description: FALLBACK_DESC, image: FALLBACK_IMAGE, url, type: 'website' }));
      }

      const sourceImage = (Array.isArray(product.images) && product.images[0]) || FALLBACK_IMAGE;
      const image = toMediaProxyUrl(sourceImage, SITE_URL);
      return res.status(200).send(renderSocialPreviewHtml({
        title: `${product.name} | ${SITE_NAME}`,
        description: toPreviewText(product.description) || FALLBACK_DESC,
        image,
        url,
        type: 'product',
        priceAmount: product.price,
        priceCurrency: 'DZD',
      }));
    } catch {
      return res.status(200).send(renderSocialPreviewHtml({ title: FALLBACK_TITLE, description: FALLBACK_DESC, image: FALLBACK_IMAGE, url, type: 'website' }));
    }
  }

  if (req.method === 'GET') {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('id', { ascending: true });

      if (error) {
        console.error('[PRODUCTS] GET error:', error.message, error.code);
        const hint = error.code === '42P01'
          ? 'Table "products" does not exist. Run the SQL setup in Supabase Dashboard → SQL Editor.'
          : error.code === '42501'
            ? 'Permission denied. Check RLS policies.'
            : null;
        return res.status(200).json({ ok: false, error: error.message, code: error.code, hint });
      }

      res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=300, stale-while-revalidate=3600');
      return res.status(200).json({ ok: true, data: publicProducts(data) });
    } catch (e) {
      return res.status(200).json({ ok: false, error: e.message });
    }
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  if (!body || typeof body !== 'object') body = {};

  const action = body.action;

  if (action === 'seed') {
    const products = body.products;
    if (!Array.isArray(products) || products.length === 0) {
      return res.status(400).json({ ok: false, error: 'products array is required' });
    }

    try {
      const { count, error: countErr } = await supabase
        .from('products')
        .select('id', { count: 'exact', head: true });

      if (countErr) return res.status(200).json({ ok: false, error: countErr.message, code: countErr.code });
      if (count && count > 0) return res.status(200).json({ ok: true, message: 'already_seeded', count });

      const rows = products.map((p) => ({
        id: p.id,
        name: p.name,
        description: p.description || '',
        price: p.price,
        category: p.category,
        images: normalizeProductImagesForStorage(p.images || []),
        stock: p.stock || 0,
        sales: p.sales || 0,
        benefits: p.benefits || [],
        contents: p.contents || [],
        level: p.level || null,
        badge: p.badge || null,
      }));

      const { error } = await supabase.from('products').insert(rows);
      if (error) return res.status(200).json({ ok: false, error: error.message, code: error.code });
      return res.status(200).json({ ok: true, message: 'seeded', count: rows.length });
    } catch (e) {
      return res.status(200).json({ ok: false, error: e.message });
    }
  }

  const admin = verifyAdminToken(req.headers.authorization);
  if (!admin) return res.status(401).json({ ok: false, error: 'Admin authentication required' });

  if (action === 'save') {
    const p = body.product;
    if (!p || !p.id) return res.status(400).json({ ok: false, error: 'product with id is required' });

    try {
      const { error } = await supabase.from('products').upsert({
        id: p.id,
        name: p.name,
        description: p.description || '',
        price: p.price,
        category: p.category,
        images: normalizeProductImagesForStorage(p.images || []),
        stock: p.stock || 0,
        sales: p.sales || 0,
        benefits: p.benefits || [],
        contents: p.contents || [],
        level: p.level || null,
        badge: p.badge || null,
        updated_at: new Date().toISOString(),
      });

      if (error) return res.status(200).json({ ok: false, error: error.message });
      return res.status(200).json({ ok: true });
    } catch (e) {
      return res.status(200).json({ ok: false, error: e.message });
    }
  }

  if (action === 'delete') {
    const id = body.id;
    if (!id) return res.status(400).json({ ok: false, error: 'id is required' });
    try {
      const { error } = await supabase.from('products').delete().eq('id', id);
      if (error) return res.status(200).json({ ok: false, error: error.message });
      return res.status(200).json({ ok: true });
    } catch (e) {
      return res.status(200).json({ ok: false, error: e.message });
    }
  }

  return res.status(400).json({ ok: false, error: `Unknown action: ${action}` });
}
