// ============================================================
// Shared bot-only HTML renderer for social-preview crawlers
// ============================================================
// IMPORTANT: this file lives OUTSIDE api/ on purpose. Vercel (on this
// project's Hobby plan) turns every .js file directly under api/ into its
// own Serverless Function, and the Hobby plan caps a deployment at 12
// functions total. The project was already at exactly 12 before this code
// existed; a separate api/social-preview.js pushed it to 13 and silently
// failed every production deployment (errorCode:
// exceeded_serverless_functions_per_deployment). Keeping this as a plain
// imported module (bundled into the caller's function, not a function of
// its own) is what keeps the count at 12. Do not move this file into api/.
// ============================================================

export const SITE_URL = 'https://elm3raj.com';
export const SITE_NAME = 'Al Miraj Education';
export const FALLBACK_IMAGE = `${SITE_URL}/og-image.jpg`;
export const FALLBACK_TITLE = 'المعراج للوسائل التعليمية | Al Miraj Education';
export const FALLBACK_DESC = 'وسائل تعليمية وموارد احترافية تساعد الأستاذ على تحضير دروسه وتقديم حصص أكثر تنظيماً وتفاعلاً.';

/** Minimal, dependency-free HTML-attribute escaping. */
export function esc(v) {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Collapse whitespace/newlines/emoji-heavy descriptions into one clean preview line. */
export function toPreviewText(raw, maxLen = 200) {
  const clean = String(raw || '').replace(/\s+/g, ' ').trim();
  if (clean.length <= maxLen) return clean;
  return clean.slice(0, maxLen - 1).trimEnd() + '…';
}

/**
 * Renders a small standalone HTML document with correct Open Graph / Twitter
 * Card tags for a single product or landing page. Only ever reached by
 * known social-crawler User-Agents via the `has` header rewrites in
 * vercel.json — real visitors always get the normal React SPA.
 */
export function renderSocialPreviewHtml({ title, description, image, url, type, priceAmount, priceCurrency }) {
  const productTags = type === 'product' && priceAmount != null
    ? `\n<meta property="product:price:amount" content="${esc(priceAmount)}" />\n<meta property="product:price:currency" content="${esc(priceCurrency || 'DZD')}" />\n<meta property="product:availability" content="in stock" />\n<meta property="product:condition" content="new" />`
    : '';

  return `<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8" />
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}" />
<link rel="canonical" href="${esc(url)}" />
<meta property="og:type" content="${type === 'product' ? 'product' : 'website'}" />
<meta property="og:title" content="${esc(title)}" />
<meta property="og:description" content="${esc(description)}" />
<meta property="og:url" content="${esc(url)}" />
<meta property="og:image" content="${esc(image)}" />
<meta property="og:site_name" content="${esc(SITE_NAME)}" />
<meta property="og:locale" content="ar_DZ" />${productTags}
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${esc(title)}" />
<meta name="twitter:description" content="${esc(description)}" />
<meta name="twitter:image" content="${esc(image)}" />
</head>
<body>
<p><a href="${esc(url)}">${esc(title)}</a></p>
</body>
</html>
`;
}
