import { randomUUID } from 'node:crypto';
import { checkoutOfficeId } from './checkoutDeliverySelection.js';

// ============================================================
// Shared delivery-provider helpers
// NOEST (legacy/current production) + ZR Express NEW (api.zrexpress.app/v1)
// Server-side only: never import this module from the browser bundle.
// ============================================================

const ZR_PREFIX = 'ZR:';

export function encodeDeliveryRef(provider, ref) {
  const value = String(ref || '').trim();
  if (!value) return '';
  return provider === 'zrexpress' ? `${ZR_PREFIX}${value}` : value;
}

export function decodeDeliveryRef(value) {
  const ref = String(value || '').trim();
  if (!ref) return { provider: null, tracking: null };
  if (ref.startsWith(ZR_PREFIX)) {
    return { provider: 'zrexpress', tracking: ref.slice(ZR_PREFIX.length) || null };
  }
  // Backward compatibility: every existing unprefixed noest_id is NOEST.
  return { provider: 'noest', tracking: ref };
}

export function normalizeOrderStatus(status) {
  return (status === 'shipped' || status === 'delivered') ? 'confirmed' : status;
}

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[’'`\-_.]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function samePlace(a, b) {
  const x = normalizeText(a);
  const y = normalizeText(b);
  if (!x || !y) return false;
  return x === y || x.replace(/\s/g, '') === y.replace(/\s/g, '');
}

function withTimeout(ms = 20_000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return { controller, done: () => clearTimeout(timer) };
}

function safeMessage(data, fallback) {
  if (!data || typeof data !== 'object') return fallback;
  return String(data.message || data.detail || data.title || fallback).slice(0, 500);
}

// ============================================================
// NOEST
// ============================================================

export function buildNoestPayloadFromOrder(order) {
  const missing = [];
  if (!order.wilaya_id) missing.push('wilaya_id');
  if (!order.commune) missing.push('commune');
  if (!order.customer) missing.push('customer');
  if (!order.phone) missing.push('phone');
  if (!order.address) missing.push('address');
  if (missing.length) {
    return {
      error: `بيانات الشحن غير مكتملة لهذا الطلب (${missing.join(', ')}) — لا يمكن إرساله إلى شركة التوصيل.`,
    };
  }

  const stopDesk = order.delivery_type === 'office' ? 1 : 0;
  let station_code;
  if (stopDesk === 1) {
    station_code = checkoutOfficeId(order);
    if (!station_code) {
      return { error: 'رمز مكتب NOEST غير محفوظ لهذا الطلب — لا يمكن إرساله تلقائياً.' };
    }
  }

  const items = Array.isArray(order.items) ? order.items : [];
  const produit = items.map((i) => `${i.name || 'منتج'} x${Number(i.quantity) || 1}`).join(', ') || 'منتجات المعراج';

  return {
    payload: {
      client: String(order.customer),
      phone: String(order.phone),
      adresse: String(order.address),
      wilaya_id: Number(order.wilaya_id),
      commune: String(order.commune),
      montant: Number(order.total) || 0,
      produit,
      type_id: 1,
      stop_desk: stopDesk,
      ...(stopDesk === 1 ? { station_code } : {}),
    },
  };
}

export async function createNoestShipment(payload) {
  const API_TOKEN = process.env.NOEST_API_TOKEN;
  const USER_GUID = process.env.NOEST_USER_GUID;
  const BASE = (process.env.NOEST_API_BASE || 'https://app.noest-dz.com').replace(/\/+$/, '');

  if (!API_TOKEN || !USER_GUID) {
    return { ok: false, error: 'NOEST_NOT_CONFIGURED', message: 'إعدادات NOEST غير مكتملة على الخادم.' };
  }

  const timeout = withTimeout(30_000);
  try {
    const r = await fetch(`${BASE}/api/public/create/order`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ api_token: API_TOKEN, user_guid: USER_GUID, ...payload }),
      signal: timeout.controller.signal,
    });
    const text = await r.text();
    let data = null;
    try { data = JSON.parse(text); } catch { /* ignore */ }

    if (r.ok && data && data.success === true) {
      const tracking = String(data.tracking || data.reference || '').trim();
      if (!tracking) return { ok: false, error: 'NOEST_NO_TRACKING', message: 'قبلت NOEST الطلب لكن لم تُرجع رقم تتبع.' };
      return { ok: true, tracking };
    }
    return { ok: false, error: 'NOEST_REJECTED', message: safeMessage(data, 'رفضت NOEST إنشاء الشحنة.') };
  } catch (e) {
    const isAbort = e && e.name === 'AbortError';
    return {
      ok: false,
      error: isAbort ? 'TIMEOUT' : 'NETWORK_ERROR',
      message: isAbort ? 'انتهت مهلة الاتصال بـ NOEST — حاول مرة أخرى.' : 'تعذر الاتصال بـ NOEST.',
    };
  } finally {
    timeout.done();
  }
}

const NOEST_ADMIN_STATUS_GROUPS = {
  in_preparation: ['upload', 'customer_validation'],
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

function mapNoestAdminStatus(providerStatus) {
  for (const [group, keys] of Object.entries(NOEST_ADMIN_STATUS_GROUPS)) {
    if (keys.includes(providerStatus)) return group;
  }
  return 'unknown';
}

const NOEST_PUBLIC_STATUS_GROUPS = {
  in_preparation: ['upload', 'customer_validation'],
  shipped: ['validation_collect_colis', 'validation_reception_admin', 'validation_reception', 'sent_to_redispatch'],
  out_for_delivery: ['fdr_activated'],
  delivered: ['livre', 'livred'],
  delivery_issue: [
    'colis_suspendu', 'return_asked_by_customer', 'return_asked_by_hub',
    'retour_dispatched_to_partenaires', 'return_dispatched_to_partenaire',
    'colis_retour_transmit_to_partner', 'livraison_echoue_recu',
    'return_validated_by_partener', 'return_redispatched_to_livraison',
    'return_dispatched_to_warehouse',
  ],
};

function mapNoestPublicStatus(providerStatus) {
  for (const [group, keys] of Object.entries(NOEST_PUBLIC_STATUS_GROUPS)) {
    if (keys.includes(providerStatus)) return group;
  }
  return 'unknown';
}

const NOEST_EVENT_LABELS = {
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

function noestEventLabel(status) {
  return NOEST_EVENT_LABELS[status] || '🔄 تحديث في حالة الشحنة';
}

function parseNoestEntry(entry) {
  if (!entry || typeof entry !== 'object') return null;
  const rawEvents = Array.isArray(entry.activity) ? entry.activity : (Array.isArray(entry.events) ? entry.events : []);
  const events = rawEvents.map((e) => {
    const providerStatus = e.event_key || e.key || e.status || 'unknown';
    const dateStr = e.date || e.created_at || e.updated_at || null;
    let occurredAt = null;
    if (dateStr) {
      const d = new Date(dateStr);
      if (!Number.isNaN(d.getTime())) occurredAt = d.toISOString();
    }
    return { providerStatus, occurredAt, label: noestEventLabel(providerStatus) };
  }).sort((a, b) => {
    if (!a.occurredAt) return 1;
    if (!b.occurredAt) return -1;
    return a.occurredAt.localeCompare(b.occurredAt);
  });
  const last = [...events].reverse().find((e) => e.occurredAt) || events[events.length - 1] || null;
  return { events, last };
}

export async function fetchNoestTrackingInfo(trackingCode) {
  const API_TOKEN = process.env.NOEST_API_TOKEN;
  const USER_GUID = process.env.NOEST_USER_GUID;
  const BASE = (process.env.NOEST_API_BASE || 'https://app.noest-dz.com').replace(/\/+$/, '');
  if (!API_TOKEN || !USER_GUID) return { ok: false };

  const timeout = withTimeout(15_000);
  try {
    const r = await fetch(`${BASE}/api/public/get/trackings/info`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ api_token: API_TOKEN, user_guid: USER_GUID, trackings: [trackingCode] }),
      signal: timeout.controller.signal,
    });
    if (!r.ok) return { ok: false };
    const data = await r.json().catch(() => null);
    if (!data || typeof data !== 'object') return { ok: false };
    const entry = data[trackingCode] || Object.values(data)[0];
    const parsed = parseNoestEntry(entry);
    if (!parsed) return { ok: false };
    return {
      ok: true,
      adminGroup: parsed.last ? mapNoestAdminStatus(parsed.last.providerStatus) : 'unknown',
      publicStatus: parsed.last ? mapNoestPublicStatus(parsed.last.providerStatus) : 'unknown',
      rawStatus: parsed.last?.providerStatus || 'unknown',
      lastUpdate: parsed.last?.occurredAt || null,
      history: parsed.events.map((e) => ({ label: e.label, occurredAt: e.occurredAt })),
    };
  } catch {
    return { ok: false };
  } finally {
    timeout.done();
  }
}

export async function fetchNoestTrackingsBatch(trackingCodes) {
  const API_TOKEN = process.env.NOEST_API_TOKEN;
  const USER_GUID = process.env.NOEST_USER_GUID;
  const BASE = (process.env.NOEST_API_BASE || 'https://app.noest-dz.com').replace(/\/+$/, '');
  const out = {};
  if (!API_TOKEN || !USER_GUID || !Array.isArray(trackingCodes) || trackingCodes.length === 0) return out;

  const timeout = withTimeout(20_000);
  try {
    const r = await fetch(`${BASE}/api/public/get/trackings/info`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ api_token: API_TOKEN, user_guid: USER_GUID, trackings: trackingCodes }),
      signal: timeout.controller.signal,
    });
    if (!r.ok) return out;
    const data = await r.json().catch(() => null);
    if (!data || typeof data !== 'object') return out;
    for (const code of trackingCodes) {
      const entry = data[code];
      const parsed = parseNoestEntry(entry);
      if (!parsed) continue;
      out[code] = {
        group: parsed.last ? mapNoestAdminStatus(parsed.last.providerStatus) : 'unknown',
        occurredAt: parsed.last?.occurredAt || null,
      };
    }
    return out;
  } catch {
    return out;
  } finally {
    timeout.done();
  }
}

// ============================================================
// ZR EXPRESS NEW
// ============================================================

function zrConfig() {
  const base = (process.env.ZREXPRESS_API_BASE || 'https://api.zrexpress.app').replace(/\/+$/, '');
  const version = String(process.env.ZREXPRESS_API_VERSION || 'v1').replace(/^\/+|\/+$/g, '');
  const tenant = process.env.ZREXPRESS_TENANT_ID;
  const apiKey = process.env.ZREXPRESS_API_KEY;
  return { base, version, tenant, apiKey, configured: !!(tenant && apiKey) };
}

export function getZrSafeConfig() {
  const cfg = zrConfig();
  return {
    configured: cfg.configured,
    base: cfg.base,
    version: cfg.version,
    tenant: cfg.tenant ? 'set' : 'missing',
    apiKey: cfg.apiKey ? 'set' : 'missing',
  };
}

async function zrRequest(path, { method = 'GET', body = undefined, timeoutMs = 20_000 } = {}) {
  const cfg = zrConfig();
  if (!cfg.configured) {
    return { ok: false, status: 0, error: 'ZREXPRESS_NOT_CONFIGURED', message: 'إعدادات ZR Express غير مكتملة على الخادم.' };
  }

  const timeout = withTimeout(timeoutMs);
  try {
    const url = `${cfg.base}/api/${cfg.version}/${String(path).replace(/^\/+/, '')}`;
    const r = await fetch(url, {
      method,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'X-Tenant': cfg.tenant,
        'X-Api-Key': cfg.apiKey,
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      signal: timeout.controller.signal,
    });
    const text = await r.text();
    let data = null;
    if (text) {
      try { data = JSON.parse(text); } catch { data = null; }
    }
    if (!r.ok) {
      return {
        ok: false,
        status: r.status,
        error: r.status === 401 || r.status === 403 ? 'ZREXPRESS_AUTH_FAILED' : 'ZREXPRESS_REJECTED',
        message: safeMessage(data, `ZR Express رفضت الطلب (HTTP ${r.status}).`),
      };
    }
    return { ok: true, status: r.status, data };
  } catch (e) {
    const isAbort = e && e.name === 'AbortError';
    return {
      ok: false,
      status: 0,
      error: isAbort ? 'TIMEOUT' : 'NETWORK_ERROR',
      message: isAbort ? 'انتهت مهلة الاتصال بـ ZR Express.' : 'تعذر الاتصال بـ ZR Express.',
    };
  } finally {
    timeout.done();
  }
}

async function zrSearchAll(path, baseBody = {}, pageSize = 500) {
  const out = [];
  let pageNumber = 1;
  for (let guard = 0; guard < 20; guard += 1) {
    const r = await zrRequest(path, { method: 'POST', body: { ...baseBody, pageNumber, pageSize } });
    if (!r.ok) return r;
    const data = r.data || {};
    const items = Array.isArray(data.items) ? data.items : (Array.isArray(data.data) ? data.data : []);
    out.push(...items);
    if (!data.hasNext || items.length === 0) break;
    pageNumber += 1;
  }
  return { ok: true, data: out };
}

export async function testZrCredentials() {
  const r = await zrRequest('workflows/search', { method: 'POST', body: { pageNumber: 1, pageSize: 1 } });
  return { ok: r.ok, error: r.error, message: r.message };
}

export async function getZrTerritories({ level = null, parentId = null } = {}) {
  const filters = [];
  if (level) filters.push({ field: 'level', operator: 'eq', value: level });
  if (parentId) filters.push({ field: 'parentId', operator: 'eq', value: parentId });
  const body = { orderBy: ['code asc'] };
  if (filters.length) body.advancedFilter = { logic: 'and', filters };
  const r = await zrSearchAll('territories/search', body, 500);
  if (!r.ok) return r;
  return {
    ok: true,
    data: r.data.map((t) => ({
      id: t.id,
      code: Number(t.code || 0),
      name: String(t.name || ''),
      nameArabic: t.nameArabic || null,
      level: String(t.level || ''),
      parentId: t.parentId || null,
      hasHomeDelivery: !!(t.delivery?.hasHomeDelivery ?? t.hasHomeDelivery),
      hasPickupPoint: !!(t.delivery?.hasPickupPoint ?? t.hasPickupPoint),
    })),
  };
}

export async function resolveZrDestination(order) {
  if (!order || !order.wilaya_id || !order.commune) {
    return { ok: false, error: 'MISSING_SHIPPING_DATA', message: 'الولاية أو البلدية غير محفوظة في هذا الطلب.' };
  }

  const wilayas = await getZrTerritories({ level: 'wilaya' });
  if (!wilayas.ok) return wilayas;
  const wilayaCode = Number(order.wilaya_id);
  const wilaya = wilayas.data.find((w) => w.code === wilayaCode)
    || wilayas.data.find((w) => samePlace(w.name, order.wilaya) || samePlace(w.nameArabic, order.wilaya));
  if (!wilaya) {
    return { ok: false, error: 'ZR_WILAYA_NOT_FOUND', message: `لم أجد الولاية «${order.wilaya || wilayaCode}» في بيانات ZR Express.` };
  }

  const communes = await getZrTerritories({ level: 'commune', parentId: wilaya.id });
  if (!communes.ok) return communes;
  const commune = communes.data.find((c) => samePlace(c.name, order.commune) || samePlace(c.nameArabic, order.commune));
  if (!commune) {
    return {
      ok: false,
      error: 'ZR_COMMUNE_NOT_FOUND',
      message: `البلدية «${order.commune}» غير مطابقة لبيانات ZR Express في ولاية ${wilaya.nameArabic || wilaya.name}.`,
    };
  }

  return {
    ok: true,
    data: {
      cityTerritoryId: wilaya.id,
      districtTerritoryId: commune.id,
      wilaya,
      commune,
    },
  };
}

export async function getZrHubs() {
  const r = await zrSearchAll('hubs/search', { includeServices: false }, 500);
  if (!r.ok) return r;
  return {
    ok: true,
    data: r.data.map((h) => {
      const a = h.address || {};
      return {
        id: String(h.id || ''),
        name: String(h.name || ''),
        type: String(h.type || ''),
        isPickupPoint: !!h.isPickupPoint,
        cityName: String(a.city || ''),
        communeName: String(a.district || ''),
        cityTerritoryId: a.cityTerritoryId || null,
        districtTerritoryId: a.districtTerritoryId || null,
        address: String(a.street || ''),
      };
    }).filter((h) => h.id),
  };
}

export async function prepareZrOrder(order) {
  const destination = await resolveZrDestination(order);
  if (!destination.ok) return destination;
  const hubs = await getZrHubs();
  if (!hubs.ok) return hubs;

  const d = destination.data;
  const sourceHubs = hubs.data;
  const pickupHubs = hubs.data.filter((h) => {
    if (!h.isPickupPoint) return false;
    if (h.districtTerritoryId && h.districtTerritoryId === d.districtTerritoryId) return true;
    if (h.cityTerritoryId && h.cityTerritoryId === d.cityTerritoryId) return true;
    return samePlace(h.communeName, order.commune) || samePlace(h.cityName, order.wilaya);
  });

  return {
    ok: true,
    data: {
      deliveryType: order.delivery_type === 'office' ? 'office' : 'home',
      destination: d,
      sourceHubs,
      pickupHubs,
    },
  };
}

function normalizeAlgerianPhone(value) {
  let p = String(value || '').trim().replace(/[\s().-]/g, '');
  if (p.startsWith('00213')) p = `+213${p.slice(5)}`;
  else if (p.startsWith('213')) p = `+${p}`;
  else if (p.startsWith('0')) p = `+213${p.slice(1)}`;
  if (!p.startsWith('+')) p = `+213${p}`;
  return p;
}

async function resolveReadyToDispatchStateId() {
  const r = await zrRequest('workflows/search', { method: 'POST', body: { pageNumber: 1, pageSize: 100 } });
  if (!r.ok) return r;
  const items = r.data?.items ?? r.data?.data ?? [];
  const states = (Array.isArray(items) ? items : []).flatMap((w) => w?.states ?? w?.workflowStates ?? [w]);
  const ready = states.find((st) => {
    const name = String(st?.name || '').toLowerCase().replace(/[\s_-]/g, '');
    return name === 'readytodispatch';
  });
  if (!ready?.id) {
    return {
      ok: false,
      error: 'ZR_READY_STATE_NOT_FOUND',
      message: 'تعذر العثور على حالة ReadyToDispatch في ZR Express؛ أوقفت إنشاء الشحنة حتى لا تبقى معلقة في OrderReceived.',
    };
  }
  return { ok: true, data: String(ready.id) };
}

export async function createZrShipment(order, { sourceHubId = null, pickupHubId = null } = {}) {
  const destination = await resolveZrDestination(order);
  if (!destination.ok) return destination;
  const hubsResult = await getZrHubs();
  if (!hubsResult.ok) return hubsResult;

  const isOffice = order.delivery_type === 'office';
  const chosenHubId = String(isOffice ? (pickupHubId || '') : (sourceHubId || '')).trim();
  if (!chosenHubId) {
    return {
      ok: false,
      error: isOffice ? 'ZR_PICKUP_HUB_REQUIRED' : 'ZR_SOURCE_HUB_REQUIRED',
      message: isOffice ? 'اختر مكتب ZR Express للاستلام.' : 'اختر مركز ZR Express المصدر قبل إنشاء الشحنة.',
    };
  }

  const selectedHub = hubsResult.data.find((h) => h.id === chosenHubId);
  if (!selectedHub) return { ok: false, error: 'ZR_HUB_INVALID', message: 'مركز ZR Express المختار غير صالح أو لم يعد متاحاً.' };

  if (isOffice) {
    if (!selectedHub.isPickupPoint) return { ok: false, error: 'ZR_HUB_NOT_PICKUP', message: 'المركز المختار ليس مكتب استلام لدى ZR Express.' };
    const d = destination.data;
    const matchesDestination =
      (selectedHub.districtTerritoryId && selectedHub.districtTerritoryId === d.districtTerritoryId)
      || (selectedHub.cityTerritoryId && selectedHub.cityTerritoryId === d.cityTerritoryId)
      || samePlace(selectedHub.communeName, order.commune)
      || samePlace(selectedHub.cityName, order.wilaya);
    if (!matchesDestination) return { ok: false, error: 'ZR_PICKUP_HUB_WRONG_DESTINATION', message: 'مكتب ZR Express المختار لا يتبع وجهة هذا الطلب.' };
  }

  // Critical ZR NEW rule: the parcel must be created in ReadyToDispatch,
  // otherwise it can remain in OrderReceived and never be picked up by the hub.
  // We fail safely instead of creating a silently-stuck parcel.
  const readyState = await resolveReadyToDispatchStateId();
  if (!readyState.ok) return readyState;

  const items = Array.isArray(order.items) ? order.items : [];
  const description = items.map((i) => `${i.name || 'منتج'} x${Number(i.quantity) || 1}`).join(', ') || 'منتجات المعراج';
  const orderedProducts = items.length > 0
    ? items.map((i) => ({
        productName: String(i.name || 'منتج المعراج'),
        unitPrice: Number(i.price) || 0,
        quantity: Math.max(1, Number(i.quantity) || 1),
        stockType: 'none',
      }))
    : [{ productName: 'منتجات المعراج', unitPrice: Number(order.total) || 0, quantity: 1, stockType: 'none' }];

  const payload = {
    hubId: chosenHubId,
    stateId: readyState.data,
    customer: {
      customerId: randomUUID(),
      name: String(order.customer || '').trim(),
      phone: { number1: normalizeAlgerianPhone(order.phone) },
    },
    deliveryAddress: {
      cityTerritoryId: destination.data.cityTerritoryId,
      districtTerritoryId: destination.data.districtTerritoryId,
      street: String(order.address || '').trim() || null,
    },
    orderedProducts,
    deliveryType: isOffice ? 'pickup-point' : 'home',
    description: description.slice(0, 250),
    amount: Number(order.total) || 0,
    externalId: String(order.tracking || order.id),
  };

  const created = await zrRequest('parcels', { method: 'POST', body: payload, timeoutMs: 30_000 });
  if (!created.ok) return created;
  const parcelId = created.data?.id ? String(created.data.id) : '';
  if (!parcelId) return { ok: false, error: 'ZR_NO_PARCEL_ID', message: 'قبلت ZR Express الطلب لكن لم تُرجع معرّف الشحنة.' };

  const full = await zrRequest(`parcels/${encodeURIComponent(parcelId)}`, { method: 'GET', timeoutMs: 20_000 });
  const tracking = String(full.ok ? (full.data?.trackingNumber || parcelId) : parcelId).trim();
  return { ok: true, tracking, shipmentId: parcelId };
}

function zrStatusKey(raw) {
  return String(raw || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[\s_-]/g, '');
}

const ZR_STATUS = {
  inPreparation: new Set(['commanderecue', 'orderreceived', 'entraitement', 'inprocessing', 'appelconfirmation', 'confirmationcall', 'commandeconfirmee', 'orderconfirmed', 'enpreparation', 'inpreparation', 'pretaexpedier', 'readytodispatch']),
  inTransit: new Set(['confirmeaubureau', 'confirmedatbranch', 'dispatch', 'dispatched', 'verswilaya', 'interwilayatransit', 'enlivraison', 'indelivery', 'sortieenlivraison', 'outfordelivery', 'disponiblebureau', 'readyforpickup', 'enattenteclient', 'waitingclient']),
  delivered: new Set(['livre', 'delivered', 'encaisse', 'collected', 'recouvert']),
  failed: new Set(['echeclivraison', 'faileddelivery', 'deliveryfailed', 'commandeannulee', 'orderrefused', 'enattenteechange', 'remboursement', 'annule', 'cancelled']),
  returned: new Set(['retour', 'returning', 'enretour', 'inreturn', 'retourne', 'returned', 'retourconfirme', 'returnconfirmed', 'reinjectestock']),
  outForDelivery: new Set(['sortieenlivraison', 'outfordelivery', 'disponiblebureau', 'readyforpickup', 'enattenteclient', 'waitingclient']),
};

export function mapZrAdminStatus(raw) {
  const key = zrStatusKey(raw);
  if (ZR_STATUS.delivered.has(key)) return 'delivered';
  if (ZR_STATUS.returned.has(key)) return 'returned';
  if (ZR_STATUS.failed.has(key)) return 'delivery_attempt_failed';
  if (ZR_STATUS.inTransit.has(key)) return 'in_transit';
  if (ZR_STATUS.inPreparation.has(key)) return 'in_preparation';
  return 'unknown';
}

function mapZrPublicStatus(raw) {
  const key = zrStatusKey(raw);
  if (ZR_STATUS.delivered.has(key)) return 'delivered';
  if (ZR_STATUS.outForDelivery.has(key)) return 'out_for_delivery';
  if (ZR_STATUS.returned.has(key) || ZR_STATUS.failed.has(key)) return 'delivery_issue';
  if (ZR_STATUS.inTransit.has(key)) return 'shipped';
  if (ZR_STATUS.inPreparation.has(key)) return 'in_preparation';
  return 'unknown';
}

function zrPublicLabel(raw, publicStatus) {
  const key = zrStatusKey(raw);
  if (key === 'readyforpickup' || key === 'disponiblebureau' || key === 'waitingclient' || key === 'enattenteclient') return '🏢 الطرد جاهز للاستلام من المكتب';
  switch (publicStatus) {
    case 'in_preparation': return '📦 قيد التحضير للشحن';
    case 'shipped': return '🚚 في الطريق';
    case 'out_for_delivery': return '🚚 خرج للتسليم / جاهز للاستلام';
    case 'delivered': return '✅ تم التسليم';
    case 'delivery_issue': return '⚠️ هناك تحديث يحتاج متابعة في عملية التسليم';
    default: return '🔄 تحديث في حالة الشحنة';
  }
}

export async function fetchZrTrackingInfo(trackingCode) {
  const ref = String(trackingCode || '').trim();
  if (!ref) return { ok: false };
  const r = await zrRequest(`parcels/${encodeURIComponent(ref)}`, { method: 'GET', timeoutMs: 15_000 });
  if (!r.ok || !r.data) return { ok: false };

  const rawStatus = String(r.data?.state?.name || r.data?.situation?.name || r.data?.status || 'unknown');
  const dateRaw = r.data?.updatedAt || r.data?.modifiedAt || r.data?.createdAt || null;
  let lastUpdate = null;
  if (dateRaw) {
    const d = new Date(dateRaw);
    if (!Number.isNaN(d.getTime())) lastUpdate = d.toISOString();
  }
  const publicStatus = mapZrPublicStatus(rawStatus);
  return {
    ok: true,
    adminGroup: mapZrAdminStatus(rawStatus),
    publicStatus,
    rawStatus,
    lastUpdate,
    history: [{ label: zrPublicLabel(rawStatus, publicStatus), occurredAt: lastUpdate }],
  };
}

export function deliveryStatusLabel(normalized) {
  switch (normalized) {
    case 'in_preparation': return '📦 قيد التحضير للشحن';
    case 'shipped': return '🚚 في الطريق';
    case 'out_for_delivery': return '🚚 خرج للتسليم';
    case 'delivered': return '✅ تم التسليم';
    case 'delivery_issue': return '⚠️ هناك تأخير أو تحديث في التسليم — سيتم التواصل معك';
    default: return '🚚 جاري متابعة الشحنة';
  }
}

export function isParcelInDeliveryNetwork(group) {
  return group !== 'in_preparation' && group !== 'unknown';
}
