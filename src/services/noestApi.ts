// ============================================================
// NOEST Delivery API Service
// Base URL: https://app.noest-dz.com
// ============================================================

// في بيئة التطوير نستخدم الـ proxy لتجاوز CORS
// في الإنتاج نتصل مباشرة عبر backend proxy
// ─── Environment Detection ────────────────────────────────────
// في بيئة التطوير (localhost): نستخدم Vite Proxy (/noest-api)
// في الإنتاج (Netlify): نستخدم Netlify Function (/api/noest)
// في أي بيئة أخرى: نحاول الاتصال المباشر

// دالة لبناء رابط الطلب الصحيح
// في التطوير (localhost): Vite Proxy
// في الإنتاج (Vercel): Vercel Serverless Function /api/noest
function buildUrl(endpoint: string): string {
  const isLocalhost = typeof window !== 'undefined' &&
    (window.location.hostname === 'localhost' ||
     window.location.hostname === '127.0.0.1');

  if (isLocalhost) {
    // Vite Proxy في التطوير المحلي
    return `/noest-api${endpoint}`;
  }

  // في الإنتاج (Vercel أو أي استضافة أخرى):
  // نستخدم Vercel Serverless Function كـ proxy
  return `/api/noest?endpoint=${encodeURIComponent(endpoint)}`;
}
export function getWilayaCodeFromDeskCode(code: string): number | null {
  // يقبل "01A" أو "1A" أو "16B" ... ويرجع 1 أو 16 ...
  const m = String(code || '').match(/^0*(\d{1,2})/);
  return m ? Number(m[1]) : null;
}
const NOEST_API_TOKEN = '7Y5o9xsGS9s5o85SEdPdqCUF0aebwWXaiYz';
const NOEST_USER_GUID = 'BX4O76YM';
const TIMEOUT_MS = 30000;

// ─── Types ───────────────────────────────────────────────────

export interface NoestOrderPayload {
  user_guid: string;
  client: string;
  phone: string;
  adresse: string;
  wilaya_id: number;
  commune: string;
  montant: number;
  produit: string;
  type_id: number;
  stop_desk: number;
  station_code?: string; // مطلوب إذا stop_desk = 1
  note?: string;
}

export interface NoestOrderResponse {
  success: boolean;
  data?: {
    id: string | number;
    tracking: string;
    barcode?: string;
    status?: string;
    [key: string]: unknown;
  };
  message?: string;
  errors?: Record<string, string[]>;
}

export interface NoestTrackingInfo {
  tracking: string;
  status: string;
  history: Array<{
    status: string;
    date: string;
    note?: string;
  }>;
}

export interface NoestWilaya {
  code: number;          // رقم الولاية (1..58) كما يرجع من NOEST
  nom: string;           // الاسم بالفرنسية
  nom_ar?: string;       // (إن وُجد)
  is_active?: number | boolean;
}

export interface NoestCommune {
  nom: string;           // اسم البلدية بالفرنسية كما يرجع من NOEST
  wilaya_id: number;     // رقم الولاية
  code_postal?: string | number;
  is_active?: number | boolean;
}

// desks endpoint يرجع Object (key => desk) غالباً
export interface NoestDesk {
  key: string;        // مثال: "01A"
  code: string;       // مثال: "1A" أو "01A" حسب API
  name: string;
  address: string;
  map?: string;
  phones?: Record<string, string>;
  email?: string;
}
// helpers
export function getWilayaCodeFromDeskCode(code: string): number | null {
  const m = String(code || '').match(/^0*(\d{1,2})/);
  return m ? Number(m[1]) : null;
}

export interface NoestFees { 
  home: number;
  desk: number;
  wilaya_id: number;
}

export type NoestApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; status?: number };

// ─── Core HTTP Client ─────────────────────────────────────────

async function noestFetch<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<NoestApiResult<T>> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(buildUrl(endpoint), {
      ...options,
      signal: controller.signal,
      headers: {
        'Authorization': `Bearer ${NOEST_API_TOKEN}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...(options.headers ?? {}),
      },
    });

    clearTimeout(timer);

    let body: unknown;
    try {
      body = await res.json();
    } catch {
      body = null;
    }

    if (!res.ok) {
      const msg =
        (body as Record<string, unknown>)?.message as string ??
        `خطأ ${res.status} من خادم NOEST`;
      return { ok: false, error: msg, status: res.status };
    }

    return { ok: true, data: body as T };
  } catch (err: unknown) {
    clearTimeout(timer);
    if ((err as Error).name === 'AbortError') {
      return { ok: false, error: 'انتهت مهلة الاتصال بخادم NOEST (30 ثانية)' };
    }
    // CORS / network error - return mock for frontend-only builds
    console.warn('[NOEST] Network error (possibly CORS in browser):', err);
    return { ok: false, error: 'تعذر الاتصال بخادم NOEST. تحقق من الشبكة أو اتصل بالمسؤول.' };
  }
}

// ─── Validate Order Payload ───────────────────────────────────

export function validateOrderPayload(
  payload: Partial<NoestOrderPayload>
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!payload.client?.trim()) errors.push('اسم العميل مطلوب');
  if (!payload.phone?.trim()) errors.push('رقم الهاتف مطلوب');
  else if (!/^0[567]\d{8}$/.test(payload.phone))
    errors.push('رقم الهاتف يجب أن يبدأ بـ 05 أو 06 أو 07 ويكون 10 أرقام');

  if (!payload.adresse?.trim()) errors.push('العنوان مطلوب');
  if (!payload.wilaya_id) errors.push('الولاية مطلوبة');
  if (!payload.commune?.trim()) errors.push('البلدية مطلوبة');
  if (payload.stop_desk === 1 && !payload.station_code?.trim()) errors.push('مكتب الاستلام (station_code) مطلوب عند اختيار التوصيل إلى المكتب');
  if (!payload.montant || payload.montant <= 0) errors.push('المبلغ يجب أن يكون أكبر من 0');
  if (!payload.produit?.trim()) errors.push('اسم المنتج مطلوب');

  return { valid: errors.length === 0, errors };
}

// ─── API Functions ────────────────────────────────────────────

/**
 * Create a new delivery order on NOEST
 */
export async function createOrder(
  params: Omit<NoestOrderPayload, 'user_guid'> & { type_id?: number; stop_desk?: number }
): Promise<NoestApiResult<NoestOrderResponse>> {
  const payload: NoestOrderPayload = {
    user_guid: NOEST_USER_GUID,
    ...params,
  };

  const validation = validateOrderPayload(payload);
  if (!validation.valid) {
    return { ok: false, error: validation.errors.join('، ') };
  }

  return noestFetch<NoestOrderResponse>('/api/public/create/order', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

/**
 * Validate an existing order (move to confirmed)
 */
export async function validateOrder(
  orderId: string | number
): Promise<NoestApiResult<NoestOrderResponse>> {
  return noestFetch<NoestOrderResponse>('/api/public/valid/order', {
    method: 'POST',
    body: JSON.stringify({
      user_guid: NOEST_USER_GUID,
      id: orderId,
    }),
  });
}

/**
 * Track orders by tracking numbers
 */
export async function trackOrders(
  trackingNumbers: string[]
): Promise<NoestApiResult<NoestTrackingInfo[]>> {
  return noestFetch<NoestTrackingInfo[]>('/api/public/get/trackings/info', {
    method: 'POST',
    body: JSON.stringify({
      user_guid: NOEST_USER_GUID,
      trackings: trackingNumbers,
    }),
  });
}

/**
 * Update an existing order
 */
export async function updateOrder(
  orderId: string | number,
  updates: Partial<Omit<NoestOrderPayload, 'user_guid'>>
): Promise<NoestApiResult<NoestOrderResponse>> {
  return noestFetch<NoestOrderResponse>('/api/public/update/order', {
    method: 'POST',
    body: JSON.stringify({
      user_guid: NOEST_USER_GUID,
      id: orderId,
      ...updates,
    }),
  });
}

/**
 * Delete / cancel an order
 */
export async function deleteOrder(
  orderId: string | number
): Promise<NoestApiResult<{ success: boolean }>> {
  return noestFetch<{ success: boolean }>('/api/public/delete/order', {
    method: 'POST',
    body: JSON.stringify({
      user_guid: NOEST_USER_GUID,
      id: orderId,
    }),
  });
}

/**
 * Download shipping label (returns a blob URL)
 */
export async function downloadLabel(
  orderId: string | number
): Promise<NoestApiResult<string>> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(
      buildUrl(`/api/public/get/order/label?id=${orderId}&user_guid=${NOEST_USER_GUID}`),
      {
        signal: controller.signal,
        headers: { 'Authorization': `Bearer ${NOEST_API_TOKEN}` },
      }
    );

    clearTimeout(timer);

    if (!res.ok) {
      return { ok: false, error: `فشل تحميل بطاقة الشحن: ${res.status}` };
    }

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    return { ok: true, data: url };
  } catch (err) {
    clearTimeout(timer);
    return { ok: false, error: 'تعذر تحميل بطاقة الشحن' };
  }
}

/**
 * Get all wilayas
 */
export async function getWilayas(): Promise<NoestApiResult<NoestWilaya[]>> {
  return noestFetch<NoestWilaya[]>('/api/public/get/wilayas', { method: 'GET' });
}

/**
 * Get communes for a wilaya
 */
export async function getCommunes(
  wilayaId: number
): Promise<NoestApiResult<NoestCommune[]>> {
  return noestFetch<NoestCommune[]>(`/api/public/get/communes/${wilayaId}`, {
    method: 'GET',
  });
}

/**
 * Get all NOEST desks
 */
export async function getDesks(): Promise<NoestApiResult<NoestDesk[]>> {
  const res = await noestFetch<Record<string, any>>('/api/public/desks');
  if (!res.ok) return { ok: false, error: res.error };

  const raw = res.data || {};
  const desks: NoestDesk[] = Object.entries(raw).map(([key, v]) => ({
    key,
    code: v?.code ?? key,          // بعض الأحيان code="1A" و key="01A"
    name: v?.name ?? '',
    address: v?.address ?? '',
    map: v?.map ?? '',
    phones: v?.phones ?? {},
    email: v?.email ?? '',
  }));

  return { ok: true, data: desks };
}

/**
 * Get delivery fees
 */
export async function getFees(): Promise<NoestApiResult<NoestFees[]>> {
  return noestFetch<NoestFees[]>('/api/public/fees', { method: 'GET' });
}

// ─── Helper: Build order product string ──────────────────────

export function buildProductString(
  items: Array<{ name: string; quantity: number }>
): string {
  return items.map(i => `${i.name} x${i.quantity}`).join(' | ');
}

// ─── NOEST Desks (Static List) ────────────────────────────────

export interface NoestDeskStatic {
  code: string;
  name: string;
  wilaya_id: number;
  wilaya_name: string;
}

export const NOEST_DESKS: NoestDeskStatic[] = [
  // 01 - Adrar
  { code: '01A', name: 'أدرار', wilaya_id: 1, wilaya_name: 'أدرار' },
  // 02 - Chlef
  { code: '02A', name: 'الشلف', wilaya_id: 2, wilaya_name: 'الشلف' },
  { code: '02B', name: 'الشلف - تنس', wilaya_id: 2, wilaya_name: 'الشلف' },
  // 03 - Laghouat
  { code: '03A', name: 'الأغواط', wilaya_id: 3, wilaya_name: 'الأغواط' },
  { code: '03B', name: 'الأغواط - أفلو', wilaya_id: 3, wilaya_name: 'الأغواط' },
  // 04 - Oum El Bouaghi
  { code: '04A', name: 'عين مليلة', wilaya_id: 4, wilaya_name: 'أم البواقي' },
  { code: '04B', name: 'أم البواقي', wilaya_id: 4, wilaya_name: 'أم البواقي' },
  { code: '04C', name: 'عين البيضاء', wilaya_id: 4, wilaya_name: 'أم البواقي' },
  // 05 - Batna
  { code: '05A', name: 'باتنة', wilaya_id: 5, wilaya_name: 'باتنة' },
  { code: '05B', name: 'باتنة - بريكة', wilaya_id: 5, wilaya_name: 'باتنة' },
  { code: '05C', name: 'باتنة - المدينة', wilaya_id: 5, wilaya_name: 'باتنة' },
  // 06 - Bejaia
  { code: '06A', name: 'بجاية', wilaya_id: 6, wilaya_name: 'بجاية' },
  { code: '06B', name: 'بجاية - أقبو', wilaya_id: 6, wilaya_name: 'بجاية' },
  { code: '06C', name: 'بجاية - القصر', wilaya_id: 6, wilaya_name: 'بجاية' },
  // 07 - Biskra
  { code: '07A', name: 'بسكرة', wilaya_id: 7, wilaya_name: 'بسكرة' },
  // 08 - Bechar
  { code: '08A', name: 'بشار', wilaya_id: 8, wilaya_name: 'بشار' },
  // 09 - Blida
  { code: '09A', name: 'البليدة', wilaya_id: 9, wilaya_name: 'البليدة' },
  { code: '09B', name: 'البليدة - بوفاريك', wilaya_id: 9, wilaya_name: 'البليدة' },
  // 10 - Bouira
  { code: '10A', name: 'البويرة', wilaya_id: 10, wilaya_name: 'البويرة' },
  { code: '10B', name: 'البويرة - لخضارية', wilaya_id: 10, wilaya_name: 'البويرة' },
  // 11 - Tamanrasset
  { code: '11A', name: 'تمنراست', wilaya_id: 11, wilaya_name: 'تمنراست' },
  // 12 - Tebessa
  { code: '12A', name: 'تبسة', wilaya_id: 12, wilaya_name: 'تبسة' },
  // 13 - Tlemcen
  { code: '13A', name: 'تلمسان', wilaya_id: 13, wilaya_name: 'تلمسان' },
  { code: '13B', name: 'تلمسان - مغنية', wilaya_id: 13, wilaya_name: 'تلمسان' },
  // 14 - Tiaret
  { code: '14A', name: 'تيارت', wilaya_id: 14, wilaya_name: 'تيارت' },
  { code: '14B', name: 'تيارت - فرندة', wilaya_id: 14, wilaya_name: 'تيارت' },
  // 15 - Tizi Ouzou
  { code: '15A', name: 'تيزي وزو', wilaya_id: 15, wilaya_name: 'تيزي وزو' },
  { code: '15B', name: 'تيزي وزو - عزازقة', wilaya_id: 15, wilaya_name: 'تيزي وزو' },
  { code: '15C', name: 'تيزي وزو - ذراع بن خدة', wilaya_id: 15, wilaya_name: 'تيزي وزو' },
  // 16 - Alger
  { code: '16A', name: 'الجزائر - بئر مراد رايس', wilaya_id: 16, wilaya_name: 'الجزائر' },
  { code: '16B', name: 'الجزائر - باب الزوار', wilaya_id: 16, wilaya_name: 'الجزائر' },
  { code: '16C', name: 'الجزائر - الشراقة', wilaya_id: 16, wilaya_name: 'الجزائر' },
  { code: '16D', name: 'الجزائر - الرغاية', wilaya_id: 16, wilaya_name: 'الجزائر' },
  { code: '16E', name: 'الجزائر - وسط المدينة', wilaya_id: 16, wilaya_name: 'الجزائر' },
  { code: '16F', name: 'الجزائر - باب الواد', wilaya_id: 16, wilaya_name: 'الجزائر' },
  { code: '16G', name: 'الجزائر - براقي', wilaya_id: 16, wilaya_name: 'الجزائر' },
  { code: '16H', name: 'الجزائر - برج البحري', wilaya_id: 16, wilaya_name: 'الجزائر' },
  { code: '16I', name: 'الجزائر - زرالدة', wilaya_id: 16, wilaya_name: 'الجزائر' },
  // 17 - Djelfa
  { code: '17A', name: 'الجلفة', wilaya_id: 17, wilaya_name: 'الجلفة' },
  { code: '17B', name: 'الجلفة - عين وسارة', wilaya_id: 17, wilaya_name: 'الجلفة' },
  // 18 - Jijel
  { code: '18A', name: 'جيجل', wilaya_id: 18, wilaya_name: 'جيجل' },
  // 19 - Setif
  { code: '19A', name: 'سطيف', wilaya_id: 19, wilaya_name: 'سطيف' },
  { code: '19B', name: 'سطيف - العلمة', wilaya_id: 19, wilaya_name: 'سطيف' },
  { code: '19C', name: 'سطيف - عين أولمان', wilaya_id: 19, wilaya_name: 'سطيف' },
  { code: '19RE', name: 'سطيف - قجال', wilaya_id: 19, wilaya_name: 'سطيف' },
  // 20 - Saida
  { code: '20A', name: 'سعيدة', wilaya_id: 20, wilaya_name: 'سعيدة' },
  // 21 - Skikda
  { code: '21A', name: 'سكيكدة', wilaya_id: 21, wilaya_name: 'سكيكدة' },
  { code: '21B', name: 'سكيكدة - عزابة', wilaya_id: 21, wilaya_name: 'سكيكدة' },
  // 22 - Sidi Bel Abbes
  { code: '22A', name: 'سيدي بلعباس', wilaya_id: 22, wilaya_name: 'سيدي بلعباس' },
  // 23 - Annaba
  { code: '23A', name: 'عنابة', wilaya_id: 23, wilaya_name: 'عنابة' },
  { code: '23B', name: 'عنابة - البوني', wilaya_id: 23, wilaya_name: 'عنابة' },
  // 24 - Guelma
  { code: '24A', name: 'قالمة', wilaya_id: 24, wilaya_name: 'قالمة' },
  // 25 - Constantine
  { code: '25A', name: 'قسنطينة - زواغي', wilaya_id: 25, wilaya_name: 'قسنطينة' },
  { code: '25B', name: 'قسنطينة - علي منجلي', wilaya_id: 25, wilaya_name: 'قسنطينة' },
  { code: '25C', name: 'قسنطينة - المدينة', wilaya_id: 25, wilaya_name: 'قسنطينة' },
  // 26 - Medea
  { code: '26A', name: 'المدية', wilaya_id: 26, wilaya_name: 'المدية' },
  // 27 - Mostaganem
  { code: '27A', name: 'مستغانم', wilaya_id: 27, wilaya_name: 'مستغانم' },
  { code: '27B', name: 'مستغانم - سيدي لخضر', wilaya_id: 27, wilaya_name: 'مستغانم' },
  // 28 - Msila
  { code: '28A', name: 'المسيلة', wilaya_id: 28, wilaya_name: 'المسيلة' },
  { code: '28B', name: 'المسيلة - بوسعادة', wilaya_id: 28, wilaya_name: 'المسيلة' },
  // 29 - Mascara
  { code: '29A', name: 'معسكر - المحمدية', wilaya_id: 29, wilaya_name: 'معسكر' },
  { code: '29B', name: 'معسكر - المدينة', wilaya_id: 29, wilaya_name: 'معسكر' },
  // 30 - Ouargla
  { code: '30A', name: 'ورقلة', wilaya_id: 30, wilaya_name: 'ورقلة' },
  { code: '30B', name: 'ورقلة - حاسي مسعود', wilaya_id: 30, wilaya_name: 'ورقلة' },
  // 31 - Oran
  { code: '31A', name: 'وهران - المرسى الكبير', wilaya_id: 31, wilaya_name: 'وهران' },
  { code: '31B', name: 'وهران - بئر الجير', wilaya_id: 31, wilaya_name: 'وهران' },
  { code: '31C', name: 'وهران - المدينة', wilaya_id: 31, wilaya_name: 'وهران' },
  { code: '31D', name: 'وهران - أرزيو', wilaya_id: 31, wilaya_name: 'وهران' },
  // 32 - El Bayadh
  { code: '32A', name: 'البيض', wilaya_id: 32, wilaya_name: 'البيض' },
  // 33 - Illizi
  { code: '33A', name: 'إيليزي', wilaya_id: 33, wilaya_name: 'إيليزي' },
  // 34 - Bordj Bou Arreridj
  { code: '34A', name: 'برج بوعريريج', wilaya_id: 34, wilaya_name: 'برج بوعريريج' },
  // 35 - Boumerdes
  { code: '35A', name: 'بومرداس', wilaya_id: 35, wilaya_name: 'بومرداس' },
  { code: '35B', name: 'بومرداس - أولاد موسى', wilaya_id: 35, wilaya_name: 'بومرداس' },
  { code: '35C', name: 'بومرداس - برج منايل', wilaya_id: 35, wilaya_name: 'بومرداس' },
  { code: '35D', name: 'بومرداس - دلس', wilaya_id: 35, wilaya_name: 'بومرداس' },
  // 36 - El Taref
  { code: '36A', name: 'الطارف', wilaya_id: 36, wilaya_name: 'الطارف' },
  // 37 - Tindouf
  { code: '37A', name: 'تندوف', wilaya_id: 37, wilaya_name: 'تندوف' },
  // 38 - Tissemsilt
  { code: '38A', name: 'تيسمسيلت', wilaya_id: 38, wilaya_name: 'تيسمسيلت' },
  // 39 - El Oued
  { code: '39A', name: 'الوادي', wilaya_id: 39, wilaya_name: 'الوادي' },
  // 40 - Khenchela
  { code: '40A', name: 'خنشلة', wilaya_id: 40, wilaya_name: 'خنشلة' },
  // 41 - Souk Ahras
  { code: '41A', name: 'سوق أهراس', wilaya_id: 41, wilaya_name: 'سوق أهراس' },
  // 42 - Tipaza
  { code: '42A', name: 'تيبازة', wilaya_id: 42, wilaya_name: 'تيبازة' },
  { code: '42B', name: 'تيبازة - القليعة', wilaya_id: 42, wilaya_name: 'تيبازة' },
  // 43 - Mila
  { code: '43A', name: 'ميلة', wilaya_id: 43, wilaya_name: 'ميلة' },
  { code: '43B', name: 'ميلة - شلغوم العيد', wilaya_id: 43, wilaya_name: 'ميلة' },
  { code: '43C', name: 'ميلة - تاجنانت', wilaya_id: 43, wilaya_name: 'ميلة' },
  // 44 - Ain Defla
  { code: '44A', name: 'عين الدفلى', wilaya_id: 44, wilaya_name: 'عين الدفلى' },
  { code: '44B', name: 'عين الدفلى - خميس مليانة', wilaya_id: 44, wilaya_name: 'عين الدفلى' },
  // 45 - Naama
  { code: '45A', name: 'النعامة - مشرية', wilaya_id: 45, wilaya_name: 'النعامة' },
  // 46 - Ain Temouchent
  { code: '46A', name: 'عين تموشنت', wilaya_id: 46, wilaya_name: 'عين تموشنت' },
  // 47 - Ghardaia
  { code: '47A', name: 'غرداية', wilaya_id: 47, wilaya_name: 'غرداية' },
  // 48 - Relizane
  { code: '48A', name: 'غليزان', wilaya_id: 48, wilaya_name: 'غليزان' },
  // 49 - Timimoun
  { code: '49A', name: 'تيميمون', wilaya_id: 49, wilaya_name: 'تيميمون' },
  // 51 - Ouled Djellal
  { code: '51A', name: 'أولاد جلال', wilaya_id: 51, wilaya_name: 'أولاد جلال' },
  // 52 - Beni Abbes
  { code: '52A', name: 'بني عباس', wilaya_id: 52, wilaya_name: 'بني عباس' },
  // 53 - In Salah
  { code: '53A', name: 'عين صالح', wilaya_id: 53, wilaya_name: 'عين صالح' },
  // 55 - Touggourt
  { code: '55A', name: 'تقرت', wilaya_id: 55, wilaya_name: 'تقرت' },
  // 56 - Djanet
  { code: '56A', name: 'جانت', wilaya_id: 56, wilaya_name: 'جانت' },
  // 58 - El Meniaa
  { code: '58A', name: 'المنيعة', wilaya_id: 58, wilaya_name: 'المنيعة' },
];

// Helper: Get desks by wilaya name (supports partial/variant matching)
export function getDesksByWilaya(wilayaName: string): NoestDeskStatic[] {
  // 1. Direct match via WILAYA_ID_MAP
  const directId = WILAYA_ID_MAP[wilayaName];
  if (directId) return NOEST_DESKS.filter(d => d.wilaya_id === directId);

  // 2. Try to find by wilaya_name field in NOEST_DESKS (partial match)
  const lowerInput = wilayaName.trim().toLowerCase();
  const matchedDesks = NOEST_DESKS.filter(d =>
    d.wilaya_name.toLowerCase().includes(lowerInput) ||
    lowerInput.includes(d.wilaya_name.toLowerCase())
  );
  if (matchedDesks.length > 0) return matchedDesks;

  // 3. Try matching by wilaya_id from code prefix
  const codeMatch = wilayaName.match(/^(\d+)/);
  if (codeMatch) {
    const id = parseInt(codeMatch[1]);
    return NOEST_DESKS.filter(d => d.wilaya_id === id);
  }

  return [];
}

// Helper: Get desks by wilaya code (numeric ID)
export function getDesksByWilayaCode(wilayaCode: number): NoestDeskStatic[] {
  return NOEST_DESKS.filter(d => d.wilaya_id === wilayaCode);
}

// ─── Helper: Map wilaya name to NOEST wilaya_id ───────────────

export const WILAYA_ID_MAP: Record<string, number> = {
  'أدرار': 1, 'الشلف': 2, 'الأغواط': 3, 'أم البواقي': 4,
  'باتنة': 5, 'بجاية': 6, 'بسكرة': 7, 'بشار': 8,
  'البليدة': 9, 'البويرة': 10, 'تمنراست': 11, 'تبسة': 12,
  'تلمسان': 13, 'تيارت': 14, 'تيزي وزو': 15, 'الجزائر': 16,
  'الجلفة': 17, 'جيجل': 18, 'سطيف': 19, 'سعيدة': 20,
  'سكيكدة': 21, 'سيدي بلعباس': 22, 'عنابة': 23, 'قالمة': 24,
  'قسنطينة': 25, 'المدية': 26, 'مستغانم': 27, 'المسيلة': 28,
  'معسكر': 29, 'ورقلة': 30, 'وهران': 31, 'البيض': 32,
  'إيليزي': 33, 'برج بوعريريج': 34, 'بومرداس': 35, 'الطارف': 36,
  'تندوف': 37, 'تيسمسيلت': 38, 'الوادي': 39, 'خنشلة': 40,
  'سوق أهراس': 41, 'تيبازة': 42, 'ميلة': 43, 'عين الدفلى': 44,
  'النعامة': 45, 'عين تموشنت': 46, 'غرداية': 47, 'غليزان': 48,
  'تيميمون': 49, 'أولاد جلال': 51, 'بني عباس': 52,
  'عين صالح': 53, 'تقرت': 55, 'جانت': 56, 'المغير': 57, 'المنيعة': 58,
};



