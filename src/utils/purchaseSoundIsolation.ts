const PURCHASE_SOUND_LABELS = [
  'أضف للعربة',
  'أضف إلى العربة',
  'اشتري الآن',
  'اشترِ الآن',
  'شراء الآن',
  'Add to Cart',
  'Buy Now',
];

const STORE_PURCHASE_FLOW_LABELS = [
  ...PURCHASE_SOUND_LABELS,
  'إتمام الطلب',
  'اتمام الطلب',
  'إكمال الطلب',
  'اكمال الطلب',
  'تأكيد الطلب',
  'تاكيد الطلب',
  'اطلب الآن',
  'اطلب الان',
  'Order Now',
  'Checkout',
  'Place Order',
];

function isPublicStorefront() {
  if (typeof window === 'undefined') return false;
  const path = window.location.pathname.toLowerCase();
  return !path.startsWith('/admin') && !path.startsWith('/dashboard');
}

function getButtonLabel(button: HTMLButtonElement) {
  return (button.textContent || '').replace(/\s+/g, ' ').trim();
}

function shouldKeepOriginalSound(button: HTMLButtonElement) {
  const label = getButtonLabel(button);
  return PURCHASE_SOUND_LABELS.some(text => label.includes(text));
}

function isStorePurchaseFlowButton(button: HTMLButtonElement) {
  // The assistant has its own checkout controls. Those must never close
  // the assistant while the customer is ordering inside the chat itself.
  if (button.closest('.miraj-ai')) return false;

  const label = getButtonLabel(button);
  return STORE_PURCHASE_FLOW_LABELS.some(text => label.includes(text));
}

function closeAssistantPanel() {
  const panel = document.querySelector<HTMLElement>('.miraj-ai__panel');
  if (!panel) return;

  // Use the assistant's existing React close button so its internal `open`
  // state stays correct. Do not manipulate panel CSS directly.
  const closeButton = panel.querySelector<HTMLButtonElement>('.miraj-ai__header > button');
  closeButton?.click();
}

function installAssistantAutoClose() {
  document.addEventListener('click', event => {
    if (!isPublicStorefront()) return;

    const target = event.target;
    if (!(target instanceof Element)) return;

    const button = target.closest('button');
    if (!(button instanceof HTMLButtonElement)) return;
    if (!isStorePurchaseFlowButton(button)) return;

    closeAssistantPanel();
  }, true);
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

  installAssistantAutoClose();

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
