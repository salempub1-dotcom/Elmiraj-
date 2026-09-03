// ============================================================
// Supabase Storage Service — SECURE Server-Side Upload
// ============================================================
// ARCHITECTURE:
//   Client → compress image → base64 → POST /api/upload-image → SERVICE_ROLE → Supabase Storage
//   Client NEVER has direct write access to Supabase Storage.
// ============================================================

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const BUCKET_NAME = import.meta.env.VITE_SUPABASE_BUCKET || 'product-images';

function getAdminToken(): string | null {
  try {
    return localStorage.getItem('almiraj_token');
  } catch {
    return null;
  }
}

function unwrapMediaProxyUrl(value: string): string {
  if (!value) return value;
  try {
    const parsed = new URL(value, window.location.origin);
    if (parsed.pathname === '/api/products' && parsed.searchParams.get('media') === '1') {
      return parsed.searchParams.get('src') || value;
    }
  } catch {
    // Keep original value when URL parsing fails.
  }
  return value;
}

export function isSupabaseConfigured(): boolean {
  return !!SUPABASE_URL;
}

export function getSupabaseInfo() {
  return {
    url: SUPABASE_URL || '(not set)',
    bucket: BUCKET_NAME,
    configured: isSupabaseConfigured(),
    mode: 'server-side (SERVICE_ROLE)' as const,
  };
}

export function compressImage(
  file: File,
  maxWidth = 1200,
  maxHeight = 1200,
  quality = 0.8
): Promise<{ blob: Blob; width: number; height: number; originalSize: number; compressedSize: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;
      if (width > maxWidth || height > maxHeight) {
        const ratio = Math.min(maxWidth / width, maxHeight / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) { reject(new Error('Canvas context not available')); return; }
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => {
          if (!blob) { reject(new Error('Failed to compress image')); return; }
          resolve({ blob, width, height, originalSize: file.size, compressedSize: blob.size });
        },
        'image/jpeg',
        quality
      );
    };

    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Failed to load image')); };
    img.src = url;
  });
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      const base64 = result.includes(',') ? result.split(',')[1] : result;
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export async function uploadProductImage(
  file: File,
  onProgress?: (percent: number) => void
): Promise<{ url: string; path: string } | { error: string }> {
  const token = getAdminToken();
  if (!token) return { error: 'غير مصرح — يرجى تسجيل الدخول كمسؤول أولاً' };

  try {
    onProgress?.(10);
    console.log(`[Upload] 📦 Compressing: ${file.name} (${(file.size / 1024).toFixed(0)}KB)`);
    const compressed = await compressImage(file);
    const ratio = ((1 - compressed.compressedSize / compressed.originalSize) * 100).toFixed(0);
    console.log(`[Upload] ✅ Compressed: ${(compressed.originalSize / 1024).toFixed(0)}KB → ${(compressed.compressedSize / 1024).toFixed(0)}KB (-${ratio}%)`);

    onProgress?.(30);
    const base64 = await blobToBase64(compressed.blob);
    onProgress?.(50);

    const response = await fetch('/api/upload-image', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        image_base64: base64,
        content_type: 'image/jpeg',
        filename: file.name,
      }),
    });

    onProgress?.(80);
    if (response.status === 401) return { error: 'جلسة المسؤول منتهية — يرجى إعادة تسجيل الدخول' };

    const result = await response.json();
    if (!result.ok) {
      console.error('[Upload] ❌ Server error:', result.error);
      return { error: result.error || 'فشل رفع الصورة' };
    }

    console.log(`[Upload] ✅ Uploaded: ${result.url}`);
    onProgress?.(100);
    return { url: result.url, path: result.path };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn('[Upload] ⚠️ API call failed:', msg);
    return { error: 'خادم الرفع غير متوفر — يرجى النشر على Vercel' };
  }
}

export async function deleteProductImage(imageUrl: string): Promise<boolean> {
  if (!isSupabaseUrl(imageUrl)) return false;

  const token = getAdminToken();
  if (!token) return false;

  try {
    const response = await fetch('/api/delete-image', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ url: imageUrl }),
    });

    const result = await response.json();
    if (result.ok) {
      console.log(`[Delete] ✅ Deleted: ${result.deleted}`);
      return true;
    }
    console.warn(`[Delete] ⚠️ Failed: ${result.error}`);
    return false;
  } catch (e) {
    console.error('[Delete] ❌ Error:', e);
    return false;
  }
}

export function isSupabaseUrl(url: string): boolean {
  const source = unwrapMediaProxyUrl(url);
  return source.includes('.supabase.co/storage/');
}

export async function testSupabaseConnection(): Promise<{
  ok: boolean;
  message: string;
  details?: string;
}> {
  if (!SUPABASE_URL) {
    return {
      ok: false,
      message: 'VITE_SUPABASE_URL غير مُكوّن',
      details: 'أضف VITE_SUPABASE_URL في .env (للعرض فقط — لا يحتوي سراً)',
    };
  }

  const token = getAdminToken();
  if (!token) {
    return {
      ok: false,
      message: 'يرجى تسجيل الدخول أولاً',
      details: 'الفحص يحتاج صلاحيات المسؤول',
    };
  }

  try {
    const response = await fetch('/api/upload-image', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ action: 'health' }),
    });

    if (response.status === 401) {
      return { ok: false, message: 'جلسة منتهية', details: 'يرجى إعادة تسجيل الدخول' };
    }

    const result = await response.json();
    if (result.ok) {
      return {
        ok: true,
        message: 'متصل بـ Supabase Storage ✅',
        details: `الوضع: رفع/قراءة آمنة عبر الخادم (SERVICE_ROLE) | البوكت: ${result.bucket || BUCKET_NAME}`,
      };
    }

    if (result.supabase_configured === false) {
      return {
        ok: false,
        message: 'Supabase غير مُكوّن على الخادم',
        details: 'أضف SUPABASE_URL و SUPABASE_SERVICE_ROLE_KEY في Vercel',
      };
    }

    return { ok: false, message: 'خطأ في الاتصال', details: result.error };
  } catch {
    return {
      ok: false,
      message: 'خادم الرفع غير متوفر',
      details: 'يرجى النشر على Vercel وإعداد متغيرات البيئة',
    };
  }
}
