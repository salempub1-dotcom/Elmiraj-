import { useEffect } from 'react';
import { DELIVERY_PROVIDER_UPDATED_EVENT } from '../../services/deliveryBridge';

type Provider = 'noest' | 'zrexpress';
type ProviderOrder = {
  id: string;
  tracking: string;
  rawRef: string;
  provider: Provider;
  providerTracking: string;
};

const GENERIC_REPLACEMENTS: Array<[string, string]> = [
  [
    'استخدم هذه العملية فقط إذا تم حذف الشحنة السابقة من NOEST أو إذا كنت متأكدًا أنها لم تعد موجودة.',
    'استخدم هذه العملية فقط إذا تم حذف الشحنة السابقة من شركة التوصيل أو إذا كنت متأكدًا أنها لم تعد موجودة.',
  ],
  [
    '⚠️ هذا الطلب لديه شحنة مسجّلة لدى شركة التوصيل (NOEST). حذفه من المعراج لن يحذف الشحنة من NOEST تلقائياً.',
    '⚠️ هذا الطلب لديه شحنة مسجّلة لدى شركة التوصيل. حذفه من المعراج لن يحذف الشحنة من شركة التوصيل تلقائياً.',
  ],
];

function decodeProviderRef(value: unknown): { provider: Provider; tracking: string } | null {
  const ref = String(value || '').trim();
  if (!ref || ref.startsWith('LOCK:')) return null;
  if (ref.startsWith('ZR:')) return { provider: 'zrexpress', tracking: ref.slice(3) };
  return { provider: 'noest', tracking: ref };
}

function walkText(root: Node, transform: (text: string) => string): void {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode() as Text | null;
  while (node) {
    const next = walker.nextNode() as Text | null;
    const changed = transform(node.data);
    if (changed !== node.data) node.data = changed;
    node = next;
  }
}

function applyGenericCopy(): void {
  if (!document.body) return;
  walkText(document.body, (text) => {
    let out = text;
    for (const [from, to] of GENERIC_REPLACEMENTS) out = out.replace(from, to);
    return out;
  });
}

function findOrderCard(orderNumber: string): HTMLElement | null {
  const markers = Array.from(document.querySelectorAll<HTMLElement>('.font-mono'));
  const marker = markers.find((el) => (el.textContent || '').trim() === orderNumber);
  if (!marker) return null;

  let current: HTMLElement | null = marker;
  for (let depth = 0; current && current !== document.body && depth < 10; depth += 1) {
    const text = current.textContent || '';
    const hasDeliveryUi =
      text.includes('أرسل إلى NOEST') ||
      text.includes('أرسل إلى ZR Express') ||
      text.includes('معلومات التوصيل') ||
      text.includes('لم يرسل');
    if (hasDeliveryUi && current.classList.contains('rounded-xl')) return current;
    current = current.parentElement;
  }
  return null;
}

function applyProviderOrder(order: ProviderOrder): void {
  const card = findOrderCard(order.tracking);
  if (!card) return;

  walkText(card, (text) => {
    let out = text;
    if (order.provider === 'zrexpress') {
      out = out
        .replace('✅ أرسل إلى NOEST', '✅ أرسل إلى ZR Express')
        .replace('تم الإرسال إلى NOEST', 'تم الإرسال إلى ZR Express');
      if (order.rawRef && order.providerTracking) out = out.replace(order.rawRef, order.providerTracking);
    } else {
      // React can reuse DOM nodes between filtered lists, so restore the correct
      // NOEST label when a NOEST order occupies a node previously patched for ZR.
      out = out
        .replace('✅ أرسل إلى ZR Express', '✅ أرسل إلى NOEST')
        .replace('تم الإرسال إلى ZR Express', 'تم الإرسال إلى NOEST');
    }
    return out;
  });
}

/**
 * Compatibility-only UI adapter.
 *
 * The large App.tsx stays untouched. It still uses the historical `noestId`
 * property, while the server now stores ZR references as `ZR:<tracking>` in
 * that same DB column for backward compatibility. This component reads the
 * already-authorized order list and corrects only courier labels in rendered
 * admin cards. It never changes order state and never calls a courier API.
 */
export default function DeliveryProviderLabels() {
  useEffect(() => {
    if (typeof window === 'undefined') return;

    let orders: ProviderOrder[] = [];
    let lastLoadedToken = '';
    let scheduled = false;
    let disposed = false;

    const apply = () => {
      if (disposed || !window.location.pathname.startsWith('/admin')) return;
      applyGenericCopy();
      orders.forEach(applyProviderOrder);
    };

    const scheduleApply = () => {
      if (scheduled || disposed) return;
      scheduled = true;
      window.requestAnimationFrame(() => {
        scheduled = false;
        apply();

        // Login happens inside App.tsx and localStorage does not emit a storage
        // event in the same tab. DOM changes do occur, so use them to detect a
        // newly-issued token once, not to poll the API continuously.
        let token = '';
        try { token = localStorage.getItem('almiraj_token') || ''; } catch { /* ignore */ }
        if (token && token !== lastLoadedToken) void loadOrders();
      });
    };

    const loadOrders = async () => {
      let token = '';
      try { token = localStorage.getItem('almiraj_token') || ''; } catch { /* ignore */ }
      if (!token || disposed) return;

      try {
        const r = await fetch('/api/orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ action: 'list' }),
        });
        if (!r.ok) return;
        const result = await r.json();
        if (!result?.ok || !Array.isArray(result.data)) return;

        orders = result.data.flatMap((row: Record<string, unknown>) => {
          const decoded = decodeProviderRef(row.noest_id);
          if (!decoded) return [];
          const tracking = String(row.tracking || '').trim();
          if (!tracking) return [];
          return [{
            id: String(row.id || ''),
            tracking,
            rawRef: String(row.noest_id || ''),
            provider: decoded.provider,
            providerTracking: decoded.tracking,
          } satisfies ProviderOrder];
        });
        lastLoadedToken = token;
        scheduleApply();
      } catch {
        // Labels are cosmetic. Never affect the operational dashboard on error.
      }
    };

    const observer = new MutationObserver(scheduleApply);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });

    const providerUpdated = () => { void loadOrders(); };
    window.addEventListener(DELIVERY_PROVIDER_UPDATED_EVENT, providerUpdated);

    void loadOrders();
    scheduleApply();

    return () => {
      disposed = true;
      observer.disconnect();
      window.removeEventListener(DELIVERY_PROVIDER_UPDATED_EVENT, providerUpdated);
    };
  }, []);

  return null;
}
