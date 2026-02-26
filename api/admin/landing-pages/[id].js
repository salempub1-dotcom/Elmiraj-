// ============================================================
// Landing Pages — UPDATE + DELETE (by ID)
// ============================================================
// PUT:    Update a landing page
// DELETE: Delete a landing page
//
// Route: /api/admin/landing-pages/:id
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

// ── Extract ID from URL ─────────────────────────────────────
function extractId(req) {
  // Vercel dynamic routes: req.query.id
  if (req.query && req.query.id) return req.query.id;

  // Fallback: parse from URL path
  const url = req.url || '';
  const match = url.match(/\/landing-pages\/([^/?]+)/);
  return match ? match[1] : null;
}

// ── UUID validation ─────────────────────────────────────────
function isValidUUID(str) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
}

// ── Handler ─────────────────────────────────────────────────
export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // ── Auth required ─────────────────────────────────────────
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

  // ── Extract and validate ID ───────────────────────────────
  const id = extractId(req);
  if (!id) {
    return res.status(400).json({
      ok: false,
      error: 'MISSING_ID',
      message: 'معرّف صفحة الهبوط مطلوب في المسار: /api/admin/landing-pages/:id',
    });
  }
  if (!isValidUUID(id)) {
    return res.status(400).json({
      ok: false,
      error: 'INVALID_ID',
      message: `المعرّف "${id}" ليس UUID صالح.`,
    });
  }

  // ═════════════════════════════════════════════════════════
  // GET — Fetch single landing page by ID
  // ═════════════════════════════════════════════════════════
  if (req.method === 'GET') {
    try {
      const { data, error } = await supabase
        .from('landing_pages')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (error) {
        console.error(`[LANDING_PAGES] GET ${id} error:`, error.message);
        return res.status(200).json({
          ok: false,
          error: error.message,
          code: error.code,
        });
      }

      if (!data) {
        return res.status(404).json({
          ok: false,
          error: 'NOT_FOUND',
          message: `صفحة الهبوط بالمعرّف "${id}" غير موجودة.`,
        });
      }

      return res.status(200).json({ ok: true, data });
    } catch (e) {
      return res.status(500).json({
        ok: false,
        error: 'INTERNAL_ERROR',
        message: e.message,
      });
    }
  }

  // ═════════════════════════════════════════════════════════
  // PUT — Update a landing page
  // ═════════════════════════════════════════════════════════
  if (req.method === 'PUT') {
    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch { body = {}; }
    }
    if (!body || typeof body !== 'object') body = {};

    // ── Check landing page exists ─────────────────────────
    try {
      const { data: existing, error: findErr } = await supabase
        .from('landing_pages')
        .select('id, slug')
        .eq('id', id)
        .maybeSingle();

      if (findErr) {
        console.error(`[LANDING_PAGES] Find ${id} error:`, findErr.message);
        if (findErr.code === '42P01') {
          return res.status(200).json({
            ok: false,
            error: 'TABLE_NOT_FOUND',
            message: 'جدول landing_pages غير موجود.',
          });
        }
        return res.status(200).json({ ok: false, error: findErr.message, code: findErr.code });
      }

      if (!existing) {
        return res.status(404).json({
          ok: false,
          error: 'NOT_FOUND',
          message: `صفحة الهبوط بالمعرّف "${id}" غير موجودة.`,
        });
      }

      // ── If slug is being changed, check uniqueness ──────
      if (body.slug && body.slug.trim().toLowerCase() !== existing.slug) {
        const newSlug = body.slug.trim().toLowerCase();
        const { data: slugTaken } = await supabase
          .from('landing_pages')
          .select('id')
          .eq('slug', newSlug)
          .neq('id', id)
          .maybeSingle();

        if (slugTaken) {
          return res.status(409).json({
            ok: false,
            error: 'SLUG_EXISTS',
            message: `الـ slug "${newSlug}" مستخدم بالفعل في صفحة هبوط أخرى.`,
          });
        }
      }
    } catch (e) {
      console.error(`[LANDING_PAGES] Pre-update check failed:`, e.message);
      return res.status(500).json({ ok: false, error: 'INTERNAL_ERROR', message: e.message });
    }

    // ── Build update object (only provided fields) ────────
    const updates = { updated_at: new Date().toISOString() };

    if (body.title !== undefined)       updates.title       = String(body.title).trim();
    if (body.slug !== undefined)        updates.slug        = String(body.slug).trim().toLowerCase();
    if (body.product_id !== undefined)  updates.product_id  = body.product_id ? Number(body.product_id) : null;
    if (body.headline !== undefined)    updates.headline    = String(body.headline).trim() || null;
    if (body.description !== undefined) updates.description = String(body.description).trim() || null;
    if (body.image_url !== undefined)   updates.image_url   = String(body.image_url).trim() || null;
    if (body.cta_text !== undefined)    updates.cta_text    = String(body.cta_text).trim() || null;
    if (body.cta_url !== undefined)     updates.cta_url     = String(body.cta_url).trim() || null;
    if (body.is_active !== undefined)   updates.is_active   = Boolean(body.is_active);

    // ── Validate title if provided ────────────────────────
    if (updates.title !== undefined && !updates.title) {
      return res.status(400).json({
        ok: false,
        error: 'VALIDATION_FAILED',
        message: 'العنوان لا يمكن أن يكون فارغاً.',
        errors: [{ field: 'title', message: 'العنوان مطلوب' }],
      });
    }
    // ── Validate slug if provided ─────────────────────────
    if (updates.slug !== undefined) {
      if (!updates.slug) {
        return res.status(400).json({
          ok: false,
          error: 'VALIDATION_FAILED',
          message: 'الـ slug لا يمكن أن يكون فارغاً.',
          errors: [{ field: 'slug', message: 'الـ slug مطلوب' }],
        });
      }
      if (!/^[a-z0-9\u0600-\u06FF_-]+$/i.test(updates.slug)) {
        return res.status(400).json({
          ok: false,
          error: 'VALIDATION_FAILED',
          message: 'الـ slug يحتوي على أحرف غير مسموحة.',
          errors: [{ field: 'slug', message: 'أحرف، أرقام، شرطات فقط' }],
        });
      }
    }

    // ── Update ────────────────────────────────────────────
    try {
      const { data, error } = await supabase
        .from('landing_pages')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.error(`[LANDING_PAGES] UPDATE ${id} error:`, error.message);

        if (error.code === '23505') {
          return res.status(409).json({
            ok: false,
            error: 'SLUG_EXISTS',
            message: 'الـ slug مستخدم بالفعل.',
          });
        }

        return res.status(200).json({
          ok: false,
          error: error.message,
          code: error.code,
        });
      }

      console.log(`[LANDING_PAGES] ✅ Updated: id=${id}, fields=${Object.keys(updates).join(',')}`);
      return res.status(200).json({
        ok: true,
        data,
        message: 'تم تحديث صفحة الهبوط بنجاح',
      });
    } catch (e) {
      console.error(`[LANDING_PAGES] UPDATE exception:`, e.message);
      return res.status(500).json({
        ok: false,
        error: 'INTERNAL_ERROR',
        message: e.message,
      });
    }
  }

  // ═════════════════════════════════════════════════════════
  // DELETE — Delete a landing page
  // ═════════════════════════════════════════════════════════
  if (req.method === 'DELETE') {
    try {
      // ── Verify exists first ─────────────────────────────
      const { data: existing, error: findErr } = await supabase
        .from('landing_pages')
        .select('id, title, slug')
        .eq('id', id)
        .maybeSingle();

      if (findErr) {
        console.error(`[LANDING_PAGES] Find for delete ${id} error:`, findErr.message);
        if (findErr.code === '42P01') {
          return res.status(200).json({
            ok: false,
            error: 'TABLE_NOT_FOUND',
            message: 'جدول landing_pages غير موجود.',
          });
        }
        return res.status(200).json({ ok: false, error: findErr.message });
      }

      if (!existing) {
        return res.status(404).json({
          ok: false,
          error: 'NOT_FOUND',
          message: `صفحة الهبوط بالمعرّف "${id}" غير موجودة.`,
        });
      }

      // ── Delete ──────────────────────────────────────────
      const { error } = await supabase
        .from('landing_pages')
        .delete()
        .eq('id', id);

      if (error) {
        console.error(`[LANDING_PAGES] DELETE ${id} error:`, error.message);
        return res.status(200).json({
          ok: false,
          error: error.message,
          code: error.code,
        });
      }

      console.log(`[LANDING_PAGES] ✅ Deleted: "${existing.title}" (slug=${existing.slug}, id=${id})`);
      return res.status(200).json({
        ok: true,
        deleted: { id, title: existing.title, slug: existing.slug },
        message: 'تم حذف صفحة الهبوط بنجاح',
      });
    } catch (e) {
      console.error(`[LANDING_PAGES] DELETE exception:`, e.message);
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
    message: `الطريقة ${req.method} غير مدعومة. استخدم GET أو PUT أو DELETE.`,
  });
}
