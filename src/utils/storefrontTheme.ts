type StorefrontTheme = 'light' | 'dark';

const STORAGE_KEY = 'miraj-storefront-theme-v1';
const THEME_ATTR = 'data-storefront-theme';
let observer: MutationObserver | null = null;
let syncQueued = false;

function isPublicStorefront() {
  if (typeof window === 'undefined') return false;
  const path = window.location.pathname.toLowerCase();
  return !path.startsWith('/admin') && !path.startsWith('/dashboard');
}

function readTheme(): StorefrontTheme {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === 'dark' ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

function saveTheme(theme: StorefrontTheme) {
  try {
    window.localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // localStorage can be unavailable in strict/private browser contexts.
  }
}

function moonIcon() {
  return `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M20.2 15.2A8.35 8.35 0 0 1 8.8 3.8 8.4 8.4 0 1 0 20.2 15.2Z" />
    </svg>`;
}

function sunIcon() {
  return `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="3.6" />
      <path d="M12 2.4v2M12 19.6v2M4.8 4.8l1.4 1.4M17.8 17.8l1.4 1.4M2.4 12h2M19.6 12h2M4.8 19.2l1.4-1.4M17.8 6.2l1.4-1.4" />
    </svg>`;
}

function updateToggle(button: HTMLButtonElement, theme: StorefrontTheme) {
  const dark = theme === 'dark';
  button.innerHTML = dark ? sunIcon() : moonIcon();
  button.setAttribute('aria-label', dark ? 'تفعيل الوضع الفاتح' : 'تفعيل الوضع الليلي');
  button.setAttribute('title', dark ? 'الوضع الفاتح' : 'الوضع الليلي');
  button.setAttribute('aria-pressed', String(dark));
}

function applyTheme(theme: StorefrontTheme) {
  if (!isPublicStorefront()) {
    document.documentElement.removeAttribute(THEME_ATTR);
    return;
  }

  document.documentElement.setAttribute(THEME_ATTR, theme);
  document.documentElement.style.colorScheme = theme;

  document.querySelectorAll<HTMLButtonElement>('.miraj-theme-toggle').forEach(button => {
    updateToggle(button, theme);
  });
}

function toggleTheme() {
  const next: StorefrontTheme = readTheme() === 'dark' ? 'light' : 'dark';
  saveTheme(next);
  applyTheme(next);
}

function ensureToggle() {
  if (!isPublicStorefront()) return;

  const header = document.querySelector('header.bg-white.shadow-md.sticky.top-0.z-50');
  if (!(header instanceof HTMLElement)) return;

  const headerRow = header.querySelector(':scope > div.max-w-7xl');
  if (!(headerRow instanceof HTMLElement)) return;

  const actionGroup = headerRow.lastElementChild;
  if (!(actionGroup instanceof HTMLElement)) return;

  // Only inject into the storefront header action group (search + cart), never a landing/admin header.
  if (!actionGroup.querySelector('input[placeholder="ابحث..."]')) return;
  if (actionGroup.querySelector('.miraj-theme-toggle')) return;

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'miraj-theme-toggle';
  button.setAttribute('data-ui-hover-sound', 'true');
  updateToggle(button, readTheme());
  button.addEventListener('click', toggleTheme);

  const cartButton = actionGroup.querySelector('button.relative');
  if (cartButton) actionGroup.insertBefore(button, cartButton);
  else actionGroup.appendChild(button);
}

function syncStorefrontTheme() {
  if (!isPublicStorefront()) {
    document.documentElement.removeAttribute(THEME_ATTR);
    document.documentElement.style.colorScheme = '';
    return;
  }

  applyTheme(readTheme());
  ensureToggle();
}

function queueSync() {
  if (syncQueued) return;
  syncQueued = true;
  queueMicrotask(() => {
    syncQueued = false;
    syncStorefrontTheme();
  });
}

export function installStorefrontTheme() {
  if (typeof document === 'undefined' || typeof window === 'undefined') return;

  // Apply before React paints where possible, keeping light as the intentional default.
  syncStorefrontTheme();

  window.addEventListener('popstate', queueSync);

  const startObserver = () => {
    if (observer || !document.body) return;
    observer = new MutationObserver(queueSync);
    observer.observe(document.body, { childList: true, subtree: true });
    queueSync();
  };

  if (document.body) startObserver();
  else document.addEventListener('DOMContentLoaded', startObserver, { once: true });
}
