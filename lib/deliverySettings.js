// ============================================================
// Storefront operational settings
// ============================================================
// Persisted in the existing landing_pages table as one RESERVED system row.
// This avoids a schema migration while still giving the admin durable toggles
// shared by every storefront visitor/device. The reserved row is never exposed
// as a landing page by the admin landing-pages API.
// ============================================================

const RESERVED_SLUG = '__system_delivery_providers';
const DEFAULTS = Object.freeze({
  noest: true,
  zrexpress: true,
  // Fail closed: WhatsApp confirmation stays hidden until the admin enables it.
  whatsappConfirmation: false,
});

function normalize(input) {
  const source = input && typeof input === 'object' ? input : {};
  let noest = source.noest !== false;
  let zrexpress = source.zrexpress !== false;
  const whatsappConfirmation = source.whatsappConfirmation === true;

  // The storefront must always have at least one usable provider.
  if (!noest && !zrexpress) noest = true;

  return { noest, zrexpress, whatsappConfirmation };
}

export function defaultDeliverySettings() {
  return { ...DEFAULTS };
}

export async function readDeliverySettings(supabase) {
  if (!supabase) return { ok: false, data: defaultDeliverySettings(), source: 'fallback' };
  try {
    const { data, error } = await supabase
      .from('landing_pages')
      .select('description')
      .eq('slug', RESERVED_SLUG)
      .maybeSingle();

    if (error) {
      console.warn('[DELIVERY_SETTINGS] read failed:', error.message);
      return { ok: false, data: defaultDeliverySettings(), source: 'fallback' };
    }

    if (!data?.description) {
      return { ok: true, data: defaultDeliverySettings(), source: 'default' };
    }

    let parsed;
    try { parsed = JSON.parse(data.description); }
    catch { parsed = {}; }
    return { ok: true, data: normalize(parsed), source: 'database' };
  } catch (e) {
    console.warn('[DELIVERY_SETTINGS] read exception:', e?.message || String(e));
    return { ok: false, data: defaultDeliverySettings(), source: 'fallback' };
  }
}

export async function writeDeliverySettings(supabase, next) {
  if (!supabase) return { ok: false, error: 'SUPABASE_NOT_CONFIGURED', message: 'قاعدة البيانات غير مضبوطة.' };
  const settings = normalize(next);
  const now = new Date().toISOString();
  const row = {
    title: '__SYSTEM__: Storefront operational settings',
    slug: RESERVED_SLUG,
    product_id: null,
    headline: null,
    description: JSON.stringify(settings),
    image_url: null,
    cta_text: 'system',
    cta_url: null,
    is_active: false,
    updated_at: now,
  };

  try {
    const { error } = await supabase
      .from('landing_pages')
      .upsert(row, { onConflict: 'slug' });
    if (error) {
      console.error('[DELIVERY_SETTINGS] write failed:', error.message);
      return { ok: false, error: error.code || 'SETTINGS_SAVE_FAILED', message: 'تعذر حفظ إعدادات المتجر.' };
    }
    return { ok: true, data: settings };
  } catch (e) {
    console.error('[DELIVERY_SETTINGS] write exception:', e?.message || String(e));
    return { ok: false, error: 'SETTINGS_SAVE_FAILED', message: 'تعذر حفظ إعدادات المتجر.' };
  }
}

export function isReservedDeliverySettingsSlug(slug) {
  return String(slug || '') === RESERVED_SLUG;
}
