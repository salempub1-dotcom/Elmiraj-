import { fetchDeliveryProviderSettings } from './deliveryCheckout';

// ============================================================
// Delivery bridge
// ============================================================
// The existing dashboard calls /api/orders for send/resend/sync. To keep
// App.tsx and the proven NOEST UI untouched, this tiny scoped bridge redirects
// ONLY those three admin actions to provider-aware delivery_* actions hosted
// inside the existing /api/noest function. Every other fetch is unchanged.
// ============================================================

export type DeliveryProvider = 'noest' | 'zrexpress';
export type DeliverySelection = {
  provider: DeliveryProvider;
  source_hub_id?: string;
  pickup_hub_id?: string;
};

export type DeliverySelectionRequest = {
  orderId: string;
  mode: 'send' | 'resend';
  authorization: string;
  resolve: (selection: DeliverySelection | null) => void;
};

export const DELIVERY_SELECTION_EVENT = 'almiraj:delivery-selection';
export const DELIVERY_PROVIDER_UPDATED_EVENT = 'almiraj:delivery-provider-updated';

function requestSelection(orderId: string, mode: 'send' | 'resend', authorization: string): Promise<DeliverySelection | null> {
  return new Promise((resolve) => {
    window.dispatchEvent(new CustomEvent<DeliverySelectionRequest>(DELIVERY_SELECTION_EVENT, {
      detail: { orderId, mode, authorization, resolve },
    }));
  });
}

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function getAuthorization(init?: RequestInit): string {
  try {
    const headers = new Headers(init?.headers || {});
    return headers.get('Authorization') || '';
  } catch {
    return '';
  }
}

function isOrdersPost(input: RequestInfo | URL, init?: RequestInit): boolean {
  try {
    const raw = typeof input === 'string'
      ? input
      : input instanceof URL
        ? input.toString()
        : input.url;
    const url = new URL(raw, window.location.origin);
    const method = String(init?.method || (input instanceof Request ? input.method : 'GET')).toUpperCase();
    return url.origin === window.location.origin && url.pathname === '/api/orders' && method === 'POST';
  } catch {
    return false;
  }
}

async function dispatchProviderRefreshFromResponse(response: Response, orderId: string): Promise<void> {
  try {
    const payload = await response.clone().json();
    if (!payload?.ok) return;
    window.dispatchEvent(new CustomEvent(DELIVERY_PROVIDER_UPDATED_EVENT, {
      detail: {
        orderId,
        provider: payload?.data?.delivery_provider || null,
        deliveryRef: payload?.data?.delivery_ref || payload?.data?.noest_id || null,
      },
    }));
  } catch {
    // UI refresh is best-effort only; never interfere with the real response.
  }
}

async function fetchPreferredProvider(
  nativeFetch: typeof window.fetch,
  orderId: string,
  authorization: string,
): Promise<DeliveryProvider | null> {
  try {
    const response = await nativeFetch('/api/noest', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(authorization ? { Authorization: authorization } : {}),
      },
      body: JSON.stringify({ action: 'delivery_provider_info', id: orderId }),
    });
    const payload = await response.json();
    const preferred = payload?.data?.preferred_provider;
    return preferred === 'noest' || preferred === 'zrexpress' ? preferred : null;
  } catch {
    return null;
  }
}

async function resolveSingleProviderSend(
  nativeFetch: typeof window.fetch,
  orderId: string,
  authorization: string,
): Promise<DeliverySelection | null> {
  try {
    const [settings, preferredProvider] = await Promise.all([
      fetchDeliveryProviderSettings(),
      fetchPreferredProvider(nativeFetch, orderId, authorization),
    ]);

    const enabledProviders: DeliveryProvider[] = [];
    if (settings.noest) enabledProviders.push('noest');
    if (settings.zrexpress) enabledProviders.push('zrexpress');

    // When only one courier is enabled in admin settings, the existing
    // "send to delivery" button becomes a real one-click action. The customer's
    // saved courier choice remains first priority for existing orders; otherwise
    // the single currently enabled courier is used. Office/hub data is already
    // stored on the order and is resolved server-side, so no second selection is needed.
    if (enabledProviders.length === 1) {
      return { provider: preferredProvider || enabledProviders[0] };
    }
  } catch {
    // If settings cannot be read, fall back to the explicit selection dialog.
  }
  return null;
}

export function installDeliveryFetchBridge(): void {
  if (typeof window === 'undefined') return;
  const marker = '__almirajDeliveryBridgeInstalled';
  const w = window as typeof window & Record<string, unknown>;
  if (w[marker]) return;
  w[marker] = true;

  const nativeFetch = window.fetch.bind(window);

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    if (!isOrdersPost(input, init) || typeof init?.body !== 'string') {
      return nativeFetch(input, init);
    }

    let body: Record<string, unknown>;
    try {
      body = JSON.parse(init.body) as Record<string, unknown>;
    } catch {
      return nativeFetch(input, init);
    }

    const action = String(body.action || '');
    if (!['send_to_delivery', 'resend_to_delivery', 'sync_delivery_status'].includes(action)) {
      return nativeFetch(input, init);
    }

    const authorization = getAuthorization(init);

    if (action === 'sync_delivery_status') {
      return nativeFetch('/api/noest', {
        ...init,
        body: JSON.stringify({ action: 'delivery_sync' }),
      });
    }

    const orderId = String(body.id || '').trim();
    if (!orderId) return jsonResponse({ ok: false, error: 'id is required' }, 400);

    const mode = action === 'resend_to_delivery' ? 'resend' : 'send';

    let selection: DeliverySelection | null = null;
    if (mode === 'send') {
      selection = await resolveSingleProviderSend(nativeFetch, orderId, authorization);
    }
    if (!selection) {
      selection = await requestSelection(orderId, mode, authorization);
    }
    if (!selection) {
      return jsonResponse({ ok: false, error: 'USER_CANCELLED', message: 'تم إلغاء الإرسال.' });
    }

    const response = await nativeFetch('/api/noest', {
      ...init,
      body: JSON.stringify({
        action: mode === 'resend' ? 'delivery_resend' : 'delivery_send',
        id: orderId,
        provider: selection.provider,
        ...(selection.source_hub_id ? { source_hub_id: selection.source_hub_id } : {}),
        ...(selection.pickup_hub_id ? { pickup_hub_id: selection.pickup_hub_id } : {}),
      }),
    });

    void dispatchProviderRefreshFromResponse(response, orderId);
    return response;
  };
}
