// ============================================================
// Public Landing Page — GET by slug
// ============================================================
// GET /api/landing-page/:slug — returns active landing page + linked product
// No auth required (public route for visitors)
//
// Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
// ============================================================

import { createClient } from '@supabase/supabase-js';

export const config = { api: { bodyParser: false } };

function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
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
    return res.status(405).json({
      ok: false,
      error: 'METHOD_NOT_ALLOWED',
      message: 'فقط GET مدعوم.',
    });
  }

  const supabase = getSupabase();
  if (!supabase) {
    return res.status(503).json({
      ok: false,
      error: 'SUPABASE_NOT_CONFIGURED',
    });
  }

  const slug = extractSlug(req);
  if (!slug) {
    return res.status(400).json({
      ok: false,
      error: 'MISSING_SLUG',
      message: 'slug مطلوب في المسار: /api/landing-page/:slug',
    });
  }

  try {
    // ── Fetch landing page by slug (only active ones) ─────
    const { data: page, error } = await supabase
      .from('landing_pages')
      .select('*')
      .eq('slug', slug.toLowerCase())
      .eq('is_active', true)
      .maybeSingle();

    if (error) {
      console.error(`[LANDING_PAGE] GET slug="${slug}" error:`, error.message);

      if (error.code === '42P01') {
        return res.status(200).json({
          ok: false,
          error: 'TABLE_NOT_FOUND',
          message: 'جدول landing_pages غير موجود.',
        });
      }

      return res.status(200).json({
        ok: false,
        error: error.message,
        code: error.code,
      });
    }

    if (!page) {
      return res.status(404).json({
        ok: false,
        error: 'NOT_FOUND',
        message: `صفحة الهبوط "${slug}" غير موجودة أو غير نشطة.`,
      });
    }

    // ── If linked to a product, fetch product data too ────
    let product = null;
    if (page.product_id) {
      const { data: prod, error: prodErr } = await supabase
        .from('products')
        .select('*')
        .eq('id', page.product_id)
        .maybeSingle();

      if (!prodErr && prod) {
        product = prod;
      }
    }

    console.log(`[LANDING_PAGE] ✅ Served: slug="${slug}" (id=${page.id})`);
    return res.status(200).json({
      ok: true,
      data: {
        ...page,
        product,
      },
    });
  } catch (e) {
    console.error(`[LANDING_PAGE] Exception:`, e.message);
    return res.status(500).json({
      ok: false,
      error: 'INTERNAL_ERROR',
      message: e.message,
    });
  }
}
