// ============================================================
// Orders API wrapper — WhatsApp order confirmation V1
// Delegates all existing behavior to the frozen core implementation,
// then (save action only) attempts a server-side WhatsApp confirmation.
// Order success NEVER depends on WhatsApp success.
// ============================================================

import { createClient } from '@supabase/supabase-js';
import ordersCoreHandler from '../lib/ordersCore.js';
import { readDeliverySettings } from '../lib/deliverySettings.js';
import { hasWhatsAppConsent, sendOrderReceivedWhatsApp } from '../lib/whatsapp.js';

export const config = { api: { bodyParser: { sizeLimit: '2mb' } } };

function parsedBody(raw) {
  if (raw && typeof raw === 'object') return raw;
  if (typeof raw === 'string') {
    try { return JSON.parse(raw); } catch { return {}; }
  }
  return {};
}

function getSupabaseForStorefrontSettings() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

function makeCaptureResponse(realRes) {
  let statusCode = 200;
  let jsonBody;
  let endBody;
  let endedWithJson = false;
  let ended = false;

  const proxy = {
    setHeader(name, value) {
      realRes.setHeader(name, value);
      return proxy;
    },
    getHeader(name) {
      return typeof realRes.getHeader === 'function' ? realRes.getHeader(name) : undefined;
    },
    status(code) {
      statusCode = code;
      return proxy;
    },
    json(body) {
      jsonBody = body;
      endedWithJson = true;
      ended = true;
      return proxy;
    },
    end(body) {
      endBody = body;
      ended = true;
      return proxy;
    },
  };

  return {
    proxy,
    snapshot: () => ({ statusCode, jsonBody, endBody, endedWithJson, ended }),
  };
}

export default async function handler(req, res) {
  const body = parsedBody(req.body);

  // Every non-save action remains byte-for-byte behavior of the existing API.
  if (req.method !== 'POST' || body.action !== 'save') {
    return ordersCoreHandler(req, res);
  }

  const capture = makeCaptureResponse(res);
  await ordersCoreHandler(req, capture.proxy);
  const result = capture.snapshot();

  // If the existing order save failed, preserve its response exactly and do not
  // attempt WhatsApp. The order is always the source of truth and comes first.
  if (!result.endedWithJson || !result.jsonBody?.ok) {
    if (result.endedWithJson) return res.status(result.statusCode).json(result.jsonBody);
    if (result.ended) return res.status(result.statusCode).end(result.endBody);
    return res.status(500).json({ ok: false, error: 'ORDER_SAVE_NO_RESPONSE' });
  }

  const consent = hasWhatsAppConsent(req.headers.cookie || '');
  let whatsapp = { sent: false, skipped: 'NO_CONSENT' };

  if (consent) {
    // The admin visibility toggle is also enforced server-side. Hiding the
    // storefront option means no WhatsApp request is made even if a stale or
    // manually crafted consent cookie is present.
    const storefrontSettings = await readDeliverySettings(getSupabaseForStorefrontSettings());
    if (!storefrontSettings.data.whatsappConfirmation) {
      whatsapp = { sent: false, skipped: 'FEATURE_DISABLED' };
    } else {
      // Await with a short server-side timeout inside the helper. A failure is
      // deliberately non-fatal because the order is already safely persisted.
      whatsapp = await sendOrderReceivedWhatsApp(body.order);
    }
  }

  return res.status(result.statusCode).json({
    ...result.jsonBody,
    whatsappSent: whatsapp.sent === true,
    whatsappSkipped: whatsapp.sent ? undefined : whatsapp.skipped,
  });
}
