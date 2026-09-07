// ============================================================
// Secure Media Upload — Vercel Serverless Function
// ============================================================
// Images still upload through this function after compression.
// Product videos use a short-lived Supabase signed upload URL so the
// binary never passes through Vercel (important for 15MB video files).
// ONLY admin can create upload/read URLs. SERVICE_ROLE stays server-side.
// ============================================================

import { createHmac, randomBytes } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { toMediaProxyUrl } from '../lib/mediaProxy.js';

export const config = { api: { bodyParser: { sizeLimit: '10mb' } } };

const MAX_VIDEO_BYTES = 15 * 1024 * 1024;
const VIDEO_TYPES = new Set(['video/mp4', 'video/webm']);

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

function safeVideoPath(path) {
  return typeof path === 'string'
    && path.startsWith('products/videos/')
    && !path.includes('..')
    && path.length < 300;
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

  // Create a one-time URL that lets the authenticated admin browser upload
  // the video DIRECTLY to Supabase Storage. Vercel receives only metadata.
  if (body.action === 'create_video_upload') {
    const contentType = String(body.content_type || '').toLowerCase();
    const size = Number(body.size || 0);
    if (!VIDEO_TYPES.has(contentType)) {
      return res.status(400).json({ ok: false, error: 'الفيديو يجب أن يكون MP4 أو WebM' });
    }
    if (!Number.isFinite(size) || size <= 0 || size > MAX_VIDEO_BYTES) {
      return res.status(400).json({ ok: false, error: 'حجم الفيديو يجب أن لا يتجاوز 15MB' });
    }

    const supabase = getServiceClient();
    if (!supabase) return res.status(503).json({ ok: false, error: 'Supabase غير مُكوّن على الخادم' });

    try {
      const timestamp = Date.now();
      const random = randomBytes(5).toString('hex');
      const ext = contentType === 'video/webm' ? 'webm' : 'mp4';
      const filePath = `products/videos/${timestamp}-${random}.${ext}`;
      const { data, error } = await supabase.storage.from(BUCKET).createSignedUploadUrl(filePath, { upsert: false });
      if (error || !data?.signedUrl) {
        return res.status(200).json({ ok: false, error: `فشل تجهيز رفع الفيديو: ${error?.message || 'signed URL unavailable'}` });
      }
      const { data: publicData } = supabase.storage.from(BUCKET).getPublicUrl(filePath);
      return res.status(200).json({
        ok: true,
        signed_url: data.signedUrl,
        token: data.token,
        path: filePath,
        canonical_url: publicData.publicUrl,
        max_bytes: MAX_VIDEO_BYTES,
      });
    } catch (e) {
      return res.status(200).json({ ok: false, error: `خطأ في تجهيز الفيديو: ${e.message}` });
    }
  }

  // Generate a short-lived playback URL after a direct upload. This keeps
  // the Storage bucket private while allowing <video> to stream/range-read
  // directly from Supabase rather than proxying 15MB through Vercel.
  if (body.action === 'video_playback_url') {
    const path = String(body.path || '');
    if (!safeVideoPath(path)) return res.status(400).json({ ok: false, error: 'مسار فيديو غير صالح' });
    const supabase = getServiceClient();
    if (!supabase) return res.status(503).json({ ok: false, error: 'Supabase غير مُكوّن على الخادم' });
    try {
      const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 6 * 60 * 60);
      if (error || !data?.signedUrl) return res.status(200).json({ ok: false, error: error?.message || 'تعذر تجهيز معاينة الفيديو' });
      return res.status(200).json({ ok: true, url: data.signedUrl });
    } catch (e) {
      return res.status(200).json({ ok: false, error: e.message });
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
