// ============================================================
// Admin Authentication — Vercel Serverless Function
// ============================================================
// Env vars: ADMIN_USERNAME, ADMIN_PASSWORD
// Token: HMAC-signed, 24h expiry, verifiable by other API routes
// ============================================================

import { createHmac } from 'node:crypto';

export const config = { api: { bodyParser: true } };

/**
 * Create an HMAC-signed admin token.
 * Format: base64( username:timestamp:hmac_signature )
 * The signature prevents forgery — only someone with ADMIN_PASSWORD can create valid tokens.
 */
function createToken(username, secret) {
  const ts = Date.now().toString();
  const sig = createHmac('sha256', secret)
    .update(`${username}:${ts}`)
    .digest('hex')
    .substring(0, 16);
  return Buffer.from(`${username}:${ts}:${sig}`).toString('base64');
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
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

  const ADMIN_USER = process.env.ADMIN_USERNAME;
  const ADMIN_PASS = process.env.ADMIN_PASSWORD;

  if (!ADMIN_USER || !ADMIN_PASS) {
    return res.status(503).json({
      ok: false,
      error: 'بيانات الاعتماد غير مُكوّنة على الخادم. يرجى إضافة ADMIN_USERNAME و ADMIN_PASSWORD في إعدادات Vercel.',
    });
  }

  if (username === ADMIN_USER && password === ADMIN_PASS) {
    const token = createToken(username, ADMIN_PASS);
    return res.status(200).json({ ok: true, token, message: 'تم تسجيل الدخول بنجاح' });
  }

  return res.status(401).json({
    ok: false,
    error: 'اسم المستخدم أو كلمة المرور غير صحيحة',
  });
}
