// ============================================================
// Orders CRUD — Vercel Serverless Function
// ============================================================
// POST action 'save'          — save new order (validates tracking exists)
// POST action 'list'          — list all orders (admin auth)
// POST action 'update_status' — update order status (admin auth)
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
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed. Use POST.' });
  }

  const supabase = getSupabase();
  if (!supabase) {
    return res.status(200).json({
      ok: false,
      error: 'SUPABASE_NOT_CONFIGURED',
      message: 'أضف SUPABASE_URL و SUPABASE_SERVICE_ROLE_KEY في Vercel',
    });
  }

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
  if (!body || typeof body !== 'object') body = {};

  const action = body.action;

  // ── LIST: Get all orders (admin only) ──────────────────────
  if (action === 'list') {
    const admin = verifyAdminToken(req.headers.authorization);
    if (!admin) {
      return res.status(401).json({ ok: false, error: 'Admin authentication required' });
    }

    try {
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('[ORDERS] List error:', error.message, error.code);
        return res.status(200).json({ ok: false, error: error.message, code: error.code });
      }

      console.log(`[ORDERS] ✅ Fetched ${(data || []).length} orders`);
      return res.status(200).json({ ok: true, data: data || [] });
    } catch (e) {
      return res.status(200).json({ ok: false, error: e.message });
    }
  }

  // ── SAVE: Save a new order (customer-facing, validates tracking) ──
  if (action === 'save') {
    const order = body.order;
    if (!order || !order.tracking) {
      return res.status(400).json({ ok: false, error: 'order with tracking is required' });
    }

    try {
      const { error } = await supabase.from('orders').upsert({
        id: order.id,
        tracking: order.tracking,
        customer: order.customer || '',
        phone: order.phone || '',
        wilaya: order.wilaya || '',
        address: order.address || '',
        items: order.items || [],
        total: order.total || 0,
        shipping: order.shipping || 0,
        delivery_type: order.deliveryType || order.delivery_type || 'home',
        selected_office: order.selectedOffice || order.selected_office || null,
        status: order.status || 'pending',
        date: order.date || new Date().toLocaleDateString('ar-DZ'),
        noest_id: order.noestId || order.noest_id || null,
      });

      if (error) {
        console.error('[ORDERS] Save error:', error.message, error.code);
        return res.status(200).json({ ok: false, error: error.message, code: error.code });
      }

      console.log(`[ORDERS] ✅ Saved order: ${order.tracking} (${order.customer})`);
      return res.status(200).json({ ok: true });
    } catch (e) {
      return res.status(200).json({ ok: false, error: e.message });
    }
  }

  // ── UPDATE STATUS: Change order status (admin only) ────────
  if (action === 'update_status') {
    const admin = verifyAdminToken(req.headers.authorization);
    if (!admin) {
      return res.status(401).json({ ok: false, error: 'Admin authentication required' });
    }

    const { id, status } = body;
    if (!id || !status) {
      return res.status(400).json({ ok: false, error: 'id and status are required' });
    }

    const validStatuses = ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ ok: false, error: `Invalid status. Valid: ${validStatuses.join(', ')}` });
    }

    try {
      const { error } = await supabase
        .from('orders')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) {
        console.error('[ORDERS] Update error:', error.message);
        return res.status(200).json({ ok: false, error: error.message });
      }

      console.log(`[ORDERS] ✅ Updated order ${id} → ${status}`);
      return res.status(200).json({ ok: true });
    } catch (e) {
      return res.status(200).json({ ok: false, error: e.message });
    }
  }

  return res.status(400).json({
    ok: false,
    error: `Unknown action: ${action}`,
    available: ['list', 'save', 'update_status'],
  });
}
