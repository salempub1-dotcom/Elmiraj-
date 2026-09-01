type StorefrontLanguage = 'ar' | 'en';

const STORAGE_KEY = 'miraj-storefront-language-v1';
const LANG_ATTR = 'data-storefront-lang';
let observer: MutationObserver | null = null;
let syncQueued = false;

const AR_TO_EN: Record<string, string> = {
  'المعراج': 'Al Miraj',
  'متجر تعليمي للأساتذة': 'Educational Resources for Teachers',
  '🎓 منصة المعراج التعليمية | 🚚 التوصيل متوفر لجميع ولايات الجزائر | 💵 الدفع عند الاستلام': '🎓 Al Miraj Education | 🚚 Delivery across Algeria | 💵 Cash on delivery',
  '🏠 الرئيسية': '🏠 Home',
  '📚 المنتجات': '📚 Products',
  '🔍 تتبع الطلب': '🔍 Track Order',
  '📞 اتصل بنا': '📞 Contact Us',
  'أدوات تعليمية مبتكرة': 'Innovative Teaching Tools',
  'لأساتذة المستقبل': 'For the Teachers of Tomorrow',
  'تصفح المنتجات': 'Browse Products',
  'اكتشف حسب الطور': 'Explore by Level',
  'تحضيري': 'Preschool',
  'ابتدائي': 'Primary',
  'متوسط': 'Middle School',
  'لماذا يختار الأساتذة المعراج؟': 'Why Teachers Choose Al Miraj',
  'مطابقة للدليل الديداكتيكي': 'Aligned with Teaching Guidelines',
  'محتوى ووسائل مصممة لتنسجم مع متطلبات الدروس.': 'Resources designed to match lesson requirements.',
  'جاهزة للاستعمال': 'Ready to Use',
  'وسائل عملية تقلل وقت التحضير وتساعد الأستاذ داخل القسم.': 'Practical resources that save preparation time in class.',
  'مصممة للأستاذ الجزائري': 'Made for Algerian Teachers',
  'منتجات تراعي المنهاج وواقع القسم الجزائري.': 'Resources adapted to the Algerian curriculum and classroom.',
  'الأكثر طلبًا لدى الأساتذة': 'Most Popular with Teachers',
  'عرض جميع المنتجات': 'View All Products',
  '🛒 أضف للعربة': '🛒 Add to Cart',
  '🛒 أضف إلى العربة': '🛒 Add to Cart',
  '⚡ اشتري الآن': '⚡ Buy Now',
  'شاهد وسائل المعراج داخل القسم': 'See Al Miraj Resources in the Classroom',
  'وسائل تعليمية صُممت لتكون عملية، واضحة وسهلة الاستخدام أثناء الحصة.': 'Teaching resources designed to be practical, clear and easy to use in class.',
  'شرح أوضح': 'Clearer Explanations',
  'تساعد الصور والبطاقات البصرية على تقديم المعلومة بطريقة مباشرة.': 'Visual cards and images help present information more clearly.',
  'تفاعل أكبر': 'More Engagement',
  'وسائل تساعد على إشراك التلاميذ أثناء الحصة بدل الاكتفاء بالشرح التقليدي.': 'Resources that help involve students actively during the lesson.',
  'جاهزة للقسم': 'Classroom Ready',
  'مواد عملية يمكن للأستاذ استعمالها مباشرة أثناء الدرس.': 'Practical materials teachers can use directly during lessons.',
  'اكتشف الوسائل التعليمية': 'Explore Teaching Resources',
  'جميع المنتجات': 'All Products',
  'السلة فارغة': 'Your cart is empty',
  '✅ إتمام الطلب': '✅ Checkout',
  '📦 إتمام الطلب': '📦 Checkout',
  'المجموع': 'Total',
  'التوصيل': 'Delivery',
  'الاسم الكامل': 'Full Name',
  'رقم الهاتف': 'Phone Number',
  'الولاية': 'Province',
  'البلدية': 'Municipality',
  'العنوان': 'Address',
  'توصيل للمنزل': 'Home Delivery',
  'توصيل للمكتب': 'Pickup Point',
  'الدفع عند الاستلام': 'Cash on Delivery',
  'تأكيد الطلب': 'Confirm Order',
  'متابعة التسوق': 'Continue Shopping',
  'إغلاق': 'Close',
  'رجوع': 'Back',
  'الكمية': 'Quantity',
  'السعر': 'Price',
  'المتوفر': 'Available',
  'غير متوفر': 'Out of Stock',
  'تفاصيل المنتج': 'Product Details',
  'تتبع الطلب': 'Track Order',
  'رقم الطلب': 'Order Number',
  'ابحث': 'Search',
};

const EN_TO_AR = Object.fromEntries(Object.entries(AR_TO_EN).map(([ar, en]) => [en, ar])) as Record<string, string>;

const PLACEHOLDERS_AR_TO_EN: Record<string, string> = {
  'ابحث...': 'Search...',
  'ابحث عن منتج...': 'Search products...',
  'أدخل الاسم الكامل': 'Enter full name',
  'أدخل رقم الهاتف': 'Enter phone number',
  'أدخل العنوان': 'Enter address',
  'اختر الولاية': 'Select province',
  'اختر البلدية': 'Select municipality',
  'أدخل رقم الطلب': 'Enter order number',
};
const PLACEHOLDERS_EN_TO_AR = Object.fromEntries(Object.entries(PLACEHOLDERS_AR_TO_EN).map(([ar, en]) => [en, ar])) as Record<string, string>;

function isPublicStorefront() {
  if (typeof window === 'undefined') return false;
  const path = window.location.pathname.toLowerCase();
  return !path.startsWith('/admin') && !path.startsWith('/dashboard');
}

function readLanguage(): StorefrontLanguage {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === 'en' ? 'en' : 'ar';
  } catch {
    return 'ar';
  }
}

function saveLanguage(language: StorefrontLanguage) {
  try {
    window.localStorage.setItem(STORAGE_KEY, language);
  } catch {
    // Ignore storage restrictions.
  }
}

function translateTextValue(value: string, language: StorefrontLanguage) {
  const leading = value.match(/^\s*/)?.[0] ?? '';
  const trailing = value.match(/\s*$/)?.[0] ?? '';
  const core = value.trim();
  if (!core) return value;

  const dictionary = language === 'en' ? AR_TO_EN : EN_TO_AR;
  if (dictionary[core]) return `${leading}${dictionary[core]}${trailing}`;

  if (language === 'en') {
    const cartMatch = core.match(/^🛒 سلة التسوق \((\d+)\)$/);
    if (cartMatch) return `${leading}🛒 Shopping Cart (${cartMatch[1]})${trailing}`;

    const toastMatch = core.match(/^تمت إضافة "(.+)" إلى السلة$/);
    if (toastMatch) return `${leading}"${toastMatch[1]}" added to cart${trailing}`;

    const dzdMatch = core.match(/^([\d\s.,]+)\s*دج$/);
    if (dzdMatch) return `${leading}${dzdMatch[1].trim()} DZD${trailing}`;
  } else {
    const cartMatch = core.match(/^🛒 Shopping Cart \((\d+)\)$/);
    if (cartMatch) return `${leading}🛒 سلة التسوق (${cartMatch[1]})${trailing}`;

    const toastMatch = core.match(/^"(.+)" added to cart$/);
    if (toastMatch) return `${leading}تمت إضافة "${toastMatch[1]}" إلى السلة${trailing}`;

    const dzdMatch = core.match(/^([\d\s.,]+)\s*DZD$/);
    if (dzdMatch) return `${leading}${dzdMatch[1].trim()} دج${trailing}`;
  }

  return value;
}

function translateElement(element: Element, language: StorefrontLanguage) {
  if (element.closest('[data-storefront-no-translate="true"]')) return;
  if (element.closest('script, style, textarea')) return;

  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  while (walker.nextNode()) nodes.push(walker.currentNode as Text);
  nodes.forEach(node => {
    const next = translateTextValue(node.nodeValue ?? '', language);
    if (next !== node.nodeValue) node.nodeValue = next;
  });

  element.querySelectorAll<HTMLInputElement>('input[placeholder]').forEach(input => {
    const dictionary = language === 'en' ? PLACEHOLDERS_AR_TO_EN : PLACEHOLDERS_EN_TO_AR;
    const current = input.getAttribute('placeholder') ?? '';
    const next = dictionary[current];
    if (next) input.setAttribute('placeholder', next);
  });
}

function updateToggle(button: HTMLButtonElement, language: StorefrontLanguage) {
  button.classList.toggle('is-en', language === 'en');
  button.classList.toggle('is-ar', language === 'ar');
  button.innerHTML = '<span class="miraj-lang-ar">AR</span><span class="miraj-lang-sep">/</span><span class="miraj-lang-en">EN</span>';
  button.setAttribute('aria-label', language === 'ar' ? 'Switch to English' : 'التبديل إلى العربية');
  button.setAttribute('title', language === 'ar' ? 'English' : 'العربية');
}

function applyLanguage(language: StorefrontLanguage) {
  if (!isPublicStorefront()) {
    document.documentElement.removeAttribute(LANG_ATTR);
    document.documentElement.lang = 'ar';
    document.documentElement.dir = 'rtl';
    return;
  }

  document.documentElement.setAttribute(LANG_ATTR, language);
  document.documentElement.lang = language;
  document.documentElement.dir = language === 'en' ? 'ltr' : 'rtl';

  if (document.body) translateElement(document.body, language);
  document.querySelectorAll<HTMLButtonElement>('.miraj-language-toggle').forEach(button => updateToggle(button, language));
}

function toggleLanguage() {
  const next: StorefrontLanguage = readLanguage() === 'ar' ? 'en' : 'ar';
  saveLanguage(next);
  applyLanguage(next);
}

function ensureToggle() {
  if (!isPublicStorefront()) return;

  const header = document.querySelector('header.bg-white.shadow-md.sticky.top-0.z-50');
  if (!(header instanceof HTMLElement)) return;

  const headerRow = header.querySelector(':scope > div.max-w-7xl');
  if (!(headerRow instanceof HTMLElement)) return;

  const actionGroup = headerRow.lastElementChild;
  if (!(actionGroup instanceof HTMLElement)) return;

  if (!actionGroup.querySelector('input[placeholder="ابحث..."], input[placeholder="Search..."]')) return;
  if (actionGroup.querySelector('.miraj-language-toggle')) return;

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'miraj-language-toggle';
  updateToggle(button, readLanguage());
  button.addEventListener('click', toggleLanguage);

  const themeButton = actionGroup.querySelector('.miraj-theme-toggle');
  const cartButton = actionGroup.querySelector('button.relative');
  if (themeButton) actionGroup.insertBefore(button, themeButton);
  else if (cartButton) actionGroup.insertBefore(button, cartButton);
  else actionGroup.appendChild(button);
}

function syncLanguage() {
  if (!isPublicStorefront()) {
    applyLanguage('ar');
    return;
  }
  applyLanguage(readLanguage());
  ensureToggle();
}

function queueSync() {
  if (syncQueued) return;
  syncQueued = true;
  queueMicrotask(() => {
    syncQueued = false;
    syncLanguage();
  });
}

export function installStorefrontLanguage() {
  if (typeof document === 'undefined' || typeof window === 'undefined') return;

  syncLanguage();
  window.addEventListener('popstate', queueSync);

  const startObserver = () => {
    if (observer || !document.body) return;
    observer = new MutationObserver(queueSync);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    queueSync();
  };

  if (document.body) startObserver();
  else document.addEventListener('DOMContentLoaded', startObserver, { once: true });
}
