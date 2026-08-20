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

// ============================================================
// NOEST shipment creation — ADMIN-ONLY, server-side.
// ============================================================
// This is intentionally separate from api/noest.js's public
// `create_order` action (used by the customer-facing checkout to
// look up wilayas/communes/desks — it has NO admin auth). Orders are
// no longer sent to NOEST at checkout time; a real NOEST shipment is
// only ever created here, from 'send_to_delivery' / 'resend_to_delivery',
// which are gated by verifyAdminToken() AND a fresh server-side read
// of the order's status. Never trust a status/flag sent by the client.
// ============================================================

/** Build the NOEST create/order payload from a DB order row. Returns { error } if required shipping fields are missing. */
function buildNoestPayloadFromOrder(order) {
  const missing = [];
  if (!order.wilaya_id) missing.push('wilaya_id');
  if (!order.commune) missing.push('commune');
  if (!order.customer) missing.push('customer');
  if (!order.phone) missing.push('phone');
  if (!order.address) missing.push('address');
  if (missing.length) {
    return {
      error: `بيانات الشحن غير مكتملة لهذا الطلب (${missing.join(', ')}) — لا يمكن إرساله إلى شركة التوصيل. غالباً طلب قديم لا يحتوي على بيانات الولاية/البلدية المطلوبة.`,
    };
  }

  const stopDesk = order.delivery_type === 'office' ? 1 : 0;
  let station_code;
  if (stopDesk === 1) {
    station_code = String(order.selected_office || '').split(' — ')[0].trim();
    if (!station_code) return { error: 'رمز مكتب الاستلام غير محفوظ لهذا الطلب — لا يمكن إرساله لشركة التوصيل تلقائياً.' };
  }

  const items = Array.isArray(order.items) ? order.items : [];
  const produit = items.map((i) => `${i.name} x${i.quantity}`).join(', ') || 'منتجات المعراج';

  return {
    payload: {
      client: order.customer,
      phone: order.phone,
      adresse: order.address,
      wilaya_id: Number(order.wilaya_id),
      commune: order.commune,
      montant: Number(order.total) || 0,
      produit,
      type_id: 1,
      stop_desk: stopDesk,
      ...(stopDesk === 1 ? { station_code } : {}),
    },
  };
}

/** Call the real NOEST create/order endpoint. Never throws — always resolves to { ok, tracking? , error?, message? }. */
async function createNoestShipment(payload) {
  const API_TOKEN = process.env.NOEST_API_TOKEN;
  const USER_GUID = process.env.NOEST_USER_GUID;
  const BASE = (process.env.NOEST_API_BASE || 'https://app.noest-dz.com').replace(/\/+$/, '');

  if (!API_TOKEN || !USER_GUID) {
    return { ok: false, error: 'NOEST_NOT_CONFIGURED', message: 'إعدادات NOEST غير مكتملة على الخادم (تواصل مع الدعم الفني).' };
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);
    const r = await fetch(`${BASE}/api/public/create/order`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ api_token: API_TOKEN, user_guid: USER_GUID, ...payload }),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    const text = await r.text();
    let data = null;
    try { data = JSON.parse(text); } catch { /* non-JSON response */ }

    if (r.ok && data && data.success === true) {
      const tracking = String(data.tracking || data.reference || '');
      if (!tracking) return { ok: false, error: 'NOEST_NO_TRACKING', message: 'قبلت NOEST الطلب لكن لم تُرجع رقم تتبع — تواصل مع الدعم الفني.' };
      return { ok: true, tracking };
    }

    return { ok: false, error: 'NOEST_REJECTED', message: (data && data.message) || 'رفضت شركة التوصيل إنشاء الشحنة.' };
  } catch (e) {
    const isAbort = e && e.name === 'AbortError';
    return {
      ok: false,
      error: isAbort ? 'TIMEOUT' : 'NETWORK_ERROR',
      message: isAbort ? 'انتهت مهلة الاتصال بشركة التوصيل — حاول مرة أخرى.' : 'تعذر الاتصال بشركة التوصيل — تحقق من الاتصال وحاول مرة أخرى.',
    };
  }
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
        wilaya_id: order.wilayaId ?? order.wilaya_id ?? null,
        commune: order.commune || null,
        address: order.address || '',
        items: order.items || [],
        total: order.total || 0,
        shipping: order.shipping || 0,
        delivery_type: order.deliveryType || order.delivery_type || 'home',
        selected_office: order.selectedOffice || order.selected_office || null,
        // Orders are no longer sent to NOEST at checkout — status always
        // starts 'pending' and noest_id stays null until an admin
        // explicitly sends it via 'send_to_delivery'.
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

    const validStatuses = ['pending', 'confirmed', 'waiting_customer', 'shipped', 'delivered', 'cancelled'];
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

  // ── UPDATE NOTE: Admin-only internal note, never exposed to the customer ──
  if (action === 'update_note') {
    const admin = verifyAdminToken(req.headers.authorization);
    if (!admin) {
      return res.status(401).json({ ok: false, error: 'Admin authentication required' });
    }

    const { id } = body;
    if (!id) return res.status(400).json({ ok: false, error: 'id is required' });
    const internal_note = body.internal_note == null ? null : String(body.internal_note);

    try {
      const { error } = await supabase
        .from('orders')
        .update({ internal_note, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) {
        console.error('[ORDERS] Update note error:', error.message);
        return res.status(200).json({ ok: false, error: error.message });
      }

      console.log(`[ORDERS] ✅ Updated note for order ${id}`);
      return res.status(200).json({ ok: true });
    } catch (e) {
      return res.status(200).json({ ok: false, error: e.message });
    }
  }

  // ── UPDATE REMINDER: Optional follow-up date (admin only) ──
  if (action === 'update_reminder') {
    const admin = verifyAdminToken(req.headers.authorization);
    if (!admin) {
      return res.status(401).json({ ok: false, error: 'Admin authentication required' });
    }

    const { id } = body;
    if (!id) return res.status(400).json({ ok: false, error: 'id is required' });

    let reminder_date = body.reminder_date;
    if (!reminder_date) {
      reminder_date = null;
    } else if (!/^\d{4}-\d{2}-\d{2}$/.test(String(reminder_date))) {
      return res.status(400).json({ ok: false, error: 'Invalid reminder_date format — expected YYYY-MM-DD' });
    }

    try {
      const { error } = await supabase
        .from('orders')
        .update({ reminder_date, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) {
        console.error('[ORDERS] Update reminder error:', error.message);
        return res.status(200).json({ ok: false, error: error.message });
      }

      console.log(`[ORDERS] ✅ Updated reminder for order ${id}`);
      return res.status(200).json({ ok: true });
    } catch (e) {
      return res.status(200).json({ ok: false, error: e.message });
    }
  }

  // ── SEND / RESEND TO DELIVERY: create a real NOEST shipment (admin only) ──
  // Critical rule: NEVER trust the client's idea of the order's status or
  // whether it was already sent. Always re-read the order fresh from the
  // DB and re-check here, server-side, right before calling NOEST.
  if (action === 'send_to_delivery' || action === 'resend_to_delivery') {
    const admin = verifyAdminToken(req.headers.authorization);
    if (!admin) {
      return res.status(401).json({ ok: false, error: 'Admin authentication required' });
    }

    const { id } = body;
    if (!id) return res.status(400).json({ ok: false, error: 'id is required' });

    const isResend = action === 'resend_to_delivery';

    let order;
    try {
      const { data, error } = await supabase.from('orders').select('*').eq('id', id).single();
      if (error || !data) {
        return res.status(200).json({ ok: false, error: 'ORDER_NOT_FOUND', message: 'تعذر العثور على الطلب.' });
      }
      order = data;
    } catch (e) {
      return res.status(200).json({ ok: false, error: e.message });
    }

    // ── Rule: only a CONFIRMED order (or a later stage, for resend) may ever be sent ──
    // pending / waiting_customer / cancelled are always rejected here, no matter
    // what the client sent or how the button was reached.
    const sendableStatuses = isResend ? ['confirmed', 'shipped', 'delivered'] : ['confirmed'];
    if (!sendableStatuses.includes(order.status)) {
      console.warn(`[ORDERS] ❌ Blocked ${isResend ? 'resend' : 'send'} for order ${id} — status=${order.status}`);
      return res.status(200).json({
        ok: false,
        error: 'STATUS_NOT_ALLOWED',
        message: isResend
          ? 'لا يمكن إعادة إرسال طلب غير مؤكد أو لم يصل بعد لمرحلة الشحن.'
          : 'لا يمكن إرسال الطلب إلى شركة التوصيل قبل تأكيده.',
      });
    }

    // ── Duplicate-shipment protection ──
    if (!isResend && order.noest_id) {
      return res.status(200).json({
        ok: false,
        error: 'ALREADY_SENT',
        message: 'هذا الطلب أُرسل مسبقاً إلى شركة التوصيل. استخدم "إعادة الإرسال" فقط إذا حُذفت الشحنة من NOEST.',
      });
    }
    if (isResend && !order.noest_id) {
      return res.status(200).json({
        ok: false,
        error: 'NOT_SENT_YET',
        message: 'لم يُرسل هذا الطلب من قبل — استخدم زر "إرسال إلى شركة التوصيل" العادي.',
      });
    }

    const built = buildNoestPayloadFromOrder(order);
    if (built.error) {
      return res.status(200).json({ ok: false, error: 'MISSING_SHIPPING_DATA', message: built.error });
    }

    const result = await createNoestShipment(built.payload);
    if (!result.ok) {
      console.error(`[ORDERS] ❌ ${isResend ? 'Resend' : 'Send'} to NOEST failed for ${id}: ${result.message}`);
      // Nothing is written to the DB — old tracking/status/noest_id (if any) stay exactly as they were.
      return res.status(200).json({ ok: false, error: result.error, message: result.message });
    }

    const nowIso = new Date().toISOString();
    const update = {
      noest_id: result.tracking,
      delivery_last_sent_at: nowIso,
      delivery_send_count: (order.delivery_send_count || 0) + 1,
      updated_at: nowIso,
    };
    if (!order.sent_to_delivery_at) update.sent_to_delivery_at = nowIso;

    try {
      const { error: updateError } = await supabase.from('orders').update(update).eq('id', id);
      if (updateError) {
        // The NOEST shipment WAS created successfully but we failed to save that
        // locally. Surface this loudly instead of silently losing the tracking —
        // do NOT report a generic failure (that could cause the admin to resend).
        console.error(`[ORDERS] ⚠️ NOEST shipment created (tracking=${result.tracking}) but failed to save locally:`, updateError.message);
        return res.status(200).json({
          ok: false,
          error: 'SAVE_FAILED_AFTER_SEND',
          message: `تم إنشاء الشحنة في NOEST (رقم التتبع: ${result.tracking}) لكن تعذّر حفظ ذلك في النظام. لا تُعد الإرسال — تواصل مع الدعم الفني فوراً وزوّده برقم التتبع.`,
        });
      }
    } catch (e) {
      console.error(`[ORDERS] ⚠️ NOEST shipment created (tracking=${result.tracking}) but failed to save locally:`, e.message);
      return res.status(200).json({
        ok: false,
        error: 'SAVE_FAILED_AFTER_SEND',
        message: `تم إنشاء الشحنة في NOEST (رقم التتبع: ${result.tracking}) لكن تعذّر حفظ ذلك في النظام. لا تُعد الإرسال — تواصل مع الدعم الفني فوراً وزوّده برقم التتبع.`,
      });
    }

    console.log(`[ORDERS] ✅ ${isResend ? 'Resent' : 'Sent'} order ${id} to NOEST — tracking=${result.tracking}`);
    return res.status(200).json({
      ok: true,
      data: {
        noest_id: result.tracking,
        tracking: result.tracking,
        sent_to_delivery_at: update.sent_to_delivery_at || order.sent_to_delivery_at,
        delivery_last_sent_at: update.delivery_last_sent_at,
        delivery_send_count: update.delivery_send_count,
      },
    });
  }

  // ── ARCHIVE / UNARCHIVE: Hide/show an order without deleting it (admin only) ──
  if (action === 'archive' || action === 'unarchive') {
    const admin = verifyAdminToken(req.headers.authorization);
    if (!admin) {
      return res.status(401).json({ ok: false, error: 'Admin authentication required' });
    }

    const { id } = body;
    if (!id) return res.status(400).json({ ok: false, error: 'id is required' });

    const archived = action === 'archive';
    try {
      const { error } = await supabase
        .from('orders')
        .update({ archived, archived_at: archived ? new Date().toISOString() : null, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) {
        console.error('[ORDERS] Archive error:', error.message, error.code);
        const hint = error.code === '42703'
          ? 'عمود الأرشفة (archived) غير موجود بعد في جدول orders. افتح /api/health وشغّل SQL الإعداد لإضافته.'
          : null;
        return res.status(200).json({ ok: false, error: error.message, code: error.code, hint });
      }

      console.log(`[ORDERS] ✅ ${archived ? 'Archived' : 'Restored'} order ${id}`);
      return res.status(200).json({ ok: true });
    } catch (e) {
      return res.status(200).json({ ok: false, error: e.message });
    }
  }

  // ── DELETE: Permanently remove an order — explicit admin action only ──
  if (action === 'delete') {
    const admin = verifyAdminToken(req.headers.authorization);
    if (!admin) {
      return res.status(401).json({ ok: false, error: 'Admin authentication required' });
    }

    const { id } = body;
    if (!id) return res.status(400).json({ ok: false, error: 'id is required' });

    try {
      const { error } = await supabase.from('orders').delete().eq('id', id);
      if (error) {
        console.error('[ORDERS] Delete error:', error.message);
        return res.status(200).json({ ok: false, error: error.message });
      }
      console.log(`[ORDERS] ✅ Deleted order ${id}`);
      return res.status(200).json({ ok: true });
    } catch (e) {
      return res.status(200).json({ ok: false, error: e.message });
    }
  }

  return res.status(400).json({
    ok: false,
    error: `Unknown action: ${action}`,
    available: ['list', 'save', 'update_status', 'update_note', 'update_reminder', 'send_to_delivery', 'resend_to_delivery', 'archive', 'unarchive', 'delete'],
  });
}
