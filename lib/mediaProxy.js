// Central helpers for routing Supabase Storage images through the existing
// /api/products serverless function. This lets Vercel's CDN absorb repeated
// public image requests (including social crawlers) instead of hitting
// Supabase Storage on every request.

const MEDIA_PATH = '/api/products?media=1&src=';

export function unwrapMediaProxyUrl(value) {
  if (typeof value !== 'string' || !value) return value;
  try {
    const parsed = new URL(value, 'https://placeholder.local');
    if (parsed.pathname === '/api/products' && parsed.searchParams.get('media') === '1') {
      return parsed.searchParams.get('src') || value;
    }
  } catch {
    // keep original value
  }
  return value;
}

export function isSupabaseStorageUrl(value) {
  if (typeof value !== 'string' || !value) return false;
  try {
    const url = new URL(unwrapMediaProxyUrl(value));
    return url.hostname.endsWith('.supabase.co') && url.pathname.includes('/storage/v1/object/');
  } catch {
    return false;
  }
}

export function toMediaProxyUrl(value, siteUrl = '') {
  const source = unwrapMediaProxyUrl(value);
  if (!isSupabaseStorageUrl(source)) return value;
  const base = String(siteUrl || '').replace(/\/$/, '');
  return `${base}${MEDIA_PATH}${encodeURIComponent(source)}`;
}

export function proxyProductImages(product, siteUrl = '') {
  if (!product || typeof product !== 'object') return product;
  const images = Array.isArray(product.images)
    ? product.images.map((url) => toMediaProxyUrl(url, siteUrl))
    : product.images;
  return { ...product, images };
}

export function normalizeProductImagesForStorage(images) {
  if (!Array.isArray(images)) return [];
  return images.map((url) => unwrapMediaProxyUrl(url));
}

export function isAllowedSupabasePublicMedia(value) {
  try {
    const source = new URL(unwrapMediaProxyUrl(value));
    const configured = process.env.SUPABASE_URL ? new URL(process.env.SUPABASE_URL) : null;
    const bucket = process.env.SUPABASE_BUCKET || 'product-images';
    if (!configured || source.origin !== configured.origin) return false;
    const requiredPrefix = `/storage/v1/object/public/${bucket}/`;
    return source.pathname.startsWith(requiredPrefix);
  } catch {
    return false;
  }
}
