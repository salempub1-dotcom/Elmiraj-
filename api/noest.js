// ============================================================
// Vercel Serverless Function — NOEST Delivery API Proxy
// Environment Variables (set in Vercel dashboard):
//   NOEST_API_TOKEN  — Bearer token for NOEST API
//   NOEST_USER_GUID  — User GUID for NOEST account
// ============================================================

const NOEST_BASE_URL = 'https://app.noest-dz.com/api/v1';

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Only POST allowed
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  // Read env vars
  const API_TOKEN = process.env.NOEST_API_TOKEN;
  const USER_GUID = process.env.NOEST_USER_GUID;

  if (!API_TOKEN || !USER_GUID) {
    console.error('Missing NOEST_API_TOKEN or NOEST_USER_GUID environment variables');
    return res.status(500).json({
      ok: false,
      error: 'Server configuration error: missing API credentials',
    });
  }

  try {
    const { action, ...params } = req.body || {};

    // ─────────────────────────────────────────────
    // ACTION: create_order
    // ─────────────────────────────────────────────
    if (action === 'create_order') {
      const {
        client,
        phone,
        adresse,
        wilaya_id,
        commune,
        montant,
        produit,
        type_id,
        stop_desk,
        station_code,
      } = params;

      // Validate required fields
      if (!client || !phone || !adresse || !wilaya_id || !commune || !montant || !produit) {
        return res.status(400).json({
          ok: false,
          error: 'Missing required fields: client, phone, adresse, wilaya_id, commune, montant, produit',
        });
      }

      // Build the order payload for NOEST API
      const orderPayload = {
        client,
        phone,
        adresse,
        wilaya_id: Number(wilaya_id),
        commune,
        montant: Number(montant),
        produit,
        type_id: type_id || 1,
        stop_desk: stop_desk || 0,
        user_guid: USER_GUID,
      };

      // Add station_code only if stop_desk delivery
      if (stop_desk === 1 && station_code) {
        orderPayload.station_code = station_code;
      }

      console.log('[NOEST] Creating order:', JSON.stringify(orderPayload, null, 2));

      // Try multiple possible NOEST API endpoints
      const endpoints = [
        `${NOEST_BASE_URL}/orders`,
        `${NOEST_BASE_URL}/order/create`,
        `${NOEST_BASE_URL}/order`,
        `${NOEST_BASE_URL}/colis`,
      ];

      let lastError = null;
      let success = false;

      for (const endpoint of endpoints) {
        try {
          console.log(`[NOEST] Trying endpoint: ${endpoint}`);

          const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json',
              'Authorization': `Bearer ${API_TOKEN}`,
            },
            body: JSON.stringify(orderPayload),
          });

          const responseText = await response.text();
          console.log(`[NOEST] Response ${response.status} from ${endpoint}:`, responseText);

          // Try to parse as JSON
          let data;
          try {
            data = JSON.parse(responseText);
          } catch {
            data = { raw: responseText };
          }

          if (response.ok) {
            // Extract tracking number from various possible response formats
            const tracking =
              data.tracking ||
              data.code ||
              data.data?.tracking ||
              data.data?.code ||
              data.data?.id ||
              data.id ||
              null;

            const orderId =
              data.id ||
              data.data?.id ||
              data.order_id ||
              data.data?.order_id ||
              null;

            console.log('[NOEST] ✅ Order created successfully:', { tracking, orderId });

            return res.status(200).json({
              ok: true,
              data: {
                id: String(orderId || ''),
                tracking: String(tracking || ''),
              },
              raw: data,
            });
          }

          // If 404, try next endpoint
          if (response.status === 404) {
            lastError = `Endpoint ${endpoint} returned 404`;
            continue;
          }

          // Other error (401, 422, 500, etc) - return it
          lastError = data.message || data.error || `HTTP ${response.status}`;

          // If 401/403, don't try other endpoints (auth issue)
          if (response.status === 401 || response.status === 403) {
            return res.status(response.status).json({
              ok: false,
              error: `Authentication failed: ${lastError}`,
              details: data,
            });
          }

          // If 422 (validation error), return it
          if (response.status === 422) {
            return res.status(422).json({
              ok: false,
              error: `Validation error: ${lastError}`,
              details: data,
            });
          }

        } catch (fetchError) {
          lastError = fetchError.message;
          console.error(`[NOEST] Fetch error for ${endpoint}:`, fetchError.message);
          continue;
        }
      }

      // All endpoints failed
      console.error('[NOEST] ❌ All endpoints failed. Last error:', lastError);
      return res.status(502).json({
        ok: false,
        error: `NOEST API error: ${lastError || 'All endpoints unreachable'}`,
      });
    }

    // ─────────────────────────────────────────────
    // ACTION: get_wilayas
    // ─────────────────────────────────────────────
    if (action === 'get_wilayas') {
      try {
        const response = await fetch(`${NOEST_BASE_URL}/wilayas`, {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
            'Authorization': `Bearer ${API_TOKEN}`,
          },
        });

        if (response.ok) {
          const data = await response.json();
          return res.status(200).json({ ok: true, data: data.data || data });
        }
      } catch (err) {
        console.warn('[NOEST] get_wilayas failed:', err.message);
      }

      // Return empty — frontend will use local data
      return res.status(200).json({ ok: true, data: [] });
    }

    // ─────────────────────────────────────────────
    // ACTION: get_communes
    // ─────────────────────────────────────────────
    if (action === 'get_communes') {
      const { wilaya_id } = params;
      if (!wilaya_id) {
        return res.status(400).json({ ok: false, error: 'Missing wilaya_id' });
      }

      try {
        const response = await fetch(`${NOEST_BASE_URL}/communes?wilaya_id=${wilaya_id}`, {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
            'Authorization': `Bearer ${API_TOKEN}`,
          },
        });

        if (response.ok) {
          const data = await response.json();
          return res.status(200).json({ ok: true, data: data.data || data });
        }
      } catch (err) {
        console.warn('[NOEST] get_communes failed:', err.message);
      }

      return res.status(200).json({ ok: true, data: [] });
    }

    // ─────────────────────────────────────────────
    // ACTION: get_desks / get_stations
    // ─────────────────────────────────────────────
    if (action === 'get_desks' || action === 'get_stations') {
      try {
        const response = await fetch(`${NOEST_BASE_URL}/stations`, {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
            'Authorization': `Bearer ${API_TOKEN}`,
          },
        });

        if (response.ok) {
          const data = await response.json();
          return res.status(200).json({ ok: true, data: data.data || data });
        }
      } catch (err) {
        console.warn('[NOEST] get_desks failed:', err.message);
      }

      return res.status(200).json({ ok: true, data: [] });
    }

    // ─────────────────────────────────────────────
    // ACTION: track_order
    // ─────────────────────────────────────────────
    if (action === 'track_order') {
      const { tracking } = params;
      if (!tracking) {
        return res.status(400).json({ ok: false, error: 'Missing tracking code' });
      }

      try {
        const response = await fetch(`${NOEST_BASE_URL}/tracking?code=${encodeURIComponent(tracking)}`, {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
            'Authorization': `Bearer ${API_TOKEN}`,
          },
        });

        if (response.ok) {
          const data = await response.json();
          return res.status(200).json({ ok: true, data: data.data || data });
        }
      } catch (err) {
        console.warn('[NOEST] track_order failed:', err.message);
      }

      return res.status(200).json({ ok: false, error: 'Tracking not found' });
    }

    // ─────────────────────────────────────────────
    // UNKNOWN ACTION
    // ─────────────────────────────────────────────
    return res.status(400).json({
      ok: false,
      error: `Unknown action: ${action}. Valid actions: create_order, get_wilayas, get_communes, get_desks, track_order`,
    });

  } catch (error) {
    console.error('[NOEST] Server error:', error);
    return res.status(500).json({
      ok: false,
      error: `Server error: ${error.message}`,
    });
  }
}
