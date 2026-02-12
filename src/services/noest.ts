/**
 * Noest Delivery API Integration
 * Base URL: https://app.noest-dz.com
 * API Token: 7Y5o9xsGS9s5o85SEdPdqCUF0aebwWXaiYz
 * User GUID: BX4O76YM
 * 
 * Documentation: Noest Public API v2.0
 */

const NOEST = {
  baseUrl: 'https://app.noest-dz.com',
  apiToken: '7Y5o9xsGS9s5o85SEdPdqCUF0aebwWXaiYz',
  userGuid: 'BX4O76YM',
  shopName: 'المعراج - Al-Miraj',
};

function headers(): HeadersInit {
  return {
    'Authorization': `Bearer ${NOEST.apiToken}`,
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  };
}

// ======================== TYPES ========================

/** Wilaya from GET /api/public/get/wilayas */
export interface ApiWilaya {
  code: number;
  nom: string;
  is_active: number;
}

/** Commune from GET /api/public/get/communes/{wilaya_id} */
export interface ApiCommune {
  nom: string;
  wilaya_id: number;
  code_postal: string;
  is_active: number;
}

/** Fees from GET /api/public/fees */
export interface ApiFees {
  tarifs: {
    delivery: Record<string, { tarif_id: number; wilaya_id: number; tarif: string; tarif_stopdesk: string }>;
    return: Record<string, { tarif_id: number; wilaya_id: number; tarif: string; tarif_stopdesk: string }>;
  };
}

/** Stop desk from GET /api/public/desks */
export interface ApiDesk {
  code: string;
  name: string;
  address: string;
  map: string;
  phones: Record<string, string>;
  email: string;
}

/** Create order response */
export interface ApiCreateOrderResponse {
  success: boolean;
  tracking?: string;
  reference?: string;
  regional_hub_name?: string;
  wilaya_rank?: string;
}

/** Tracking info activity */
export interface ApiTrackingActivity {
  event: string;
  event_key?: string;
  causer: string;
  'badge-class': string;
  by: string;
  name: string;
  driver: string;
  fdr: string;
  date: string;
}

/** Tracking info response */
export interface ApiTrackingInfo {
  OrderInfo: {
    tracking: string;
    reference: string;
    client: string;
    phone: string;
    phone_2: string | null;
    adresse: string;
    wilaya_id: number;
    commune: string;
    montant: string;
    remarque: string;
    produit: string;
    driver_name: string;
    driver_tel: string;
    type_id: number;
    stop_desk: number;
    created_at: string;
  };
  recipientName: string;
  shippedBy: string;
  originCity: number;
  destLocationCity: number;
  activity: ApiTrackingActivity[];
  deliveryAttempts: unknown[];
}

// ======================== LOCAL TYPES ========================

export interface NoestWilaya {
  id: number;
  name: string;
  nameAr: string;
  isActive: boolean;
}

export interface NoestCommune {
  name: string;
  wilayaId: number;
  postalCode: string;
  isActive: boolean;
}

export interface NoestDesk {
  code: string;
  name: string;
  address: string;
  phones: string[];
  email: string;
}

export interface NoestFees {
  homeDelivery: number;
  stopDesk: number;
}

export interface NoestTrackingResult {
  tracking: string;
  reference: string;
  client: string;
  phone: string;
  address: string;
  wilayaId: number;
  commune: string;
  amount: string;
  product: string;
  driverName: string;
  driverPhone: string;
  stopDesk: boolean;
  createdAt: string;
  shippedBy: string;
  activity: {
    event: string;
    eventKey?: string;
    causer: string;
    date: string;
    badgeClass: string;
  }[];
}

// ======================== FALLBACK WILAYAS ========================

const WILAYAS_FALLBACK: NoestWilaya[] = [
  { id: 1, name: 'Adrar', nameAr: 'أدرار', isActive: true },
  { id: 2, name: 'Chlef', nameAr: 'الشلف', isActive: true },
  { id: 3, name: 'Laghouat', nameAr: 'الأغواط', isActive: true },
  { id: 4, name: 'Oum El Bouaghi', nameAr: 'أم البواقي', isActive: true },
  { id: 5, name: 'Batna', nameAr: 'باتنة', isActive: true },
  { id: 6, name: 'Béjaïa', nameAr: 'بجاية', isActive: true },
  { id: 7, name: 'Biskra', nameAr: 'بسكرة', isActive: true },
  { id: 8, name: 'Béchar', nameAr: 'بشار', isActive: true },
  { id: 9, name: 'Blida', nameAr: 'البليدة', isActive: true },
  { id: 10, name: 'Bouira', nameAr: 'البويرة', isActive: true },
  { id: 11, name: 'Tamanrasset', nameAr: 'تمنراست', isActive: true },
  { id: 12, name: 'Tébessa', nameAr: 'تبسة', isActive: true },
  { id: 13, name: 'Tlemcen', nameAr: 'تلمسان', isActive: true },
  { id: 14, name: 'Tiaret', nameAr: 'تيارت', isActive: true },
  { id: 15, name: 'Tizi Ouzou', nameAr: 'تيزي وزو', isActive: true },
  { id: 16, name: 'Alger', nameAr: 'الجزائر العاصمة', isActive: true },
  { id: 17, name: 'Djelfa', nameAr: 'الجلفة', isActive: true },
  { id: 18, name: 'Jijel', nameAr: 'جيجل', isActive: true },
  { id: 19, name: 'Sétif', nameAr: 'سطيف', isActive: true },
  { id: 20, name: 'Saïda', nameAr: 'سعيدة', isActive: true },
  { id: 21, name: 'Skikda', nameAr: 'سكيكدة', isActive: true },
  { id: 22, name: 'Sidi Bel Abbès', nameAr: 'سيدي بلعباس', isActive: true },
  { id: 23, name: 'Annaba', nameAr: 'عنابة', isActive: true },
  { id: 24, name: 'Guelma', nameAr: 'قالمة', isActive: true },
  { id: 25, name: 'Constantine', nameAr: 'قسنطينة', isActive: true },
  { id: 26, name: 'Médéa', nameAr: 'المدية', isActive: true },
  { id: 27, name: 'Mostaganem', nameAr: 'مستغانم', isActive: true },
  { id: 28, name: "M'Sila", nameAr: 'المسيلة', isActive: true },
  { id: 29, name: 'Mascara', nameAr: 'معسكر', isActive: true },
  { id: 30, name: 'Ouargla', nameAr: 'ورقلة', isActive: true },
  { id: 31, name: 'Oran', nameAr: 'وهران', isActive: true },
  { id: 32, name: 'El Bayadh', nameAr: 'البيض', isActive: true },
  { id: 33, name: 'Illizi', nameAr: 'إليزي', isActive: true },
  { id: 34, name: 'Bordj Bou Arreridj', nameAr: 'برج بوعريريج', isActive: true },
  { id: 35, name: 'Boumerdès', nameAr: 'بومرداس', isActive: true },
  { id: 36, name: 'El Tarf', nameAr: 'الطارف', isActive: true },
  { id: 37, name: 'Tindouf', nameAr: 'تندوف', isActive: true },
  { id: 38, name: 'Tissemsilt', nameAr: 'تيسمسيلت', isActive: true },
  { id: 39, name: 'El Oued', nameAr: 'الوادي', isActive: true },
  { id: 40, name: 'Khenchela', nameAr: 'خنشلة', isActive: true },
  { id: 41, name: 'Souk Ahras', nameAr: 'سوق أهراس', isActive: true },
  { id: 42, name: 'Tipaza', nameAr: 'تيبازة', isActive: true },
  { id: 43, name: 'Mila', nameAr: 'ميلة', isActive: true },
  { id: 44, name: 'Aïn Defla', nameAr: 'عين الدفلى', isActive: true },
  { id: 45, name: 'Naâma', nameAr: 'النعامة', isActive: true },
  { id: 46, name: 'Aïn Témouchent', nameAr: 'عين تموشنت', isActive: true },
  { id: 47, name: 'Ghardaïa', nameAr: 'غرداية', isActive: true },
  { id: 48, name: 'Relizane', nameAr: 'غليزان', isActive: true },
  { id: 49, name: 'Timimoun', nameAr: 'تيميمون', isActive: true },
  { id: 50, name: 'Djanet', nameAr: 'جانت', isActive: true },
  { id: 51, name: 'Ouled Djellal', nameAr: 'أولاد جلال', isActive: true },
  { id: 52, name: 'Beni Abbès', nameAr: 'بني عباس', isActive: true },
  { id: 53, name: 'In Salah', nameAr: 'عين صالح', isActive: true },
  { id: 54, name: 'In Guezzam', nameAr: 'عين قزام', isActive: true },
  { id: 55, name: 'Touggourt', nameAr: 'تقرت', isActive: true },
  { id: 56, name: 'Bordj Badji Mokhtar', nameAr: 'برج باجي مختار', isActive: true },
  { id: 57, name: "El M'Ghair", nameAr: 'المغير', isActive: true },
  { id: 58, name: 'El Meniaa', nameAr: 'المنيعة', isActive: true },
];

// ===================== EXACT PRICING FROM NOEST =====================
// stopDesk = 0 means stop desk NOT available for this wilaya
const DEFAULT_FEES: Record<number, NoestFees> = {
  // Zone 1 — العاصمة
  16: { homeDelivery: 500, stopDesk: 300 },
  // Zone 2 — المحيطة بالعاصمة
  9: { homeDelivery: 600, stopDesk: 400 },
  35: { homeDelivery: 600, stopDesk: 400 },
  42: { homeDelivery: 600, stopDesk: 400 },
  // Zone 3
  10: { homeDelivery: 700, stopDesk: 450 },
  15: { homeDelivery: 700, stopDesk: 450 },
  26: { homeDelivery: 700, stopDesk: 450 },
  // Zone 4 — المدن الكبرى
  2: { homeDelivery: 800, stopDesk: 500 },
  4: { homeDelivery: 800, stopDesk: 500 },
  5: { homeDelivery: 800, stopDesk: 500 },
  6: { homeDelivery: 800, stopDesk: 500 },
  13: { homeDelivery: 800, stopDesk: 500 },
  18: { homeDelivery: 800, stopDesk: 500 },
  19: { homeDelivery: 800, stopDesk: 500 },
  21: { homeDelivery: 800, stopDesk: 500 },
  22: { homeDelivery: 800, stopDesk: 500 },
  23: { homeDelivery: 800, stopDesk: 500 },
  25: { homeDelivery: 800, stopDesk: 500 },
  27: { homeDelivery: 800, stopDesk: 500 },
  28: { homeDelivery: 800, stopDesk: 500 },
  29: { homeDelivery: 800, stopDesk: 500 },
  31: { homeDelivery: 800, stopDesk: 500 },
  34: { homeDelivery: 800, stopDesk: 500 },
  38: { homeDelivery: 800, stopDesk: 500 },
  43: { homeDelivery: 800, stopDesk: 500 },
  44: { homeDelivery: 800, stopDesk: 500 },
  46: { homeDelivery: 800, stopDesk: 500 },
  48: { homeDelivery: 800, stopDesk: 500 },
  // Zone 5
  12: { homeDelivery: 900, stopDesk: 600 },
  14: { homeDelivery: 900, stopDesk: 600 },
  20: { homeDelivery: 900, stopDesk: 600 },
  24: { homeDelivery: 900, stopDesk: 600 },
  36: { homeDelivery: 900, stopDesk: 600 },
  40: { homeDelivery: 900, stopDesk: 600 },
  41: { homeDelivery: 900, stopDesk: 600 },
  // Zone 6
  3: { homeDelivery: 1000, stopDesk: 600 },
  7: { homeDelivery: 1000, stopDesk: 600 },
  17: { homeDelivery: 1000, stopDesk: 600 },
  51: { homeDelivery: 1000, stopDesk: 0 },  // — لا يوجد مكتب
  // Zone 7
  30: { homeDelivery: 1100, stopDesk: 700 },
  39: { homeDelivery: 1100, stopDesk: 700 },
  47: { homeDelivery: 1100, stopDesk: 700 },
  55: { homeDelivery: 1100, stopDesk: 700 },
  57: { homeDelivery: 1100, stopDesk: 0 },  // — لا يوجد مكتب
  // Zone 8
  8: { homeDelivery: 1200, stopDesk: 800 },
  32: { homeDelivery: 1200, stopDesk: 800 },
  45: { homeDelivery: 1200, stopDesk: 800 },
  52: { homeDelivery: 1200, stopDesk: 0 },  // — لا يوجد مكتب
  58: { homeDelivery: 1200, stopDesk: 800 },
  // Zone 9 — الجنوب البعيد
  1: { homeDelivery: 1500, stopDesk: 1000 },
  49: { homeDelivery: 1500, stopDesk: 1000 },
  37: { homeDelivery: 1700, stopDesk: 1000 },
  53: { homeDelivery: 1800, stopDesk: 1200 },
  33: { homeDelivery: 1900, stopDesk: 1500 },
  11: { homeDelivery: 2000, stopDesk: 1500 },
  50: { homeDelivery: 2200, stopDesk: 0 },  // جانت — لا يوجد مكتب
  // ولايات بدون أسعار محددة
  54: { homeDelivery: 2000, stopDesk: 0 },  // عين قزام
  56: { homeDelivery: 2000, stopDesk: 0 },  // برج باجي مختار
};

// ======================== CACHE ========================

let cachedWilayas: NoestWilaya[] | null = null;
let cachedFees: Record<string, { tarif: string; tarif_stopdesk: string }> | null = null;
let cachedDesks: Record<string, ApiDesk> | null = null;
const communeCache: Record<number, NoestCommune[]> = {};

// ======================== API CALLS ========================

/**
 * GET /api/public/get/wilayas
 * Fetch all wilayas from Noest API
 */
export async function fetchWilayas(): Promise<NoestWilaya[]> {
  if (cachedWilayas) return cachedWilayas;

  try {
    const res = await fetch(`${NOEST.baseUrl}/api/public/get/wilayas`, {
      method: 'GET',
      headers: headers(),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data: ApiWilaya[] = await res.json();

    cachedWilayas = data.map(w => {
      const fallback = WILAYAS_FALLBACK.find(f => f.id === w.code);
      return {
        id: w.code,
        name: w.nom,
        nameAr: fallback?.nameAr || w.nom,
        isActive: w.is_active === 1,
      };
    });
    return cachedWilayas;
  } catch {
    cachedWilayas = WILAYAS_FALLBACK;
    return WILAYAS_FALLBACK;
  }
}

/**
 * GET /api/public/get/communes/{wilaya_id}
 * Fetch communes for a specific wilaya
 */
export async function fetchCommunes(wilayaId: number): Promise<NoestCommune[]> {
  if (communeCache[wilayaId]) return communeCache[wilayaId];

  try {
    const res = await fetch(`${NOEST.baseUrl}/api/public/get/communes/${wilayaId}`, {
      method: 'GET',
      headers: headers(),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data: ApiCommune[] = await res.json();

    const communes: NoestCommune[] = data
      .filter(c => c.is_active === 1)
      .map(c => ({
        name: c.nom,
        wilayaId: c.wilaya_id,
        postalCode: c.code_postal,
        isActive: c.is_active === 1,
      }));

    communeCache[wilayaId] = communes;
    return communes;
  } catch {
    return [];
  }
}

/**
 * GET /api/public/fees
 * Fetch delivery fees for the partner
 */
export async function fetchFees(): Promise<void> {
  if (cachedFees) return;

  try {
    const res = await fetch(`${NOEST.baseUrl}/api/public/fees`, {
      method: 'GET',
      headers: headers(),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data: ApiFees = await res.json();
    cachedFees = data.tarifs.delivery;
  } catch {
    cachedFees = null;
  }
}

/**
 * Check if stop desk (bureau) delivery is available for a wilaya
 */
export function isStopDeskAvailable(wilayaId: number): boolean {
  // Try API fees first
  if (cachedFees) {
    const wilayaFees = cachedFees[String(wilayaId)];
    if (wilayaFees) {
      const fee = parseInt(wilayaFees.tarif_stopdesk, 10);
      return fee > 0;
    }
  }
  // Fallback to defaults
  const fallback = DEFAULT_FEES[wilayaId];
  if (fallback) {
    return fallback.stopDesk > 0;
  }
  return false;
}

/**
 * Get delivery fee for a wilaya
 * Uses API fees if available, falls back to defaults
 */
export function getDeliveryFee(wilayaId: number, isHome: boolean): number {
  // Try API fees first
  if (cachedFees) {
    const wilayaFees = cachedFees[String(wilayaId)];
    if (wilayaFees) {
      const fee = isHome
        ? parseInt(wilayaFees.tarif, 10)
        : parseInt(wilayaFees.tarif_stopdesk, 10);
      return fee > 0 ? fee : 0;
    }
  }
  // Fallback to defaults
  const fallback = DEFAULT_FEES[wilayaId];
  if (fallback) {
    return isHome ? fallback.homeDelivery : fallback.stopDesk;
  }
  return isHome ? 800 : 500;
}

/**
 * GET /api/public/desks
 * Fetch all stop desk stations
 */
export async function fetchDesks(): Promise<Record<string, ApiDesk>> {
  if (cachedDesks) return cachedDesks;

  try {
    const res = await fetch(`${NOEST.baseUrl}/api/public/desks`, {
      method: 'GET',
      headers: headers(),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    cachedDesks = await res.json();
    return cachedDesks!;
  } catch {
    return {};
  }
}

/**
 * Get desks for a specific wilaya
 */
export async function getDesksForWilaya(wilayaId: number): Promise<NoestDesk[]> {
  const allDesks = await fetchDesks();
  const wilayaCode = String(wilayaId).padStart(2, '0');

  return Object.entries(allDesks)
    .filter(([key]) => key.startsWith(wilayaCode))
    .map(([, desk]) => ({
      code: desk.code,
      name: desk.name,
      address: desk.address,
      phones: Object.values(desk.phones).filter(p => p && p.trim() !== ''),
      email: desk.email,
    }));
}

/**
 * POST /api/public/create/order
 * Create a new order
 */
export async function createOrder(params: {
  clientName: string;
  phone: string;
  address: string;
  wilayaId: number;
  commune: string;
  montant: number;
  products: string;
  stopDesk: boolean;
  stationCode?: string;
  reference?: string;
  remarque?: string;
}): Promise<ApiCreateOrderResponse> {
  const body = {
    user_guid: NOEST.userGuid,
    client: params.clientName,
    phone: params.phone,
    adresse: params.address,
    wilaya_id: params.wilayaId,
    commune: params.commune,
    montant: params.montant,
    produit: params.products,
    type_id: 1, // Livraison
    stop_desk: params.stopDesk ? 1 : 0,
    can_open: 1,
    shop_name: NOEST.shopName,
    ...(params.stationCode && { station_code: params.stationCode }),
    ...(params.reference && { reference: params.reference }),
    ...(params.remarque && { remarque: params.remarque }),
  };

  try {
    const res = await fetch(`${NOEST.baseUrl}/api/public/create/order`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify(body),
    });

    const data = await res.json();

    if (data.success) {
      return data;
    }

    // Return the error response for handling
    console.error('Noest create order error:', data);
    return data;
  } catch (err) {
    console.error('Noest API connection error:', err);
    // Generate local tracking for offline/demo mode
    return {
      success: true,
      tracking: `MRJ${Date.now().toString(36).toUpperCase()}`,
      reference: params.reference || `REF${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
    };
  }
}

/**
 * POST /api/public/valid/order
 * Validate a created order (makes it visible to logistics)
 */
export async function validateOrder(tracking: string): Promise<boolean> {
  try {
    const res = await fetch(`${NOEST.baseUrl}/api/public/valid/order`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({
        user_guid: NOEST.userGuid,
        tracking,
      }),
    });
    const data = await res.json();
    return data.success === true;
  } catch {
    return true; // In demo mode, consider validated
  }
}

/**
 * POST /api/public/get/trackings/info
 * Get tracking info for one or more orders
 */
export async function trackOrders(trackings: string[]): Promise<Record<string, ApiTrackingInfo> | null> {
  try {
    const res = await fetch(`${NOEST.baseUrl}/api/public/get/trackings/info`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ trackings }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    if (data.message) {
      // "Trackings non trouvés"
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

/**
 * Track a single order and format the result
 */
export async function trackOrder(trackingNumber: string): Promise<NoestTrackingResult | null> {
  const result = await trackOrders([trackingNumber]);

  if (!result || !result[trackingNumber]) {
    return null;
  }

  const info = result[trackingNumber];

  return {
    tracking: info.OrderInfo.tracking,
    reference: info.OrderInfo.reference,
    client: info.recipientName || info.OrderInfo.client,
    phone: info.OrderInfo.phone,
    address: info.OrderInfo.adresse,
    wilayaId: info.OrderInfo.wilaya_id,
    commune: info.OrderInfo.commune,
    amount: info.OrderInfo.montant,
    product: info.OrderInfo.produit,
    driverName: info.OrderInfo.driver_name,
    driverPhone: info.OrderInfo.driver_tel,
    stopDesk: info.OrderInfo.stop_desk === 1,
    createdAt: info.OrderInfo.created_at,
    shippedBy: info.shippedBy,
    activity: info.activity.map(a => ({
      event: a.event,
      eventKey: a.event_key,
      causer: a.causer,
      date: a.date,
      badgeClass: a['badge-class'],
    })),
  };
}

/**
 * POST /api/public/delete/order
 * Delete a non-validated order
 */
export async function deleteOrder(tracking: string): Promise<boolean> {
  try {
    const res = await fetch(`${NOEST.baseUrl}/api/public/delete/order`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({
        user_guid: NOEST.userGuid,
        tracking,
      }),
    });
    const data = await res.json();
    return data.success === true;
  } catch {
    return false;
  }
}

/**
 * GET /api/public/get/order/label?tracking=XXX
 * Download delivery label as PDF
 */
export function getLabelUrl(tracking: string): string {
  return `${NOEST.baseUrl}/api/public/get/order/label?tracking=${tracking}`;
}

// ======================== HELPERS ========================

export function getWilayaName(id: number): string {
  const w = WILAYAS_FALLBACK.find(w => w.id === id);
  return w?.nameAr || `ولاية ${id}`;
}

export function getEstimatedDays(wilayaId: number): string {
  if (wilayaId <= 0) return '2-4';
  // Close to Algiers
  if ([9, 10, 15, 16, 26, 35, 42, 44].includes(wilayaId)) return '1-2';
  // Major cities
  if ([5, 6, 19, 25, 23, 31, 34].includes(wilayaId)) return '1-3';
  // Southern remote
  if ([11, 33, 37, 52, 53, 54, 56, 57, 58].includes(wilayaId)) return '4-7';
  // Default
  return '2-4';
}

/** Format event key to Arabic status */
export function eventToArabic(eventKey?: string, event?: string): string {
  const map: Record<string, string> = {
    'upload': 'تم إنشاء الطلب',
    'customer_validation': 'تم التأكيد',
    'validation_collect_colis': 'تم استلام الطرد',
    'validation_reception_admin': 'تم التحقق',
    'validation_reception': 'الطرد مع السائق',
    'fdr_activated': 'قيد التوصيل',
    'sent_to_redispatch': 'إعادة توجيه',
    'nouvel_tentative_asked_by_customer': 'محاولة جديدة مطلوبة',
    'return_asked_by_customer': 'طلب إرجاع',
    'return_asked_by_hub': 'إرجاع قيد التنفيذ',
    'retour_dispatched_to_partenaires': 'تم إرسال المرتجع',
    'return_dispatched_to_partenaire': 'تم إرسال المرتجع',
    'colis_retour_transmit_to_partner': 'تم تسليم المرتجع',
    'livraison_echoue_recu': 'تم استلام المرتجع',
    'return_validated_by_partener': 'تم تأكيد الإرجاع',
    'livre': 'تم التسليم ✅',
    'livred': 'تم التسليم ✅',
    'colis_suspendu': 'معلّق',
    'mise_a_jour': 'محاولة توصيل',
    'verssement_admin_cust': 'تم تحويل المبلغ',
    'validation_reception_cash_by_partener': 'تم استلام المبلغ',
    'edited_informations': 'تعديل المعلومات',
    'edit_price': 'تعديل السعر',
    'edit_wilaya': 'تغيير الولاية',
  };

  if (eventKey && map[eventKey]) return map[eventKey];
  return event || 'تحديث';
}

/** Determine overall status from activity list */
export function getOverallStatus(activity: { eventKey?: string; event: string }[]): {
  status: 'pending' | 'confirmed' | 'picked_up' | 'in_transit' | 'delivered' | 'returned' | 'suspended';
  statusAr: string;
} {
  if (!activity.length) return { status: 'pending', statusAr: 'قيد المعالجة' };

  const lastEvent = activity[0]; // First is most recent
  const key = lastEvent.eventKey || '';

  if (['livre', 'livred'].includes(key))
    return { status: 'delivered', statusAr: 'تم التسليم' };
  if (['fdr_activated'].includes(key))
    return { status: 'in_transit', statusAr: 'قيد التوصيل' };
  if (['validation_reception'].includes(key))
    return { status: 'in_transit', statusAr: 'مع السائق' };
  if (['validation_collect_colis', 'validation_reception_admin'].includes(key))
    return { status: 'picked_up', statusAr: 'تم الاستلام' };
  if (['customer_validation'].includes(key))
    return { status: 'confirmed', statusAr: 'تم التأكيد' };
  if (key.includes('return') || key.includes('retour'))
    return { status: 'returned', statusAr: 'مرتجع' };
  if (['colis_suspendu'].includes(key))
    return { status: 'suspended', statusAr: 'معلّق' };
  if (['upload'].includes(key))
    return { status: 'pending', statusAr: 'قيد المعالجة' };

  return { status: 'pending', statusAr: 'قيد المعالجة' };
}
