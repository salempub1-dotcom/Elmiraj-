// ============================================================
// Delivery API Proxy — NOEST legacy endpoints + provider orchestration
// ============================================================
// This remains ONE Vercel Function so the Hobby deployment stays within the
// 12-function limit. Provider orchestration lives under /lib and is delegated
// through delivery_* actions. Existing NOEST actions and response shapes are
// preserved for backward compatibility.
// ============================================================

import { createClient } from '@supabase/supabase-js';
import { handleDeliveryAction } from '../lib/deliveryOrchestrator.js';
import { getZrDeliveryQuote, getZrSafeConfig, prepareZrOrder } from '../lib/deliveryProviders.js';
import { readDeliverySettings } from '../lib/deliverySettings.js';

export const config = { api: { bodyParser: true } };

const RECENT = new Map();
const TTL_SUCCESS_S = 60;
const TTL_FAILURE_S = 10;
const CLEANUP_INTERVAL_MS = 30_000;
let lastCleanup = Date.now();

function cleanupRecent() {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) return;
  lastCleanup = now;
  for (const [key, entry] of RECENT.entries()) {
    if (now - entry.timestamp > entry.ttl * 1000) RECENT.delete(key);
  }
}

const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const hasUpstash = !!(UPSTASH_URL && UPSTASH_TOKEN);

async function redisGet(key) {
  if (!hasUpstash) return null;
  try {
    const r = await fetch(`${UPSTASH_URL}/get/${encodeURIComponent(key)}`, {
      headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` },
    });
    if (!r.ok) return null;
    const body = await r.json();
    if (!body.result) return null;
    return JSON.parse(body.result);
  } catch (e) {
    console.warn('[IDEMPOTENCY] Upstash GET failed:', e?.message || String(e));
    return null;
  }
}

async function redisSet(key, value, ttlSeconds) {
  if (!hasUpstash) return false;
  try {
    const r = await fetch(`${UPSTASH_URL}/set/${encodeURIComponent(key)}/${encodeURIComponent(JSON.stringify(value))}/ex/${ttlSeconds}`, {
      headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` },
    });
    return r.ok;
  } catch (e) {
    console.warn('[IDEMPOTENCY] Upstash SET failed:', e?.message || String(e));
    return false;
  }
}

async function dedupGet(requestId) {
  const upstashResult = await redisGet(`dedup:${requestId}`);
  if (upstashResult) return { ...upstashResult, source: 'upstash' };
  const mapEntry = RECENT.get(requestId);
  if (!mapEntry) return null;
  const age = Date.now() - mapEntry.timestamp;
  if (age >= mapEntry.ttl * 1000) {
    RECENT.delete(requestId);
    return null;
  }
  return { ...mapEntry.response, source: 'memory', age_ms: age };
}

async function dedupSet(requestId, response, ttlSeconds) {
  redisSet(`dedup:${requestId}`, response, ttlSeconds).catch(() => {});
  RECENT.set(requestId, { response, timestamp: Date.now(), ttl: ttlSeconds });
}

function getSupabaseForDeliverySettings() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

function safeJson(v) {
  try { return JSON.stringify(v); } catch { return String(v); }
}

function toObj(maybeJson) {
  if (!maybeJson) return null;
  if (typeof maybeJson === 'object') return maybeJson;
  if (typeof maybeJson !== 'string') return null;
  try { return JSON.parse(maybeJson); } catch { return null; }
}

export default async function handler(req, res) {
  cleanupRecent();

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'GET') {
    const zr = getZrSafeConfig();
    return res.status(200).json({
      ok: true,
      message: '✅ Delivery proxy is deployed and running',
      env: {
        NOEST_API_TOKEN: process.env.NOEST_API_TOKEN ? '✅ Set' : '❌ MISSING',
        NOEST_USER_GUID: process.env.NOEST_USER_GUID ? '✅ Set' : '❌ MISSING',
        NOEST_API_BASE: process.env.NOEST_API_BASE || 'https://app.noest-dz.com',
        ZREXPRESS_TENANT_ID: zr.tenant === 'set' ? '✅ Set' : '❌ MISSING',
        ZREXPRESS_API_KEY: zr.apiKey === 'set' ? '✅ Set' : '❌ MISSING',
        ZREXPRESS_API_BASE: zr.base,
        ZREXPRESS_API_VERSION: zr.version,
        UPSTASH_REDIS: hasUpstash ? '✅ Connected (cross-instance dedup)' : '⚠️ Not configured (using in-memory Map only)',
      },
      idempotency: {
        store: hasUpstash ? 'upstash+memory' : 'memory-only',
        memory_cache_size: RECENT.size,
        ttl_success: `${TTL_SUCCESS_S}s`,
        ttl_failure: `${TTL_FAILURE_S}s`,
      },
      timestamp: new Date().toISOString(),
    });
  }

  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  if (!body || typeof body !== 'object') body = {};
  const action = String(body.action || '');

  // Public storefront provider configuration. This reveals only enabled/disabled
  // booleans and safe office data; courier credentials never leave the server.
  if (action === 'checkout_delivery_settings') {
    const settings = await readDeliverySettings(getSupabaseForDeliverySettings());
    return res.status(200).json({ ok: true, data: settings.data, source: settings.source });
  }

  if (action === 'checkout_zr_options') {
    const wilayaId = Number(body.wilaya_id);
    const commune = String(body.commune || '').trim();
    if (!wilayaId || !commune) return res.status(400).json({ ok: false, error: 'wilaya_id and commune are required' });

    const settings = await readDeliverySettings(getSupabaseForDeliverySettings());
    if (!settings.data.zrexpress) {
      return res.status(200).json({ ok: false, error: 'PROVIDER_DISABLED', message: 'ZR Express غير متاحة في المتجر حاليًا.' });
    }

    const prepared = await prepareZrOrder({
      wilaya_id: wilayaId,
      commune,
      wilaya: String(wilayaId),
      delivery_type: 'office',
    });
    if (!prepared.ok) return res.status(200).json({ ok: false, error: prepared.error, message: prepared.message || 'تعذر تحميل مكاتب ZR Express.' });
    return res.status(200).json({
      ok: true,
      data: {
        destination: { wilaya: prepared.data.destination.wilaya, commune: prepared.data.destination.commune },
        pickup_hubs: prepared.data.pickupHubs,
      },
    });
  }

  if (action === 'checkout_zr_quote') {
    const wilayaId = Number(body.wilaya_id);
    const commune = String(body.commune || '').trim();
    if (!wilayaId || !commune) return res.status(400).json({ ok: false, error: 'wilaya_id and commune are required' });

    const settings = await readDeliverySettings(getSupabaseForDeliverySettings());
    if (!settings.data.zrexpress) {
      return res.status(200).json({ ok: false, error: 'PROVIDER_DISABLED', message: 'ZR Express غير متاحة في المتجر حاليًا.' });
    }

    const quote = await getZrDeliveryQuote({ wilaya_id: wilayaId, commune, wilaya: String(wilayaId) });
    return res.status(quote.ok ? 200 : 200).json(quote);
  }

  // Provider-aware admin actions are handled BEFORE the legacy NOEST env check,
  // because a valid ZR operation must not depend on NOEST credentials.
  if (action.startsWith('delivery_')) {
    const handled = await handleDeliveryAction({
      action,
      body,
      authorization: req.headers.authorization || '',
    });
    if (handled.handled) return res.status(handled.status || 200).json(handled.payload);
  }

  if (action === 'ping') {
    return res.status(200).json({
      ok: true,
      pong: true,
      version: 'ALMIRAJ_V5_MULTI_PROVIDER',
      providers: { noest: true, zrexpress: getZrSafeConfig().configured },
      idempotency_store: hasUpstash ? 'upstash+memory' : 'memory-only',
    });
  }

  const API_TOKEN = process.env.NOEST_API_TOKEN;
  const USER_GUID = process.env.NOEST_USER_GUID;
  const BASE = (process.env.NOEST_API_BASE || 'https://app.noest-dz.com').replace(/\/+$/, '');

  if (!API_TOKEN || !USER_GUID) {
    return res.status(500).json({
      ok: false,
      error: 'Missing NOEST_API_TOKEN or NOEST_USER_GUID in Vercel environment variables',
    });
  }

  if (action === 'get_wilayas') {
    try {
      const r = await fetch(`${BASE}/api/public/wilayas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ api_token: API_TOKEN, user_guid: USER_GUID }),
      });
      const text = await r.text();
      const data = toObj(text);
      if (r.ok && data) return res.status(200).json({ ok: true, data: data.data || data });
      return res.status(200).json({ ok: false, error: 'Failed to fetch wilayas', status: r.status });
    } catch (e) {
      return res.status(200).json({ ok: false, error: 'fetch_wilayas_failed', debug: (e?.message || '').substring(0, 1500) });
    }
  }

  if (action === 'get_communes') {
    const wilaya_id = Number(body.wilaya_id);
    if (!wilaya_id) return res.status(400).json({ ok: false, error: 'wilaya_id is required' });
    try {
      const r = await fetch(`${BASE}/api/public/communes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ api_token: API_TOKEN, user_guid: USER_GUID, wilaya_id }),
      });
      const text = await r.text();
      const data = toObj(text);
      if (r.ok && data) return res.status(200).json({ ok: true, data: data.data || data });
      return res.status(200).json({ ok: false, error: 'Failed to fetch communes', status: r.status });
    } catch (e) {
      return res.status(200).json({ ok: false, error: 'fetch_communes_failed', debug: (e?.message || '').substring(0, 1500) });
    }
  }

  if (action === 'get_desks') {
    try {
      const r = await fetch(`${BASE}/api/public/stations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ api_token: API_TOKEN, user_guid: USER_GUID }),
      });
      const text = await r.text();
      const data = toObj(text);
      if (r.ok && data) return res.status(200).json({ ok: true, data: data.data || data });
      return res.status(200).json({ ok: false, error: 'Failed to fetch desks', status: r.status });
    } catch (e) {
      return res.status(200).json({ ok: false, error: 'fetch_desks_failed', debug: (e?.message || '').substring(0, 1500) });
    }
  }

  if (action === 'diagnose') {
    const CREATE_URL = `${BASE}/api/public/create/order`;
    try {
      const r = await fetch(CREATE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ api_token: API_TOKEN, user_guid: USER_GUID, test: true }),
      });
      const text = await r.text();
      return res.status(200).json({
        ok: true,
        data: {
          url_tested: CREATE_URL,
          status: r.status,
          statusText: r.statusText,
          snippet: text.substring(0, 1500),
          idempotency: { store: hasUpstash ? 'upstash+memory' : 'memory-only', memory_cache_size: RECENT.size },
        },
      });
    } catch (e) {
      const msg = e instanceof Error ? (e.stack || e.message) : safeJson(e);
      return res.status(200).json({ ok: false, error: 'diagnose_failed', debug: msg.substring(0, 1500) });
    }
  }

  if (action === 'create_order') {
    const CREATE_URL = `${BASE}/api/public/create/order`;
    const request_id = String(body.request_id || '').trim();
    if (!request_id) {
      return res.status(400).json({ ok: false, error: 'request_id is required for idempotency. Generate with crypto.randomUUID().' });
    }

    const cached = await dedupGet(request_id);
    if (cached) {
      const source = cached.source || 'unknown';
      const age = cached.age_ms || 0;
      delete cached.source;
      delete cached.age_ms;
      return res.status(200).json({ ...cached, dedup: true, dedup_source: source, dedup_age_ms: age });
    }

    const payload = {
      api_token: API_TOKEN,
      user_guid: USER_GUID,
      client: String(body.client || '').trim(),
      phone: String(body.phone || '').trim(),
      adresse: String(body.adresse || '').trim(),
      wilaya_id: Number(body.wilaya_id),
      commune: String(body.commune || '').trim(),
      montant: Number(body.montant),
      produit: String(body.produit || '').trim(),
      type_id: Number(body.type_id),
      stop_desk: Number(body.stop_desk),
    };
    if (payload.stop_desk === 1) {
      const station_code = String(body.station_code || '').trim();
      if (!station_code) return res.status(422).json({ ok: false, error: 'station_code required when stop_desk=1' });
      payload.station_code = station_code;
    }

    const missing = [];
    if (!payload.client) missing.push('client');
    if (!payload.phone) missing.push('phone');
    if (!payload.adresse) missing.push('adresse');
    if (!payload.wilaya_id) missing.push('wilaya_id');
    if (!payload.commune) missing.push('commune');
    if (!Number.isFinite(payload.montant)) missing.push('montant');
    if (!payload.produit) missing.push('produit');
    if (!payload.type_id) missing.push('type_id');
    if (![0, 1].includes(payload.stop_desk)) missing.push('stop_desk');
    if (missing.length) return res.status(400).json({ ok: false, error: `Missing/invalid: ${missing.join(', ')}` });

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30_000);
      const r = await fetch(CREATE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      clearTimeout(timeout);
      const text = await r.text();
      const data = toObj(text);

      if (r.ok && data?.success === true) {
        const response = {
          ok: true,
          data: {
            tracking: String(data.tracking || ''),
            reference: data.reference ?? null,
            regional_hub_name: data.regional_hub_name ?? null,
            wilaya_rank: data.wilaya_rank ?? null,
            endpoint_used: CREATE_URL,
          },
        };
        await dedupSet(request_id, response, TTL_SUCCESS_S);
        return res.status(200).json(response);
      }

      const failResponse = {
        ok: false,
        error: data?.message || 'NOEST rejected the order or returned unexpected response',
        errors: data?.errors || null,
        status: r.status,
      };
      await dedupSet(request_id, failResponse, TTL_FAILURE_S);
      return res.status(200).json(failResponse);
    } catch (e) {
      const isAbort = e?.name === 'AbortError';
      const msg = isAbort ? 'NOEST API timeout (30s) — try again' : (e instanceof Error ? (e.stack || e.message) : safeJson(e));
      return res.status(200).json({ ok: false, error: isAbort ? 'timeout' : 'fetch_failed', debug: msg.substring(0, 1500) });
    }
  }

  return res.status(400).json({
    ok: false,
    error: `Unknown action: ${action}`,
    available: [
      'ping', 'diagnose', 'get_wilayas', 'get_communes', 'get_desks', 'create_order',
      'checkout_delivery_settings', 'checkout_zr_options',
      'delivery_provider_info', 'delivery_prepare_zrexpress', 'delivery_send', 'delivery_resend', 'delivery_sync',
    ],
  });
}
