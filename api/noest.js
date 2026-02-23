// pages/api/noest.js
export const config = {
  api: { bodyParser: true },
};

function safeJson(v) {
  try { return JSON.stringify(v); } catch { return String(v); }
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
      message: '✅ NOEST proxy (clean) is deployed',
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

  // ✅ Safe body (never destructure req.body)
  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  if (!body || typeof body !== 'object') body = {};

  const action = body.action;

  // Quick ping
  if (action === 'ping') {
    return res.status(200).json({ ok: true, pong: true, version: 'CLEAN_V1' });
  }

  const API_TOKEN = process.env.NOEST_API_TOKEN;
  const USER_GUID = process.env.NOEST_USER_GUID;
  const BASE = (process.env.NOEST_API_BASE || 'https://app.noest-dz.com').replace(/\/+$/, '');
  const CREATE_URL = `${BASE}/api/public/create/order`;

  if (!API_TOKEN || !USER_GUID) {
    return res.status(500).json({
      ok: false,
      error: 'Missing NOEST_API_TOKEN or NOEST_USER_GUID in Vercel env',
    });
  }

  // Diagnose (does one request and returns raw snippet)
  if (action === 'diagnose') {
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
          snippet: text.substring(0, 600),
        },
      });
    } catch (e) {
      const msg = e instanceof Error ? (e.stack || e.message) : safeJson(e);
      return res.status(200).json({ ok: false, error: 'diagnose_failed', debug: msg.substring(0, 800) });
    }
  }

  // Create order
  if (action === 'create_order') {
    const payload = {
  api_token: API_TOKEN,
  user_guid: USER_GUID,

  // ✅ REQUIRED field names per NOEST validation
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
    // station_code required when stop_desk=1
    if (payload.stop_desk === 1) {
  const station_code = String(body.station_code || '').trim();
  if (!station_code) {
    return res.status(422).json({ ok: false, error: 'station_code required when stop_desk=1' });
  }
  payload.station_code = station_code;
}

    try {
      const r = await fetch(CREATE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify(payload),
      });

      const text = await r.text();

      // return raw so we can see EXACT NOEST response
      return res.status(200).json({
        ok: r.ok,
        status: r.status,
        url: CREATE_URL,
        raw: text.substring(0, 1500),
      });
    } catch (e) {
      const msg = e instanceof Error ? (e.stack || e.message) : safeJson(e);
      return res.status(200).json({ ok: false, error: 'fetch_failed', debug: msg.substring(0, 1200) });
    }
  }

  return res.status(400).json({
    ok: false,
    error: `Unknown action: ${action}`,
    available: ['ping', 'diagnose', 'create_order'],
  });
}
