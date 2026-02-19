// ============================================================
// Netlify Serverless Function - NOEST API Proxy
// يعمل كوسيط بين المتصفح وخادم NOEST لتجاوز مشكلة CORS
// ============================================================

const NOEST_BASE_URL = 'https://app.noest-dz.com';
const NOEST_API_TOKEN = '7Y5o9xsGS9s5o85SEdPdqCUF0aebwWXaiYz';

exports.handler = async (event) => {
  // Allow CORS from any origin
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json',
  };

  // Handle preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  try {
    // Extract the NOEST endpoint from query params
    const endpoint = event.queryStringParameters?.endpoint || '';
    if (!endpoint) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'endpoint parameter is required' }),
      };
    }

    const url = `${NOEST_BASE_URL}${endpoint}`;
    const method = event.httpMethod || 'POST';

    const fetchOptions = {
      method,
      headers: {
        'Authorization': `Bearer ${NOEST_API_TOKEN}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    };

    if (method !== 'GET' && event.body) {
      fetchOptions.body = event.body;
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

    console.log(`[NOEST Proxy] Response ${response.status}:`, JSON.stringify(responseBody).slice(0, 200));

    return {
      statusCode: response.status,
      headers,
      body: JSON.stringify(responseBody),
    };

  } catch (error) {
    console.error('[NOEST Proxy] Error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Proxy error',
        message: error.message,
      }),
    };
  }
};
