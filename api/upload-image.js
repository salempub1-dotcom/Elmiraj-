// ============================================================
// Secure Image Upload — Vercel Serverless Function
// ============================================================
// ONLY admin can upload. Uses Supabase SERVICE_ROLE key (server-side).
// ============================================================

import { createHmac, randomBytes } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { toMediaProxyUrl } from '../lib/mediaProxy.js';

export const config = { api: { bodyParser: { sizeLimit: '10mb' } } };

function verifyAdminToken(authHeader) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.substring(7);
  try {
    const decoded = Buffer.from(token, 'base64').toString();
    const firstColon = decoded.indexOf(':');
    const secondColon = decoded.indexOf(':', firstColon + 1);
    if (firstColon === -1 || secondColon === -1) return null;
    const user = decoded.substring(0, firstColon);
    const ts = decoded.substring(firstColon + 1, secondColon);
    const sig = decoded.substring(secondColon + 1);
    const ADMIN_USER = process.env.ADMIN_USERNAME;
    const ADMIN_PASS = process.env.ADMIN_PASSWORD;
    if (!ADMIN_USER || !ADMIN_PASS || user !== ADMIN_USER) return null;
    const age = Date.now() - parseInt(ts);
    if (isNaN(age) || age > 24 * 60 * 60 * 1000 || age < 0) return null;
    const expectedSig = createHmac('sha256', ADMIN_PASS)
      .update(`${user}:${ts}`)
      .digest('hex')
      .substring(0, 16);
    if (sig !== expectedSig) return null;
    return { username: user };
  } catch {
    return null;
  }
}

function getServiceClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });

  const admin = verifyAdminToken(req.headers.authorization);
  if (!admin) return res.status(401).json({ ok: false, error: 'غير مصرح — يرجى تسجيل الدخول كمسؤول' });

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  if (!body || typeof body !== 'object') body = {};

  const BUCKET = process.env.SUPABASE_BUCKET || 'product-images';

  if (body.action === 'health') {
    const supabase = getServiceClient();
    if (!supabase) {
      return res.status(200).json({ ok: false, supabase_configured: false, error: 'SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not configured' });
    }
    try {
      const { error } = await supabase.storage.from(BUCKET).list('products', { limit: 1 });
      if (error) return res.status(200).json({ ok: false, supabase_configured: true, error: error.message });
      return res.status(200).json({ ok: true, supabase_configured: true, bucket: BUCKET, mode: 'service_role', message: '✅ Supabase Storage connected (server-side)' });
    } catch (e) {
      return res.status(200).json({ ok: false, supabase_configured: true, error: e.message });
    }
  }

  const { image_base64, content_type } = body;
  if (!image_base64) return res.status(400).json({ ok: false, error: 'image_base64 is required' });

  const supabase = getServiceClient();
  if (!supabase) {
    return res.status(503).json({ ok: false, error: 'Supabase غير مُكوّن. أضف SUPABASE_URL و SUPABASE_SERVICE_ROLE_KEY في Vercel.' });
  }

  try {
    let b64Data = image_base64;
    if (b64Data.startsWith('data:')) b64Data = b64Data.split(',')[1] || b64Data;
    const buffer = Buffer.from(b64Data, 'base64');
    if (buffer.length > 10 * 1024 * 1024) return res.status(400).json({ ok: false, error: 'الصورة كبيرة جداً (أقصى 10MB)' });

    const timestamp = Date.now();
    const random = randomBytes(4).toString('hex');
    const ext = (content_type || 'image/jpeg').includes('png') ? 'png' : 'jpg';
    const filePath = `products/${timestamp}-${random}.${ext}`;

    const { data, error } = await supabase.storage.from(BUCKET).upload(filePath, buffer, {
      contentType: content_type || 'image/jpeg',
      cacheControl: '31536000',
      upsert: false,
    });

    if (error) {
      console.error('[UPLOAD] ❌ Supabase error:', error.message);
      return res.status(200).json({ ok: false, error: `فشل رفع الصورة: ${error.message}` });
    }

    // Keep the canonical storage URL internally, but only expose the Vercel
    // media proxy to the browser. This works whether the bucket is public or private.
    const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(data.path);
    const canonicalUrl = urlData.publicUrl;
    const proxyUrl = toMediaProxyUrl(canonicalUrl);

    console.log(`[UPLOAD] ✅ ${admin.username} uploaded: ${filePath} (${(buffer.length / 1024).toFixed(0)}KB)`);

    return res.status(200).json({
      ok: true,
      url: proxyUrl,
      path: data.path,
      size: buffer.length,
    });
  } catch (e) {
    console.error('[UPLOAD] ❌ Error:', e.message);
    return res.status(200).json({ ok: false, error: `خطأ في رفع الصورة: ${e.message}` });
  }
}
