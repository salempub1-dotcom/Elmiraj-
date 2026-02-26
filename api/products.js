// ============================================================
// Products CRUD — Vercel Serverless Function
// ============================================================
// GET:  public — list all products from Supabase
// POST: action 'save'   — upsert product (admin auth)
//       action 'delete'  — delete product (admin auth)
//       action 'seed'    — bulk insert initial products (no auth, only if table empty)
//
// Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ADMIN_USERNAME, ADMIN_PASSWORD
// ============================================================

import { createHmac } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

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
  } catch { return null; }
}

function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const supabase = getSupabase();
  if (!supabase) {
    return res.status(200).json({
      ok: false,
      error: 'SUPABASE_NOT_CONFIGURED',
      message: 'أضف SUPABASE_URL و SUPABASE_SERVICE_ROLE_KEY في Vercel',
    });
  }

  // ── GET: List all products (public) ────────────────────────
  if (req.method === 'GET') {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('id', { ascending: true });

      if (error) {
        console.error('[PRODUCTS] GET error:', error.message, error.code);
        const hint = error.code === '42P01'
          ? 'Table "products" does not exist. Run the SQL setup in Supabase Dashboard → SQL Editor. Visit /api/health for the full SQL.'
          : error.code === '42501'
            ? 'Permission denied. Check RLS policies: products table needs SELECT policy for anon role with USING (true).'
            : null;
        return res.status(200).json({ ok: false, error: error.message, code: error.code, hint });
      }

      console.log(`[PRODUCTS] ✅ Fetched ${(data || []).length} products`);
      return res.status(200).json({ ok: true, data: data || [] });
    } catch (e) {
      return res.status(200).json({ ok: false, error: e.message });
    }
  }

  // ── POST: Admin operations ─────────────────────────────────
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
  if (!body || typeof body !== 'object') body = {};

  const action = body.action;

  // ── SEED: Bulk insert initial products (only if table is empty) ──
  if (action === 'seed') {
    const products = body.products;
    if (!Array.isArray(products) || products.length === 0) {
      return res.status(400).json({ ok: false, error: 'products array is required' });
    }

    try {
      // Check if already has data
      const { count, error: countErr } = await supabase
        .from('products')
        .select('id', { count: 'exact', head: true });

      if (countErr) {
        console.error('[PRODUCTS] Count error:', countErr.message, countErr.code);
        return res.status(200).json({ ok: false, error: countErr.message, code: countErr.code });
      }

      if (count && count > 0) {
        console.log(`[PRODUCTS] Already seeded (${count} rows)`);
        return res.status(200).json({ ok: true, message: 'already_seeded', count });
      }

      const rows = products.map(p => ({
        id: p.id,
        name: p.name,
        description: p.description || '',
        price: p.price,
        category: p.category,
        images: p.images || [],
        stock: p.stock || 0,
        sales: p.sales || 0,
        benefits: p.benefits || [],
        badge: p.badge || null,
      }));

      const { error } = await supabase.from('products').insert(rows);
      if (error) {
        console.error('[PRODUCTS] Seed error:', error.message);
        return res.status(200).json({ ok: false, error: error.message, code: error.code });
      }

      console.log(`[PRODUCTS] ✅ Seeded ${rows.length} products`);
      return res.status(200).json({ ok: true, message: 'seeded', count: rows.length });
    } catch (e) {
      return res.status(200).json({ ok: false, error: e.message });
    }
  }

  // ── All other actions require admin auth ────────────────────
  const admin = verifyAdminToken(req.headers.authorization);
  if (!admin) {
    return res.status(401).json({ ok: false, error: 'Admin authentication required' });
  }

  // ── SAVE: Upsert a product ─────────────────────────────────
  if (action === 'save') {
    const p = body.product;
    if (!p || !p.id) {
      return res.status(400).json({ ok: false, error: 'product with id is required' });
    }

    try {
      const { error } = await supabase.from('products').upsert({
        id: p.id,
        name: p.name,
        description: p.description || '',
        price: p.price,
        category: p.category,
        images: p.images || [],
        stock: p.stock || 0,
        sales: p.sales || 0,
        benefits: p.benefits || [],
        badge: p.badge || null,
        updated_at: new Date().toISOString(),
      });

      if (error) {
        console.error('[PRODUCTS] Save error:', error.message);
        return res.status(200).json({ ok: false, error: error.message });
      }

      console.log(`[PRODUCTS] ✅ Saved: ${p.name} (id=${p.id})`);
      return res.status(200).json({ ok: true });
    } catch (e) {
      return res.status(200).json({ ok: false, error: e.message });
    }
  }

  // ── DELETE: Remove a product ───────────────────────────────
  if (action === 'delete') {
    const id = body.id;
    if (!id) return res.status(400).json({ ok: false, error: 'id is required' });

    try {
      const { error } = await supabase.from('products').delete().eq('id', id);
      if (error) {
        return res.status(200).json({ ok: false, error: error.message });
      }
      console.log(`[PRODUCTS] ✅ Deleted product id=${id}`);
      return res.status(200).json({ ok: true });
    } catch (e) {
      return res.status(200).json({ ok: false, error: e.message });
    }
  }

  return res.status(400).json({ ok: false, error: `Unknown action: ${action}` });
}
