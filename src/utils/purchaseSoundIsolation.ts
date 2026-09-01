const PURCHASE_SOUND_LABELS = [
  'أضف للعربة',
  'أضف إلى العربة',
  'اشتري الآن',
  'اشترِ الآن',
  'شراء الآن',
];

function isPublicStorefront() {
  if (typeof window === 'undefined') return false;
  const path = window.location.pathname.toLowerCase();
  return !path.startsWith('/admin') && !path.startsWith('/dashboard');
}

function shouldKeepOriginalSound(button: HTMLButtonElement) {
  const label = (button.textContent || '').replace(/\s+/g, ' ').trim();
  return PURCHASE_SOUND_LABELS.some(text => label.includes(text));
}

function markPurchaseButtons(root: ParentNode = document) {
  if (!isPublicStorefront()) return;

  root.querySelectorAll<HTMLButtonElement>('button').forEach(button => {
    if (shouldKeepOriginalSound(button)) {
      // The global UI click sound respects this attribute. The button's
      // existing product-specific sound/callback remains untouched.
      button.setAttribute('data-ui-sound', 'off');
    }
  });
}

export function installPurchaseSoundIsolation() {
  if (typeof document === 'undefined' || typeof window === 'undefined') return;

  const run = () => markPurchaseButtons(document);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run, { once: true });
  } else {
    run();
  }

  const startObserver = () => {
    if (!document.body) return;

    const observer = new MutationObserver(records => {
      for (const record of records) {
        for (const node of Array.from(record.addedNodes)) {
          if (!(node instanceof Element)) continue;

          if (node instanceof HTMLButtonElement && shouldKeepOriginalSound(node)) {
            node.setAttribute('data-ui-sound', 'off');
          }

          markPurchaseButtons(node);
        }
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });
  };

  if (document.body) startObserver();
  else document.addEventListener('DOMContentLoaded', startObserver, { once: true });
}
