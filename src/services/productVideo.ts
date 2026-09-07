const MAX_PRODUCT_VIDEO_BYTES = 15 * 1024 * 1024;
const ALLOWED_VIDEO_TYPES = new Set(['video/mp4', 'video/webm']);

function getAdminToken(): string | null {
  try { return localStorage.getItem('almiraj_token'); }
  catch { return null; }
}

export type ProductVideoUploadResult =
  | { ok: true; url: string; playbackUrl: string; path: string; size: number }
  | { ok: false; error: string };

export function validateProductVideo(file: File): string | null {
  if (!ALLOWED_VIDEO_TYPES.has(file.type)) return 'الفيديو يجب أن يكون بصيغة MP4 أو WebM';
  if (file.size <= 0) return 'ملف الفيديو فارغ';
  if (file.size > MAX_PRODUCT_VIDEO_BYTES) return 'حجم الفيديو يجب أن لا يتجاوز 15MB';
  return null;
}

export function productVideoLimitLabel() {
  return 'MP4 أو WebM — الحد الأقصى 15MB';
}

export async function uploadProductVideo(
  file: File,
  onProgress?: (percent: number) => void,
): Promise<ProductVideoUploadResult> {
  const validation = validateProductVideo(file);
  if (validation) return { ok: false, error: validation };

  const token = getAdminToken();
  if (!token) return { ok: false, error: 'يرجى تسجيل الدخول كمسؤول أولاً' };

  try {
    onProgress?.(10);
    const prepare = await fetch('/api/upload-image', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        action: 'create_video_upload',
        filename: file.name,
        content_type: file.type,
        size: file.size,
      }),
    });
    const prepared = await prepare.json();
    if (!prepare.ok || !prepared?.ok || !prepared?.signed_url || !prepared?.path) {
      return { ok: false, error: prepared?.error || 'تعذر تجهيز رفع الفيديو' };
    }

    onProgress?.(35);
    const upload = await fetch(prepared.signed_url, {
      method: 'PUT',
      headers: {
        'Content-Type': file.type,
        'x-upsert': 'false',
      },
      body: file,
    });
    if (!upload.ok) {
      const detail = await upload.text().catch(() => '');
      console.error('[Video Upload] Supabase signed upload failed:', upload.status, detail);
      return { ok: false, error: 'فشل رفع الفيديو إلى Supabase Storage' };
    }

    onProgress?.(85);
    const playbackResponse = await fetch('/api/upload-image', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ action: 'video_playback_url', path: prepared.path }),
    });
    const playback = await playbackResponse.json();
    if (!playbackResponse.ok || !playback?.ok || !playback?.url) {
      return { ok: false, error: playback?.error || 'تم رفع الفيديو لكن تعذر تجهيز المعاينة' };
    }

    onProgress?.(100);
    return {
      ok: true,
      url: prepared.canonical_url,
      playbackUrl: playback.url,
      path: prepared.path,
      size: file.size,
    };
  } catch (error) {
    console.error('[Video Upload] failed:', error);
    return { ok: false, error: 'تعذر الاتصال بخادم رفع الفيديو' };
  }
}

export { MAX_PRODUCT_VIDEO_BYTES };
