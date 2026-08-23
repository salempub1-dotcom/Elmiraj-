// ============================================================
// Lightweight Internal Analytics (📊 الإحصائيات) — Vercel Serverless Function
// ============================================================
// POST action 'track' — PUBLIC, unauthenticated. Registers ONE page view.
//   Body: { page: string }
//   - Never reads or returns any analytics/order data.
//   - Never touches the `orders` table or Service Role in any other way.
//   - Excludes /admin* paths server-side too (defense in depth — the
//     client already skips this call for /admin).
//   - Always responds fast; failures are swallowed (fire-and-forget from
//     the client, so this endpoint must never be a source of UI errors).
//
// POST action 'stats' — ADMIN ONLY (verifyAdminToken). Returns aggregated
//   daily page-view totals for a date range. Never returns per-visitor
//   or per-request data — only day-bucketed counts, already aggregated
//   in the database (one grouped query).
//   Body: { from: 'YYYY-MM-DD', to: 'YYYY-MM-DD' }  (Africa/Algiers keys)
//
// Data model: table `analytics_pageviews(date DATE, page_id TEXT,
// views INTEGER)`, PRIMARY KEY(date, page_id), incremented atomically via
// the `increment_pageview` Postgres function (INSERT ... ON CONFLICT DO
// UPDATE) so concurrent visits never race/lose counts. This is simple
// aggregated "Page Views", not deduplicated unique "Visits" — see
// sql/setup.sql and src/components/admin/StatisticsPage.tsx.
//
// Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ADMIN_USERNAME, ADMIN_PASSWORD
// ============================================================

import { createHmac } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

export const config = { api: { bodyParser: { sizeLimit: '64kb' } } };

// Same admin-token verification as api/orders.js — kept as a small local
// copy since these are independent serverless functions (project convention).
function verifyAdminToken(authHeader) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.substring(7);
  try {
    const decoded = Buffer.from(token, 'base64').toString();
    const c1 = decoded.indexOf(':');
    const c2 = decoded.indexOf(':', c1 + 1);
    if (c1 === -1 || c2 === -1) return null;
    const user = decoded.substring(0, c1);
    const ts = decoded.substring(c1 + 1, c2);
    const sig = decoded.substring(c2 + 1);
    const AU = process.env.ADMIN_USERNAME;
    const AP = process.env.ADMIN_PASSWORD;
    if (!AU || !AP || user !== AU) return null;
    const age = Date.now() - parseInt(ts);
    if (isNaN(age) || age > 86400000 || age < 0) return null;
    const expected = createHmac('sha256', AP).update(`${user}:${ts}`).digest('hex').substring(0, 16);
    if (sig !== expected) return null;
    return { username: user };
  } catch { return null; }
}

function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

// Africa/Algiers is a fixed UTC+1 offset year-round (no DST) — matches the
// algiersDateKey() logic already used client-side for order date filters.
function algiersDateKey(d) {
  const date = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(date.getTime())) return '';
  const shifted = new Date(date.getTime() + 60 * 60 * 1000);
  return shifted.toISOString().slice(0, 10);
}

const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed. Use POST.' });
  }

  const supabase = getSupabase();
  if (!supabase) {
    // Never block/error visibly on the client for 'track' — just no-op.
    return res.status(200).json({ ok: false, error: 'SERVICE_UNAVAILABLE' });
  }

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
  if (!body || typeof body !== 'object') body = {};

  const action = body.action;

  // ── TRACK: register one page view (public, minimal, best-effort) ──
  if (action === 'track') {
    try {
      const rawPage = typeof body.page === 'string' ? body.page : '/';
      const page = rawPage.split('?')[0].split('#')[0].slice(0, 200) || '/';

      // Exclude /admin traffic and obvious bot/health-check noise — no
      // external service, just a minimal server-side allow-list guard.
      if (page.startsWith('/admin')) {
        return res.status(200).json({ ok: true, skipped: true });
      }
      const ua = String(req.headers['user-agent'] || '');
      if (/bot|spider|crawler|health-?check|monitor/i.test(ua)) {
        return res.status(200).json({ ok: true, skipped: true });
      }

      const dateKey = algiersDateKey(new Date());
      const { error } = await supabase.rpc('increment_pageview', { p_date: dateKey, p_page: page });
      if (error) {
        // Swallow — tracking must never surface an error to the visitor.
        console.error('[ANALYTICS] track error:', error.message);
      }
      return res.status(200).json({ ok: true });
    } catch (e) {
      console.error('[ANALYTICS] track exception:', e.message);
      return res.status(200).json({ ok: true }); // still 200 — never a source of client-side errors
    }
  }

  // ── STATS: admin-only aggregated totals for a date range ──────────
  if (action === 'stats') {
    const admin = verifyAdminToken(req.headers.authorization);
    if (!admin) {
      return res.status(401).json({ ok: false, error: 'Admin authentication required' });
    }

    const from = typeof body.from === 'string' && DATE_KEY_RE.test(body.from) ? body.from : null;
    const to = typeof body.to === 'string' && DATE_KEY_RE.test(body.to) ? body.to : null;
    if (!from || !to) {
      return res.status(400).json({ ok: false, error: 'from/to (YYYY-MM-DD) are required' });
    }

    try {
      // One grouped query: all page rows in range, excluding /admin (defense
      // in depth — 'track' already never stores /admin rows, but a defunct
      // row from before this rule existed should never leak into a total).
      const { data, error } = await supabase
        .from('analytics_pageviews')
        .select('date, page_id, views')
        .gte('date', from)
        .lte('date', to)
        .not('page_id', 'ilike', '/admin%');

      if (error) {
        console.error('[ANALYTICS] stats error:', error.message, error.code);
        return res.status(200).json({ ok: false, error: error.message, code: error.code });
      }

      const byDateMap = new Map();
      let totalViews = 0;
      for (const row of data || []) {
        const v = Number(row.views) || 0;
        totalViews += v;
        byDateMap.set(row.date, (byDateMap.get(row.date) || 0) + v);
      }
      const byDate = Array.from(byDateMap.entries())
        .map(([date, views]) => ({ date, views }))
        .sort((a, b) => a.date.localeCompare(b.date));

      return res.status(200).json({ ok: true, data: { totalViews, byDate } });
    } catch (e) {
      return res.status(200).json({ ok: false, error: e.message });
    }
  }

  return res.status(400).json({ ok: false, error: 'Unknown action', available: ['track', 'stats'] });
}
