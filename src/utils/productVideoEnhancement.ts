import { productVideoLimitLabel, uploadProductVideo, validateProductVideo } from '../services/productVideo';

const VIDEO_MARKER = '__MIRAJ_VIDEO__:';

type RuntimeProduct = {
  id: number;
  name: string;
  contents?: string[];
  video_url?: string;
  [key: string]: unknown;
};

const productCache = new Map<number, RuntimeProduct>();
let installed = false;
let draftVideoUrl = '';
let draftVideoPath = '';
let draftVideoPreview = '';
let uploadBusy = false;
let uploadPercent = 0;

function extractVideo(product: RuntimeProduct): RuntimeProduct {
  const contents = Array.isArray(product.contents) ? product.contents : [];
  let videoUrl = typeof product.video_url === 'string' ? product.video_url : '';
  const cleanContents = contents.filter((entry) => {
    const text = String(entry || '');
    if (text.startsWith(VIDEO_MARKER)) {
      if (!videoUrl) videoUrl = text.slice(VIDEO_MARKER.length).trim();
      return false;
    }
    return true;
  });
  const normalized = { ...product, contents: cleanContents, video_url: videoUrl || undefined };
  if (Number.isFinite(Number(normalized.id))) productCache.set(Number(normalized.id), normalized);
  return normalized;
}

function injectVideoMarker(product: RuntimeProduct): RuntimeProduct {
  const contents = (Array.isArray(product.contents) ? product.contents : [])
    .map((entry) => String(entry || ''))
    .filter((entry) => !entry.startsWith(VIDEO_MARKER));
  if (draftVideoUrl) contents.push(`${VIDEO_MARKER}${draftVideoUrl}`);
  const { video_url: _video, ...rest } = product;
  return { ...rest, contents } as RuntimeProduct;
}

function slugify(text: string) {
  return text
    .toLowerCase()
    .replace(/[\s_]+/g, '-')
    .replace(/[^؀-ۿa-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function currentLandingProduct(): RuntimeProduct | undefined {
  const match = window.location.pathname.match(/^\/lp\/([^/?#]+)/);
  if (!match) return undefined;
  const slug = decodeURIComponent(match[1]);
  const id = Number(slug);
  const products = [...productCache.values()];
  if (Number.isFinite(id)) return productCache.get(id);
  return products.find((product) => slugify(product.name) === slug);
}

function productFromAdminModal(modal: HTMLElement): RuntimeProduct | undefined {
  const input = modal.querySelector<HTMLInputElement>('input[placeholder="اسم المنتج"]');
  const name = input?.value?.trim();
  if (!name) return undefined;
  return [...productCache.values()].find((product) => product.name === name);
}

function pathFromVideoUrl(url: string): string {
  if (!url) return '';
  try {
    const parsed = new URL(url, window.location.origin);
    const marker = '/storage/v1/object/public/product-videos/';
    const index = parsed.pathname.indexOf(marker);
    if (index < 0) return '';
    return decodeURIComponent(parsed.pathname.slice(index + marker.length));
  } catch {
    return '';
  }
}

function ensureStyles() {
  if (document.getElementById('miraj-product-video-styles')) return;
  const style = document.createElement('style');
  style.id = 'miraj-product-video-styles';
  style.textContent = `
    .miraj-product-video-field{border:1px solid rgba(24,60,107,.22);border-radius:14px;padding:14px;background:rgba(239,246,255,.55)}
    .dark .miraj-product-video-field{background:rgba(15,23,42,.42);border-color:rgba(59,130,246,.28)}
    .miraj-product-video-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:10px}
    .miraj-product-video-title{font-size:14px;font-weight:800;color:#374151}.dark .miraj-product-video-title{color:#e5e7eb}
    .miraj-product-video-help{font-size:11px;color:#6b7280;margin-top:3px}.dark .miraj-product-video-help{color:#9ca3af}
    .miraj-product-video-box{display:flex;gap:12px;align-items:stretch;flex-wrap:wrap}
    .miraj-product-video-preview{width:180px;max-width:100%;aspect-ratio:16/9;border-radius:12px;background:#071226;object-fit:contain;display:block}
    .miraj-product-video-actions{flex:1;min-width:190px;display:flex;flex-direction:column;justify-content:center;gap:8px}
    .miraj-product-video-btn{border:0;border-radius:11px;padding:9px 12px;font-size:12px;font-weight:800;cursor:pointer;background:#183c6b;color:#fff}
    .miraj-product-video-btn.secondary{background:#fff;color:#183c6b;border:1px solid #cbd5e1}.dark .miraj-product-video-btn.secondary{background:#111827;color:#93c5fd;border-color:#374151}
    .miraj-product-video-btn.danger{background:#fff;color:#b91c1c;border:1px solid #fecaca}.dark .miraj-product-video-btn.danger{background:#111827;color:#fca5a5;border-color:#7f1d1d}
    .miraj-product-video-btn:disabled{opacity:.55;cursor:not-allowed}
    .miraj-product-video-progress{height:6px;background:#dbeafe;border-radius:999px;overflow:hidden}.miraj-product-video-progress>span{display:block;height:100%;background:#183c6b;transition:width .2s}
    .miraj-product-video-status{font-size:11px;font-weight:700;color:#64748b}.dark .miraj-product-video-status{color:#94a3b8}
    .miraj-product-video-landing{margin:18px 0;padding:14px;border-radius:18px;background:#fff;border:1px solid #e5e7eb;box-shadow:0 8px 28px rgba(11,24,51,.08)}
    .miraj-product-video-landing h3{font-size:15px;font-weight:900;color:#0b1833;margin:0 0 10px;text-align:right}
    .miraj-product-video-landing video{display:block;width:100%;max-height:520px;border-radius:14px;background:#050b15;object-fit:contain}
    @media(max-width:520px){.miraj-product-video-preview{width:100%}.miraj-product-video-actions{min-width:100%}.miraj-product-video-landing{margin:14px 0;padding:10px}}
  `;
  document.head.appendChild(style);
}

function renderAdminVideoSection(section: HTMLElement) {
  const preview = section.querySelector<HTMLVideoElement>('video');
  const status = section.querySelector<HTMLElement>('[data-video-status]');
  const progress = section.querySelector<HTMLElement>('[data-video-progress]');
  const uploadButton = section.querySelector<HTMLButtonElement>('[data-video-upload]');
  const removeButton = section.querySelector<HTMLButtonElement>('[data-video-remove]');

  if (preview) {
    const src = draftVideoPreview || draftVideoUrl;
    if (src) {
      if (preview.src !== src) preview.src = src;
      preview.style.display = 'block';
    } else {
      preview.removeAttribute('src');
      preview.style.display = 'none';
    }
  }
  if (status) status.textContent = uploadBusy ? `جاري رفع الفيديو... ${uploadPercent}%` : (draftVideoUrl ? '✅ فيديو مضاف إلى المنتج' : 'لا يوجد فيديو لهذا المنتج');
  if (progress) {
    progress.parentElement!.style.display = uploadBusy ? 'block' : 'none';
    progress.style.width = `${uploadPercent}%`;
  }
  if (uploadButton) {
    uploadButton.disabled = uploadBusy;
    uploadButton.textContent = uploadBusy ? '⏳ جاري الرفع...' : (draftVideoUrl ? '🔄 تغيير الفيديو' : '📤 إضافة فيديو');
  }
  if (removeButton) removeButton.style.display = draftVideoUrl ? 'block' : 'none';
}

function installAdminVideoSection() {
  const headings = [...document.querySelectorAll<HTMLElement>('h3')];
  const heading = headings.find((node) => node.textContent?.includes('إضافة منتج جديد') || node.textContent?.includes('تعديل المنتج'));
  if (!heading) return;
  const modal = heading.closest<HTMLElement>('.fixed');
  if (!modal) return;

  let section = modal.querySelector<HTMLElement>('[data-miraj-product-video]');
  if (!section) {
    const body = modal.querySelector<HTMLElement>('.p-6.space-y-4');
    const nameInput = modal.querySelector<HTMLInputElement>('input[placeholder="اسم المنتج"]');
    if (!body || !nameInput) return;

    const existing = productFromAdminModal(modal);
    draftVideoUrl = String(existing?.video_url || '');
    draftVideoPath = pathFromVideoUrl(draftVideoUrl);
    draftVideoPreview = draftVideoUrl;
    uploadBusy = false;
    uploadPercent = 0;

    section = document.createElement('div');
    section.dataset.mirajProductVideo = '1';
    section.className = 'miraj-product-video-field';
    section.innerHTML = `
      <div class="miraj-product-video-head">
        <div><div class="miraj-product-video-title">🎬 فيديو المنتج <span style="font-weight:500;color:#64748b">— اختياري</span></div><div class="miraj-product-video-help">${productVideoLimitLabel()} · يُحفظ في Supabase Storage وليس داخل قاعدة البيانات</div></div>
      </div>
      <div class="miraj-product-video-box">
        <video controls preload="metadata" playsinline class="miraj-product-video-preview"></video>
        <div class="miraj-product-video-actions">
          <button type="button" class="miraj-product-video-btn" data-video-upload>📤 إضافة فيديو</button>
          <button type="button" class="miraj-product-video-btn danger" data-video-remove>🗑️ إزالة الفيديو</button>
          <input type="file" accept="video/mp4,video/webm" hidden data-video-input />
          <div class="miraj-product-video-progress" style="display:none"><span data-video-progress style="width:0%"></span></div>
          <div class="miraj-product-video-status" data-video-status></div>
        </div>
      </div>`;

    const firstChild = body.firstElementChild;
    if (firstChild?.nextSibling) body.insertBefore(section, firstChild.nextSibling);
    else body.appendChild(section);

    const input = section.querySelector<HTMLInputElement>('[data-video-input]')!;
    const uploadButton = section.querySelector<HTMLButtonElement>('[data-video-upload]')!;
    const removeButton = section.querySelector<HTMLButtonElement>('[data-video-remove]')!;

    uploadButton.addEventListener('click', () => input.click());
    input.addEventListener('change', async () => {
      const file = input.files?.[0];
      input.value = '';
      if (!file || uploadBusy) return;
      const error = validateProductVideo(file);
      if (error) {
        window.alert(error);
        return;
      }
      const objectPreview = URL.createObjectURL(file);
      draftVideoPreview = objectPreview;
      uploadBusy = true;
      uploadPercent = 5;
      renderAdminVideoSection(section!);
      const result = await uploadProductVideo(file, (percent) => {
        uploadPercent = percent;
        renderAdminVideoSection(section!);
      });
      uploadBusy = false;
      if (result.ok) {
        draftVideoUrl = result.url;
        draftVideoPath = result.path;
        draftVideoPreview = result.playbackUrl || result.url;
        uploadPercent = 100;
      } else {
        draftVideoPreview = draftVideoUrl;
        uploadPercent = 0;
        window.alert(result.error);
      }
      URL.revokeObjectURL(objectPreview);
      renderAdminVideoSection(section!);
    });

    removeButton.addEventListener('click', () => {
      if (!window.confirm('إزالة الفيديو من هذا المنتج؟ سيتم تطبيق التغيير عند حفظ المنتج.')) return;
      draftVideoUrl = '';
      draftVideoPath = '';
      draftVideoPreview = '';
      uploadPercent = 0;
      renderAdminVideoSection(section!);
    });
  }
  renderAdminVideoSection(section);
}

function installLandingVideo() {
  if (!window.location.pathname.startsWith('/lp/')) return;
  const product = currentLandingProduct();
  if (!product?.video_url) return;
  if (document.querySelector('[data-miraj-landing-video]')) return;

  const headings = [...document.querySelectorAll<HTMLElement>('h1,h2')];
  const productHeading = headings.find((node) => node.textContent?.trim() === product.name);
  if (!productHeading) return;

  // Find the main product layout and place the video immediately after it,
  // before long description/FAQ sections. Fallback: after the heading block.
  const layout = productHeading.closest<HTMLElement>('.grid');
  const insertionParent = layout?.parentElement || productHeading.parentElement?.parentElement;
  const anchor = layout || productHeading.parentElement;
  if (!insertionParent || !anchor) return;

  const section = document.createElement('section');
  section.dataset.mirajLandingVideo = '1';
  section.className = 'miraj-product-video-landing';
  section.innerHTML = `<h3>🎬 شاهد المنتج عن قرب</h3><video controls preload="metadata" playsinline src="${String(product.video_url).replace(/"/g, '&quot;')}"></video>`;
  anchor.insertAdjacentElement('afterend', section);
}

function scheduleEnhancements() {
  window.requestAnimationFrame(() => {
    installAdminVideoSection();
    installLandingVideo();
  });
}

function installFetchBridge() {
  const originalFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    let nextInit = init;

    if (url.includes('/api/products') && (init?.method || 'GET').toUpperCase() === 'POST' && typeof init?.body === 'string') {
      try {
        const body = JSON.parse(init.body);
        if (body?.action === 'save' && body?.product && document.querySelector('[data-miraj-product-video]')) {
          body.product = injectVideoMarker(body.product as RuntimeProduct);
          nextInit = { ...init, body: JSON.stringify(body) };
        }
      } catch {
        // Leave unrelated/invalid bodies untouched.
      }
    }

    const response = await originalFetch(input, nextInit);

    if (url.includes('/api/products') && (init?.method || 'GET').toUpperCase() === 'GET' && !url.includes('media=1') && response.headers.get('content-type')?.includes('application/json')) {
      try {
        const payload = await response.clone().json();
        if (payload?.ok && Array.isArray(payload.data)) {
          payload.data = payload.data.map((product: RuntimeProduct) => extractVideo(product));
          scheduleEnhancements();
          return new Response(JSON.stringify(payload), {
            status: response.status,
            statusText: response.statusText,
            headers: response.headers,
          });
        }
      } catch {
        // Return the original response unchanged.
      }
    }

    return response;
  };
}

export function installProductVideoEnhancement() {
  if (installed || typeof window === 'undefined') return;
  installed = true;
  ensureStyles();
  installFetchBridge();

  const observer = new MutationObserver(() => scheduleEnhancements());
  const start = () => {
    observer.observe(document.documentElement, { childList: true, subtree: true });
    scheduleEnhancements();
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();

  window.addEventListener('popstate', scheduleEnhancements);
}
