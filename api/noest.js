// ============================================================
// Vercel Serverless Function — NOEST Delivery API Proxy
// ============================================================
//
// ENV VARS (set in Vercel Dashboard → Settings → Environment Variables):
//   NOEST_API_TOKEN   — Bearer token for NOEST API
//   NOEST_USER_GUID   — User GUID for NOEST account
//   NOEST_API_BASE    — (Optional) e.g. https://api.noest-dz.com/api/v1
//
// TEST: Visit https://YOUR-APP.vercel.app/api/noest in browser → health check
// DIAGNOSE: POST { "action": "diagnose" } → full connectivity test
// ============================================================

// Try multiple base URLs if env var not set
const ENV_BASE = (process.env.NOEST_API_BASE || '').replace(/\/+$/, '');
const CANDIDATE_BASES = ENV_BASE
  ? [ENV_BASE]
  : [
      'https://api.noest-dz.com/api/v1',
      'https://app.noest-dz.com/api/v1',
      'https://api.noest.ma/api/v1',
    ];

// Endpoint paths to try for order creation
const CREATE_PATHS = ['/colis', '/order/create', '/orders', '/create-order'];

// Two payload variants — NOEST might use either naming convention
function buildPayloadVariants(params, userGuid) {
  const base = {
    adresse: String(params.adresse || '').trim(),
    wilaya_id: Number(params.wilaya_id),
    commune: String(params.commune || '').trim(),
    montant: Number(params.montant),
    produit: String(params.produit || '').trim(),
    type_id: Number(params.type_id) || 1,
    stop_desk: Number(params.stop_desk) || 0,
    user_guid: userGuid,
  };
  if (base.stop_desk === 1 && params.station_code) {
    base.station_code = String(params.station_code).trim();
  }

  // Variant A: French-style field names (most Algerian APIs)
  const variantA = {
    ...base,
    nom: String(params.client || '').trim(),
    telephone: String(params.phone || '').trim(),
    // Also include client/phone for backwards compat
    client: String(params.client || '').trim(),
    phone: String(params.phone || '').trim(),
  };

  // Variant B: Alternative field names
  const variantB = {
    ...base,
    client: String(params.client || '').trim(),
    phone: String(params.phone || '').trim(),
    nom: String(params.client || '').trim(),
    tel: String(params.phone || '').trim(),
    telephone: String(params.phone || '').trim(),
    name: String(params.client || '').trim(),
  };

  return [variantA, variantB];
}

function rid() {
  return 'R' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
}

function hint(s) {
  if (!s) return '(empty)';
  if (s.length <= 8) return '***';
  return s.slice(0, 4) + '…' + s.slice(-4);
}

function extractInfo(d) {
  if (!d || typeof d !== 'object') return { tracking: null, id: null };
  const tracking =
    d.tracking || d.code || d.tracking_code || d.barcode ||
    d.data?.tracking || d.data?.code || d.data?.tracking_code || d.data?.barcode ||
    d.order?.tracking || d.order?.code || d.colis?.tracking || d.colis?.code || d.colis?.barcode ||
    null;
  const id =
    d.id || d.order_id || d.colis_id ||
    d.data?.id || d.data?.order_id || d.data?.colis_id ||
    d.order?.id || d.colis?.id ||
    null;
  return { tracking, id };
}

function isError(d) {
  if (!d || typeof d !== 'object') return null;
  if (d.success === false) return d.message || d.error || 'success=false';
  if (d.status === 'error' || d.status === 'failed') return d.message || d.error || `status=${d.status}`;
  if (typeof d.error === 'string' && d.error.length > 0) return d.error;
  if (d.errors && typeof d.errors === 'object') return JSON.stringify(d.errors);
  return null;
}

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // ═══════════════════════════════════════════════════════
  // GET → Health Check (visit in browser to verify deployment)
  // ═══════════════════════════════════════════════════════
  if (req.method === 'GET') {
    const TOKEN = process.env.NOEST_API_TOKEN;
    const GUID = process.env.NOEST_USER_GUID;
    return res.status(200).json({
      ok: true,
      message: '✅ NOEST API proxy is deployed and running on Vercel',
      env: {
        NOEST_API_TOKEN: TOKEN ? `✅ Set (${hint(TOKEN)})` : '❌ MISSING',
        NOEST_USER_GUID: GUID ? `✅ Set (${hint(GUID)})` : '❌ MISSING',
        NOEST_API_BASE: ENV_BASE || `(default: will try ${CANDIDATE_BASES.length} URLs)`,
      },
      candidate_bases: CANDIDATE_BASES,
      usage: 'POST with { "action": "create_order" | "diagnose" | "get_wilayas" | ... }',
      timestamp: new Date().toISOString(),
    });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed. Use GET (health check) or POST.' });
  }

  // ── Validate env vars ──
  const API_TOKEN = process.env.NOEST_API_TOKEN;
  const USER_GUID = process.env.NOEST_USER_GUID;

  if (!API_TOKEN) {
    console.error('[NOEST] ❌ NOEST_API_TOKEN not set');
    return res.status(500).json({
      ok: false,
      error: 'NOEST_API_TOKEN غير مُعرَّف في إعدادات Vercel',
      fix: 'Go to Vercel → Project Settings → Environment Variables → Add NOEST_API_TOKEN',
    });
  }
  if (!USER_GUID) {
    console.error('[NOEST] ❌ NOEST_USER_GUID not set');
    return res.status(500).json({
      ok: false,
      error: 'NOEST_USER_GUID غير مُعرَّف في إعدادات Vercel',
      fix: 'Go to Vercel → Project Settings → Environment Variables → Add NOEST_USER_GUID',
    });
  }

  const authHeaders = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'Authorization': `Bearer ${API_TOKEN}`,
  };

  const id = rid();

  try {
    const { action, ...params } = req.body || {};
    console.log(`[${id}] action=${action} token=${hint(API_TOKEN)} guid=${hint(USER_GUID)}`);

    // ═══════════════════════════════════════════════════════
    // DIAGNOSE — Test connectivity to all candidate base URLs
    // ═══════════════════════════════════════════════════════
    if (action === 'diagnose') {
      const results = {
        timestamp: new Date().toISOString(),
        env_base: ENV_BASE || '(not set)',
        candidate_bases: CANDIDATE_BASES,
        token_hint: hint(API_TOKEN),
        guid_hint: hint(USER_GUID),
        tests: {},
      };

      for (const base of CANDIDATE_BASES) {
        results.tests[base] = {};

        // Test GET /wilayas
        try {
          const r = await fetch(`${base}/wilayas`, {
            headers: authHeaders,
            signal: AbortSignal.timeout(8000),
          });
          const t = await r.text();
          results.tests[base]['GET /wilayas'] = {
            status: r.status,
            ok: r.ok,
            is_json: (() => { try { JSON.parse(t); return true; } catch { return false; } })(),
            snippet: t.substring(0, 200),
          };
        } catch (e) {
          results.tests[base]['GET /wilayas'] = { error: e.message };
        }

        // Test POST endpoints
        for (const path of CREATE_PATHS) {
          try {
            const r = await fetch(`${base}${path}`, {
              method: 'POST',
              headers: authHeaders,
              body: JSON.stringify({ test: true, user_guid: USER_GUID }),
              signal: AbortSignal.timeout(8000),
            });
            results.tests[base][`POST ${path}`] = {
              status: r.status,
              statusText: r.statusText,
            };
          } catch (e) {
            results.tests[base][`POST ${path}`] = { error: e.message };
          }
        }
      }

      console.log(`[${id}] DIAGNOSE:`, JSON.stringify(results, null, 2));
      return res.status(200).json({ ok: true, data: results });
    }

    // ═══════════════════════════════════════════════════════
    // CREATE ORDER
    // ═══════════════════════════════════════════════════════
    if (action === 'create_order') {
      // Validate required fields
      const missing = [];
      if (!params.client) missing.push('client');
      if (!params.phone) missing.push('phone');
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

      const payloadVariants = buildPayloadVariants(params, USER_GUID);
      let lastError = null;
      let lastStatus = null;
      let lastSnippet = '';
      let triedCount = 0;

      // Try each base URL × each endpoint × each payload variant
      for (const base of CANDIDATE_BASES) {
        for (const path of CREATE_PATHS) {
          const url = `${base}${path}`;
          triedCount++;

          for (let vi = 0; vi < payloadVariants.length; vi++) {
            const payload = payloadVariants[vi];

            console.log(`[${id}] TRY #${triedCount}.${vi + 1}: POST ${url}`);
            if (vi === 0) console.log(`[${id}] Payload:`, JSON.stringify(payload));

            let response;
            try {
              response = await fetch(url, {
                method: 'POST',
                headers: authHeaders,
                body: JSON.stringify(payload),
                signal: AbortSignal.timeout(25000),
              });
            } catch (netErr) {
              console.log(`[${id}] ⚠️ Network error on ${url}: ${netErr.message}`);
              lastError = `Network: ${netErr.message}`;
              break; // Same base URL will have same network issue, try next base
            }

            const text = await response.text();
            lastStatus = response.status;
            lastSnippet = text.substring(0, 500);
            console.log(`[${id}] ${url} → ${response.status}: ${lastSnippet.substring(0, 200)}`);

            // 404/405 = wrong endpoint, try next
            if (response.status === 404 || response.status === 405) {
              lastError = `${path} → ${response.status}`;
              break; // No point trying variant B on same 404 endpoint
            }

            // Parse JSON
            let data;
            try {
              data = JSON.parse(text);
            } catch {
              // HTML response = likely auth redirect
              if (text.includes('<html') || text.includes('<!DOCTYPE')) {
                return res.status(401).json({
                  ok: false,
                  error: 'NOEST أعاد صفحة HTML (تسجيل دخول) — تحقق من NOEST_API_TOKEN',
                  debug: { url, status: response.status },
                });
              }
              lastError = `Non-JSON response from ${url}`;
              break;
            }

            // Auth errors — definitive, stop everything
            if (response.status === 401 || response.status === 403) {
              console.error(`[${id}] ❌ AUTH FAILED on ${url}`);
              return res.status(401).json({
                ok: false,
                error: `فشل المصادقة (${response.status}) — تحقق من NOEST_API_TOKEN`,
                debug: { url, status: response.status, body: data },
              });
            }

            // Validation error 422 — try variant B before giving up
            if (response.status === 422) {
              console.log(`[${id}] 422 from ${url} with variant ${vi + 1}`);
              if (vi === 0) {
                lastError = `422: ${data.message || JSON.stringify(data.errors || data)}`;
                continue; // Try variant B
              }
              // Both variants failed with 422
              return res.status(422).json({
                ok: false,
                error: `خطأ في البيانات: ${data.message || JSON.stringify(data.errors || data)}`,
                debug: { url, status: 422, response: data },
              });
            }

            // Other HTTP error
            if (!response.ok) {
              lastError = `${url} → HTTP ${response.status}: ${data.message || data.error || ''}`;
              return res.status(response.status).json({
                ok: false,
                error: `خطأ من NOEST (${response.status}): ${data.message || data.error || JSON.stringify(data).substring(0, 200)}`,
                debug: { url, status: response.status, response: data },
              });
            }

            // ── HTTP 200 — check for semantic errors ──
            const semErr = isError(data);
            if (semErr) {
              console.error(`[${id}] Semantic error from ${url}: ${semErr}`);
              if (vi === 0) {
                lastError = `Semantic: ${semErr}`;
                continue; // Try variant B
              }
              return res.status(200).json({
                ok: false,
                error: `NOEST رفض الطلب: ${semErr}`,
                debug: { url, response: data },
              });
            }

            // ── Extract tracking/id ──
            const info = extractInfo(data);
            if (!info.tracking && !info.id) {
              console.warn(`[${id}] ⚠️ 200 OK from ${url} but NO tracking/id:`, JSON.stringify(data));
              return res.status(200).json({
                ok: false,
                error: 'NOEST استجاب 200 لكن بدون رقم تتبع — الطلب قد لا يكون صالحاً',
                debug: { url, response: data },
              });
            }

            // ═══════════════════════════════════════════════
            // ✅ SUCCESS — Real order created with tracking
            // ═══════════════════════════════════════════════
            console.log(`[${id}] ✅ ORDER CREATED! tracking=${info.tracking} id=${info.id} via ${url}`);
            return res.status(200).json({
              ok: true,
              data: {
                id: String(info.id || ''),
                tracking: String(info.tracking || ''),
                endpoint_used: url,
              },
            });
          }
        }
      }

      // ── All combinations failed ──
      console.error(`[${id}] ❌ ALL FAILED after ${triedCount} attempts. Last: ${lastError}`);
      return res.status(502).json({
        ok: false,
        error: 'فشل الاتصال بـ NOEST — جميع المحاولات فشلت',
        debug: {
          bases_tried: CANDIDATE_BASES,
          endpoints_tried: CREATE_PATHS,
          total_attempts: triedCount,
          last_error: lastError,
          last_status: lastStatus,
          last_response: lastSnippet,
          fix: 'Run POST {"action":"diagnose"} to test connectivity. Set NOEST_API_BASE if needed.',
        },
      });
    }

    // ═══════════════════════════════════════════════════════
    // GET WILAYAS
    // ═══════════════════════════════════════════════════════
    if (action === 'get_wilayas') {
      for (const base of CANDIDATE_BASES) {
        try {
          const r = await fetch(`${base}/wilayas`, { headers: authHeaders, signal: AbortSignal.timeout(8000) });
          if (r.ok) {
            const d = await r.json();
            return res.status(200).json({ ok: true, data: d.data || d });
          }
        } catch { /* try next */ }
      }
      return res.status(200).json({ ok: true, data: [] });
    }

    // ═══════════════════════════════════════════════════════
    // GET COMMUNES
    // ═══════════════════════════════════════════════════════
    if (action === 'get_communes') {
      if (!params.wilaya_id) return res.status(400).json({ ok: false, error: 'Missing wilaya_id' });
      for (const base of CANDIDATE_BASES) {
        try {
          const r = await fetch(`${base}/communes?wilaya_id=${params.wilaya_id}`, { headers: authHeaders, signal: AbortSignal.timeout(8000) });
          if (r.ok) {
            const d = await r.json();
            return res.status(200).json({ ok: true, data: d.data || d });
          }
        } catch { /* try next */ }
      }
      return res.status(200).json({ ok: true, data: [] });
    }

    // ═══════════════════════════════════════════════════════
    // GET DESKS
    // ═══════════════════════════════════════════════════════
    if (action === 'get_desks' || action === 'get_stations') {
      for (const base of CANDIDATE_BASES) {
        try {
          const r = await fetch(`${base}/stations`, { headers: authHeaders, signal: AbortSignal.timeout(8000) });
          if (r.ok) {
            const d = await r.json();
            return res.status(200).json({ ok: true, data: d.data || d });
          }
        } catch { /* try next */ }
      }
      return res.status(200).json({ ok: true, data: [] });
    }

    // ═══════════════════════════════════════════════════════
    // TRACK ORDER
    // ═══════════════════════════════════════════════════════
    if (action === 'track_order') {
      if (!params.tracking) return res.status(400).json({ ok: false, error: 'Missing tracking' });
      for (const base of CANDIDATE_BASES) {
        try {
          const r = await fetch(`${base}/tracking?code=${encodeURIComponent(params.tracking)}`, { headers: authHeaders, signal: AbortSignal.timeout(8000) });
          if (r.ok) {
            const d = await r.json();
            return res.status(200).json({ ok: true, data: d.data || d });
          }
        } catch { /* try next */ }
      }
      return res.status(200).json({ ok: false, error: 'Tracking not found' });
    }

    // ═══════════════════════════════════════════════════════
    // UNKNOWN
    // ═══════════════════════════════════════════════════════
    return res.status(400).json({
      ok: false,
      error: `Unknown action: ${action}`,
      available: ['create_order', 'diagnose', 'get_wilayas', 'get_communes', 'get_desks', 'track_order'],
    });

  } catch (err) {
    console.error(`[${id}] UNHANDLED:`, err);
    return res.status(500).json({
      ok: false,
      error: `خطأ داخلي: ${err.message}`,
    });
  }
}
