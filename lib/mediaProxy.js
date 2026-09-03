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

/**
 * Validate a stored Supabase URL and return the object path inside the
 * configured bucket. The URL may still contain the legacy /public/ segment
 * even after the bucket is made private; the proxy uses SERVICE_ROLE to read
 * the object, so browser/public access to Supabase can stay disabled.
 */
export function getAllowedSupabaseMediaPath(value) {
  try {
    const source = new URL(unwrapMediaProxyUrl(value));
    const configured = process.env.SUPABASE_URL ? new URL(process.env.SUPABASE_URL) : null;
    const bucket = process.env.SUPABASE_BUCKET || 'product-images';
    if (!configured || source.origin !== configured.origin) return null;

    const prefixes = [
      `/storage/v1/object/public/${bucket}/`,
      `/storage/v1/object/authenticated/${bucket}/`,
      `/storage/v1/object/sign/${bucket}/`,
    ];

    const prefix = prefixes.find((candidate) => source.pathname.startsWith(candidate));
    if (!prefix) return null;

    const rawPath = source.pathname.slice(prefix.length);
    if (!rawPath || rawPath.includes('..')) return null;

    try {
      return decodeURIComponent(rawPath);
    } catch {
      return rawPath;
    }
  } catch {
    return null;
  }
}

// Kept for backwards-compatible imports in existing API routes.
export function isAllowedSupabasePublicMedia(value) {
  return !!getAllowedSupabaseMediaPath(value);
}
