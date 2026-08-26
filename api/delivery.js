// ============================================================
// Generic Delivery Orchestration — Vercel Serverless Function
// ============================================================
// Admin-only actions:
//   provider_info      — identify provider for an existing shipment
//   prepare_zrexpress  — resolve ZR territory UUIDs + safe hub choices (READ ONLY)
//   send               — create first shipment in NOEST or ZR Express
//   resend             — explicit re-create after an earlier shipment was deleted
//   sync               — refresh delivery statuses + auto-archive
//
// IMPORTANT: no shipment is ever created on GET/render/load. Creation only
// happens through action=send/resend after an explicit admin button click.
// ============================================================

import { createHmac, randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import {
  buildNoestPayloadFromOrder,
  createNoestShipment,
  decodeDeliveryRef,
  encodeDeliveryRef,
  fetchNoestTrackingsBatch,
  fetchZrTrackingInfo,
  isParcelInDeliveryNetwork,
  normalizeOrderStatus,
  prepareZrOrder,
  createZrShipment,
} from '../lib/deliveryProviders.js';

export const config = { api: { bodyParser: { sizeLimit: '1mb' } } };

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
    const age = Date.now() - parseInt(ts, 10);
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

async function getOrder(supabase, id) {
  try {
    const { data, error } = await supabase.from('orders').select('*').eq('id', id).single();
    if (error || !data) return { ok: false, error: 'ORDER_NOT_FOUND', message: 'تعذر العثور على الطلب.' };
    return { ok: true, data };
  } catch (e) {
    return { ok: false, error: 'ORDER_LOOKUP_FAILED', message: e?.message || 'تعذر قراءة الطلب.' };
  }
}

function validateSendable(order) {
  if (normalizeOrderStatus(order.status) !== 'confirmed') {
    return { ok: false, error: 'STATUS_NOT_ALLOWED', message: 'لا يمكن إرسال الطلب إلى شركة التوصيل قبل تأكيده.' };
  }
  return { ok: true };
}

function isUnknownLock(ref) {
  return String(ref || '').startsWith('LOCK:');
}

async function acquireFirstSendLock(supabase, order, provider) {
  const lockRef = `LOCK:${provider}:${randomUUID()}`;
  try {
    const nowIso = new Date().toISOString();
    const { data, error } = await supabase
      .from('orders')
      .update({ noest_id: lockRef, updated_at: nowIso })
      .eq('id', order.id)
      .is('noest_id', null)
      .select('id')
      .maybeSingle();
    if (error) return { ok: false, error: 'LOCK_FAILED', message: 'تعذر حجز الطلب للإرسال بأمان. حاول مرة أخرى.' };
    if (!data) return { ok: false, error: 'ALREADY_SENT', message: 'هذا الطلب أُرسل مسبقاً أو توجد عملية إرسال أخرى جارية حالياً.' };
    return { ok: true, lockRef };
  } catch {
    return { ok: false, error: 'LOCK_FAILED', message: 'تعذر حجز الطلب للإرسال بأمان.' };
  }
}

async function releaseLock(supabase, id, lockRef) {
  try {
    await supabase.from('orders').update({ noest_id: null, updated_at: new Date().toISOString() }).eq('id', id).eq('noest_id', lockRef);
  } catch {
    // Best effort only. Leaving a lock is safer than risking duplicate shipment.
  }
}

function shouldKeepLockAfterFailure(result) {
  // A timeout/network failure can be ambiguous: the courier might have accepted
  // the parcel just before the connection was lost. Keep the lock so a retry
  // cannot silently create a duplicate shipment.
  return result?.error === 'TIMEOUT' || result?.error === 'NETWORK_ERROR';
}

async function saveShipmentResult(supabase, order, provider, providerTracking, lockRef = null) {
  const nowIso = new Date().toISOString();
  const deliveryRef = encodeDeliveryRef(provider, providerTracking);
  const update = {
    noest_id: deliveryRef,
    delivery_last_sent_at: nowIso,
    delivery_send_count: (order.delivery_send_count || 0) + 1,
    updated_at: nowIso,
  };
  if (!order.sent_to_delivery_at) update.sent_to_delivery_at = nowIso;

  let query = supabase.from('orders').update(update).eq('id', order.id);
  if (lockRef) query = query.eq('noest_id', lockRef);
  const { data, error } = await query.select('id').maybeSingle();
  if (error || !data) {
    return {
      ok: false,
      error: 'SAVE_FAILED_AFTER_SEND',
      message: `تم إنشاء الشحنة لدى شركة التوصيل (رقم التتبع: ${providerTracking}) لكن تعذّر حفظها محلياً. لا تُعد الإرسال؛ احتفظ بهذا الرقم وتواصل مع الدعم الفني.`,
    };
  }

  return {
    ok: true,
    data: {
      delivery_provider: provider,
      delivery_ref: deliveryRef,
      // Backward-compatible key expected by the current React dashboard.
      noest_id: deliveryRef,
      tracking: providerTracking,
      sent_to_delivery_at: update.sent_to_delivery_at || order.sent_to_delivery_at || null,
      delivery_last_sent_at: nowIso,
      delivery_send_count: update.delivery_send_count,
    },
  };
}

async function createShipmentForProvider(order, provider, body) {
  if (provider === 'noest') {
    const built = buildNoestPayloadFromOrder(order);
    if (built.error) return { ok: false, error: 'MISSING_SHIPPING_DATA', message: built.error };
    return createNoestShipment(built.payload);
  }
  if (provider === 'zrexpress') {
    return createZrShipment(order, {
      sourceHubId: body.source_hub_id || null,
      pickupHubId: body.pickup_hub_id || null,
    });
  }
  return { ok: false, error: 'INVALID_PROVIDER', message: 'شركة التوصيل المختارة غير مدعومة.' };
}

async function mapWithConcurrency(items, concurrency, worker) {
  const out = new Array(items.length);
  let index = 0;
  async function runner() {
    while (true) {
      const current = index;
      index += 1;
      if (current >= items.length) return;
      out[current] = await worker(items[current], current);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => runner()));
  return out;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });

  const admin = verifyAdminToken(req.headers.authorization);
  if (!admin) return res.status(401).json({ ok: false, error: 'Admin authentication required' });

  const supabase = getSupabase();
  if (!supabase) return res.status(200).json({ ok: false, error: 'SUPABASE_NOT_CONFIGURED', message: 'قاعدة البيانات غير مضبوطة على الخادم.' });

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  if (!body || typeof body !== 'object') body = {};
  const action = String(body.action || '');

  if (action === 'provider_info') {
    if (!body.id) return res.status(400).json({ ok: false, error: 'id is required' });
    const found = await getOrder(supabase, body.id);
    if (!found.ok) return res.status(200).json(found);
    const ref = found.data.noest_id;
    if (isUnknownLock(ref)) {
      return res.status(200).json({ ok: false, error: 'SEND_STATE_UNKNOWN', message: 'توجد عملية إرسال سابقة لم تُحسم نتيجتها. لا تُعد الإرسال قبل التحقق من لوحة شركة التوصيل.' });
    }
    const decoded = decodeDeliveryRef(ref);
    return res.status(200).json({ ok: true, data: decoded });
  }

  if (action === 'prepare_zrexpress') {
    if (!body.id) return res.status(400).json({ ok: false, error: 'id is required' });
    const found = await getOrder(supabase, body.id);
    if (!found.ok) return res.status(200).json(found);
    const allowed = validateSendable(found.data);
    if (!allowed.ok) return res.status(200).json(allowed);
    const prepared = await prepareZrOrder(found.data);
    if (!prepared.ok) return res.status(200).json(prepared);
    return res.status(200).json({
      ok: true,
      data: {
        delivery_type: prepared.data.deliveryType,
        destination: {
          wilaya: prepared.data.destination.wilaya,
          commune: prepared.data.destination.commune,
        },
        source_hubs: prepared.data.sourceHubs,
        pickup_hubs: prepared.data.pickupHubs,
      },
    });
  }

  if (action === 'send' || action === 'resend') {
    if (!body.id) return res.status(400).json({ ok: false, error: 'id is required' });
    const found = await getOrder(supabase, body.id);
    if (!found.ok) return res.status(200).json(found);
    const order = found.data;
    const allowed = validateSendable(order);
    if (!allowed.ok) return res.status(200).json(allowed);

    const isResend = action === 'resend';
    if (isUnknownLock(order.noest_id)) {
      return res.status(200).json({
        ok: false,
        error: 'SEND_STATE_UNKNOWN',
        message: 'نتيجة محاولة إرسال سابقة غير محسومة بسبب انقطاع الاتصال. تحقّق من لوحة شركة التوصيل قبل أي إعادة إرسال لتجنب شحنة مكررة.',
      });
    }

    let provider;
    if (isResend) {
      if (!order.noest_id) {
        return res.status(200).json({ ok: false, error: 'NOT_SENT_YET', message: 'لم يُرسل هذا الطلب من قبل — استخدم الإرسال العادي.' });
      }
      provider = decodeDeliveryRef(order.noest_id).provider;
    } else {
      if (order.noest_id) {
        return res.status(200).json({ ok: false, error: 'ALREADY_SENT', message: 'هذا الطلب أُرسل مسبقاً إلى شركة التوصيل.' });
      }
      provider = String(body.provider || '');
      if (!['noest', 'zrexpress'].includes(provider)) {
        return res.status(200).json({ ok: false, error: 'INVALID_PROVIDER', message: 'اختر NOEST أو ZR Express.' });
      }
    }

    let lock = null;
    if (!isResend) {
      lock = await acquireFirstSendLock(supabase, order, provider);
      if (!lock.ok) return res.status(200).json(lock);
    }

    console.log(`[DELIVERY] ${isResend ? 'resend' : 'send'} started order=${order.id} provider=${provider}`);
    const shipment = await createShipmentForProvider(order, provider, body);
    if (!shipment.ok) {
      if (lock?.lockRef && !shouldKeepLockAfterFailure(shipment)) {
        await releaseLock(supabase, order.id, lock.lockRef);
      }
      console.error(`[DELIVERY] ${provider} create failed order=${order.id} error=${shipment.error}`);
      return res.status(200).json({ ok: false, error: shipment.error, message: shipment.message || 'تعذر إنشاء الشحنة.' });
    }

    const saved = await saveShipmentResult(supabase, order, provider, shipment.tracking, lock?.lockRef || null);
    if (!saved.ok) {
      console.error(`[DELIVERY] provider shipment created but local save failed order=${order.id} provider=${provider}`);
      return res.status(200).json(saved);
    }

    console.log(`[DELIVERY] shipment created order=${order.id} provider=${provider} tracking=${shipment.tracking}`);
    return res.status(200).json(saved);
  }

  if (action === 'sync') {
    const SYNC_MAX = 200;
    let raw;
    try {
      const { data, error } = await supabase
        .from('orders')
        .select('id, status, noest_id, archived, archived_at, delivery_status, delivery_status_updated_at')
        .not('noest_id', 'is', null)
        .order('updated_at', { ascending: true })
        .limit(500);
      if (error) return res.status(200).json({ ok: false, error: error.message });
      raw = data || [];
    } catch (e) {
      return res.status(200).json({ ok: false, error: e?.message || 'Sync query failed' });
    }

    const candidates = raw
      .filter((o) => !isUnknownLock(o.noest_id))
      .filter((o) => !(o.archived && (o.delivery_status === 'delivered' || o.delivery_status === 'returned')))
      .slice(0, SYNC_MAX);

    if (!candidates.length) return res.status(200).json({ ok: true, data: { checked: 0, updated: [], unavailable: 0 } });

    const noestOrders = [];
    const zrOrders = [];
    for (const order of candidates) {
      const decoded = decodeDeliveryRef(order.noest_id);
      if (decoded.provider === 'zrexpress') zrOrders.push({ order, tracking: decoded.tracking });
      else if (decoded.provider === 'noest') noestOrders.push({ order, tracking: decoded.tracking });
    }

    const normalized = new Map();

    // NOEST supports native batched tracking lookup; preserve that efficient path.
    const NOEST_BATCH = 60;
    for (let i = 0; i < noestOrders.length; i += NOEST_BATCH) {
      const chunk = noestOrders.slice(i, i + NOEST_BATCH);
      const result = await fetchNoestTrackingsBatch(chunk.map((x) => x.tracking));
      for (const item of chunk) {
        const info = result[item.tracking];
        if (info) normalized.set(item.order.id, { group: info.group, occurredAt: info.occurredAt });
      }
    }

    // ZR's documented resource endpoint is per parcel. Keep concurrency low so
    // a dashboard sync cannot overwhelm/rate-limit the courier API.
    const zrResults = await mapWithConcurrency(zrOrders, 4, async (item) => {
      const info = await fetchZrTrackingInfo(item.tracking);
      return info.ok ? { id: item.order.id, group: info.adminGroup, occurredAt: info.lastUpdate } : null;
    });
    for (const info of zrResults) if (info) normalized.set(info.id, info);

    const nowIso = new Date().toISOString();
    const updated = [];
    let unavailable = 0;

    for (const order of candidates) {
      const info = normalized.get(order.id);
      if (!info) { unavailable += 1; continue; }
      const isConfirmed = normalizeOrderStatus(order.status) === 'confirmed';
      const shouldArchive = isConfirmed && !order.archived && isParcelInDeliveryNetwork(info.group);
      const groupChanged = info.group !== order.delivery_status;
      if (!groupChanged && !shouldArchive) continue;

      const update = { updated_at: nowIso };
      if (groupChanged) {
        update.delivery_status = info.group;
        update.delivery_status_updated_at = nowIso;
      }
      if (shouldArchive) {
        update.archived = true;
        update.archived_at = nowIso;
      }

      try {
        const { error } = await supabase.from('orders').update(update).eq('id', order.id);
        if (error) continue;
        updated.push({
          id: order.id,
          deliveryStatus: info.group,
          deliveryStatusUpdatedAt: groupChanged ? nowIso : (order.delivery_status_updated_at || nowIso),
          archived: shouldArchive ? true : !!order.archived,
          archivedAt: shouldArchive ? nowIso : undefined,
        });
      } catch {
        // Keep previous known state on any DB failure.
      }
    }

    console.log(`[DELIVERY] sync checked=${candidates.length} updated=${updated.length} unavailable=${unavailable}`);
    return res.status(200).json({ ok: true, data: { checked: candidates.length, updated, unavailable } });
  }

  return res.status(400).json({
    ok: false,
    error: `Unknown action: ${action}`,
    available: ['provider_info', 'prepare_zrexpress', 'send', 'resend', 'sync'],
  });
}
