// ============================================================
// Vercel Serverless Function - NOEST API Proxy
// المسار: /api/noest
// يعمل كوسيط حقيقي بين المتصفح وخادم NOEST لتجاوز CORS
// ============================================================

const NOEST_BASE_URL = 'https://app.noest-dz.com';
const NOEST_API_TOKEN = '7Y5o9xsGS9s5o85SEdPdqCUF0aebwWXaiYz';

export default async function handler(req, res) {
  // ─── CORS Headers ────────────────────────────────────────
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  try {
    // Extract NOEST endpoint from query
    const { endpoint, ...rest } = req.query;

    if (!endpoint) {
      return res.status(400).json({ error: 'endpoint parameter is required' });
    }

    const url = `${NOEST_BASE_URL}${endpoint}`;
    const method = req.method || 'POST';

    const fetchOptions = {
      method,
      headers: {
        'Authorization': `Bearer ${NOEST_API_TOKEN}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    };

    // Add body for POST requests
    if (method !== 'GET' && req.body) {
      fetchOptions.body = typeof req.body === 'string'
        ? req.body
        : JSON.stringify(req.body);
    }

    console.log(`[NOEST Proxy] ${method} ${url}`);
    if (fetchOptions.body) {
      console.log('[NOEST Proxy] Body:', fetchOptions.body);
    }

    const response = await fetch(url, fetchOptions);
    const responseText = await response.text();

    let responseBody;
    try {
      responseBody = JSON.parse(responseText);
    } catch {
      responseBody = { raw: responseText };
    }

    console.log(`[NOEST Proxy] Response ${response.status}:`,
      JSON.stringify(responseBody).slice(0, 300));

    return res.status(response.status).json(responseBody);

  } catch (error) {
    console.error('[NOEST Proxy] Error:', error);
    return res.status(500).json({
      error: 'Proxy server error',
      message: error.message,
    });
  }
}
