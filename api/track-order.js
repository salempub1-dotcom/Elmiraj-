// ============================================================
// Public Order Tracking — provider-aware (NOEST + ZR Express)
// ============================================================
// Customer supplies ONLY the Al Miraj order number. Provider credentials and
// provider shipment identifiers never leave the server.
// ============================================================

import { createClient } from '@supabase/supabase-js';
import {
  decodeDeliveryRef,
  deliveryStatusLabel,
  fetchNoestTrackingInfo,
  fetchZrTrackingInfo,
  normalizeOrderStatus,
} from '../lib/deliveryProviders.js';

export const config = { api: { bodyParser: false } };

function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
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
  if (req.method !== 'GET') return res.status(405).json({ ok: false, error: 'Method not allowed. Use GET.' });

  const supabase = getSupabase();
  if (!supabase) {
    return res.status(200).json({ ok: false, error: 'SERVICE_UNAVAILABLE', message: 'الخدمة غير متاحة حالياً، حاول لاحقاً.' });
  }

  const raw = (req.query && req.query.order_number) || '';
  const orderNumber = String(Array.isArray(raw) ? raw[0] : raw).trim();
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
    console.error('[TRACK-ORDER] Lookup exception:', e?.message || String(e));
    return res.status(200).json({ ok: false, error: 'LOOKUP_FAILED', message: 'حدث خطأ غير متوقع. حاول مرة أخرى لاحقاً.' });
  }

  if (!order) {
    return res.status(200).json({ ok: false, error: 'NOT_FOUND', message: 'لم نعثر على طلب بهذا الرقم. تأكد من رقم الطلب وحاول مرة أخرى.' });
  }

  const orderStatus = normalizeOrderStatus(order.status);
  const rawDeliveryRef = String(order.noest_id || '');
  const isInFlightLock = rawDeliveryRef.startsWith('LOCK:');
  const decoded = isInFlightLock ? { provider: null, tracking: null } : decodeDeliveryRef(rawDeliveryRef);
  const hasShipment = !!(decoded.provider && decoded.tracking);

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
    // Kept for backward compatibility with the existing frontend type. It now
    // means "delivery provider temporarily unavailable", not specifically NOEST.
    noestUnavailable: false,
  };

  if (!hasShipment) {
    return res.status(200).json({ ok: true, data: result });
  }

  let live;
  if (decoded.provider === 'zrexpress') {
    live = await fetchZrTrackingInfo(decoded.tracking);
  } else {
    live = await fetchNoestTrackingInfo(decoded.tracking);
  }

  if (!live.ok) {
    result.noestUnavailable = true;
    return res.status(200).json({ ok: true, data: result });
  }

  result.deliveryStatus = live.publicStatus || 'unknown';
  result.deliveryLabel = deliveryStatusLabel(result.deliveryStatus);
  if (live.lastUpdate) result.lastUpdate = live.lastUpdate;
  result.history = Array.isArray(live.history) ? live.history : [];

  return res.status(200).json({ ok: true, data: result });
}
