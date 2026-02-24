// ============================================================
// NOEST Delivery API Proxy — Vercel Serverless Function
// ============================================================
// Environment variables required in Vercel:
//   NOEST_API_TOKEN  — your NOEST API token
//   NOEST_USER_GUID  — your NOEST user GUID
//   NOEST_API_BASE   — (optional) default: https://app.noest-dz.com
// ============================================================

export const config = { api: { bodyParser: true } };

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
    return res.status(200).json({ ok: true, pong: true, version: 'ALMIRAJ_V2' });
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

      return res.status(200).json({
        ok: false,
        error: 'Failed to fetch wilayas from NOEST',
        status: r.status,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : safeJson(e);
      return res.status(200).json({ ok: false, error: 'fetch_wilayas_failed', debug: msg.substring(0, 1500) });
    }
  }

  // ═════════════════════════════════════════════
  // GET COMMUNES
  // ═════════════════════════════════════════════
  if (action === 'get_communes') {
    const wilaya_id = Number(body.wilaya_id);
    if (!wilaya_id) {
      return res.status(400).json({ ok: false, error: 'wilaya_id is required' });
    }

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

      return res.status(200).json({
        ok: false,
        error: 'Failed to fetch communes from NOEST',
        status: r.status,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : safeJson(e);
      return res.status(200).json({ ok: false, error: 'fetch_communes_failed', debug: msg.substring(0, 1500) });
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

      return res.status(200).json({
        ok: false,
        error: 'Failed to fetch desk stations from NOEST',
        status: r.status,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : safeJson(e);
      return res.status(200).json({ ok: false, error: 'fetch_desks_failed', debug: msg.substring(0, 1500) });
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
        },
      });
    } catch (e) {
      const msg = e instanceof Error ? (e.stack || e.message) : safeJson(e);
      return res.status(200).json({ ok: false, error: 'diagnose_failed', debug: msg.substring(0, 1500) });
    }
  }

  // ═════════════════════════════════════════════
  // CREATE ORDER
  // ═════════════════════════════════════════════
  if (action === 'create_order') {
    const CREATE_URL = `${BASE}/api/public/create/order`;

    const payload = {
      api_token: API_TOKEN,
      user_guid: USER_GUID,

      // ✅ REQUIRED fields per NOEST validation
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

    // stop_desk requires station_code
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

    try {
      const r = await fetch(CREATE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify(payload),
      });

      const text = await r.text();
      const data = toObj(text);

      // ✅ SUCCESS: NOEST returns success:true + tracking
      if (r.ok && data?.success === true) {
        return res.status(200).json({
          ok: true,
          data: {
            tracking: String(data.tracking || ''),
            reference: data.reference ?? null,
            regional_hub_name: data.regional_hub_name ?? null,
            wilaya_rank: data.wilaya_rank ?? null,
            endpoint_used: CREATE_URL,
          },
        });
      }

      // ❌ Validation errors or unexpected response
      return res.status(200).json({
        ok: false,
        error: data?.message || 'NOEST rejected the order or returned unexpected response',
        errors: data?.errors || null,
        status: r.status,
      });
    } catch (e) {
      const msg = e instanceof Error ? (e.stack || e.message) : safeJson(e);
      return res.status(200).json({ ok: false, error: 'fetch_failed', debug: msg.substring(0, 1500) });
    }
  }

  // Unknown action
  return res.status(400).json({
    ok: false,
    error: `Unknown action: ${action}`,
    available: ['ping', 'diagnose', 'get_wilayas', 'get_communes', 'get_desks', 'create_order'],
  });
}
