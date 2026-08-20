// ============================================================
// Public Order Tracking — Vercel Serverless Function
// ============================================================
// GET /api/track-order?order_number=BX4-166-19388761
//
// PUBLIC, unauthenticated. The customer supplies ONLY the Al Miraj
// order number (order.tracking — the customer-facing reference; a
// local internal reference for orders created after checkout was
// decoupled from NOEST, or the historical real NOEST tracking code
// for older orders). This endpoint never accepts and never returns
// any NOEST identifier (noest_id / shipment id / user_guid / api
// token) or admin-only data (internal_note, reminder_date, raw DB
// record). If the order already has a real NOEST shipment, this
// queries NOEST server-side (admin credentials never leave the
// server) and maps the result into a small public tracking DTO.
//
// Called ONLY when the customer explicitly searches on the tracking
// page, or an admin explicitly asks to refresh — never on render,
// page load, or a background timer.
//
// Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, NOEST_API_TOKEN,
//      NOEST_USER_GUID, (optional) NOEST_API_BASE
// ============================================================

import { createClient } from '@supabase/supabase-js';

export const config = { api: { bodyParser: false } };

function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

// Same order-status simplification as api/orders.js — kept as a
// small local copy since these are independent serverless functions.
function normalizeOrderStatus(status) {
  return (status === 'shipped' || status === 'delivered') ? 'confirmed' : status;
}

// ── NOEST provider-status → normalized delivery-status groups ──────────
// Based on NOEST's real event_key values used in shipment tracking
// history (upload/customer_validation/validation_.../fdr_activated/
// livre.../colis_suspendu/return_*).
const NOEST_STATUS_GROUPS = {
  in_preparation: ['upload', 'customer_validation'],
  shipped: ['validation_collect_colis', 'validation_reception_admin', 'validation_reception', 'sent_to_redispatch'],
  out_for_delivery: ['fdr_activated'],
  delivered: ['livre', 'livred'],
  delivery_issue: [
    'colis_suspendu',
    'return_asked_by_customer', 'return_asked_by_hub',
    'retour_dispatched_to_partenaires', 'return_dispatched_to_partenaire',
    'colis_retour_transmit_to_partner', 'livraison_echoue_recu',
    'return_validated_by_partener', 'return_redispatched_to_livraison',
    'return_dispatched_to_warehouse',
  ],
};
function normalizeNoestStatus(providerStatus) {
  for (const [group, keys] of Object.entries(NOEST_STATUS_GROUPS)) {
    if (keys.includes(providerStatus)) return group;
  }
  return 'unknown';
}
function deliveryStatusLabel(normalized) {
  switch (normalized) {
    case 'in_preparation': return '📦 قيد التحضير للشحن';
    case 'shipped': return '🚚 في الطريق';
    case 'out_for_delivery': return '🚚 خرج للتسليم';
    case 'delivered': return '✅ تم التسليم';
    case 'delivery_issue': return '⚠️ هناك تأخير في التسليم — سيتم التواصل معك';
    default: return '🚚 في الطريق';
  }
}
const EVENT_LABELS = {
  upload: '🧾 تم تسجيل الطلب لدى شركة التوصيل',
  customer_validation: '📞 تم التحقق من الطلب',
  validation_collect_colis: '📦 تم استلام الطرد من المعراج',
  validation_reception_admin: '🏢 وصل الطرد إلى مركز الفرز',
  validation_reception: '🏢 وصل الطرد إلى مركز التوزيع',
  fdr_activated: '🚚 خرج للتسليم',
  sent_to_redispatch: '🔁 أعيدت جدولة عملية التسليم',
  livre: '✅ تم التسليم',
  livred: '✅ تم التسليم',
  colis_suspendu: '⏸️ الشحنة معلّقة مؤقتاً',
  return_asked_by_customer: '↩️ طلب إرجاع الطرد',
  return_asked_by_hub: '↩️ طلب إرجاع الطرد',
  retour_dispatched_to_partenaires: '↩️ الطرد في طريق الإرجاع',
  return_dispatched_to_partenaire: '↩️ الطرد في طريق الإرجاع',
  colis_retour_transmit_to_partner: '↩️ تم تسليم الطرد للإرجاع',
  livraison_echoue_recu: '⚠️ تعذّر التسليم',
  return_validated_by_partener: '↩️ تم تأكيد إرجاع الطرد',
  return_redispatched_to_livraison: '🔁 أعيدت جدولة عملية التسليم',
  return_dispatched_to_warehouse: '↩️ عاد الطرد إلى المستودع',
  nouvel_tentative_asked_by_customer: '🔁 تم طلب إعادة محاولة التسليم',
};
function eventLabel(providerStatus) {
  return EVENT_LABELS[providerStatus] || '🔄 تحديث في حالة الشحنة';
}

/**
 * Query NOEST server-side for the live status of one shipment.
 * Never throws — always resolves to { ok, normalizedStatus?, lastUpdate?, history? }.
 * Never leaks the raw NOEST response, tokens, or GUID to the caller.
 */
async function fetchNoestTrackingInfo(trackingCode) {
  const API_TOKEN = process.env.NOEST_API_TOKEN;
  const USER_GUID = process.env.NOEST_USER_GUID;
  const BASE = (process.env.NOEST_API_BASE || 'https://app.noest-dz.com').replace(/\/+$/, '');
  if (!API_TOKEN || !USER_GUID) return { ok: false };

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);
    const r = await fetch(`${BASE}/api/public/get/trackings/info`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ api_token: API_TOKEN, user_guid: USER_GUID, trackings: [trackingCode] }),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!r.ok) return { ok: false };

    const text = await r.text();
    let data = null;
    try { data = JSON.parse(text); } catch { return { ok: false }; }
    if (!data || typeof data !== 'object') return { ok: false };

    const entry = data[trackingCode] || Object.values(data)[0];
    if (!entry || typeof entry !== 'object') return { ok: false };

    const rawEvents = Array.isArray(entry.activity) ? entry.activity : (Array.isArray(entry.events) ? entry.events : []);
    const events = rawEvents
      .map((e) => {
        const providerStatus = e.event_key || e.key || e.status || 'unknown';
        const dateStr = e.date || e.created_at || e.updated_at || null;
        let occurredAt = null;
        if (dateStr) {
          const d = new Date(dateStr);
          if (!Number.isNaN(d.getTime())) occurredAt = d.toISOString();
        }
        return { providerStatus, label: eventLabel(providerStatus), occurredAt };
      })
      .sort((a, b) => {
        if (!a.occurredAt) return 1;
        if (!b.occurredAt) return -1;
        return a.occurredAt.localeCompare(b.occurredAt);
      });

    const last = [...events].reverse().find((e) => e.occurredAt) || events[events.length - 1] || null;
    const normalizedStatus = last ? normalizeNoestStatus(last.providerStatus) : 'unknown';

    return {
      ok: true,
      normalizedStatus,
      lastUpdate: last ? last.occurredAt : null,
      history: events.map((e) => ({ label: e.label, occurredAt: e.occurredAt })),
    };
  } catch {
    return { ok: false };
  }
}

function customerMessage(orderStatus, hasShipment) {
  switch (orderStatus) {
    case 'pending':
      return 'طلبك قيد المراجعة 🟡 — سيتم التواصل معك لتأكيد الطلب.';
    case 'waiting_customer':
      return 'طلبك في انتظار استكمال بعض التفاصيل 🟣 — سنتواصل معك قريباً.';
    case 'cancelled':
      return 'تم إلغاء هذا الطلب 🔴';
    case 'confirmed':
      return hasShipment ? 'تم تأكيد طلبك ✅' : 'تم تأكيد طلبك ✅ — يجري الآن تحضيره للإرسال.';
    default:
      return 'حالة الطلب غير معروفة حالياً.';
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') {
    return res.status(405).json({ ok: false, error: 'Method not allowed. Use GET.' });
  }

  const supabase = getSupabase();
  if (!supabase) {
    return res.status(200).json({ ok: false, error: 'SERVICE_UNAVAILABLE', message: 'الخدمة غير متاحة حالياً، حاول لاحقاً.' });
  }

  const orderNumberRaw = (req.query && req.query.order_number) || '';
  const orderNumber = String(Array.isArray(orderNumberRaw) ? orderNumberRaw[0] : orderNumberRaw).trim();
  if (!orderNumber || orderNumber.length > 64) {
    return res.status(400).json({ ok: false, error: 'MISSING_ORDER_NUMBER', message: 'رقم الطلب مطلوب.' });
  }

  let order;
  try {
    const { data, error } = await supabase
      .from('orders')
      .select('tracking, status, wilaya, commune, created_at, noest_id, sent_to_delivery_at')
      .eq('tracking', orderNumber)
      .maybeSingle();
    if (error) {
      console.error('[TRACK-ORDER] Lookup error:', error.message);
      return res.status(200).json({ ok: false, error: 'LOOKUP_FAILED', message: 'حدث خطأ غير متوقع. حاول مرة أخرى لاحقاً.' });
    }
    order = data;
  } catch (e) {
    console.error('[TRACK-ORDER] Lookup exception:', e.message);
    return res.status(200).json({ ok: false, error: 'LOOKUP_FAILED', message: 'حدث خطأ غير متوقع. حاول مرة أخرى لاحقاً.' });
  }

  if (!order) {
    return res.status(200).json({ ok: false, error: 'NOT_FOUND', message: 'لم نعثر على طلب بهذا الرقم. تأكد من رقم الطلب وحاول مرة أخرى.' });
  }

  const orderStatus = normalizeOrderStatus(order.status);
  const hasShipment = !!order.noest_id;

  const result = {
    orderNumber: order.tracking,
    orderStatus,
    wilaya: order.wilaya || null,
    commune: order.commune || null,
    sentToDeliveryAt: order.sent_to_delivery_at || null,
    deliveryStatus: null,
    deliveryLabel: null,
    lastUpdate: order.sent_to_delivery_at || order.created_at || null,
    history: [],
    message: customerMessage(orderStatus, hasShipment),
    noestUnavailable: false,
  };

  // Never query NOEST for orders that were never sent — nothing to fetch,
  // and this keeps the pending/waiting_customer/cancelled paths NOEST-free.
  if (!hasShipment) {
    return res.status(200).json({ ok: true, data: result });
  }

  const live = await fetchNoestTrackingInfo(order.noest_id);
  if (!live.ok) {
    result.noestUnavailable = true;
    return res.status(200).json({ ok: true, data: result });
  }

  result.deliveryStatus = live.normalizedStatus;
  result.deliveryLabel = deliveryStatusLabel(live.normalizedStatus);
  if (live.lastUpdate) result.lastUpdate = live.lastUpdate;
  result.history = live.history || [];

  return res.status(200).json({ ok: true, data: result });
}
