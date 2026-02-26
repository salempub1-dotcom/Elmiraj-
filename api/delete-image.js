// ============================================================
// Secure Image Deletion — Vercel Serverless Function
// ============================================================
// ONLY admin can delete. Uses Supabase SERVICE_ROLE key.
// ============================================================

import { createHmac } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

export const config = { api: { bodyParser: true } };

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
    if (!ADMIN_USER || !ADMIN_PASS) return null;
    if (user !== ADMIN_USER) return null;
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
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });

  const admin = verifyAdminToken(req.headers.authorization);
  if (!admin) return res.status(401).json({ ok: false, error: 'غير مصرح' });

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
  if (!body || typeof body !== 'object') body = {};

  const supabase = getServiceClient();
  if (!supabase) {
    return res.status(503).json({ ok: false, error: 'Supabase غير مُكوّن على الخادم' });
  }

  const BUCKET = process.env.SUPABASE_BUCKET || 'product-images';
  const { path: filePath, url } = body;

  try {
    let resolvedPath = filePath;

    // Extract path from URL if provided
    if (!resolvedPath && url) {
      const bucketMarker = `/storage/v1/object/public/${BUCKET}/`;
      const idx = url.indexOf(bucketMarker);
      if (idx === -1) {
        return res.status(400).json({ ok: false, error: 'ليس رابط Supabase صالح' });
      }
      resolvedPath = url.substring(idx + bucketMarker.length);
    }

    if (!resolvedPath) {
      return res.status(400).json({ ok: false, error: 'path or url is required' });
    }

    const { error } = await supabase.storage.from(BUCKET).remove([resolvedPath]);

    if (error) {
      console.error('[DELETE] ❌', error.message);
      return res.status(200).json({ ok: false, error: error.message });
    }

    console.log(`[DELETE] ✅ ${admin.username} deleted: ${resolvedPath}`);
    return res.status(200).json({ ok: true, deleted: resolvedPath });
  } catch (e) {
    return res.status(200).json({ ok: false, error: e.message });
  }
}
