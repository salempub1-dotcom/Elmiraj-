/**
 * Facebook Pixel Integration
 * Pixel ID: 852210374033980
 */

const FB_PIXEL_ID = '852210374033980';

declare global {
  interface Window {
    fbq: any;
    _fbq: any;
  }
}

export function initFacebookPixel() {
  if (typeof window === 'undefined' || window.fbq) return;

  const f: any = window;
  const b = document;
  const n = 'script';

  if (f.fbq) return;
  const fbq: any = f.fbq = function () {
    fbq.callMethod ? fbq.callMethod.apply(fbq, arguments) : fbq.queue.push(arguments);
  };
  if (!f._fbq) f._fbq = fbq;
  fbq.push = fbq;
  fbq.loaded = true;
  fbq.version = '2.0';
  fbq.queue = [];

  const e = b.createElement(n) as HTMLScriptElement;
  e.async = true;
  e.src = 'https://connect.facebook.net/en_US/fbevents.js';
  const s = b.getElementsByTagName(n)[0];
  s?.parentNode?.insertBefore(e, s);

  window.fbq('init', FB_PIXEL_ID);
  window.fbq('track', 'PageView');
}

export function trackPageView() {
  if (window.fbq) {
    window.fbq('track', 'PageView');
  }
}

export function trackViewContent(productName: string, price: number, category: string) {
  if (window.fbq) {
    window.fbq('track', 'ViewContent', {
      content_name: productName,
      content_category: category,
      value: price,
      currency: 'DZD',
    });
  }
}

export function trackAddToCart(productName: string, price: number, quantity: number) {
  if (window.fbq) {
    window.fbq('track', 'AddToCart', {
      content_name: productName,
      value: price * quantity,
      currency: 'DZD',
      num_items: quantity,
    });
  }
}

export function trackInitiateCheckout(numItems: number, totalValue: number) {
  if (window.fbq) {
    window.fbq('track', 'InitiateCheckout', {
      num_items: numItems,
      value: totalValue,
      currency: 'DZD',
    });
  }
}

export function trackPurchase(orderId: string, totalValue: number, products: string[]) {
  if (window.fbq) {
    window.fbq('track', 'Purchase', {
      value: totalValue,
      currency: 'DZD',
      content_ids: products,
      order_id: orderId,
      num_items: products.length,
    });
  }
}
