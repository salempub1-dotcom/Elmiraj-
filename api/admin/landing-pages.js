// ============================================================
// Landing Pages — LIST + CREATE
// ============================================================
// GET:  List all landing pages (admin auth required)
// POST: Create a new landing page (admin auth required)
//
// Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ADMIN_USERNAME, ADMIN_PASSWORD
// ============================================================

import { createHmac } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

export const config = { api: { bodyParser: { sizeLimit: '1mb' } } };

// ── Auth helper (same pattern as products.js / orders.js) ───
function verifyAdminToken(authHeader) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.substring(7);
  try {
    const decoded = Buffer.from(token, 'base64').toString();
    const c1 = decoded.indexOf(':');
    const c2 = decoded.indexOf(':', c1 + 1);
    if (c1 === -1 || c2 === -1) return null;
    const user = decoded.substring(0, c1);
    const ts   = decoded.substring(c1 + 1, c2);
    const sig  = decoded.substring(c2 + 1);
    const AU = process.env.ADMIN_USERNAME;
    const AP = process.env.ADMIN_PASSWORD;
    if (!AU || !AP || user !== AU) return null;
    const age = Date.now() - parseInt(ts);
    if (isNaN(age) || age > 86400000 || age < 0) return null;
    const expected = createHmac('sha256', AP)
      .update(`${user}:${ts}`)
      .digest('hex')
      .substring(0, 16);
    if (sig !== expected) return null;
    return { username: user };
  } catch { return null; }
}

// ── Supabase helper ─────────────────────────────────────────
function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

// ── Validate required fields ────────────────────────────────
function validateLandingPage(body) {
  const errors = [];

  if (!body.title || typeof body.title !== 'string' || !body.title.trim()) {
    errors.push({ field: 'title', message: 'العنوان مطلوب' });
  }
  if (!body.slug || typeof body.slug !== 'string' || !body.slug.trim()) {
    errors.push({ field: 'slug', message: 'الـ slug مطلوب' });
  } else if (!/^[a-z0-9\u0600-\u06FF_-]+$/i.test(body.slug.trim())) {
    errors.push({ field: 'slug', message: 'الـ slug يجب أن يحتوي فقط على أحرف، أرقام، شرطات، أو أحرف عربية' });
  }

  return errors;
}

// ── Handler ─────────────────────────────────────────────────
export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // ── Auth required for all methods ─────────────────────────
  const admin = verifyAdminToken(req.headers.authorization);
  if (!admin) {
    return res.status(401).json({
      ok: false,
      error: 'AUTH_REQUIRED',
      message: 'يجب تسجيل الدخول كمسؤول',
    });
  }

  // ── Supabase ──────────────────────────────────────────────
  const supabase = getSupabase();
  if (!supabase) {
    return res.status(503).json({
      ok: false,
      error: 'SUPABASE_NOT_CONFIGURED',
      message: 'أضف SUPABASE_URL و SUPABASE_SERVICE_ROLE_KEY في Vercel',
    });
  }

  // ═════════════════════════════════════════════════════════
  // GET — List all landing pages
  // ═════════════════════════════════════════════════════════
  if (req.method === 'GET') {
    try {
      const { data, error } = await supabase
        .from('landing_pages')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('[LANDING_PAGES] GET error:', error.message, error.code);

        if (error.code === '42P01') {
          return res.status(200).json({
            ok: false,
            error: 'TABLE_NOT_FOUND',
            message: 'جدول landing_pages غير موجود. شغّل SQL الإنشاء في Supabase Dashboard.',
            hint: 'Visit /api/health for full SQL setup.',
          });
        }

        return res.status(200).json({
          ok: false,
          error: error.message,
          code: error.code,
        });
      }

      console.log(`[LANDING_PAGES] ✅ Fetched ${(data || []).length} landing pages`);
      return res.status(200).json({
        ok: true,
        data: data || [],
        count: (data || []).length,
      });
    } catch (e) {
      console.error('[LANDING_PAGES] GET exception:', e.message);
      return res.status(500).json({
        ok: false,
        error: 'INTERNAL_ERROR',
        message: e.message,
      });
    }
  }

  // ═════════════════════════════════════════════════════════
  // POST — Create a new landing page
  // ═════════════════════════════════════════════════════════
  if (req.method === 'POST') {
    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch { body = {}; }
    }
    if (!body || typeof body !== 'object') body = {};

    // ── Validation ────────────────────────────────────────
    const errors = validateLandingPage(body);
    if (errors.length > 0) {
      return res.status(400).json({
        ok: false,
        error: 'VALIDATION_FAILED',
        message: 'بيانات غير صالحة',
        errors,
      });
    }

    // ── Check slug uniqueness ─────────────────────────────
    const slug = body.slug.trim().toLowerCase();
    try {
      const { data: existing } = await supabase
        .from('landing_pages')
        .select('id')
        .eq('slug', slug)
        .maybeSingle();

      if (existing) {
        return res.status(409).json({
          ok: false,
          error: 'SLUG_EXISTS',
          message: `الـ slug "${slug}" مستخدم بالفعل. اختر slug مختلف.`,
        });
      }
    } catch (e) {
      // slug check failed — table might not exist
      if (e.message && e.message.includes('42P01')) {
        return res.status(200).json({
          ok: false,
          error: 'TABLE_NOT_FOUND',
          message: 'جدول landing_pages غير موجود.',
        });
      }
    }

    // ── Insert ────────────────────────────────────────────
    const row = {
      title:       (body.title || '').trim(),
      slug:        slug,
      product_id:  body.product_id ? Number(body.product_id) : null,
      headline:    (body.headline || '').trim() || null,
      description: (body.description || '').trim() || null,
      image_url:   (body.image_url || '').trim() || null,
      cta_text:    (body.cta_text || '').trim() || null,
      cta_url:     (body.cta_url || '').trim() || null,
      is_active:   body.is_active !== undefined ? Boolean(body.is_active) : true,
    };

    try {
      const { data, error } = await supabase
        .from('landing_pages')
        .insert(row)
        .select()
        .single();

      if (error) {
        console.error('[LANDING_PAGES] INSERT error:', error.message, error.code);

        if (error.code === '23505') {
          return res.status(409).json({
            ok: false,
            error: 'SLUG_EXISTS',
            message: `الـ slug "${slug}" مستخدم بالفعل.`,
          });
        }
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

      console.log(`[LANDING_PAGES] ✅ Created: "${row.title}" (slug=${slug}, id=${data.id})`);
      return res.status(201).json({
        ok: true,
        data,
        message: 'تم إنشاء صفحة الهبوط بنجاح',
      });
    } catch (e) {
      console.error('[LANDING_PAGES] INSERT exception:', e.message);
      return res.status(500).json({
        ok: false,
        error: 'INTERNAL_ERROR',
        message: e.message,
      });
    }
  }

  // ── Unsupported method ────────────────────────────────────
  return res.status(405).json({
    ok: false,
    error: 'METHOD_NOT_ALLOWED',
    message: `الطريقة ${req.method} غير مدعومة. استخدم GET أو POST.`,
  });
}
