// ============================================================
// NOEST Delivery API Proxy — Vercel Serverless Function
// ============================================================
// Environment variables required in Vercel:
//   NOEST_API_TOKEN  — your NOEST API token
//   NOEST_USER_GUID  — your NOEST user GUID
//   NOEST_API_BASE   — (optional) default: https://app.noest-dz.com
//
// OPTIONAL — for cross-instance idempotency:
//   UPSTASH_REDIS_REST_URL   — Upstash Redis REST URL
//   UPSTASH_REDIS_REST_TOKEN — Upstash Redis REST token
//
// Without Upstash: uses in-memory Map (same-instance only)
// With Upstash: full cross-instance deduplication (recommended)
// ============================================================

export const config = { api: { bodyParser: true } };

// ═════════════════════════════════════════════════════════════
// IDEMPOTENCY STORE — Hybrid: Upstash Redis → In-Memory Map
// ═════════════════════════════════════════════════════════════
//
// ⚠️  WHY Map ALONE IS UNSAFE ON VERCEL SERVERLESS:
//     1. Cold start        → new instance → empty Map
//     2. Auto-scaling      → multiple instances → each has own Map
//     3. Instance recycle  → Map is lost without warning
//     4. Region failover   → completely separate memory
//
// ✅  SOLUTION (3 layers, strongest to weakest):
//     Layer 1: Frontend   — isSubmittingRef (sync) + disabled button
//     Layer 2: Upstash    — cross-instance, persistent, TTL-based (if configured)
//     Layer 3: Map        — covers same-instance rapid retries (always active)
//
// 🆓  Upstash Redis FREE TIER: 10K commands/day — more than enough
//     Setup: upstash.com → Create DB → Copy REST URL + Token → Add to Vercel Env
// ═════════════════════════════════════════════════════════════

const RECENT = new Map();            // Layer 3: in-memory fallback
const TTL_SUCCESS_S  = 60;           // 60s  — cache successful orders
const TTL_FAILURE_S  = 10;           // 10s  — cache failures (anti-spam)
const CLEANUP_INTERVAL_MS = 30_000;

let lastCleanup = Date.now();
function cleanupRecent() {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) return;
  lastCleanup = now;
  for (const [key, entry] of RECENT.entries()) {
    if (now - entry.timestamp > entry.ttl * 1000) {
      RECENT.delete(key);
    }
  }
}

// ── Upstash Redis REST helpers (zero npm dependencies) ───────
const UPSTASH_URL   = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const hasUpstash     = !!(UPSTASH_URL && UPSTASH_TOKEN);

async function redisGet(key) {
  if (!hasUpstash) return null;
  try {
    const r = await fetch(`${UPSTASH_URL}/get/${encodeURIComponent(key)}`, {
      headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` },
    });
    if (!r.ok) return null;
    const body = await r.json();
    // Upstash returns { result: "..." } or { result: null }
    if (!body.result) return null;
    return JSON.parse(body.result);
  } catch (e) {
    console.warn('[IDEMPOTENCY] Upstash GET failed:', e.message);
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
    console.warn('[IDEMPOTENCY] Upstash SET failed:', e.message);
    return false;
  }
}

// ── Dedup check: Upstash first, then Map ─────────────────────
async function dedupGet(requestId) {
  // Layer 2: Upstash (cross-instance)
  const upstashResult = await redisGet(`dedup:${requestId}`);
  if (upstashResult) {
    return { ...upstashResult, source: 'upstash' };
  }

  // Layer 3: Map (same-instance)
  const mapEntry = RECENT.get(requestId);
  if (mapEntry) {
    const age = Date.now() - mapEntry.timestamp;
    if (age < mapEntry.ttl * 1000) {
      return { ...mapEntry.response, source: 'memory', age_ms: age };
    } else {
      RECENT.delete(requestId);
    }
  }

  return null; // Not found — first time seeing this request_id
}

// ── Dedup store: write to BOTH Upstash and Map ───────────────
async function dedupSet(requestId, response, ttlSeconds) {
  // Layer 2: Upstash (fire-and-forget, don't block response)
  redisSet(`dedup:${requestId}`, response, ttlSeconds).catch(() => {});

  // Layer 3: Map (immediate)
  RECENT.set(requestId, {
    response,
    timestamp: Date.now(),
    ttl: ttlSeconds,
  });
}

// ── Utilities ────────────────────────────────────────────────
function safeJson(v) {
  try { return JSON.stringify(v); } catch { return String(v); }
}

function toObj(maybeJson) {
  if (!maybeJson) return null;
  if (typeof maybeJson === 'object') return maybeJson;
  if (typeof maybeJson !== 'string') return null;
  try { return JSON.parse(maybeJson); } catch { return null; }
}

// ═════════════════════════════════════════════════════════════
// HANDLER
// ═════════════════════════════════════════════════════════════
export default async function handler(req, res) {
  cleanupRecent();

  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // Health check
  if (req.method === 'GET') {
    return res.status(200).json({
      ok: true,
      message: '✅ NOEST proxy is deployed and running',
      env: {
        NOEST_API_TOKEN: process.env.NOEST_API_TOKEN ? '✅ Set' : '❌ MISSING',
        NOEST_USER_GUID: process.env.NOEST_USER_GUID ? '✅ Set' : '❌ MISSING',
        NOEST_API_BASE: process.env.NOEST_API_BASE || 'https://app.noest-dz.com',
        UPSTASH_REDIS: hasUpstash ? '✅ Connected (cross-instance dedup)' : '⚠️ Not configured (using in-memory Map only)',
      },
      idempotency: {
        store: hasUpstash ? 'upstash+memory' : 'memory-only',
        memory_cache_size: RECENT.size,
        ttl_success: `${TTL_SUCCESS_S}s`,
        ttl_failure: `${TTL_FAILURE_S}s`,
        warning: hasUpstash ? null : 'Map is per-instance only. Configure Upstash for cross-instance dedup.',
      },
      timestamp: new Date().toISOString(),
    });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  // ✅ Safe body parsing
  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  if (!body || typeof body !== 'object') body = {};

  const action = body.action;

  // Quick ping
  if (action === 'ping') {
    return res.status(200).json({
      ok: true,
      pong: true,
      version: 'ALMIRAJ_V4_HYBRID_DEDUP',
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

  // ═════════════════════════════════════════════
  // GET WILAYAS
  // ═════════════════════════════════════════════
  if (action === 'get_wilayas') {
    try {
      const url = `${BASE}/api/public/wilayas`;
      const r = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ api_token: API_TOKEN, user_guid: USER_GUID }),
      });
      const text = await r.text();
      const data = toObj(text);
      if (r.ok && data) {
        return res.status(200).json({ ok: true, data: data.data || data });
      }
      return res.status(200).json({ ok: false, error: 'Failed to fetch wilayas', status: r.status });
    } catch (e) {
      return res.status(200).json({ ok: false, error: 'fetch_wilayas_failed', debug: (e.message || '').substring(0, 1500) });
    }
  }

  // ═════════════════════════════════════════════
  // GET COMMUNES
  // ═════════════════════════════════════════════
  if (action === 'get_communes') {
    const wilaya_id = Number(body.wilaya_id);
    if (!wilaya_id) return res.status(400).json({ ok: false, error: 'wilaya_id is required' });
    try {
      const url = `${BASE}/api/public/communes`;
      const r = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ api_token: API_TOKEN, user_guid: USER_GUID, wilaya_id }),
      });
      const text = await r.text();
      const data = toObj(text);
      if (r.ok && data) {
        return res.status(200).json({ ok: true, data: data.data || data });
      }
      return res.status(200).json({ ok: false, error: 'Failed to fetch communes', status: r.status });
    } catch (e) {
      return res.status(200).json({ ok: false, error: 'fetch_communes_failed', debug: (e.message || '').substring(0, 1500) });
    }
  }

  // ═════════════════════════════════════════════
  // GET STOP DESK STATIONS
  // ═════════════════════════════════════════════
  if (action === 'get_desks') {
    try {
      const url = `${BASE}/api/public/stations`;
      const r = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ api_token: API_TOKEN, user_guid: USER_GUID }),
      });
      const text = await r.text();
      const data = toObj(text);
      if (r.ok && data) {
        return res.status(200).json({ ok: true, data: data.data || data });
      }
      return res.status(200).json({ ok: false, error: 'Failed to fetch desks', status: r.status });
    } catch (e) {
      return res.status(200).json({ ok: false, error: 'fetch_desks_failed', debug: (e.message || '').substring(0, 1500) });
    }
  }

  // ═════════════════════════════════════════════
  // DIAGNOSE — Test NOEST connectivity
  // ═════════════════════════════════════════════
  if (action === 'diagnose') {
    const CREATE_URL = `${BASE}/api/public/create/order`;
    try {
      const r = await fetch(CREATE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
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
          idempotency: {
            store: hasUpstash ? 'upstash+memory' : 'memory-only',
            memory_cache_size: RECENT.size,
          },
        },
      });
    } catch (e) {
      const msg = e instanceof Error ? (e.stack || e.message) : safeJson(e);
      return res.status(200).json({ ok: false, error: 'diagnose_failed', debug: msg.substring(0, 1500) });
    }
  }

  // ═════════════════════════════════════════════
  // CREATE ORDER — with HYBRID IDEMPOTENCY
  // ═════════════════════════════════════════════
  if (action === 'create_order') {
    const CREATE_URL = `${BASE}/api/public/create/order`;

    // ── Step 1: Require request_id ──────────────────────────
    const request_id = String(body.request_id || '').trim();
    if (!request_id) {
      return res.status(400).json({
        ok: false,
        error: 'request_id is required for idempotency. Generate with crypto.randomUUID().',
      });
    }

    // ── Step 2: CHECK DEDUP (Upstash → Map) ─────────────────
    const cached = await dedupGet(request_id);
    if (cached) {
      const source = cached.source || 'unknown';
      const age = cached.age_ms || 0;
      delete cached.source;
      delete cached.age_ms;

      console.log(`[DEDUP] ♻️ HIT from ${source} for request_id=${request_id} (age≈${Math.round(age / 1000)}s)`);

      return res.status(200).json({
        ...cached,
        dedup: true,
        dedup_source: source,
        dedup_age_ms: age,
      });
    }

    // ── Step 3: Build payload ───────────────────────────────
    const payload = {
      api_token: API_TOKEN,
      user_guid: USER_GUID,
      client:    String(body.client || '').trim(),
      phone:     String(body.phone || '').trim(),
      adresse:   String(body.adresse || '').trim(),
      wilaya_id: Number(body.wilaya_id),
      commune:   String(body.commune || '').trim(),
      montant:   Number(body.montant),
      produit:   String(body.produit || '').trim(),
      type_id:   Number(body.type_id),
      stop_desk: Number(body.stop_desk),
    };

    if (payload.stop_desk === 1) {
      const station_code = String(body.station_code || '').trim();
      if (!station_code) {
        return res.status(422).json({ ok: false, error: 'station_code required when stop_desk=1' });
      }
      payload.station_code = station_code;
    }

    // Quick validation
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

    if (missing.length) {
      return res.status(400).json({ ok: false, error: `Missing/invalid: ${missing.join(', ')}` });
    }

    // ── Step 4: Send to NOEST (FIRST TIME for this request_id) ──
    try {
      console.log(`[DEDUP] 🚀 NEW request_id=${request_id} — sending to NOEST (store: ${hasUpstash ? 'upstash+memory' : 'memory-only'})...`);

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30_000); // 30s timeout

      const r = await fetch(CREATE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      const text = await r.text();
      const data = toObj(text);

      // ✅ SUCCESS
      if (r.ok && data?.success === true) {
        const response = {
          ok: true,
          data: {
            tracking:          String(data.tracking || ''),
            reference:         data.reference ?? null,
            regional_hub_name: data.regional_hub_name ?? null,
            wilaya_rank:       data.wilaya_rank ?? null,
            endpoint_used:     CREATE_URL,
          },
        };

        // Cache in BOTH stores (Upstash + Map) — 60 seconds
        await dedupSet(request_id, response, TTL_SUCCESS_S);

        console.log(`[DEDUP] ✅ CACHED SUCCESS for request_id=${request_id} (tracking=${data.tracking}, store=${hasUpstash ? 'upstash+memory' : 'memory'})`);
        return res.status(200).json(response);
      }

      // ❌ NOEST rejected
      const failResponse = {
        ok: false,
        error: data?.message || 'NOEST rejected the order or returned unexpected response',
        errors: data?.errors || null,
        status: r.status,
      };

      // Cache failure briefly (10s) to prevent rapid re-spam
      await dedupSet(request_id, failResponse, TTL_FAILURE_S);

      console.log(`[DEDUP] ❌ CACHED FAILURE for request_id=${request_id} (ttl=${TTL_FAILURE_S}s)`);
      return res.status(200).json(failResponse);

    } catch (e) {
      const isAbort = e.name === 'AbortError';
      const msg = isAbort
        ? 'NOEST API timeout (30s) — try again'
        : (e instanceof Error ? (e.stack || e.message) : safeJson(e));

      // ⚠️ Network/timeout errors: DON'T cache → let user retry immediately
      console.log(`[DEDUP] ⚠️ NETWORK ERROR for request_id=${request_id} — NOT cached (user can retry)`);
      return res.status(200).json({
        ok: false,
        error: isAbort ? 'timeout' : 'fetch_failed',
        debug: msg.substring(0, 1500),
      });
    }
  }

  // Unknown action
  return res.status(400).json({
    ok: false,
    error: `Unknown action: ${action}`,
    available: ['ping', 'diagnose', 'get_wilayas', 'get_communes', 'get_desks', 'create_order'],
  });
}
