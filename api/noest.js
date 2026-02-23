// ============================================================
// Vercel Serverless Function — NOEST Delivery API Proxy
// ============================================================
//
// NOEST API (Algerian Delivery — Laravel-based):
//   Base URL:  https://app.noest-dz.com/api
//   Auth:      Authorization: Bearer {NOEST_API_TOKEN}
//   Endpoints:
//     POST /store          → Create colis (order)
//     GET  /wilayas         → List wilayas
//     GET  /communes/{id}   → List communes by wilaya
//     GET  /centres         → List stop desk centres
//     GET  /tarifs          → Pricing
//
// ENV VARS (Vercel Dashboard → Settings → Environment Variables):
//   NOEST_API_TOKEN   — Bearer token
//   NOEST_USER_GUID   — User GUID
//   NOEST_API_BASE    — (Optional) override base URL
// ============================================================

function rid() {
  return 'R' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 5).toUpperCase();
}

function hint(s) {
  if (!s) return '(empty)';
  if (s.length <= 8) return '***';
  return s.slice(0, 4) + '…' + s.slice(-4);
}

// Extract tracking/id from any shape of NOEST response
function extractInfo(d) {
  if (!d || typeof d !== 'object') return { tracking: null, id: null };

  // Direct fields
  const tracking =
    d.tracking || d.code || d.tracking_code || d.barcode ||
    // Nested under .data
    d.data?.tracking || d.data?.code || d.data?.tracking_code || d.data?.barcode ||
    // Nested under .order / .colis
    d.order?.tracking || d.order?.code ||
    d.colis?.tracking || d.colis?.code || d.colis?.barcode ||
    null;

  const id =
    d.id || d.order_id || d.colis_id ||
    d.data?.id || d.data?.order_id || d.data?.colis_id ||
    d.order?.id || d.colis?.id ||
    null;

  return { tracking, id };
}

// Check if NOEST returned a semantic error inside a 200 response
function detectError(d) {
  if (!d || typeof d !== 'object') return null;
  if (d.success === false) return d.message || d.error || 'success=false';
  if (d.status === 'error' || d.status === 'failed') return d.message || d.error || `status=${d.status}`;
  if (typeof d.error === 'string' && d.error.length > 0) return d.error;
  if (d.errors && typeof d.errors === 'object') {
    // Laravel validation errors: { "nom": ["required"], "telephone": ["required"] }
    const msgs = Object.entries(d.errors).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`);
    return msgs.join(' | ');
  }
  return null;
}
export const config = {
  api: {
    bodyParser: true,
  },
};
export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'POST' && req.body?.action === 'ping') {
  return res.status(200).json({ ok: true, pong: true, version: "PING_V2" });
}
  const API_TOKEN = process.env.NOEST_API_TOKEN;
  const USER_GUID = process.env.NOEST_USER_GUID;

  // ═══════════════════════════════════════════════════════════
  // GET → Health Check
  // ═══════════════════════════════════════════════════════════
  if (req.method === 'GET') {
    const ENV_BASE = process.env.NOEST_API_BASE || '';
    return res.status(200).json({
      ok: true,
      message: '✅ NOEST API proxy deployed on Vercel',
      env: {
        NOEST_API_TOKEN: API_TOKEN ? `✅ Set (${hint(API_TOKEN)})` : '❌ MISSING',
        NOEST_USER_GUID: USER_GUID ? `✅ Set (${hint(USER_GUID)})` : '❌ MISSING',
        NOEST_API_BASE: ENV_BASE || '(default: https://app.noest-dz.com/api)',
      },
      timestamp: new Date().toISOString(),
    });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }
  // ✅ Direct diagnose (must not crash)
if (req.body?.action === 'diagnose') {
  return res.status(200).json({ ok: true, message: "DIAGNOSE_V2_OK", base: process.env.NOEST_API_BASE || "https://app.noest-dz.com" });
}
// ✅ Ensure body is parsed (sometimes req.body is undefined)
let body = req.body;
if (!body || typeof body !== 'object') {
  try {
    let raw = '';
    await new Promise((resolve) => {
      req.on('data', (chunk) => (raw += chunk));
      req.on('end', resolve);
    });
    body = raw ? JSON.parse(raw) : {};
  } catch (e) {
    return res.status(400).json({
      ok: false,
      error: 'Invalid JSON body',
      debug: e instanceof Error ? e.message : String(e),
    });
  }
}
  // ── Validate env vars ──
  if (!API_TOKEN) {
    console.error('[NOEST] ❌ NOEST_API_TOKEN not set');
    return res.status(500).json({
      ok: false,
      error: 'NOEST_API_TOKEN غير مُعرَّف في إعدادات Vercel',
      fix: 'Vercel → Project Settings → Environment Variables → Add NOEST_API_TOKEN',
    });
  }

  const headers = {
  'Content-Type': 'application/json',
  'Accept': 'application/json',
};

  // Base URL — prioritize env override, then default
  const BASE = (process.env.NOEST_API_BASE || 'https://app.noest-dz.com').replace(/\/+$/, '');

  try {
    // ✅ Safe body parsing (avoids FUNCTION_INVOCATION_FAILED)
let body = req.body;

if (typeof body === 'string') {
  try { body = JSON.parse(body); } catch { body = {}; }
}
if (!body || typeof body !== 'object') body = {};

const action = body.action;
const params = { ...body };
delete params.action;

console.log(`[${id}] action=${action}`);
    console.log(`[${id}] action=${action} base=${BASE} token=${hint(API_TOKEN)}`);

    // ═══════════════════════════════════════════════════════════
    // DIAGNOSE — Test which endpoints work
    // ═══════════════════════════════════════════════════════════
    if (action === 'diagnose') {
  return res.status(200).json({
    ok: true,
    message: "diagnose reached ✅",
    base: BASE,
  });
}

    // ═══════════════════════════════════════════════════════════
    // CREATE ORDER — POST /store
    // ═══════════════════════════════════════════════════════════
    if (action === 'create_order') {
      // Validate required fields
      const missing = [];
      if (!params.client) missing.push('client (nom)');
      if (!params.phone) missing.push('phone (telephone)');
      if (!params.adresse) missing.push('adresse');
      if (!params.wilaya_id) missing.push('wilaya_id');
      if (!params.commune) missing.push('commune');
      if (params.montant === undefined) missing.push('montant');
      if (!params.produit) missing.push('produit');
      if (missing.length > 0) {
        return res.status(400).json({
          ok: false,
          error: `حقول ناقصة: ${missing.join(', ')}`,
        });
      }

      // Build NOEST payload with correct field names
  const payload = {
  api_token: API_TOKEN,
  user_guid: USER_GUID,

  nom: String(params.client || '').trim(),
  telephone: String(params.phone || '').trim(),
  telephone_2: '',
  adresse: String(params.adresse || '').trim(),
  wilaya_id: Number(params.wilaya_id),
  commune: String(params.commune || '').trim(), // لازم FR
  montant: Number(params.montant),
  produit: String(params.produit || '').trim(),
  note: String(params.note || '').trim(),
  stop_desk: Number(params.stop_desk) || 0,

  // (اختياري) بعض حسابات NOEST تحتاج type_id
  type_id: Number(params.type_id) || 0,
};

      // Add stop desk centre_id if applicable
 if (payload.stop_desk === 1 && !payload.station_code) {
  return res.status(422).json({
    ok: false,
    error: 'station_code مطلوب عند اختيار التوصيل إلى المكتب',
  });
}

      // Add user_guid if set
      if (USER_GUID) {
        payload.user_guid = USER_GUID;
      }

      console.log(`[${id}] CREATE ORDER payload:`, JSON.stringify(payload));

      // Try endpoints in order of likelihood
      const endpoints = ['/api/public/create/order'];
      let lastError = null;
      let lastStatus = null;

      for (const endpoint of endpoints) {
        const url = `${BASE}${endpoint}`;
        console.log(`[${id}] → POST ${url}`);

        let response;
        try {
          response = await fetch(url, {
            method: 'POST',
            headers,
            body: JSON.stringify(payload),
            
          });
     } catch (netErr) {
  const msg =
    netErr instanceof Error ? netErr.message :
    typeof netErr === 'string' ? netErr :
    JSON.stringify(netErr);

  console.error(`[${id}] ❌ Network error on ${url}: ${msg}`);
  lastError = `Network: ${msg}`;
  continue;
}
if (!response) {
  lastError = 'No response object returned from fetch';
  continue;
}
        const text = await response.text();
        lastStatus = response.status;
        console.log(`[${id}] ← ${response.status} from ${url}: ${text.substring(0, 300)}`);

        // 404/405 = wrong endpoint, skip to next
        if (response.status === 404 || response.status === 405) {
          lastError = `${endpoint} → ${response.status} Not Found`;
          console.log(`[${id}] ⏭️ Skipping ${endpoint} (${response.status})`);
          continue;
        }

        // Parse JSON
        let data;
        try {
          data = JSON.parse(text);
        } catch {
          if (text.includes('<html') || text.includes('<!DOCTYPE') || text.includes('Redirecting')) {
            console.error(`[${id}] ❌ HTML response from ${url} — auth issue?`);
            return res.status(401).json({
              ok: false,
              error: 'NOEST أعاد صفحة HTML — تحقق من NOEST_API_TOKEN',
              debug: `URL: ${url}, Status: ${response.status}`,
            });
          }
          lastError = `Non-JSON from ${url}: ${text.substring(0, 100)}`;
          continue;
        }

        // 401/403 = authentication failed — definitive, stop
        if (response.status === 401 || response.status === 403) {
          console.error(`[${id}] ❌ AUTH FAILED (${response.status}) on ${url}`);
          return res.status(401).json({
            ok: false,
            error: `فشل المصادقة (${response.status}) — تحقق من NOEST_API_TOKEN`,
            debug: JSON.stringify(data).substring(0, 200),
          });
        }

        // 422 = validation error — NOEST received the request but rejected fields
        if (response.status === 422) {
          const errDetail = data.message || detectError(data) || JSON.stringify(data.errors || data).substring(0, 300);
          console.error(`[${id}] ❌ VALIDATION 422 from ${url}: ${errDetail}`);

          // If this is a validation error on /store, the endpoint is correct but fields are wrong
          // Don't try other endpoints
          return res.status(422).json({
            ok: false,
            error: `خطأ في البيانات (422): ${errDetail}`,
            debug: `Endpoint: ${url}`,
          });
        }

        // Other HTTP errors
        if (!response.ok) {
          const errMsg = data.message || data.error || `HTTP ${response.status}`;
          console.error(`[${id}] ❌ HTTP ${response.status} from ${url}: ${errMsg}`);
          return res.status(response.status).json({
            ok: false,
            error: `خطأ NOEST (${response.status}): ${errMsg}`,
            debug: `Endpoint: ${url}`,
          });
        }

        // ── HTTP 200 — Check for semantic errors ──
        const semErr = detectError(data);
        if (semErr) {
          console.error(`[${id}] ❌ Semantic error from ${url}: ${semErr}`);
          return res.status(200).json({
            ok: false,
            error: `NOEST رفض الطلب: ${semErr}`,
            debug: `Endpoint: ${url}`,
          });
        }

        // ── Extract tracking/id ──
        const info = extractInfo(data);
        if (!info.tracking && !info.id) {
          console.warn(`[${id}] ⚠️ 200 OK from ${url} but NO tracking/id. Full response:`, JSON.stringify(data));
          // Still might be success — some APIs return the order in a different shape
          // Check if there's any meaningful data
          const possibleId = data.data?.id || data.id || data.order_id;
          if (possibleId) {
            console.log(`[${id}] ✅ Found ID via fallback: ${possibleId}`);
            return res.status(200).json({
              ok: true,
              data: {
                id: String(possibleId),
                tracking: String(data.data?.tracking || data.tracking || possibleId),
                endpoint_used: url,
                raw: data,
              },
            });
          }

          return res.status(200).json({
            ok: false,
            error: 'NOEST استجاب 200 لكن بدون رقم تتبع أو معرف — قد لا يكون الطلب مسجلاً',
            debug: JSON.stringify(data).substring(0, 300),
          });
        }

        // ═══════════════════════════════════════════════════════
        // ✅ SUCCESS — Real order created!
        // ═══════════════════════════════════════════════════════
        console.log(`[${id}] ✅ ORDER CREATED! tracking=${info.tracking} id=${info.id} via ${url}`);
        return res.status(200).json({
          ok: true,
          data: {
            id: String(info.id || ''),
            tracking: String(info.tracking || info.id || ''),
            endpoint_used: url,
          },
        });
      }

      // ── All endpoints failed ──
      console.error(`[${id}] ❌ ALL ENDPOINTS FAILED. Last error: ${lastError}, Last status: ${lastStatus}`);
      return res.status(502).json({
        ok: false,
        error: 'فشل الاتصال بـ NOEST — جميع المحاولات فشلت',
        debug: JSON.stringify({
          base_url: BASE,
          endpoints_tried: ['/api/public/create/order'],
          last_error: lastError,
          last_status: lastStatus,
          fix: 'شغّل diagnose أو تحقق من NOEST_API_BASE',
        }),
      });
    }

    // ═══════════════════════════════════════════════════════════
    // GET WILAYAS
    // ═══════════════════════════════════════════════════════════
    if (action === 'get_wilayas') {
      try {
        const r = await fetch(`${BASE}/wilayas`, { headers, });
        if (r.ok) {
          const d = await r.json();
          return res.status(200).json({ ok: true, data: d.data || d });
        }
        console.warn(`[${id}] wilayas → ${r.status}`);
      } catch (e) {
        console.warn(`[${id}] wilayas error: ${e.message}`);
      }
      return res.status(200).json({ ok: true, data: [] });
    }

    // ═══════════════════════════════════════════════════════════
    // GET COMMUNES
    // ═══════════════════════════════════════════════════════════
    if (action === 'get_communes') {
      if (!params.wilaya_id) return res.status(400).json({ ok: false, error: 'Missing wilaya_id' });
      // Try both URL patterns
      for (const path of [`/communes/${params.wilaya_id}`, `/communes?wilaya_id=${params.wilaya_id}`]) {
        try {
          const r = await fetch(`${BASE}${path}`, { headers, signal: AbortSignal.timeout(10000) });
          if (r.ok) {
            const d = await r.json();
            return res.status(200).json({ ok: true, data: d.data || d });
          }
        } catch { /* try next */ }
      }
      return res.status(200).json({ ok: true, data: [] });
    }

    // ═══════════════════════════════════════════════════════════
    // GET DESKS / CENTRES
    // ═══════════════════════════════════════════════════════════
    if (action === 'get_desks' || action === 'get_stations') {
      for (const path of ['/centres', '/stations', '/stop-desk']) {
        try {
          const r = await fetch(`${BASE}${path}`, { headers, signal: AbortSignal.timeout(10000) });
          if (r.ok) {
            const d = await r.json();
            return res.status(200).json({ ok: true, data: d.data || d });
          }
        } catch { /* try next */ }
      }
      return res.status(200).json({ ok: true, data: [] });
    }

    // ═══════════════════════════════════════════════════════════
    // TRACK ORDER
    // ═══════════════════════════════════════════════════════════
    if (action === 'track_order') {
      if (!params.tracking) return res.status(400).json({ ok: false, error: 'Missing tracking' });
      for (const path of [`/tracking?code=${encodeURIComponent(params.tracking)}`, `/tracking/${encodeURIComponent(params.tracking)}`]) {
        try {
          const r = await fetch(`${BASE}${path}`, { headers, signal: AbortSignal.timeout(10000) });
          if (r.ok) {
            const d = await r.json();
            return res.status(200).json({ ok: true, data: d.data || d });
          }
        } catch { /* try next */ }
      }
      return res.status(200).json({ ok: false, error: 'Tracking not found' });
    }

    // ═══════════════════════════════════════════════════════════
    // UNKNOWN ACTION
    // ═══════════════════════════════════════════════════════════
    return res.status(400).json({
      ok: false,
      error: `Unknown action: ${action}`,
      available: ['create_order', 'diagnose', 'get_wilayas', 'get_communes', 'get_desks', 'track_order'],
    });

  } catch (err) {
  const msg =
    err instanceof Error ? err.stack || err.message :
    typeof err === 'string' ? err :
    JSON.stringify(err);

  console.error(`[${id}] UNHANDLED:`, msg);

  return res.status(500).json({
    ok: false,
    error: 'خطأ داخلي في proxy NOEST',
    debug: msg.substring(0, 800),
  });
}
