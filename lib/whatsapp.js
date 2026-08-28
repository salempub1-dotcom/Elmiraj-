// ============================================================
// WhatsApp Cloud API — Order confirmation V1
// Server-side only. Never expose Meta credentials to the browser.
// ============================================================

const CONSENT_COOKIE = 'almiraj_whatsapp_consent';

export function hasWhatsAppConsent(cookieHeader = '') {
  return String(cookieHeader)
    .split(';')
    .map((part) => part.trim())
    .some((part) => part === `${CONSENT_COOKIE}=1`);
}

export function normalizeAlgerianWhatsAppNumber(input) {
  let value = String(input ?? '').trim();
  if (!value) return null;

  // Keep digits only after accepting common human formatting (+, spaces, -, parentheses).
  value = value.replace(/[^0-9+]/g, '');
  if (value.startsWith('+')) value = value.slice(1);
  if (value.startsWith('00213')) value = value.slice(2);

  // Algerian mobile number: 05/06/07 + 8 digits.
  if (/^0[567]\d{8}$/.test(value)) value = `213${value.slice(1)}`;
  if (/^213[567]\d{8}$/.test(value)) return value;
  return null;
}

export function buildWhatsAppTemplatePayload(order, env = process.env) {
  const phone = normalizeAlgerianWhatsAppNumber(order?.phone);
  if (!phone) return { ok: false, error: 'INVALID_PHONE' };

  const templateName = String(env.WHATSAPP_TEMPLATE_NAME || '').trim();
  const templateLang = String(env.WHATSAPP_TEMPLATE_LANG || 'ar').trim();
  if (!templateName) return { ok: false, error: 'TEMPLATE_NOT_CONFIGURED' };

  const amount = String(Math.round(Number(order?.total) || 0));
  const reference = String(order?.tracking || order?.id || '').trim();
  const customer = String(order?.customer || '').trim() || 'عميلنا';

  return {
    ok: true,
    phone,
    payload: {
      messaging_product: 'whatsapp',
      to: phone,
      type: 'template',
      template: {
        name: templateName,
        language: { code: templateLang },
        components: [
          {
            type: 'body',
            parameters: [
              { type: 'text', text: customer },
              { type: 'text', text: reference },
              { type: 'text', text: amount },
            ],
          },
        ],
      },
    },
  };
}

function isEnabled(env) {
  return ['1', 'true', 'yes', 'on'].includes(String(env.WHATSAPP_ENABLED || '').trim().toLowerCase());
}

function safeOrderRef(order) {
  return String(order?.tracking || order?.id || 'unknown').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 80) || 'unknown';
}

/**
 * Send the approved utility template after an order has already been saved.
 * This function NEVER throws. Any Meta/network/config failure returns sent:false
 * so WhatsApp can never turn a successful order into a failed checkout.
 */
export async function sendOrderReceivedWhatsApp(order, options = {}) {
  const env = options.env || process.env;
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  const ref = safeOrderRef(order);

  if (!isEnabled(env)) {
    console.log(`[WHATSAPP] Disabled — confirmation skipped for order ${ref}`);
    return { sent: false, skipped: 'DISABLED' };
  }

  const accessToken = String(env.WHATSAPP_ACCESS_TOKEN || '').trim();
  const phoneNumberId = String(env.WHATSAPP_PHONE_NUMBER_ID || '').trim();
  const apiVersion = String(env.META_GRAPH_API_VERSION || '').trim();

  if (!accessToken || !phoneNumberId || !apiVersion || !env.WHATSAPP_TEMPLATE_NAME) {
    console.warn(`[WHATSAPP] Configuration incomplete — confirmation skipped for order ${ref}`);
    return { sent: false, skipped: 'NOT_CONFIGURED' };
  }

  if (!/^v\d+\.\d+$/.test(apiVersion)) {
    console.warn(`[WHATSAPP] Invalid Graph API version — confirmation skipped for order ${ref}`);
    return { sent: false, skipped: 'INVALID_API_VERSION' };
  }

  const built = buildWhatsAppTemplatePayload(order, env);
  if (!built.ok) {
    console.warn(`[WHATSAPP] ${built.error} — confirmation skipped for order ${ref}`);
    return { sent: false, skipped: built.error };
  }

  if (typeof fetchImpl !== 'function') {
    console.warn(`[WHATSAPP] Fetch unavailable — confirmation skipped for order ${ref}`);
    return { sent: false, skipped: 'FETCH_UNAVAILABLE' };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 7000);

  try {
    const response = await fetchImpl(
      `https://graph.facebook.com/${apiVersion}/${encodeURIComponent(phoneNumberId)}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(built.payload),
        signal: controller.signal,
      }
    );

    let data = null;
    try { data = await response.json(); } catch { /* Meta may return a non-JSON error */ }

    if (!response.ok) {
      const metaCode = data?.error?.code || response.status;
      const metaMessage = data?.error?.message || 'Meta request rejected';
      console.error(`[WHATSAPP] Meta rejected confirmation for order ${ref}: code=${metaCode} message=${metaMessage}`);
      return { sent: false, skipped: 'META_REJECTED' };
    }

    const messageId = data?.messages?.[0]?.id || null;
    console.log(`[WHATSAPP] ✅ Order confirmation sent for ${ref}`);
    return { sent: true, messageId };
  } catch (error) {
    const aborted = error?.name === 'AbortError';
    console.error(`[WHATSAPP] Confirmation failed for order ${ref}: ${aborted ? 'timeout' : 'network error'}`);
    return { sent: false, skipped: aborted ? 'TIMEOUT' : 'NETWORK_ERROR' };
  } finally {
    clearTimeout(timeout);
  }
}
