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
import { checkoutOfficeId, checkoutPreferredProvider } from '../lib/checkoutDeliverySelection.js';

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

// ============================================================
// Order status vs delivery status
// ============================================================
// order_status (this column, `status`) is the ADMIN'S own handling of
// the order and is limited to exactly 4 values going forward: pending,
// confirmed, waiting_customer, cancelled. Older rows created before this
// simplification may still carry 'shipped' or 'delivered' (real shipping
// progress that used to be conflated with order status) — those are
// legacy data, never written again, and always treated as 'confirmed'
// for validation/eligibility purposes here. Real shipping progress now
// comes from NOEST directly via /api/track-order, kept separate from
// this column entirely.
const ORDER_STATUSES = ['pending', 'confirmed', 'waiting_customer', 'cancelled'];
function normalizeOrderStatus(status) {
  return (status === 'shipped' || status === 'delivered') ? 'confirmed' : status;
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
  if (checkoutPreferredProvider(order) === 'zrexpress') {
    return { error: 'العميل اختار ZR Express لهذا الطلب. استخدم مسار شركات التوصيل الجديد بدل مسار NOEST القديم.' };
  }
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
    station_code = checkoutOfficeId(order);
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

// ============================================================
// Delivery-status sync — batched NOEST lookup + auto-archive
// ============================================================
// order_status (`status`, above) stays limited to exactly 4 values.
// delivery_status is a completely separate concept: NOEST's real
// shipment progress, written ONLY here, never guessed/inferred from
// order_status. The groups below are built from NOEST's real event_key
// vocabulary — same source already proven in production at
// GET /api/track-order (fetchNoestTrackingInfo) — grouped more finely
// here for admin/archive display (delivered vs returned vs in-transit
// vs a failed delivery attempt, instead of one lumped "delivery_issue").
const NOEST_ADMIN_STATUS_GROUPS = {
  // النقل لم يبدأ بعد — الطرد لم يُستلم فعليًا من المعراج بعد. هذه المجموعة
  // فقط هي التي لا تُشغّل الأرشفة التلقائية.
  in_preparation: ['upload', 'customer_validation'],
  // الطرد استُلم فعليًا (validation_collect_colis) ودخل شبكة NOEST — أول
  // حدث هنا هو المُحفّز الآمن للأرشفة التلقائية.
  in_transit: [
    'validation_collect_colis', 'validation_reception_admin', 'validation_reception',
    'fdr_activated', 'sent_to_redispatch', 'return_redispatched_to_livraison',
    'nouvel_tentative_asked_by_customer',
  ],
  delivery_attempt_failed: ['colis_suspendu', 'livraison_echoue_recu'],
  returned: [
    'return_asked_by_customer', 'return_asked_by_hub', 'retour_dispatched_to_partenaires',
    'return_dispatched_to_partenaire', 'colis_retour_transmit_to_partner',
    'return_validated_by_partener', 'return_dispatched_to_warehouse',
  ],
  delivered: ['livre', 'livred'],
};
function mapNoestDeliveryStatus(providerStatus) {
  for (const [group, keys] of Object.entries(NOEST_ADMIN_STATUS_GROUPS)) {
    if (keys.includes(providerStatus)) return group;
  }
  return 'unknown';
}

// ── ARCHIVE_ELIGIBLE_STATUSES — "Vers Hub" وما بعدها ────────────────────
// Set صريح من قيم event_key الحقيقية (نفس المفردات المُثبَتة عملياً في
// الإنتاج — انظر NOEST_ADMIN_STATUS_GROUPS أعلاه، وهي نفس القائمة المُستخدمة
// في GET /api/track-order منذ Task 3) التي تعني أن الطرد غادر "قيد
// التحضير" فعلياً ودخل شبكة NOEST — يقابلها في واجهة NOEST البصرية مسار
// "Vers Hub" (noest.dz/vers/hub) وما بعده من مراحل (استلام في المركز/الفرز،
// خروج للتسليم، تسليم، مرتجع...). البداية الحقيقية لهذه المجموعة هي أول
// حدث بعد إنشاء الشحنة: validation_collect_colis ("تم استلام الطرد من
// المعراج") — أي لحظة استلام الطرد فعلياً من المتجر وبدء نقله نحو الـHub،
// وليس مجرد "تم إنشاء الشحنة في NOEST" (upload/customer_validation، وهما
// فقط ما يبقى في مجموعة in_preparation ولا يُشغّلان الأرشفة). أي حالة
// مؤكدة أنها لاحقة لـ"Vers Hub" (وصول لمركز الفرز/التوزيع، خروج للتسليم،
// تسليم، مرتجع بكل مساراته) مؤهلة للأرشفة أيضاً — مُشتقة هنا برمجياً من
// نفس NOEST_ADMIN_STATUS_GROUPS بدل تكرارها يدوياً، لتبقى مصدر الحقيقة
// واحداً ولا تنحرف القائمتان عن بعضهما مستقبلاً.
const ARCHIVE_ELIGIBLE_STATUSES = new Set(
  Object.entries(NOEST_ADMIN_STATUS_GROUPS)
    .filter(([group]) => group !== 'in_preparation')
    .flatMap(([, keys]) => keys)
);

// المُحفّز الوحيد للأرشفة التلقائية: أي مجموعة غير "in_preparation" (لم
// يُستلم بعد) وغير "unknown" (لا بيانات كافية) تعني أن الطرد فعلًا دخل
// دورة التوصيل — وليس مجرد "تم إنشاء الشحنة" (send_to_delivery وحده لا يكفي).
// (مكافئ رياضياً لفحص "هل آخر event_key ضمن ARCHIVE_ELIGIBLE_STATUSES؟" —
// المجموعة group هنا هي أصلاً نتيجة تصنيف آخر event_key الحقيقي.)
function isParcelInDeliveryNetwork(group) {
  return group !== 'in_preparation' && group !== 'unknown';
}

/** استخراج آخر حدث زمنيًا من قائمة أحداث NOEST — نفس منطق api/track-order.js تمامًا. */
function pickLatestNoestEvent(rawEvents) {
  const events = (Array.isArray(rawEvents) ? rawEvents : []).map((e) => {
    const providerStatus = e.event_key || e.key || e.status || 'unknown';
    const dateStr = e.date || e.created_at || e.updated_at || null;
    let occurredAt = null;
    if (dateStr) {
      const d = new Date(dateStr);
      if (!Number.isNaN(d.getTime())) occurredAt = d.toISOString();
    }
    return { providerStatus, occurredAt };
  }).sort((a, b) => {
    if (!a.occurredAt) return 1;
    if (!b.occurredAt) return -1;
    return a.occurredAt.localeCompare(b.occurredAt);
  });
  return [...events].reverse().find((e) => e.occurredAt) || events[events.length - 1] || null;
}

/**
 * Batched NOEST tracking lookup — ONE HTTP call covers up to `trackingCodes.length`
 * shipments (NOEST's endpoint accepts an array natively). Never throws; returns
 * a map of trackingCode → { group, occurredAt } for whatever NOEST actually
 * had data for — codes it couldn't resolve are simply absent from the result,
 * so callers can leave their last-known status untouched instead of guessing.
 */
async function fetchNoestTrackingsBatch(trackingCodes) {
  const API_TOKEN = process.env.NOEST_API_TOKEN;
  const USER_GUID = process.env.NOEST_USER_GUID;
  const BASE = (process.env.NOEST_API_BASE || 'https://app.noest-dz.com').replace(/\/+$/, '');
  if (!API_TOKEN || !USER_GUID || trackingCodes.length === 0) return {};

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20_000);
    const r = await fetch(`${BASE}/api/public/get/trackings/info`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ api_token: API_TOKEN, user_guid: USER_GUID, trackings: trackingCodes }),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!r.ok) return {};

    const text = await r.text();
    let data = null;
    try { data = JSON.parse(text); } catch { return {}; }
    if (!data || typeof data !== 'object') return {};

    const out = {};
    for (const code of trackingCodes) {
      const entry = data[code];
      if (!entry || typeof entry !== 'object') continue;
      const rawEvents = Array.isArray(entry.activity) ? entry.activity : (Array.isArray(entry.events) ? entry.events : []);
      const latest = pickLatestNoestEvent(rawEvents);
      if (latest) out[code] = { group: mapNoestDeliveryStatus(latest.providerStatus), occurredAt: latest.occurredAt };
    }
    return out;
  } catch {
    return {};
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

    if (!ORDER_STATUSES.includes(status)) {
      return res.status(400).json({ ok: false, error: `Invalid status. Valid: ${ORDER_STATUSES.join(', ')}` });
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

  // ── UPDATE ITEMS: edit an order's products in place (admin only) ───────
  // "✏️ تعديل الطلب" — add/remove products or change quantities on an
  // EXISTING order without creating a new Order (same id/tracking/history).
  //
  // Trust model (critical): the client sends ONLY { productId, quantity }
  // pairs — never a price, subtotal, or total. This endpoint never reads
  // body.price / body.total / body.subtotal for anything, so there is no
  // field a tampered request could set to override the computed total —
  // it is recomputed fresh, every time, from trusted server-side data:
  //   - an item already on the order keeps its EXACT existing price
  //     snapshot (order.items, re-read fresh from the DB) — editing the
  //     Catalog price of a product never silently changes an existing
  //     order, exactly like at checkout time.
  //   - an item newly added to the order gets a fresh snapshot of that
  //     product's CURRENT price, read from the `products` table here,
  //     server-side (never the price the browser happened to have
  //     rendered).
  // Delivery (`shipping`) is left completely untouched — this project's
  // delivery price depends only on wilaya/delivery type, never on cart
  // contents (see the checkout `shippingCost` calculation), so changing
  // products can never change the delivery price.
  if (action === 'update_items') {
    const admin = verifyAdminToken(req.headers.authorization);
    if (!admin) {
      return res.status(401).json({ ok: false, error: 'Admin authentication required' });
    }

    const { id, lines } = body;
    if (!id) return res.status(400).json({ ok: false, error: 'id is required' });
    if (!Array.isArray(lines) || lines.length === 0) {
      return res.status(400).json({ ok: false, error: 'EMPTY_ITEMS', message: 'يجب أن يحتوي الطلب على منتج واحد على الأقل.' });
    }

    // ── Validate + de-duplicate the requested lines (merge repeated productId, like the storefront cart does) ──
    const mergedQty = new Map();
    for (const line of lines) {
      const productId = Number(line?.productId);
      const quantity = Number(line?.quantity);
      if (!Number.isFinite(productId) || productId <= 0) {
        return res.status(400).json({ ok: false, error: 'INVALID_LINE', message: 'أحد عناصر الطلب يشير إلى منتج غير صالح.' });
      }
      if (!Number.isInteger(quantity) || quantity <= 0) {
        return res.status(400).json({ ok: false, error: 'INVALID_QUANTITY', message: 'الكمية يجب أن تكون رقمًا صحيحًا أكبر من صفر لكل منتج.' });
      }
      mergedQty.set(productId, (mergedQty.get(productId) || 0) + quantity);
    }

    // ── Fresh server-side read — never trust the client's idea of the order's current state ──
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

    // ── Rule §14: only pending / confirmed / waiting_customer may be edited (never cancelled, unless requested explicitly later) ──
    const ITEMS_EDITABLE_STATUSES = ['pending', 'confirmed', 'waiting_customer'];
    if (!ITEMS_EDITABLE_STATUSES.includes(normalizeOrderStatus(order.status))) {
      return res.status(200).json({
        ok: false,
        error: 'STATUS_NOT_ALLOWED',
        message: 'لا يمكن تعديل منتجات هذا الطلب في حالته الحالية.',
      });
    }

    // ── Rule §17: an archived order is closed — never editable ──
    if (order.archived) {
      return res.status(200).json({
        ok: false,
        error: 'ORDER_ARCHIVED',
        message: 'هذا الطلب مؤرشف — لا يمكن تعديل منتجاته.',
      });
    }

    // ── Rule §16: once NOEST confirms the parcel actually entered its delivery
    // network (Expédié/Scanned — same trigger as auto-archive, see
    // isParcelInDeliveryNetwork above), item editing is permanently blocked.
    // A null/unsynced delivery_status must NOT be treated as "in network". ──
    if (order.delivery_status && isParcelInDeliveryNetwork(order.delivery_status)) {
      return res.status(200).json({
        ok: false,
        error: 'ALREADY_SHIPPED',
        message: 'لا يمكن تعديل المنتجات بعد دخول الطلب في مرحلة الشحن.',
      });
    }

    // ── Resolve each line's price: existing snapshot for items already on the order, live Catalog price for newly-added ones ──
    const existingItems = Array.isArray(order.items) ? order.items : [];
    const existingById = new Map(existingItems.map((it) => [Number(it.id), it]));
    const newProductIds = [...mergedQty.keys()].filter((pid) => !existingById.has(pid));

    let liveProductsById = new Map();
    if (newProductIds.length > 0) {
      try {
        const { data, error } = await supabase
          .from('products')
          .select('id,name,description,price,category,images,stock,sales,benefits,contents,level,badge')
          .in('id', newProductIds);
        if (error) {
          return res.status(200).json({ ok: false, error: error.message });
        }
        liveProductsById = new Map((data || []).map((p) => [Number(p.id), p]));
      } catch (e) {
        return res.status(200).json({ ok: false, error: e.message });
      }
      const notFound = newProductIds.filter((pid) => !liveProductsById.has(pid));
      if (notFound.length > 0) {
        return res.status(200).json({
          ok: false,
          error: 'PRODUCT_NOT_FOUND',
          message: 'أحد المنتجات المحددة لم يعد موجودًا في الكتالوج.',
        });
      }
    }

    const finalItems = [];
    for (const [productId, quantity] of mergedQty.entries()) {
      const existing = existingById.get(productId);
      if (existing) {
        finalItems.push({ ...existing, quantity });
      } else {
        const p = liveProductsById.get(productId);
        finalItems.push({
          id: p.id, name: p.name, description: p.description, price: p.price,
          category: p.category, images: p.images, stock: p.stock, sales: p.sales,
          benefits: p.benefits, contents: p.contents, level: p.level, badge: p.badge,
          quantity,
        });
      }
    }

    const subtotal = finalItems.reduce((s, it) => s + (Number(it.price) || 0) * (Number(it.quantity) || 0), 0);
    const shipping = Number(order.shipping) || 0; // ── delivery price untouched — never re-derived here ──
    const total = subtotal + shipping;
    const nowIso = new Date().toISOString();

    try {
      const { error } = await supabase
        .from('orders')
        .update({ items: finalItems, total, updated_at: nowIso })
        .eq('id', id);

      if (error) {
        console.error('[ORDERS] Update items error:', error.message, error.code);
        return res.status(200).json({ ok: false, error: error.message, code: error.code });
      }

      console.log(`[ORDERS] ✅ Updated items for order ${id} — ${finalItems.length} line(s), total=${total}`);
      return res.status(200).json({
        ok: true,
        data: { items: finalItems, subtotal, shipping, total, updatedAt: nowIso },
      });
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

    // ── Rule: only a CONFIRMED order may ever be sent ──
    // pending / waiting_customer / cancelled are always rejected here, no matter
    // what the client sent or how the button was reached. Legacy rows still
    // carrying 'shipped'/'delivered' (pre-simplification) normalize to
    // 'confirmed' so they remain eligible for resend.
    if (normalizeOrderStatus(order.status) !== 'confirmed') {
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

  // ── SYNC DELIVERY STATUS: batched NOEST lookup + auto-archive (admin only) ──
  // Called ONLY on an explicit admin action (opening the Archive tab once
  // per session, or pressing "sync now") — never on render/page-load/timer.
  // One NOEST request covers up to SYNC_BATCH_SIZE orders at a time, never
  // one request per order.
  if (action === 'sync_delivery_status') {
    const admin = verifyAdminToken(req.headers.authorization);
    if (!admin) {
      return res.status(401).json({ ok: false, error: 'Admin authentication required' });
    }

    const SYNC_BATCH_SIZE = 60;      // trackings per NOEST HTTP call
    const SYNC_MAX_CANDIDATES = 200; // hard cap per sync call — keeps this lightweight

    let candidatesRaw;
    try {
      const { data, error } = await supabase
        .from('orders')
        .select('id, status, noest_id, archived, delivery_status, delivery_status_updated_at')
        .not('noest_id', 'is', null)
        .order('updated_at', { ascending: true })
        .limit(500);
      if (error) {
        console.error('[ORDERS] Sync candidates query error:', error.message);
        return res.status(200).json({ ok: false, error: error.message });
      }
      candidatesRaw = data || [];
    } catch (e) {
      return res.status(200).json({ ok: false, error: e.message });
    }

    // ── من يحتاج فحصًا؟ (نقطة 14 — إصلاح Bug قديم) ──────────────────────
    // سابقًا: كان أي طلب delivery_status IN (delivered, returned) يُستبعد
    // نهائياً من الفحص القادم — حتى لو كان archived لا يزال false (خطأ
    // قديم/تعارض/استرجاع يدوي من الأرشيف). هذا يعني أن هذه الطلبات لم تكن
    // لتُصحَّح تلقائياً أبداً. الآن: نستبعد فقط الطلبات التي لا يوجد فيها
    // أي عمل متبقٍ فعلاً — أي archived=true بالفعل ووصلت لحالة نهائية —
    // وهذا يحقق Idempotency (نقطة 6) دون التضحية بالتصحيح الذاتي (نقطة 14).
    const candidates = candidatesRaw
      .filter((o) => !(o.archived && (o.delivery_status === 'delivered' || o.delivery_status === 'returned')))
      .slice(0, SYNC_MAX_CANDIDATES);

    if (candidates.length === 0) {
      return res.status(200).json({ ok: true, data: { checked: 0, updated: [], unavailable: 0 } });
    }

    const byTracking = new Map();
    for (const o of candidates) byTracking.set(o.noest_id, o);
    const trackingCodes = [...byTracking.keys()];

    const results = {};
    for (let i = 0; i < trackingCodes.length; i += SYNC_BATCH_SIZE) {
      const chunk = trackingCodes.slice(i, i + SYNC_BATCH_SIZE);
      Object.assign(results, await fetchNoestTrackingsBatch(chunk));
    }

    const nowIso = new Date().toISOString();
    const updated = [];
    let unavailable = 0;
    for (const [tracking, order] of byTracking.entries()) {
      const info = results[tracking];
      if (!info) { unavailable++; continue; } // NOEST unavailable/no data — keep last known status, never guess

      // ── نقطة 7 (حرجة): لا تُؤرشف تلقائياً إلا status='confirmed' — حتى
      // لو كان لدى pending/waiting_customer/cancelled معرّف noest_id (بيانات
      // قديمة/خطأ سابق). delivery_status لا يزال يُحدَّث للجميع (عرض فقط،
      // غير ضار)، لكن الأرشفة الفعلية مشروطة بالحالة دائماً. ──────────────
      const isConfirmed = normalizeOrderStatus(order.status) === 'confirmed';
      // المُحفّز الوحيد للأرشفة التلقائية: تأكيد NOEST أن الطرد دخل شبكة
      // التوصيل فعليًا (Vers Hub فما بعد) — وليس مجرد إنشاء شحنة
      // (send_to_delivery وحده لا يكفي، انظر ARCHIVE_ELIGIBLE_STATUSES أعلاه).
      const shouldArchive = isConfirmed && !order.archived && isParcelInDeliveryNetwork(info.group);
      const groupChanged = info.group !== order.delivery_status;

      // ── Idempotency (نقطة 6): لا كتابة إطلاقاً إن لم يتغيّر شيء فعلياً —
      // لا حالة التوصيل تغيّرت ولا هناك أرشفة مستحقة الآن. لكن مهم: فحص
      // shouldArchive منفصل تماماً عن groupChanged — حتى لو ظلت المجموعة
      // كما هي بين مزامنتين، إن كان archived لا يزال false رغم أنها مؤهلة
      // (نقطة 14: طلب قديم فاتته الأرشفة أو أُعيد من الأرشيف يدوياً)، يجب
      // تصحيحه الآن، لا تجاهله بسبب "لا تغيير في delivery_status". ────────
      if (!groupChanged && !shouldArchive) continue;

      const update = { updated_at: nowIso };
      if (groupChanged) { update.delivery_status = info.group; update.delivery_status_updated_at = nowIso; }
      if (shouldArchive) { update.archived = true; update.archived_at = nowIso; }

      try {
        const { error: updateError } = await supabase.from('orders').update(update).eq('id', order.id);
        if (updateError) { console.error(`[ORDERS] Sync update failed for ${order.id}:`, updateError.message); continue; }
        updated.push({
          id: order.id,
          deliveryStatus: info.group,
          deliveryStatusUpdatedAt: groupChanged ? nowIso : (order.delivery_status_updated_at ?? nowIso),
          archived: shouldArchive ? true : !!order.archived,
          archivedAt: shouldArchive ? nowIso : undefined,
        });
      } catch (e) {
        console.error(`[ORDERS] Sync update exception for ${order.id}:`, e.message);
      }
    }

    console.log(`[ORDERS] 🔄 Delivery-status sync: checked ${candidates.length}, updated ${updated.length}, archived ${updated.filter(u => u.archived).length}`);
    return res.status(200).json({ ok: true, data: { checked: candidates.length, updated, unavailable } });
  }

  return res.status(400).json({
    ok: false,
    error: `Unknown action: ${action}`,
    available: ['list', 'save', 'update_status', 'update_note', 'update_reminder', 'update_items', 'send_to_delivery', 'resend_to_delivery', 'archive', 'unarchive', 'delete', 'sync_delivery_status'],
  });
}
