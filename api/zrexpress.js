// Safe ZR Express health endpoint — never returns credentials.
import { getZrSafeConfig } from '../lib/deliveryProviders.js';

export const config = { api: { bodyParser: false } };

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ ok: false, error: 'Method not allowed' });

  const cfg = getZrSafeConfig();
  return res.status(200).json({
    ok: true,
    provider: 'zrexpress',
    configured: cfg.configured,
    env: {
      tenant: cfg.tenant,
      apiKey: cfg.apiKey,
      base: cfg.base,
      version: cfg.version,
    },
    note: 'This endpoint checks configuration presence only. It never exposes or logs ZR credentials and never creates a parcel.',
  });
}
