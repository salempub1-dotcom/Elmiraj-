// ============================================================
// Delivery bridge
// ============================================================
// The existing dashboard calls /api/orders for send/resend/sync. To keep
// App.tsx and the proven NOEST UI untouched, this tiny scoped bridge redirects
// ONLY those three admin actions to the new generic /api/delivery endpoint.
// Every other fetch in the store is passed through unchanged.
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
      return nativeFetch('/api/delivery', {
        ...init,
        body: JSON.stringify({ action: 'sync' }),
      });
    }

    const orderId = String(body.id || '').trim();
    if (!orderId) return jsonResponse({ ok: false, error: 'id is required' }, 400);

    const mode = action === 'resend_to_delivery' ? 'resend' : 'send';
    const selection = await requestSelection(orderId, mode, authorization);
    if (!selection) {
      return jsonResponse({ ok: false, error: 'USER_CANCELLED', message: 'تم إلغاء الإرسال.' });
    }

    return nativeFetch('/api/delivery', {
      ...init,
      body: JSON.stringify({
        action: mode === 'resend' ? 'resend' : 'send',
        id: orderId,
        provider: selection.provider,
        ...(selection.source_hub_id ? { source_hub_id: selection.source_hub_id } : {}),
        ...(selection.pickup_hub_id ? { pickup_hub_id: selection.pickup_hub_id } : {}),
      }),
    });
  };
}
