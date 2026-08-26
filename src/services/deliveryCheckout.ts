export type DeliveryProvider = 'noest' | 'zrexpress';

export interface DeliveryProviderSettings {
  noest: boolean;
  zrexpress: boolean;
}

export interface ZrPickupHub {
  id: string;
  name: string;
  isPickupPoint: boolean;
  cityName: string;
  communeName: string;
  address: string;
}

export interface ZrCheckoutOptions {
  destination: {
    wilaya: { id: string; code: number; name: string; nameArabic?: string | null };
    commune: { id: string; code: number; name: string; nameArabic?: string | null };
  };
  pickup_hubs: ZrPickupHub[];
}

export interface ZrShippingQuote {
  home: number | null;
  office: number | null;
  returnPrice?: number | null;
  territoryId?: string | null;
  territoryLevel?: string | null;
  territoryName?: string | null;
}

export interface CheckoutDeliverySelection {
  provider: DeliveryProvider;
  officeId?: string;
  officeName?: string;
}

const PREFIX = '@DP1:';
const DEFAULTS: DeliveryProviderSettings = { noest: true, zrexpress: true };

async function jsonPost(payload: Record<string, unknown>, auth = '') {
  const response = await fetch('/api/noest', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(auth ? { Authorization: auth } : {}),
    },
    body: JSON.stringify(payload),
  });
  const result = await response.json().catch(() => ({ ok: false, error: 'INVALID_RESPONSE' }));
  return { response, result };
}

export async function fetchDeliveryProviderSettings(): Promise<DeliveryProviderSettings> {
  try {
    const { result } = await jsonPost({ action: 'checkout_delivery_settings' });
    if (result?.ok && result?.data) {
      const noest = result.data.noest !== false;
      const zrexpress = result.data.zrexpress !== false;
      if (!noest && !zrexpress) return { ...DEFAULTS };
      return { noest, zrexpress };
    }
  } catch { /* fallback below */ }
  return { ...DEFAULTS };
}

export async function saveDeliveryProviderSettings(next: DeliveryProviderSettings): Promise<{ ok: boolean; data?: DeliveryProviderSettings; message?: string }> {
  let token = '';
  try { token = localStorage.getItem('almiraj_token') || ''; } catch { /* ignore */ }
  try {
    const { response, result } = await jsonPost(
      { action: 'delivery_settings_update', settings: next },
      token ? `Bearer ${token}` : '',
    );
    if (response.status === 401) return { ok: false, message: 'انتهت جلسة الإدارة. سجّل الدخول من جديد.' };
    return result;
  } catch {
    return { ok: false, message: 'تعذر حفظ إعدادات شركات التوصيل.' };
  }
}

export async function fetchZrCheckoutOptions(wilayaId: number, commune: string): Promise<{ ok: boolean; data?: ZrCheckoutOptions; message?: string }> {
  try {
    const { result } = await jsonPost({
      action: 'checkout_zr_options',
      wilaya_id: wilayaId,
      commune,
    });
    return result;
  } catch {
    return { ok: false, message: 'تعذر تحميل مكاتب ZR Express.' };
  }
}

export async function fetchZrShippingQuote(wilayaId: number, commune: string): Promise<{ ok: boolean; data?: ZrShippingQuote; message?: string }> {
  try {
    const { result } = await jsonPost({
      action: 'checkout_zr_quote',
      wilaya_id: wilayaId,
      commune,
    });
    return result;
  } catch {
    return { ok: false, message: 'تعذر تحميل تسعيرة ZR Express.' };
  }
}

export function encodeCheckoutDeliverySelection(selection: CheckoutDeliverySelection): string {
  const provider = selection.provider;
  const id = encodeURIComponent(selection.officeId || '');
  const name = encodeURIComponent(selection.officeName || '');
  return `${PREFIX}${provider}:${id}:${name}`;
}

export function decodeCheckoutDeliverySelection(value?: string | null): CheckoutDeliverySelection | null {
  const raw = String(value || '');
  if (!raw.startsWith(PREFIX)) return null;
  const rest = raw.slice(PREFIX.length);
  const [providerRaw, idRaw = '', ...nameParts] = rest.split(':');
  if (providerRaw !== 'noest' && providerRaw !== 'zrexpress') return null;
  try {
    return {
      provider: providerRaw,
      officeId: decodeURIComponent(idRaw) || undefined,
      officeName: decodeURIComponent(nameParts.join(':')) || undefined,
    };
  } catch {
    return { provider: providerRaw };
  }
}

export function deliveryProviderLabel(provider?: DeliveryProvider | null): string {
  return provider === 'zrexpress' ? 'ZR Express' : 'NOEST';
}

export function checkoutOfficeLabel(value?: string | null): string {
  const decoded = decodeCheckoutDeliverySelection(value);
  if (decoded) return decoded.officeName || '';
  return String(value || '');
}

export function preferredCheckoutProvider(value?: string | null): DeliveryProvider | null {
  return decodeCheckoutDeliverySelection(value)?.provider || null;
}
