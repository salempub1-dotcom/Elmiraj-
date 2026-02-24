// ============================================================
// Admin Authentication — Vercel Serverless Function
// ============================================================
// Environment variables required in Vercel:
//   ADMIN_USERNAME — admin login username
//   ADMIN_PASSWORD — admin login password
// ============================================================

export const config = { api: { bodyParser: true } };

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  if (!body || typeof body !== 'object') body = {};

  const { username, password } = body;

  if (!username || !password) {
    return res.status(400).json({ ok: false, error: 'يرجى إدخال اسم المستخدم وكلمة المرور' });
  }

  // Check credentials from environment variables
  const ADMIN_USER = process.env.ADMIN_USERNAME || 'admin';
  const ADMIN_PASS = process.env.ADMIN_PASSWORD || 'admin123';

  if (username === ADMIN_USER && password === ADMIN_PASS) {
    // Generate a simple session token
    const token = Buffer.from(`${username}:${Date.now()}:${Math.random().toString(36)}`).toString('base64');
    return res.status(200).json({
      ok: true,
      token,
      message: 'تم تسجيل الدخول بنجاح',
    });
  }

  return res.status(401).json({
    ok: false,
    error: 'اسم المستخدم أو كلمة المرور غير صحيحة',
  });
}
