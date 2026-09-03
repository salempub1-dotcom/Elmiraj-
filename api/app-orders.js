import { createClient } from '@supabase/supabase-js';

export const config = { api: { bodyParser: { sizeLimit: '2mb' } } };

const APP_SUPABASE_URL = 'https://szgvpajhmqvxugoeoidc.supabase.co';
const APP_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_KHZ4BVg-R-mT9Lu_2xexrA_rtlMlfb1';
const STORE_DELIVERY_API = 'https://www.elm3raj.com/api/noest';

function json(res, data, status = 200) {
  return res.status(status).json(data);
}

function getStoreSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

async function getAppUser(req) {
  const auth = req.headers.authorization || '';
  if (!auth.startsWith('Bearer ')) return null;

  const response = await fetch(`${APP_SUPABASE_URL}/auth/v1/user`, {
    headers: {
      apikey: APP_SUPABASE_PUBLISHABLE_KEY,
      Authorization: auth,
      Accept: 'application/json',
    },
  });
  if (!response.ok) return null;
  return response.json().catch(() => null);
}

async function deliveryPost(payload) {
  const response = await fetch(STORE_DELIVERY_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(payload),
  });
  const result = await response.json().catch(() => null);
  if (!response.ok || !result) throw new Error('تعذر الاتصال بخدمة التوصيل.');
  return result;
}

function encodeDeliverySelection(officeId, officeName) {
  return `@DP1:zrexpress:${encodeURIComponent(officeId || '')}:${encodeURIComponent(officeName || '')}`;
}

function makeTracking() {
  const time = Date.now().toString(36).toUpperCase();
  const rnd = crypto.randomUUID().replace(/-/g, '').slice(0, 6).toUpperCase();
  return `AM-${time}${rnd}`;
}

async function createOrder(req, res, user, admin, body) {
  const customer = String(body.customer ?? '').trim();
  const phone = String(body.phone ?? '').trim();
  const wilaya = String(body.wilaya ?? '').trim();
  const wilayaId = Number(body.wilayaId);
  const commune = String(body.commune ?? '').trim();
  const address = String(body.address ?? '').trim();
  const deliveryType = body.deliveryType === 'office' ? 'office' : 'home';
  const selectedOfficeId = body.selectedOfficeId ? String(body.selectedOfficeId).trim() : null;
  const selectedOfficeName = body.selectedOfficeName ? String(body.selectedOfficeName).trim() : null;
  const items = Array.isArray(body.items)
    ? body.items.filter((i) => Number(i.productId) > 0 && Number(i.quantity) > 0)
    : [];

  if (!customer || !phone || !wilaya || !wilayaId || !commune || !address || items.length === 0) {
    return json(res, { error: 'يرجى إكمال بيانات المستلم والولاية والبلدية والعنوان.' }, 400);
  }
  if (deliveryType === 'office' && !selectedOfficeId) {
    return json(res, { error: 'اختر مكتب الاستلام.' }, 400);
  }

  const settings = await deliveryPost({ action: 'checkout_delivery_settings' });
  if (!settings?.ok || settings?.data?.zrexpress === false) {
    return json(res, { error: 'ZR Express غير متاحة حاليًا للطلبات من التطبيق.' }, 400);
  }

  const quote = await deliveryPost({ action: 'checkout_zr_quote', wilaya_id: wilayaId, commune });
  if (!quote?.ok || !quote?.data) {
    return json(res, { error: quote?.message || 'تعذر حساب سعر التوصيل لهذه الوجهة.' }, 400);
  }

  const shipping = Number(deliveryType === 'office' ? quote.data.office : quote.data.home);
  if (!Number.isFinite(shipping) || shipping < 0) {
    return json(res, { error: 'سعر التوصيل غير متوفر لهذه الوجهة.' }, 400);
  }

  let safeOfficeName = null;
  if (deliveryType === 'office') {
    const options = await deliveryPost({ action: 'checkout_zr_options', wilaya_id: wilayaId, commune });
    if (!options?.ok || !Array.isArray(options?.data?.pickup_hubs)) {
      return json(res, { error: options?.message || 'تعذر تحميل مكاتب ZR Express.' }, 400);
    }
    const hub = options.data.pickup_hubs.find((h) => String(h?.id || '') === selectedOfficeId);
    if (!hub) return json(res, { error: 'مكتب الاستلام المحدد لم يعد متاحًا.' }, 400);
    safeOfficeName = String(hub.name || selectedOfficeName || 'ZR Express').trim();
  }

  const ids = [...new Set(items.map((i) => Number(i.productId)))];
  const { data: products, error: productError } = await admin
    .from('products')
    .select('id,name,description,price,category,images,stock,sales,benefits,badge,contents,level,created_at,updated_at')
    .in('id', ids);

  if (productError) throw productError;
  if (!products || products.length !== ids.length) {
    return json(res, { error: 'بعض المنتجات لم تعد متاحة.' }, 400);
  }

  let subtotal = 0;
  const orderItems = items.map((item) => {
    const product = products.find((p) => Number(p.id) === Number(item.productId));
    if (!product) throw new Error('منتج غير متاح');
    const quantity = Math.min(Math.max(1, Math.floor(Number(item.quantity))), 20);
    if (typeof product.stock === 'number' && product.stock < quantity) {
      throw new Error(`الكمية غير متوفرة: ${product.name}`);
    }
    subtotal += Number(product.price) * quantity;
    return { ...product, quantity };
  });

  const total = subtotal + shipping;
  const id = `APP-${Date.now()}`;
  const tracking = makeTracking();
  const now = new Date().toISOString();
  const selectedOffice = encodeDeliverySelection(
    deliveryType === 'office' ? selectedOfficeId : null,
    deliveryType === 'office' ? safeOfficeName : null,
  );

  const { data: inserted, error: insertError } = await admin.from('orders').insert({
    id,
    tracking,
    customer,
    phone,
    wilaya,
    wilaya_id: wilayaId,
    commune,
    address,
    items: orderItems,
    total,
    shipping,
    delivery_type: deliveryType,
    selected_office: selectedOffice,
    status: 'pending',
    date: now,
    order_source: 'app',
    user_id: user.id,
    archived: false,
  }).select('id,tracking,status,total,shipping,delivery_type,selected_office,created_at').single();

  if (insertError) throw insertError;
  return json(res, { order: inserted, shippingPending: false });
}

async function listOrders(res, user, admin) {
  const { data, error } = await admin
    .from('orders')
    .select('id,tracking,status,total,shipping,delivery_type,selected_office,delivery_status,delivery_status_updated_at,sent_to_delivery_at,created_at,items,wilaya,wilaya_id,commune,address')
    .eq('order_source', 'app')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return json(res, { data: data || [] });
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return json(res, { error: 'Method not allowed' }, 405);

  const admin = getStoreSupabase();
  if (!admin) return json(res, { error: 'STORE_DATABASE_NOT_CONFIGURED' }, 503);

  try {
    const user = await getAppUser(req);
    if (!user?.id) return json(res, { error: 'Unauthorized' }, 401);

    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const action = body.action || 'create';

    if (action === 'create') return createOrder(req, res, user, admin, body);
    if (action === 'list') return listOrders(res, user, admin);
    return json(res, { error: `Unknown action: ${action}` }, 400);
  } catch (error) {
    console.error('[APP_ORDERS]', error?.message || error);
    return json(res, { error: error instanceof Error ? error.message : 'Unexpected error' }, 500);
  }
}
