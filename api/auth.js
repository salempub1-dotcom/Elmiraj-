// ============================================================
// Vercel Serverless Function — Admin Authentication
// Environment Variables (set in Vercel dashboard):
//   VITE_ADMIN_USER  — Admin username
//   VITE_ADMIN_PASS  — Admin password
// ============================================================

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  // Read credentials from server-side env vars
  // Supports both VITE_ prefix and non-prefix versions
  const ADMIN_USER = process.env.VITE_ADMIN_USER || process.env.ADMIN_USER;
  const ADMIN_PASS = process.env.VITE_ADMIN_PASS || process.env.ADMIN_PASS;

  if (!ADMIN_USER || !ADMIN_PASS) {
    console.error('Missing ADMIN_USER or ADMIN_PASS environment variables');
    return res.status(500).json({
      ok: false,
      error: 'Server configuration error',
    });
  }

  try {
    const { username, password } = req.body || {};

    if (!username || !password) {
      return res.status(400).json({
        ok: false,
        error: 'يرجى إدخال اسم المستخدم وكلمة المرور',
      });
    }

    if (username === ADMIN_USER && password === ADMIN_PASS) {
      // Generate a simple session token (timestamp + random)
      const token = Buffer.from(`${ADMIN_USER}:${Date.now()}:${Math.random().toString(36).slice(2)}`).toString('base64');

      return res.status(200).json({
        ok: true,
        token,
      });
    }

    return res.status(401).json({
      ok: false,
      error: 'اسم المستخدم أو كلمة المرور غير صحيحة',
    });

  } catch (error) {
    console.error('[AUTH] Server error:', error);
    return res.status(500).json({
      ok: false,
      error: 'خطأ في الخادم',
    });
  }
}
