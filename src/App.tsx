import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { cn } from './utils/cn';
import {
  createOrder,
  buildProductString,
  WILAYA_ID_MAP,
  getDesksByWilayaCode,
  type NoestOrderResponse,
} from './services/noestApi';

type Category = 'preparatory' | 'primary' | 'middle';
type OrderStatus = 'pending' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled';
type DeliveryType = 'desk' | 'home';
type AdminTab = 'dashboard' | 'orders' | 'products' | 'tracking';
type View = 'store' | 'admin';

interface Product {
  id: number;
  name: string;
  category: Category;
  price: number;
  image: string;
  images: string[];
  description: string;
  benefits: string[];
  stock: number;
  sales: number;
}

interface CartItem extends Product { quantity: number }

interface WilayaShipping {
  code: number;
  name: string;
  desk: number;
  home: number;
}

interface Order {
  id: string;
  customerName: string;
  phone: string;
  wilaya: string;
  address: string;
  items: Array<{ product: string; quantity: number; price: number }>;
  subtotal: number;
  shipping: number;
  grandTotal: number;
  status: OrderStatus;
  deliveryType: DeliveryType;
  createdAt: string;
}

interface Notification {
  id: string;
  type: 'new-order' | 'low-stock' | 'status-update';
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
}

// ==================== FACEBOOK PIXEL ====================
declare global {
  interface Window {
    fbq: (...args: unknown[]) => void;
  }
}

const fbTrack = (event: string, data?: Record<string, unknown>) => {
  try {
    if (typeof window !== 'undefined' && window.fbq) {
      window.fbq('track', event, data);
    }
  } catch (_) {}
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _placeholder = {
  16: [
    { name: 'placeholder' },
    { name: 'وكالة باب الزوار', address: 'حي باب الزوار، الجزائر', phone: '023 XX XX XX' },
    { name: 'وكالة بئر خادم', address: 'شارع حسيبة بن بوعلي، بئر خادم', phone: '023 XX XX XX' },
  ],
  35: [
    { name: 'وكالة بومرداس المركز', address: 'شارع الاستقلال، بومرداس', phone: '024 XX XX XX' },
    { name: 'وكالة بودواو', address: 'المركز التجاري بودواو', phone: '024 XX XX XX' },
  ],
  9: [
    { name: 'وكالة البليدة المركز', address: 'شارع أول نوفمبر، البليدة', phone: '025 XX XX XX' },
    { name: 'وكالة بوفاريك', address: 'شارع الشهداء، بوفاريك', phone: '025 XX XX XX' },
  ],
  42: [
    { name: 'وكالة تيبازة المركز', address: 'شارع الشهداء، تيبازة', phone: '024 XX XX XX' },
    { name: 'وكالة حجوط', address: 'الطريق الوطني رقم 11، حجوط', phone: '024 XX XX XX' },
  ],
  15: [
    { name: 'وكالة تيزي وزو المركز', address: 'شارع دوكالي، تيزي وزو', phone: '026 XX XX XX' },
    { name: 'وكالة ذراع بن خدة', address: 'شارع الشهداء، ذراع بن خدة', phone: '026 XX XX XX' },
  ],
  10: [
    { name: 'وكالة البويرة المركز', address: 'شارع الشهداء، البويرة', phone: '026 XX XX XX' },
  ],
  26: [
    { name: 'وكالة المدية المركز', address: 'شارع الشهداء، المدية', phone: '025 XX XX XX' },
  ],
  6: [
    { name: 'وكالة بجاية المركز', address: 'شارع الحرية، بجاية', phone: '034 XX XX XX' },
    { name: 'وكالة أكبو', address: 'شارع الاستقلال، أكبو', phone: '034 XX XX XX' },
  ],
  25: [
    { name: 'وكالة قسنطينة المركز', address: 'شارع بن مهيدي، قسنطينة', phone: '031 XX XX XX' },
    { name: 'وكالة الخروب', address: 'طريق الخروب، قسنطينة', phone: '031 XX XX XX' },
  ],
  31: [
    { name: 'وكالة وهران المركز', address: 'شارع السلام، وهران', phone: '041 XX XX XX' },
    { name: 'وكالة سيدي الشحمي', address: 'حي سيدي الشحمي، وهران', phone: '041 XX XX XX' },
  ],
  5: [
    { name: 'وكالة باتنة المركز', address: 'شارع الجمهورية، باتنة', phone: '033 XX XX XX' },
  ],
  23: [
    { name: 'وكالة عنابة المركز', address: 'شارع الشهداء، عنابة', phone: '038 XX XX XX' },
  ],
  19: [
    { name: 'وكالة سطيف المركز', address: 'شارع الاستقلال، سطيف', phone: '036 XX XX XX' },
  ],
  13: [
    { name: 'وكالة تلمسان المركز', address: 'شارع كولومبار، تلمسان', phone: '043 XX XX XX' },
  ],
  7: [
    { name: 'وكالة بسكرة المركز', address: 'شارع الثورة، بسكرة', phone: '033 XX XX XX' },
  ],
  30: [
    { name: 'وكالة ورقلة المركز', address: 'شارع الأمير عبد القادر، ورقلة', phone: '029 XX XX XX' },
  ],
  47: [
    { name: 'وكالة غرداية المركز', address: 'شارع الشهداء، غرداية', phone: '029 XX XX XX' },
  ],
  11: [
    { name: 'وكالة تمنراست المركز', address: 'شارع الاستقلال، تمنراست', phone: '029 XX XX XX' },
  ],
};

const wilayaShipping: WilayaShipping[] = [
  { code: 16, name: 'الجزائر', desk: 300, home: 500 },
  { code: 35, name: 'بومرداس', desk: 400, home: 600 },
  { code: 9, name: 'البليدة', desk: 400, home: 600 },
  { code: 42, name: 'تيبازة', desk: 400, home: 600 },
  { code: 15, name: 'تيزي وزو', desk: 450, home: 700 },
  { code: 10, name: 'البويرة', desk: 450, home: 700 },
  { code: 26, name: 'المدية', desk: 450, home: 700 },
  { code: 6, name: 'بجاية', desk: 500, home: 800 },
  { code: 34, name: 'برج بوعريريج', desk: 500, home: 800 },
  { code: 44, name: 'عين الدفلى', desk: 500, home: 800 },
  { code: 46, name: 'عين تموشنت', desk: 500, home: 800 },
  { code: 23, name: 'عنابة', desk: 500, home: 800 },
  { code: 5, name: 'باتنة', desk: 500, home: 800 },
  { code: 2, name: 'الشلف', desk: 500, home: 800 },
  { code: 25, name: 'قسنطينة', desk: 500, home: 800 },
  { code: 29, name: 'معسكر', desk: 500, home: 800 },
  { code: 43, name: 'ميلة', desk: 500, home: 800 },
  { code: 27, name: 'مستغانم', desk: 500, home: 800 },
  { code: 28, name: 'المسيلة', desk: 500, home: 800 },
  { code: 31, name: 'وهران', desk: 500, home: 800 },
  { code: 4, name: 'أم البواقي', desk: 500, home: 800 },
  { code: 48, name: 'غليزان', desk: 500, home: 800 },
  { code: 38, name: 'تيسمسيلت', desk: 500, home: 800 },
  { code: 13, name: 'تلمسان', desk: 500, home: 800 },
  { code: 19, name: 'سطيف', desk: 500, home: 800 },
  { code: 22, name: 'سيدي بلعباس', desk: 500, home: 800 },
  { code: 21, name: 'سكيكدة', desk: 500, home: 800 },
  { code: 18, name: 'جيجل', desk: 500, home: 800 },
  { code: 36, name: 'الطارف', desk: 600, home: 900 },
  { code: 24, name: 'قالمة', desk: 600, home: 900 },
  { code: 40, name: 'خنشلة', desk: 600, home: 900 },
  { code: 20, name: 'سعيدة', desk: 600, home: 900 },
  { code: 41, name: 'سوق أهراس', desk: 600, home: 900 },
  { code: 12, name: 'تبسة', desk: 600, home: 900 },
  { code: 14, name: 'تيارت', desk: 600, home: 900 },
  { code: 51, name: 'أولاد جلال', desk: 1000, home: 1000 },
  { code: 17, name: 'الجلفة', desk: 600, home: 1000 },
  { code: 3, name: 'الأغواط', desk: 600, home: 1000 },
  { code: 7, name: 'بسكرة', desk: 600, home: 1000 },
  { code: 47, name: 'غرداية', desk: 700, home: 1100 },
  { code: 39, name: 'الوادي', desk: 700, home: 1100 },
  { code: 57, name: 'المغير', desk: 1100, home: 1100 },
  { code: 30, name: 'ورقلة', desk: 700, home: 1100 },
  { code: 55, name: 'تقرت', desk: 700, home: 1100 },
  { code: 58, name: 'المنيعة', desk: 800, home: 1200 },
  { code: 32, name: 'البيض', desk: 800, home: 1200 },
  { code: 45, name: 'النعامة', desk: 800, home: 1200 },
  { code: 8, name: 'بشار', desk: 800, home: 1200 },
  { code: 52, name: 'بني عباس', desk: 1200, home: 1200 },
  { code: 1, name: 'أدرار', desk: 1000, home: 1500 },
  { code: 49, name: 'تيميمون', desk: 1000, home: 1500 },
  { code: 37, name: 'تندوف', desk: 1000, home: 1700 },
  { code: 53, name: 'عين صالح', desk: 1200, home: 1800 },
  { code: 33, name: 'إيليزي', desk: 1500, home: 1900 },
  { code: 11, name: 'تمنراست', desk: 1500, home: 2000 },
  { code: 56, name: 'جانت', desk: 2200, home: 2200 },
];

const initialProducts: Product[] = [
  {
    id: 1, name: 'بطاقات مغامرات الأبجدية', category: 'preparatory', price: 1200,
    image: 'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=400&h=300&fit=crop',
    images: [
      'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=800&h=600&fit=crop',
      'https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?w=800&h=600&fit=crop',
      'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=800&h=600&fit=crop',
    ],
    description: 'أداة مساعدة للأستاذ في تعليم الحروف الإنجليزية بطريقة تفاعلية وممتعة',
    benefits: ['تساعد الأستاذ في شرح الحروف بسهولة', 'تفعّل التلاميذ بتمارين الصوتيات', 'تعزز التعلم البصري داخل الفصل'],
    stock: 45, sales: 128
  },
  {
    id: 2, name: 'الأرقام والعد الممتع', category: 'preparatory', price: 950,
    image: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=400&h=300&fit=crop',
    images: [
      'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=800&h=600&fit=crop',
      'https://images.unsplash.com/photo-1509228468518-180dd4864904?w=800&h=600&fit=crop',
    ],
    description: 'بطاقات تفاعلية تساعد الأستاذ في تقديم مفاهيم الأرقام والعد بأسلوب جذاب',
    benefits: ['تُسهّل على الأستاذ تعليم الأرقام', 'تجعل التلاميذ يتفاعلون مع درس العد', 'تُثري حصة الرياضيات بالألعاب التعليمية'],
    stock: 38, sales: 94
  },
  {
    id: 3, name: 'مستكشف الألوان والأشكال', category: 'preparatory', price: 1100,
    image: 'https://images.unsplash.com/photo-1503454537195-1dcabb73ffb9?w=400&h=300&fit=crop',
    images: [
      'https://images.unsplash.com/photo-1503454537195-1dcabb73ffb9?w=800&h=600&fit=crop',
      'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=800&h=600&fit=crop',
    ],
    description: 'بطاقات ملونة تساعد الأستاذ على تعليم الألوان والأشكال الهندسية',
    benefits: ['تُوضّح الألوان والأشكال بصرياً', 'تُحفّز التفكير والملاحظة', 'تساعد الأستاذ في إدارة أنشطة جماعية'],
    stock: 52, sales: 73
  },
  {
    id: 4, name: 'أساسيات الفرنسية للمبتدئين', category: 'preparatory', price: 1300,
    image: 'https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?w=400&h=300&fit=crop',
    images: [
      'https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?w=800&h=600&fit=crop',
      'https://images.unsplash.com/photo-1434030216411-0b793f4b4173?w=800&h=600&fit=crop',
    ],
    description: 'بطاقات مفردات فرنسية تساعد الأستاذ في تقديم أساسيات اللغة الفرنسية',
    benefits: ['تُسهّل تعليم المفردات الفرنسية الأولى', 'تُرشد الأستاذ في تصحيح النطق', 'تُفعّل التلاميذ بمحادثات بسيطة'],
    stock: 29, sales: 61
  },
  {
    id: 5, name: 'بناء المفردات الإنجليزية', category: 'primary', price: 1350,
    image: 'https://images.unsplash.com/photo-1512820790803-83ca734da794?w=400&h=300&fit=crop',
    images: [
      'https://images.unsplash.com/photo-1512820790803-83ca734da794?w=800&h=600&fit=crop',
      'https://images.unsplash.com/photo-1456735190827-d1262f71b8a6?w=800&h=600&fit=crop',
    ],
    description: 'تساعد الأستاذ في إثراء حصة اللغة الإنجليزية وتجعل التلاميذ يتعلمون مفردات جديدة',
    benefits: ['تُوسّع مفردات التلاميذ بشكل ممتع', 'تُساعد الأستاذ في شرح التعريفات', 'أداة مثالية لتمارين الإملاء'],
    stock: 41, sales: 112
  },
  {
    id: 6, name: 'بطاقات قواعد اللغة الإنجليزية', category: 'primary', price: 1600,
    image: 'https://images.unsplash.com/photo-1456735190827-d1262f71b8a6?w=400&h=300&fit=crop',
    images: [
      'https://images.unsplash.com/photo-1456735190827-d1262f71b8a6?w=800&h=600&fit=crop',
      'https://images.unsplash.com/photo-1512820790803-83ca734da794?w=800&h=600&fit=crop',
      'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=800&h=600&fit=crop',
    ],
    description: 'أداة مساعدة للأستاذ في شرح قواعد اللغة الإنجليزية بأمثلة ملونة واضحة',
    benefits: ['تُبسّط للأستاذ شرح قواعد النحو', 'توضّح بنية الجملة بأمثلة حية', 'تُساعد التلاميذ على فهم الأزمنة'],
    stock: 35, sales: 88
  },
  {
    id: 7, name: 'الأفعال الفرنسية بسهولة', category: 'primary', price: 1700,
    image: 'https://images.unsplash.com/photo-1519681393784-d120267933ba?w=400&h=300&fit=crop',
    images: [
      'https://images.unsplash.com/photo-1519681393784-d120267933ba?w=800&h=600&fit=crop',
      'https://images.unsplash.com/photo-1434030216411-0b793f4b4173?w=800&h=600&fit=crop',
    ],
    description: 'تساعد الأستاذ في تبسيط تصريف الأفعال الفرنسية مع مساعدات بصرية',
    benefits: ['تُسهّل على الأستاذ شرح تصريف الأفعال', 'تُساعد التلاميذ على إتقان الأزمنة', 'تُفعّل بناء الجمل الصحيحة'],
    stock: 27, sales: 76
  },
  {
    id: 8, name: 'بطاقات المفاهيم الرياضية', category: 'primary', price: 1550,
    image: 'https://images.unsplash.com/photo-1509228468518-180dd4864904?w=400&h=300&fit=crop',
    images: [
      'https://images.unsplash.com/photo-1509228468518-180dd4864904?w=800&h=600&fit=crop',
      'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=800&h=600&fit=crop',
    ],
    description: 'تساعد الأستاذ في شرح مفاهيم الضرب والقسمة والكسور والهندسة بصرياً',
    benefits: ['تُبسّط للأستاذ شرح المفاهيم الرياضية', 'تُنمّي مهارة الحساب الذهني', 'أداة ممتازة للاستعداد للاختبارات'],
    stock: 44, sales: 97
  },
  {
    id: 9, name: 'بطاقات مصطلحات العلوم', category: 'middle', price: 1950,
    image: 'https://images.unsplash.com/photo-1532094349884-543bc11b234d?w=400&h=300&fit=crop',
    images: [
      'https://images.unsplash.com/photo-1532094349884-543bc11b234d?w=800&h=600&fit=crop',
      'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=800&h=600&fit=crop',
    ],
    description: 'تُمكّن الأستاذ من تقديم المصطلحات العلمية في الأحياء والكيمياء والفيزياء',
    benefits: ['تُوضّح المصطلحات العلمية بشكل مبسط', 'تُساعد التلاميذ على فهم المفاهيم', 'أداة مثالية للتحضير للاختبارات'],
    stock: 18, sales: 65
  },
  {
    id: 10, name: 'بطاقات المحادثة والتعبير', category: 'middle', price: 2200,
    image: 'https://images.unsplash.com/photo-1523240795612-9a054b0db644?w=400&h=300&fit=crop',
    images: [
      'https://images.unsplash.com/photo-1523240795612-9a054b0db644?w=800&h=600&fit=crop',
      'https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?w=800&h=600&fit=crop',
    ],
    description: 'تساعد الأستاذ في تنظيم أنشطة المحادثة والتعبير الشفهي داخل الفصل',
    benefits: ['تُفعّل نشاط المحادثة داخل الفصل', 'تُشجع التلاميذ على التعبير بثقة', 'أداة رائعة لتقييم المستوى الشفهي'],
    stock: 22, sales: 48
  },
  {
    id: 11, name: 'مصطلحات الأدب الإنجليزي', category: 'middle', price: 1800,
    image: 'https://images.unsplash.com/photo-1457369804613-52c61a468e7d?w=400&h=300&fit=crop',
    images: [
      'https://images.unsplash.com/photo-1457369804613-52c61a468e7d?w=800&h=600&fit=crop',
      'https://images.unsplash.com/photo-1512820790803-83ca734da794?w=800&h=600&fit=crop',
    ],
    description: 'تُمكّن الأستاذ من تعليم مصطلحات تحليل النصوص الأدبية بطريقة منظمة',
    benefits: ['تُسهّل تعليم التحليل الأدبي', 'تُنمّي التفكير النقدي لدى التلاميذ', 'تُحسّن فهم التلاميذ للنصوص'],
    stock: 31, sales: 59
  },
  {
    id: 12, name: 'قواعد الفرنسية المتقدمة', category: 'middle', price: 2100,
    image: 'https://images.unsplash.com/photo-1434030216411-0b793f4b4173?w=400&h=300&fit=crop',
    images: [
      'https://images.unsplash.com/photo-1434030216411-0b793f4b4173?w=800&h=600&fit=crop',
      'https://images.unsplash.com/photo-1519681393784-d120267933ba?w=800&h=600&fit=crop',
    ],
    description: 'تُساعد الأستاذ في تقديم الأزمنة المعقدة والجمل الشرطية بطريقة مبسطة',
    benefits: ['تُبسّط شرح القواعد المتقدمة', 'تُساعد على بناء الجمل المعقدة', 'مثالية للتحضير لامتحانات الفرنسية'],
    stock: 26, sales: 43
  },
];

const categoryConfig = {
  preparatory: { icon: '🎨', color: 'from-emerald-400 to-teal-600', label: 'التحضيري', desc: 'أدوات مساعدة للأستاذ في تعليم المهارات الأساسية' },
  primary: { icon: '📚', color: 'from-emerald-500 to-emerald-700', label: 'الابتدائي', desc: 'بطاقات تعليمية تساعد الأستاذ في بناء أسس أكاديمية قوية' },
  middle: { icon: '🎓', color: 'from-emerald-700 to-emerald-900', label: 'المتوسط', desc: 'موارد متقدمة لمساعدة الأستاذ في تحفيز التلاميذ' },
} as const;

const mockOrders: Order[] = [
  { id: 'ORD-2025-001', customerName: 'محمد أحمد', phone: '0555123456', wilaya: 'الجزائر', address: 'حيدرة، عمارة 12، شقة 45', items: [{ product: 'بطاقات مغامرات الأبجدية', quantity: 2, price: 1200 }, { product: 'الأرقام والعد الممتع', quantity: 1, price: 950 }], subtotal: 3350, shipping: 500, grandTotal: 3850, status: 'pending', deliveryType: 'home', createdAt: '2025-01-15 10:30' },
  { id: 'ORD-2025-002', customerName: 'فاطمة الزهراء', phone: '0677890123', wilaya: 'وهران', address: 'بئر الجير، شارع 18', items: [{ product: 'بناء المفردات الإنجليزية', quantity: 1, price: 1350 }, { product: 'الأفعال الفرنسية بسهولة', quantity: 1, price: 1700 }], subtotal: 3050, shipping: 800, grandTotal: 3850, status: 'confirmed', deliveryType: 'desk', createdAt: '2025-01-15 09:15' },
  { id: 'ORD-2025-003', customerName: 'علي بن محمد', phone: '0544567890', wilaya: 'قسنطينة', address: 'حي 500 مسكن، بلوك ب', items: [{ product: 'بطاقات مصطلحات العلوم', quantity: 3, price: 1950 }], subtotal: 5850, shipping: 800, grandTotal: 6650, status: 'shipped', deliveryType: 'home', createdAt: '2025-01-14 16:45' },
  { id: 'ORD-2025-004', customerName: 'أمينة سعيد', phone: '0699012345', wilaya: 'البليدة', address: 'أولاد يعيش، الشارع الرئيسي', items: [{ product: 'بطاقات المحادثة والتعبير', quantity: 2, price: 2200 }], subtotal: 4400, shipping: 600, grandTotal: 5000, status: 'delivered', deliveryType: 'home', createdAt: '2025-01-13 14:20' },
];

const formatPrice = (p: number) => `${p.toLocaleString()} دج`;
const getCategoryName = (cat: string) => categoryConfig[cat as Category]?.label ?? 'الكل';
const getEstimatedDelivery = (wilaya: WilayaShipping | null) => {
  if (!wilaya) return '';
  if (wilaya.code === 16) return '24-48 ساعة';
  if ([9, 35, 42].includes(wilaya.code)) return '2-3 أيام';
  if (wilaya.desk <= 500) return '3-5 أيام';
  if (wilaya.desk <= 800) return '4-6 أيام';
  return '5-7 أيام';
};

const playSound = () => {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.15);
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.3);
  } catch (_) {}
};

// ==================== IMAGE GALLERY ====================
function ImageGallery({ images, productName }: { images: string[]; productName: string }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isZoomed, setIsZoomed] = useState(false);
  const allImages = images.length > 0 ? images : ['https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=800&h=600&fit=crop'];

  const goNext = () => setActiveIndex(i => (i + 1) % allImages.length);
  const goPrev = () => setActiveIndex(i => (i - 1 + allImages.length) % allImages.length);

  return (
    <div className="space-y-3">
      {/* Main Image */}
      <div className="relative group overflow-hidden rounded-2xl bg-gray-100" style={{ aspectRatio: '4/3' }}>
        <img
          src={allImages[activeIndex]}
          alt={`${productName} - صورة ${activeIndex + 1}`}
          className="w-full h-full object-cover cursor-zoom-in transition-transform duration-500 group-hover:scale-105"
          onClick={() => setIsZoomed(true)}
          onError={e => { (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=800&h=600&fit=crop'; }}
        />
        {/* Navigation Arrows */}
        {allImages.length > 1 && (
          <>
            <button onClick={goPrev} className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 bg-white/90 rounded-full shadow-lg flex items-center justify-center hover:bg-white transition-all opacity-0 group-hover:opacity-100">
              <svg className="w-4 h-4 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/></svg>
            </button>
            <button onClick={goNext} className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 bg-white/90 rounded-full shadow-lg flex items-center justify-center hover:bg-white transition-all opacity-0 group-hover:opacity-100">
              <svg className="w-4 h-4 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/></svg>
            </button>
          </>
        )}
        {/* Counter */}
        {allImages.length > 1 && (
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-black/50 text-white text-xs px-3 py-1 rounded-full font-semibold">
            {activeIndex + 1} / {allImages.length}
          </div>
        )}
        {/* Zoom Icon */}
        <div className="absolute top-3 left-3 bg-white/80 p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity">
          <svg className="w-4 h-4 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7"/></svg>
        </div>
      </div>

      {/* Thumbnails */}
      {allImages.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {allImages.map((img, i) => (
            <button
              key={i}
              onClick={() => setActiveIndex(i)}
              className={cn('flex-shrink-0 w-16 h-16 rounded-xl overflow-hidden border-2 transition-all',
                activeIndex === i ? 'border-emerald-500 shadow-md scale-105' : 'border-transparent hover:border-emerald-300 opacity-70 hover:opacity-100'
              )}
            >
              <img src={img} alt={`صورة ${i + 1}`} className="w-full h-full object-cover"
                onError={e => { (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=400&h=300&fit=crop'; }}
              />
            </button>
          ))}
        </div>
      )}

      {/* Zoom Modal */}
      {isZoomed && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/90 p-4" onClick={() => setIsZoomed(false)}>
          <button className="absolute top-4 right-4 w-10 h-10 bg-white/20 rounded-full flex items-center justify-center text-white hover:bg-white/30">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
          <img src={allImages[activeIndex]} alt={productName} className="max-w-full max-h-full object-contain rounded-xl shadow-2xl" onClick={e => e.stopPropagation()}/>
          {allImages.length > 1 && (
            <>
              <button onClick={e => { e.stopPropagation(); goPrev(); }} className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 bg-white/20 rounded-full flex items-center justify-center text-white hover:bg-white/30">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/></svg>
              </button>
              <button onClick={e => { e.stopPropagation(); goNext(); }} className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 bg-white/20 rounded-full flex items-center justify-center text-white hover:bg-white/30">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/></svg>
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ==================== LOGO ====================
function Logo({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const sizes = { sm: 'w-9 h-9', md: 'w-12 h-12', lg: 'w-20 h-20' };
  const textSizes = { sm: 'text-lg', md: 'text-2xl', lg: 'text-4xl' };
  const [imgError, setImgError] = useState(false);
  return (
    <div className="flex items-center gap-2">
      <div className={cn(sizes[size], 'relative rounded-xl shadow-lg overflow-hidden flex-shrink-0')}>
        {!imgError ? (
          <img
            src="https://i.ibb.co/jkq94GGC/logo.jpg"
            alt="المعراج"
            className="w-full h-full object-contain bg-white"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-emerald-600 to-emerald-800 flex items-center justify-center">
            <svg viewBox="0 0 40 40" className="w-3/4 h-3/4" fill="none">
              <path d="M20 4L6 12v8c0 9 6 16 14 18 8-2 14-9 14-18v-8L20 4z" fill="rgba(255,255,255,0.15)" stroke="white" strokeWidth="1.5"/>
              <path d="M14 20l4 4 8-8" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M13 10h14M15 7h10" stroke="#facc15" strokeWidth="1.5" strokeLinecap="round" opacity="0.8"/>
            </svg>
          </div>
        )}
      </div>
      <div className="flex flex-col">
        <span className={cn(textSizes[size], 'font-bold text-emerald-900 tracking-tight leading-tight')}>المعـراج</span>
        {size !== 'sm' && <span className="text-[10px] text-emerald-600 font-semibold tracking-widest">AL-MI'RAJ</span>}
      </div>
    </div>
  );
}

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5">
      {[1,2,3,4,5].map(s => (
        <svg key={s} className={cn('w-4 h-4', s <= rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300')} viewBox="0 0 20 20">
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/>
        </svg>
      ))}
    </div>
  );
}

function StatusBadge({ status }: { status: OrderStatus }) {
  const cfg = {
    pending: { bg: 'bg-yellow-100', text: 'text-yellow-800', label: '⏳ قيد الانتظار' },
    confirmed: { bg: 'bg-blue-100', text: 'text-blue-800', label: '✅ تم التأكيد' },
    shipped: { bg: 'bg-purple-100', text: 'text-purple-800', label: '🚚 تم الشحن' },
    delivered: { bg: 'bg-green-100', text: 'text-green-800', label: '🎉 تم التوصيل' },
    cancelled: { bg: 'bg-red-100', text: 'text-red-800', label: '❌ ملغي' },
  };
  const c = cfg[status];
  return <span className={cn('px-3 py-1 rounded-full text-xs font-bold', c.bg, c.text)}>{c.label}</span>;
}

function CartButton({ cartCount, onClick }: { cartCount: number; onClick: () => void }) {
  const [isAnimating, setIsAnimating] = useState(false);
  const prevCount = useRef(cartCount);
  useEffect(() => {
    if (cartCount > prevCount.current) {
      setIsAnimating(true);
      playSound();
      setTimeout(() => setIsAnimating(false), 1000);
    }
    prevCount.current = cartCount;
  }, [cartCount]);
  return (
    <button onClick={onClick} className="relative p-2 hover:bg-stone-100 rounded-full transition-colors">
      {isAnimating && (
        <>
          <span className="absolute inset-0 rounded-full animate-ping-once-1" style={{ background: 'radial-gradient(circle, rgba(220,38,38,0.5) 0%, transparent 70%)' }}/>
          <span className="absolute inset-0 rounded-full animate-ping-once-2" style={{ background: 'radial-gradient(circle, rgba(234,179,8,0.5) 0%, transparent 70%)', animationDelay: '0.15s' }}/>
          <span className="absolute inset-0 rounded-full animate-ping-once-3" style={{ background: 'radial-gradient(circle, rgba(220,38,38,0.4) 0%, transparent 70%)', animationDelay: '0.3s' }}/>
          <span className="absolute -top-2 left-1/2 -translate-x-1/2 text-yellow-400 text-xs animate-sparkle pointer-events-none">✦</span>
          <span className="absolute -top-1 -right-1 text-red-400 text-xs animate-sparkle pointer-events-none" style={{ animationDelay: '0.1s' }}>✦</span>
          <span className="absolute -top-1 -left-1 text-yellow-300 text-xs animate-sparkle pointer-events-none" style={{ animationDelay: '0.2s' }}>✦</span>
        </>
      )}
      <svg className={cn('w-6 h-6 text-stone-700', isAnimating && 'animate-cart-shake')} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"/>
      </svg>
      {cartCount > 0 && (
        <span className={cn('absolute -top-1 -right-1 w-5 h-5 text-white text-xs font-bold rounded-full flex items-center justify-center transition-all duration-300', isAnimating ? 'bg-yellow-400 text-emerald-900 scale-125 animate-bounce' : 'bg-emerald-600')}>
          {cartCount}
        </span>
      )}
    </button>
  );
}

function Toast({ message, type, onClose }: { message: string; type: 'success' | 'error'; onClose: () => void }) {
  useEffect(() => { const t = setTimeout(onClose, 3000); return () => clearTimeout(t); }, [onClose]);
  return (
    <div className={cn('fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] px-6 py-3 rounded-full shadow-xl font-semibold text-white flex items-center gap-2', type === 'success' ? 'bg-emerald-600' : 'bg-red-600')} style={{ animation: 'fadeInUp 0.3s ease-out' }}>
      <span>{type === 'success' ? '✅' : '❌'}</span>
      {message}
    </div>
  );
}

// ==================== MULTI-IMAGE UPLOAD ====================
interface MultiImageUploadProps {
  images: string[];
  onChange: (images: string[]) => void;
}

function MultiImageUpload({ images, onChange }: MultiImageUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState('');

  const handleFiles = (files: FileList | null) => {
    if (!files) return;
    setError('');
    const newImages: string[] = [];
    let processed = 0;
    const fileArray = Array.from(files);

    if (images.length + fileArray.length > 6) {
      setError('الحد الأقصى 6 صور للمنتج');
      return;
    }

    fileArray.forEach(file => {
      if (!file.type.startsWith('image/')) { setError('يرجى اختيار ملفات صور فقط'); return; }
      if (file.size > 5 * 1024 * 1024) { setError('حجم الصورة يجب أن يكون أقل من 5MB'); return; }
      const reader = new FileReader();
      reader.onloadend = () => {
        newImages.push(reader.result as string);
        processed++;
        if (processed === fileArray.length) {
          onChange([...images, ...newImages]);
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const removeImage = (index: number) => {
    onChange(images.filter((_, i) => i !== index));
  };

  const moveImage = (from: number, to: number) => {
    const arr = [...images];
    [arr[from], arr[to]] = [arr[to], arr[from]];
    onChange(arr);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="block text-sm font-bold text-stone-700">📸 صور المنتج <span className="text-red-500">*</span></label>
        <span className="text-xs text-stone-400">{images.length}/6 صور</span>
      </div>

      {/* Upload Area */}
      {images.length < 6 && (
        <>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={e => handleFiles(e.target.files)}
            className="hidden"
          />
          <div
            onClick={() => fileInputRef.current?.click()}
            onDragOver={e => e.preventDefault()}
            onDrop={e => { e.preventDefault(); handleFiles(e.dataTransfer.files); }}
            className="border-2 border-dashed border-emerald-300 rounded-2xl p-6 text-center cursor-pointer hover:border-emerald-500 hover:bg-emerald-50 transition-all"
          >
            <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center mx-auto mb-3 text-2xl">📤</div>
            <p className="font-bold text-stone-600 text-sm mb-1">انقر أو اسحب الصور هنا</p>
            <p className="text-xs text-stone-400">PNG, JPG, WEBP · حجم أقصى 5MB · حتى {6 - images.length} صور</p>
          </div>
        </>
      )}

      {error && <p className="text-red-500 text-xs">{error}</p>}

      {/* Images Grid */}
      {images.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          {images.map((img, i) => (
            <div key={i} className="relative group rounded-xl overflow-hidden border-2 border-stone-200 hover:border-emerald-400 transition-all" style={{ aspectRatio: '1' }}>
              <img src={img} alt={`صورة ${i + 1}`} className="w-full h-full object-cover"
                onError={e => { (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=400&h=300&fit=crop'; }}
              />
              {/* Badge */}
              {i === 0 && (
                <div className="absolute top-1 right-1 bg-emerald-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">رئيسية</div>
              )}
              {/* Overlay Controls */}
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
                {i > 0 && (
                  <button onClick={() => moveImage(i, i - 1)} className="w-7 h-7 bg-white/90 rounded-full flex items-center justify-center hover:bg-white" title="تحريك يمين">
                    <svg className="w-3.5 h-3.5 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/></svg>
                  </button>
                )}
                <button onClick={() => removeImage(i)} className="w-7 h-7 bg-red-500 rounded-full flex items-center justify-center hover:bg-red-600" title="حذف">
                  <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
                </button>
                {i < images.length - 1 && (
                  <button onClick={() => moveImage(i, i + 1)} className="w-7 h-7 bg-white/90 rounded-full flex items-center justify-center hover:bg-white" title="تحريك يسار">
                    <svg className="w-3.5 h-3.5 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/></svg>
                  </button>
                )}
              </div>
              {/* Image number */}
              <div className="absolute bottom-1 left-1 bg-black/50 text-white text-[9px] px-1.5 py-0.5 rounded-full">{i + 1}</div>
            </div>
          ))}
        </div>
      )}

      {images.length > 0 && (
        <p className="text-xs text-stone-400 text-center">الصورة الأولى هي الصورة الرئيسية · مرر على الصورة للتحكم فيها</p>
      )}
    </div>
  );
}

// ==================== PRODUCT FORM ====================
interface ProductFormProps {
  product?: Product | null;
  onSave: (data: Omit<Product, 'id' | 'sales'>) => void;
  onCancel: () => void;
}

function ProductForm({ product, onSave, onCancel }: ProductFormProps) {
  const [form, setForm] = useState({
    name: product?.name ?? '',
    category: (product?.category ?? 'preparatory') as Category,
    price: product?.price?.toString() ?? '',
    stock: product?.stock?.toString() ?? '',
    description: product?.description ?? '',
    benefits: product?.benefits?.join('\n') ?? '',
  });
  const [images, setImages] = useState<string[]>(product?.images ?? (product?.image ? [product.image] : []));
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = 'اسم المنتج مطلوب';
    if (!form.price || isNaN(Number(form.price)) || Number(form.price) <= 0) e.price = 'يرجى إدخال سعر صحيح';
    if (!form.stock || isNaN(Number(form.stock)) || Number(form.stock) < 0) e.stock = 'يرجى إدخال كمية صحيحة';
    if (!form.description.trim()) e.description = 'وصف المنتج مطلوب';
    if (!form.benefits.trim()) e.benefits = 'يرجى إدخال فائدة واحدة على الأقل';
    if (images.length === 0) e.images = 'يرجى إضافة صورة واحدة على الأقل';
    return e;
  };

  const handleSubmit = () => {
    const e = validate();
    if (Object.keys(e).length > 0) { setErrors(e); return; }
    const defaultImg = 'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=400&h=300&fit=crop';
    onSave({
      name: form.name.trim(),
      category: form.category,
      price: Number(form.price),
      stock: Number(form.stock),
      image: images[0] || defaultImg,
      images: images.length > 0 ? images : [defaultImg],
      description: form.description.trim(),
      benefits: form.benefits.split('\n').map(b => b.trim()).filter(Boolean),
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[95vh] overflow-y-auto shadow-2xl" dir="rtl">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between rounded-t-2xl z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center text-xl">
              {product ? '✏️' : '➕'}
            </div>
            <div>
              <h2 className="text-lg font-bold text-emerald-950">{product ? 'تعديل المنتج' : 'إضافة منتج جديد'}</h2>
              <p className="text-xs text-stone-500">جميع الحقول المعلّمة بـ * مطلوبة</p>
            </div>
          </div>
          <button onClick={onCancel} className="p-2 hover:bg-stone-100 rounded-xl transition-colors">
            <svg className="w-5 h-5 text-stone-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Multi Image Upload */}
          <div>
            <MultiImageUpload images={images} onChange={setImages} />
            {errors.images && <p className="text-red-500 text-xs mt-1">{errors.images}</p>}
          </div>

          {/* Name */}
          <div>
            <label className="block text-sm font-bold text-stone-700 mb-2">اسم المنتج <span className="text-red-500">*</span></label>
            <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="w-full p-3 border-2 border-stone-200 rounded-xl focus:border-emerald-500 focus:outline-none text-sm" placeholder="مثال: بطاقات مغامرات الأبجدية"/>
            {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name}</p>}
          </div>

          {/* Category & Price */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-stone-700 mb-2">الطور التعليمي <span className="text-red-500">*</span></label>
              <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value as Category }))} className="w-full p-3 border-2 border-stone-200 rounded-xl focus:border-emerald-500 focus:outline-none text-sm">
                <option value="preparatory">🎨 التحضيري</option>
                <option value="primary">📚 الابتدائي</option>
                <option value="middle">🎓 المتوسط</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-bold text-stone-700 mb-2">السعر (دج) <span className="text-red-500">*</span></label>
              <input type="number" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} className="w-full p-3 border-2 border-stone-200 rounded-xl focus:border-emerald-500 focus:outline-none text-sm" placeholder="1200"/>
              {errors.price && <p className="text-red-500 text-xs mt-1">{errors.price}</p>}
            </div>
          </div>

          {/* Stock */}
          <div>
            <label className="block text-sm font-bold text-stone-700 mb-2">الكمية المتوفرة <span className="text-red-500">*</span></label>
            <input type="number" value={form.stock} onChange={e => setForm(f => ({ ...f, stock: e.target.value }))} className="w-full p-3 border-2 border-stone-200 rounded-xl focus:border-emerald-500 focus:outline-none text-sm" placeholder="50"/>
            {errors.stock && <p className="text-red-500 text-xs mt-1">{errors.stock}</p>}
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-bold text-stone-700 mb-2">وصف المنتج <span className="text-red-500">*</span></label>
            <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={3} className="w-full p-3 border-2 border-stone-200 rounded-xl focus:border-emerald-500 focus:outline-none text-sm resize-none" placeholder="وصف مختصر للمنتج وفائدته للأستاذ..."/>
            {errors.description && <p className="text-red-500 text-xs mt-1">{errors.description}</p>}
          </div>

          {/* Benefits */}
          <div>
            <label className="block text-sm font-bold text-stone-700 mb-2">الفوائد التعليمية <span className="text-red-500">*</span> <span className="text-stone-400 font-normal">(فائدة في كل سطر)</span></label>
            <textarea value={form.benefits} onChange={e => setForm(f => ({ ...f, benefits: e.target.value }))} rows={4} className="w-full p-3 border-2 border-stone-200 rounded-xl focus:border-emerald-500 focus:outline-none text-sm resize-none" placeholder="تساعد الأستاذ في شرح المفاهيم&#10;تفعّل التلاميذ داخل الفصل&#10;أداة مثالية لتحضير الدروس"/>
            {errors.benefits && <p className="text-red-500 text-xs mt-1">{errors.benefits}</p>}
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button onClick={handleSubmit} className="flex-1 bg-gradient-to-r from-emerald-600 to-emerald-700 text-white py-3.5 rounded-xl font-bold shadow-lg hover:shadow-xl transition-all text-base">
              {product ? '💾 حفظ التغييرات' : '✅ إضافة المنتج'}
            </button>
            <button onClick={onCancel} className="px-6 py-3.5 border-2 border-stone-200 text-stone-600 rounded-xl font-semibold hover:bg-stone-50 transition-colors">
              إلغاء
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ==================== DELETE CONFIRM ====================
function DeleteConfirm({ productName, onConfirm, onCancel }: { productName: string; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden" dir="rtl">
        <div className="p-6 bg-red-50 border-b flex items-center gap-3">
          <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center text-2xl">🗑️</div>
          <h2 className="text-xl font-bold text-red-800">تأكيد الحذف</h2>
        </div>
        <div className="p-6">
          <p className="text-stone-600 mb-2">هل أنت متأكد من حذف هذا المنتج؟</p>
          <p className="font-bold text-stone-800 mb-4 bg-stone-50 p-3 rounded-xl">"{productName}"</p>
          <p className="text-red-500 text-sm mb-6">⚠️ هذا الإجراء لا يمكن التراجع عنه</p>
          <div className="flex gap-3">
            <button onClick={onConfirm} className="flex-1 bg-red-600 text-white py-3 rounded-xl font-bold hover:bg-red-700 transition-colors">نعم، احذف المنتج</button>
            <button onClick={onCancel} className="flex-1 border-2 border-stone-200 text-stone-600 py-3 rounded-xl font-semibold hover:bg-stone-50 transition-colors">إلغاء</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ==================== ADMIN DASHBOARD ====================
function AdminDashboard({ onBack, products, setProducts }: {
  onBack: () => void;
  products: Product[];
  setProducts: React.Dispatch<React.SetStateAction<Product[]>>;
}) {
  const [isLoggedIn, setIsLoggedIn] = useState(() => localStorage.getItem('almeraj_admin') === 'true');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [activeTab, setActiveTab] = useState<AdminTab>('dashboard');
  const [orders, setOrders] = useState<Order[]>(mockOrders);
  const [notifications, setNotifications] = useState<Notification[]>([
    { id: '1', type: 'new-order', title: 'طلب جديد', message: 'طلب جديد من محمد أحمد - 3,850 دج', timestamp: 'منذ 5 دقائق', read: false },
    { id: '2', type: 'status-update', title: 'تحديث حالة', message: 'تم تأكيد الطلب ORD-2025-002', timestamp: 'منذ 30 دقيقة', read: false },
    { id: '3', type: 'low-stock', title: 'تنبيه مخزون', message: 'بطاقات مصطلحات العلوم - 18 قطعة متبقية', timestamp: 'منذ ساعة', read: true },
  ]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [showProductForm, setShowProductForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [deletingProduct, setDeletingProduct] = useState<Product | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [productSearch, setProductSearch] = useState('');
  const [productCategoryFilter, setProductCategoryFilter] = useState('all');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  useEffect(() => { localStorage.setItem('almeraj_admin', isLoggedIn ? 'true' : 'false'); }, [isLoggedIn]);

  const showToast = (message: string, type: 'success' | 'error') => setToast({ message, type });

  const handleSaveProduct = (data: Omit<Product, 'id' | 'sales'>) => {
    if (editingProduct) {
      setProducts(prev => prev.map(p => p.id === editingProduct.id ? { ...p, ...data } : p));
      showToast('✅ تم تعديل المنتج بنجاح', 'success');
    } else {
      setProducts(prev => [...prev, { ...data, id: Date.now(), sales: 0 }]);
      showToast('✅ تم إضافة المنتج بنجاح', 'success');
    }
    setShowProductForm(false);
    setEditingProduct(null);
  };

  const handleDeleteProduct = () => {
    if (!deletingProduct) return;
    setProducts(prev => prev.filter(p => p.id !== deletingProduct.id));
    showToast('تم حذف المنتج بنجاح', 'success');
    setDeletingProduct(null);
  };

  const updateOrderStatus = (id: string, status: OrderStatus) => {
    setOrders(prev => prev.map(o => o.id === id ? { ...o, status } : o));
    showToast('تم تحديث حالة الطلب بنجاح', 'success');
  };

  const unreadCount = notifications.filter(n => !n.read).length;
  const filteredOrders = selectedStatus === 'all' ? orders : orders.filter(o => o.status === selectedStatus);
  const filteredProducts = products.filter(p =>
    p.name.includes(productSearch) && (productCategoryFilter === 'all' || p.category === productCategoryFilter)
  );

  const stats = {
    totalOrders: orders.length,
    pendingOrders: orders.filter(o => o.status === 'pending').length,
    totalRevenue: orders.reduce((s, o) => s + o.grandTotal, 0),
    totalProducts: products.length,
    lowStock: products.filter(p => p.stock < 20).length,
  };

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-900 via-emerald-800 to-teal-900 flex items-center justify-center p-4" dir="rtl">
        <div className="w-full max-w-md">
          <div className="text-center mb-8"><Logo size="lg"/><p className="text-emerald-200 mt-4 text-sm">لوحة تحكم المسؤول</p></div>
          <div className="bg-white rounded-3xl shadow-2xl overflow-hidden">
            <div className="bg-gradient-to-r from-emerald-600 to-emerald-800 p-8 text-center text-white">
              <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-4 text-3xl">🔐</div>
              <h1 className="text-2xl font-bold mb-1">تسجيل الدخول</h1>
              <p className="text-emerald-100 text-sm">ادخل بياناتك للوصول للوحة التحكم</p>
            </div>
            <div className="p-8 space-y-5">
              <div>
                <label className="block text-sm font-bold text-stone-700 mb-2">👤 اسم المستخدم</label>
                <input type="text" value={username} onChange={e => { setUsername(e.target.value); setLoginError(''); }} placeholder="admin" className="w-full p-3.5 border-2 border-stone-200 rounded-xl focus:border-emerald-500 focus:outline-none text-sm"/>
              </div>
              <div>
                <label className="block text-sm font-bold text-stone-700 mb-2">🔑 كلمة المرور</label>
                <input type="password" value={password} onChange={e => { setPassword(e.target.value); setLoginError(''); }} placeholder="••••••••" className="w-full p-3.5 border-2 border-stone-200 rounded-xl focus:border-emerald-500 focus:outline-none text-sm"
                  onKeyDown={e => { if (e.key === 'Enter') { if (username === 'admin' && password === 'admin123') setIsLoggedIn(true); else setLoginError('بيانات الدخول غير صحيحة!'); }}}/>
              </div>
              {loginError && <div className="bg-red-50 border border-red-200 text-red-700 text-sm p-3 rounded-xl flex items-center gap-2"><span>⚠️</span>{loginError}</div>}
              <button onClick={() => { if (username === 'admin' && password === 'admin123') setIsLoggedIn(true); else setLoginError('بيانات الدخول غير صحيحة! استخدم: admin / admin123'); }} className="w-full bg-gradient-to-r from-emerald-600 to-emerald-800 text-white py-4 rounded-xl font-bold shadow-lg hover:shadow-xl transition-all text-base">
                🔑 دخول للوحة التحكم
              </button>
              <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-xl text-center">
                <p className="text-stone-500 text-xs mb-1">بيانات الدخول:</p>
                <p className="font-mono font-bold text-emerald-700 text-sm">admin / admin123</p>
              </div>
              <button onClick={onBack} className="w-full text-center text-stone-500 text-sm hover:text-emerald-600 font-semibold transition-colors">← العودة للمتجر</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const [trackingInput, setTrackingInput] = useState('');
  const [trackingResults, setTrackingResults] = useState<Array<{tracking: string; status: string; history: Array<{status: string; date: string; note?: string}>}>>([]);
  const [trackingLoading, setTrackingLoading] = useState(false);
  const [trackingError, setTrackingError] = useState('');

  const handleTrackOrders = async () => {
    if (!trackingInput.trim()) { setTrackingError('أدخل رقم تتبع واحد على الأقل'); return; }
    setTrackingLoading(true);
    setTrackingError('');
    setTrackingResults([]);
    const { trackOrders } = await import('./services/noestApi');
    const nums = trackingInput.split('\n').map(s => s.trim()).filter(Boolean);
    const result = await trackOrders(nums);
    setTrackingLoading(false);
    if (result.ok) {
      setTrackingResults(result.data);
    } else {
      setTrackingError(result.error ?? 'فشل التتبع');
    }
  };

  const handleValidateOrder = async (orderId: string) => {
    const { validateOrder } = await import('./services/noestApi');
    const result = await validateOrder(orderId);
    if (result.ok) showToast('✅ تم تأكيد الطلب على NOEST', 'success');
    else showToast(`❌ ${result.error}`, 'error');
  };

  const handleDeleteNoestOrder = async (orderId: string) => {
    if (!confirm('هل تريد حذف هذا الطلب من NOEST؟')) return;
    const { deleteOrder } = await import('./services/noestApi');
    const result = await deleteOrder(orderId);
    if (result.ok) showToast('✅ تم حذف الطلب من NOEST', 'success');
    else showToast(`❌ ${result.error}`, 'error');
  };

  const handleDownloadLabel = async (orderId: string) => {
    const { downloadLabel } = await import('./services/noestApi');
    const result = await downloadLabel(orderId);
    if (result.ok) {
      const a = document.createElement('a');
      a.href = result.data;
      a.download = `label-${orderId}.pdf`;
      a.click();
    } else {
      showToast(`❌ ${result.error}`, 'error');
    }
  };

  const tabs = [
    { id: 'dashboard' as AdminTab, icon: '📊', label: 'الرئيسية' },
    { id: 'orders' as AdminTab, icon: '📋', label: 'الطلبات', badge: stats.pendingOrders },
    { id: 'products' as AdminTab, icon: '📦', label: 'المنتجات', badge: stats.lowStock },
    { id: 'tracking' as AdminTab, icon: '🚚', label: 'تتبع NOEST' },
  ];

  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)}/>}
      {showProductForm && <ProductForm product={editingProduct} onSave={handleSaveProduct} onCancel={() => { setShowProductForm(false); setEditingProduct(null); }}/>}
      {deletingProduct && <DeleteConfirm productName={deletingProduct.name} onConfirm={handleDeleteProduct} onCancel={() => setDeletingProduct(null)}/>}

      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40 shadow-sm">
        <div className="flex items-center justify-between px-4 lg:px-6 h-16">
          <div className="flex items-center gap-3">
            <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="lg:hidden p-2 hover:bg-gray-100 rounded-lg">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16"/></svg>
            </button>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-gradient-to-br from-emerald-600 to-emerald-800 rounded-lg flex items-center justify-center text-white font-bold text-sm shadow-sm">AM</div>
              <div className="hidden sm:block">
                <h1 className="font-bold text-gray-800 text-base leading-tight">المعراج</h1>
                <p className="text-xs text-gray-400">لوحة التحكم</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <button onClick={() => setShowNotifications(!showNotifications)} className="relative p-2 hover:bg-gray-100 rounded-lg transition-colors">
                <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/></svg>
                {unreadCount > 0 && <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center animate-pulse">{unreadCount}</span>}
              </button>
              {showNotifications && (
                <div className="absolute top-12 left-0 w-80 bg-white rounded-2xl shadow-2xl border z-50 overflow-hidden">
                  <div className="p-4 bg-gray-50 border-b flex items-center justify-between">
                    <h3 className="font-bold text-gray-800">🔔 الإشعارات</h3>
                    <button onClick={() => setNotifications(prev => prev.map(n => ({ ...n, read: true })))} className="text-xs text-emerald-600 font-semibold hover:text-emerald-800">قراءة الكل</button>
                  </div>
                  <div className="max-h-72 overflow-y-auto">
                    {notifications.map(n => (
                      <div key={n.id} onClick={() => setNotifications(prev => prev.map(x => x.id === n.id ? { ...x, read: true } : x))} className={cn('p-4 border-b hover:bg-gray-50 cursor-pointer transition-colors', !n.read && 'bg-emerald-50/50')}>
                        <div className="flex items-start gap-3">
                          <span className="text-lg">{n.type === 'new-order' ? '🛒' : n.type === 'low-stock' ? '⚠️' : '📦'}</span>
                          <div className="flex-1">
                            <p className="font-semibold text-sm text-gray-800">{n.title}</p>
                            <p className="text-xs text-gray-500 mt-0.5">{n.message}</p>
                            <p className="text-xs text-gray-400 mt-1">{n.timestamp}</p>
                          </div>
                          {!n.read && <span className="w-2 h-2 bg-emerald-500 rounded-full mt-1 flex-shrink-0"/>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <button onClick={onBack} className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors font-medium">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/></svg>
              المتجر
            </button>
            <button onClick={() => { if (confirm('تسجيل الخروج؟')) { setIsLoggedIn(false); localStorage.removeItem('almeraj_admin'); } }} className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors font-medium">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/></svg>
              خروج
            </button>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar */}
        <aside className={cn('fixed lg:sticky top-16 h-[calc(100vh-4rem)] w-64 bg-white border-l border-gray-200 flex flex-col z-30 transition-transform duration-300 overflow-y-auto', isSidebarOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0')}>
          <nav className="p-4 space-y-1 flex-1">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest px-3 mb-3">القائمة الرئيسية</p>
            {tabs.map(tab => (
              <button key={tab.id} onClick={() => { setActiveTab(tab.id); setIsSidebarOpen(false); }} className={cn('w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-right', activeTab === tab.id ? 'bg-emerald-600 text-white shadow-md' : 'text-gray-600 hover:bg-gray-100')}>
                <span className="text-xl">{tab.icon}</span>
                <span className="flex-1 font-semibold">{tab.label}</span>
                {tab.badge !== undefined && tab.badge > 0 && (
                  <span className={cn('text-xs px-2 py-0.5 rounded-full font-bold', activeTab === tab.id ? 'bg-white/20 text-white' : tab.id === 'orders' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700')}>{tab.badge}</span>
                )}
              </button>
            ))}
          </nav>
          <div className="p-4 border-t">
            <div className="bg-emerald-50 rounded-xl p-3 text-center">
              <p className="text-xs text-emerald-600 font-semibold">متجر المعراج التعليمي</p>
              <p className="text-xs text-gray-400 mt-1">v2.0.0</p>
            </div>
          </div>
        </aside>

        {isSidebarOpen && <div className="fixed inset-0 bg-black/40 z-20 lg:hidden" onClick={() => setIsSidebarOpen(false)}/>}

        {/* Main Content */}
        <main className="flex-1 p-4 lg:p-6 min-h-[calc(100vh-4rem)] overflow-x-hidden">

          {/* DASHBOARD */}
          {activeTab === 'dashboard' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-800">لوحة المعلومات 📊</h2>
                <p className="text-gray-500 text-sm mt-1">مرحباً بك في متجر المعراج التعليمي</p>
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  { label: 'إجمالي الطلبات', value: stats.totalOrders, icon: '📋', light: 'bg-blue-50 text-blue-700' },
                  { label: 'طلبات معلقة', value: stats.pendingOrders, icon: '⏳', light: 'bg-yellow-50 text-yellow-700' },
                  { label: 'إجمالي الإيرادات', value: formatPrice(stats.totalRevenue), icon: '💰', light: 'bg-emerald-50 text-emerald-700' },
                  { label: 'المنتجات', value: stats.totalProducts, icon: '📦', light: 'bg-purple-50 text-purple-700' },
                ].map((s, i) => (
                  <div key={i} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-xs text-gray-500 font-medium mb-1">{s.label}</p>
                        <p className="text-xl lg:text-2xl font-bold text-gray-800">{s.value}</p>
                      </div>
                      <div className={cn('w-11 h-11 rounded-xl flex items-center justify-center text-xl', s.light)}>{s.icon}</div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="p-5 border-b flex items-center justify-between">
                  <h3 className="font-bold text-gray-800 text-lg">🕒 آخر الطلبات</h3>
                  <button onClick={() => setActiveTab('orders')} className="text-sm text-emerald-600 font-semibold hover:text-emerald-800">عرض الكل ←</button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead><tr className="bg-gray-50 border-b">
                      {['رقم الطلب', 'العميل', 'الولاية', 'المبلغ', 'الحالة'].map(h => (
                        <th key={h} className="text-right p-4 text-xs font-bold text-gray-500 uppercase">{h}</th>
                      ))}
                    </tr></thead>
                    <tbody>
                      {orders.slice(0, 5).map(o => (
                        <tr key={o.id} className="border-b hover:bg-gray-50 transition-colors">
                          <td className="p-4 font-mono text-sm text-emerald-700 font-bold">{o.id}</td>
                          <td className="p-4 text-sm font-semibold text-gray-700">{o.customerName}</td>
                          <td className="p-4 text-sm text-gray-500">{o.wilaya}</td>
                          <td className="p-4 font-bold text-emerald-700">{formatPrice(o.grandTotal)}</td>
                          <td className="p-4"><StatusBadge status={o.status}/></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="grid sm:grid-cols-3 gap-4">
                {(['preparatory', 'primary', 'middle'] as Category[]).map(cat => {
                  const catProds = products.filter(p => p.category === cat);
                  const totalSales = catProds.reduce((s, p) => s + p.sales, 0);
                  return (
                    <div key={cat} className={cn('bg-gradient-to-br p-5 rounded-2xl text-white shadow-lg', categoryConfig[cat].color)}>
                      <span className="text-3xl">{categoryConfig[cat].icon}</span>
                      <h4 className="font-bold text-lg mt-3">{categoryConfig[cat].label}</h4>
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-white/80 text-sm">{catProds.length} منتجات</span>
                        <span className="font-bold">{totalSales} مبيعة</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ORDERS */}
          {activeTab === 'orders' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <h2 className="text-2xl font-bold text-gray-800">📋 إدارة الطلبات</h2>
                  <p className="text-gray-500 text-sm">{orders.length} طلب إجمالي</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {[
                    { v: 'all', l: 'الكل', count: orders.length },
                    { v: 'pending', l: '⏳ انتظار', count: orders.filter(o => o.status === 'pending').length },
                    { v: 'confirmed', l: '✅ مؤكد', count: orders.filter(o => o.status === 'confirmed').length },
                    { v: 'shipped', l: '🚚 شحن', count: orders.filter(o => o.status === 'shipped').length },
                    { v: 'delivered', l: '🎉 تم', count: orders.filter(o => o.status === 'delivered').length },
                  ].map(f => (
                    <button key={f.v} onClick={() => setSelectedStatus(f.v)} className={cn('px-3 py-1.5 rounded-lg text-xs font-bold transition-all', selectedStatus === f.v ? 'bg-emerald-600 text-white shadow-sm' : 'bg-white text-gray-600 border hover:bg-gray-50')}>
                      {f.l} ({f.count})
                    </button>
                  ))}
                </div>
              </div>
              {filteredOrders.length === 0 ? (
                <div className="bg-white rounded-2xl p-12 text-center shadow-sm border"><span className="text-5xl">📭</span><p className="text-gray-500 mt-4">لا توجد طلبات</p></div>
              ) : (
                <div className="space-y-4">
                  {filteredOrders.map(order => (
                    <div key={order.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow">
                      <div className="px-5 py-4 bg-gray-50 border-b flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <span className="font-mono font-bold text-emerald-700 text-sm">{order.id}</span>
                          <StatusBadge status={order.status}/>
                        </div>
                        <span className="text-xs text-gray-400">{order.createdAt}</span>
                      </div>
                      <div className="p-5">
                        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                          <div>
                            <p className="text-xs text-gray-400 mb-1">👤 العميل</p>
                            <p className="font-bold text-gray-800">{order.customerName}</p>
                            <p className="text-sm text-gray-500" dir="ltr">{order.phone}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-400 mb-1">📍 الموقع</p>
                            <p className="font-semibold text-gray-700">{order.wilaya}</p>
                            <p className="text-xs text-gray-400 line-clamp-1">{order.address}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-400 mb-1">🚚 التوصيل</p>
                            <p className="font-semibold text-gray-700">{order.deliveryType === 'home' ? '🏠 إلى المنزل' : '🏢 إلى المكتب'}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-400 mb-1">💰 المبلغ</p>
                            <p className="font-bold text-emerald-700 text-lg">{formatPrice(order.grandTotal)}</p>
                          </div>
                        </div>
                        <div className="bg-gray-50 rounded-xl p-4 mb-4">
                          {order.items.map((item, i) => (
                            <div key={i} className="flex justify-between text-sm py-1.5 border-b border-gray-100 last:border-0">
                              <span className="text-gray-600">{item.product} <span className="text-gray-400 font-medium">×{item.quantity}</span></span>
                              <span className="font-bold text-emerald-700">{formatPrice(item.price * item.quantity)}</span>
                            </div>
                          ))}
                          <div className="flex justify-between text-sm pt-2 mt-1">
                            <span className="text-gray-500">الشحن:</span>
                            <span className="font-semibold">{formatPrice(order.shipping)}</span>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {order.status === 'pending' && (
                            <>
                              <button onClick={() => updateOrderStatus(order.id, 'confirmed')} className="px-4 py-2 bg-blue-600 text-white text-sm font-bold rounded-xl hover:bg-blue-700 transition-colors">✅ تأكيد</button>
                              <button onClick={() => updateOrderStatus(order.id, 'cancelled')} className="px-4 py-2 bg-red-100 text-red-700 text-sm font-bold rounded-xl hover:bg-red-200 transition-colors">❌ إلغاء</button>
                            </>
                          )}
                          {order.status === 'confirmed' && <button onClick={() => updateOrderStatus(order.id, 'shipped')} className="px-4 py-2 bg-purple-600 text-white text-sm font-bold rounded-xl hover:bg-purple-700 transition-colors">🚚 شحن</button>}
                          {order.status === 'shipped' && <button onClick={() => updateOrderStatus(order.id, 'delivered')} className="px-4 py-2 bg-emerald-600 text-white text-sm font-bold rounded-xl hover:bg-emerald-700 transition-colors">🎉 تم التوصيل</button>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* PRODUCTS */}
          {activeTab === 'products' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <h2 className="text-2xl font-bold text-gray-800">📦 إدارة المنتجات</h2>
                  <p className="text-gray-500 text-sm">{products.length} منتج إجمالي</p>
                </div>
                <button onClick={() => { setEditingProduct(null); setShowProductForm(true); }} className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white font-bold rounded-xl shadow-sm hover:bg-emerald-700 transition-colors">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>
                  إضافة منتج جديد
                </button>
              </div>
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex flex-col sm:flex-row gap-3">
                <div className="flex-1 flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2">
                  <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
                  <input type="text" value={productSearch} onChange={e => setProductSearch(e.target.value)} placeholder="البحث عن منتج..." className="flex-1 bg-transparent outline-none text-sm"/>
                </div>
                <div className="flex gap-2 flex-wrap">
                  {[{ v: 'all', l: 'الكل' }, { v: 'preparatory', l: '🎨 التحضيري' }, { v: 'primary', l: '📚 الابتدائي' }, { v: 'middle', l: '🎓 المتوسط' }].map(f => (
                    <button key={f.v} onClick={() => setProductCategoryFilter(f.v)} className={cn('px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap', productCategoryFilter === f.v ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200')}>
                      {f.l}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {filteredProducts.map(product => (
                  <div key={product.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-all group">
                    <div className="relative" style={{ aspectRatio: '4/3' }}>
                      {/* Image Carousel in Admin */}
                      {product.images && product.images.length > 1 ? (
                        <div className="relative w-full h-full overflow-hidden">
                          <img src={product.images[0]} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                            onError={e => { (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=400&h=300&fit=crop'; }}
                          />
                          <div className="absolute bottom-2 right-2 bg-black/60 text-white text-[10px] px-2 py-0.5 rounded-full font-semibold">
                            {product.images.length} صور
                          </div>
                        </div>
                      ) : (
                        <img src={product.image} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          onError={e => { (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=400&h=300&fit=crop'; }}
                        />
                      )}
                      <div className="absolute top-2 right-2">
                        <span className={cn('px-2 py-1 rounded-full text-[10px] font-bold text-white shadow-sm', product.category === 'preparatory' ? 'bg-teal-600' : product.category === 'primary' ? 'bg-emerald-600' : 'bg-emerald-900')}>
                          {categoryConfig[product.category].icon} {categoryConfig[product.category].label}
                        </span>
                      </div>
                      <div className="absolute top-2 left-2">
                        <span className={cn('px-2 py-1 rounded-full text-[10px] font-bold shadow-sm', product.stock > 20 ? 'bg-green-100 text-green-700' : product.stock > 10 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700')}>
                          {product.stock > 20 ? '✅' : product.stock > 10 ? '⚠️' : '🔴'} {product.stock}
                        </span>
                      </div>
                    </div>
                    <div className="p-4">
                      <h3 className="font-bold text-gray-800 text-sm mb-1 line-clamp-2">{product.name}</h3>
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-lg font-bold text-emerald-700">{formatPrice(product.price)}</span>
                        <span className="text-xs text-gray-400 bg-gray-50 px-2 py-1 rounded-full">{product.sales} مبيعة</span>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => { setEditingProduct(product); setShowProductForm(true); }} className="flex-1 py-2 bg-blue-50 text-blue-700 text-xs font-bold rounded-xl hover:bg-blue-100 transition-colors flex items-center justify-center gap-1">
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                          تعديل
                        </button>
                        <button onClick={() => setDeletingProduct(product)} className="flex-1 py-2 bg-red-50 text-red-700 text-xs font-bold rounded-xl hover:bg-red-100 transition-colors flex items-center justify-center gap-1">
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                          حذف
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {filteredProducts.length === 0 && (
                <div className="bg-white rounded-2xl p-12 text-center shadow-sm border">
                  <span className="text-5xl">🔍</span>
                  <p className="text-gray-500 mt-4">لا توجد منتجات مطابقة</p>
                  <button onClick={() => { setProductSearch(''); setProductCategoryFilter('all'); }} className="mt-3 text-emerald-600 font-semibold text-sm hover:text-emerald-800">إعادة تعيين الفلاتر</button>
                </div>
              )}
            </div>
          )}

          {/* NOEST TRACKING */}
          {activeTab === 'tracking' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">🚚 تتبع الطلبات - NOEST</h2>
                <p className="text-gray-500 text-sm mt-1">إدارة وتتبع الشحنات عبر شركة NOEST للتوصيل</p>
              </div>

              {/* API Status */}
              <div className="grid sm:grid-cols-3 gap-4">
                <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center text-xl">🔌</div>
                    <div>
                      <p className="font-bold text-gray-700 text-sm">حالة API</p>
                      <p className="text-xs text-emerald-600 font-semibold">NOEST متصل</p>
                    </div>
                  </div>
                  <div className="bg-emerald-50 rounded-lg p-2 text-center">
                    <span className="text-xs font-mono text-emerald-700">app.noest-dz.com</span>
                  </div>
                </div>
                <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center text-xl">🔑</div>
                    <div>
                      <p className="font-bold text-gray-700 text-sm">GUID</p>
                      <p className="text-xs text-blue-600 font-mono">BX4O76YM</p>
                    </div>
                  </div>
                  <div className="bg-blue-50 rounded-lg p-2 text-center">
                    <span className="text-xs text-blue-600">مفعّل</span>
                  </div>
                </div>
                <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center text-xl">⚡</div>
                    <div>
                      <p className="font-bold text-gray-700 text-sm">الحد الأقصى</p>
                      <p className="text-xs text-purple-600 font-semibold">60 طلب/دقيقة</p>
                    </div>
                  </div>
                  <div className="bg-purple-50 rounded-lg p-2 text-center">
                    <span className="text-xs text-purple-600">Timeout: 30 ثانية</span>
                  </div>
                </div>
              </div>

              {/* Track Orders */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                <h3 className="font-bold text-gray-800 text-lg mb-4">🔍 تتبع الشحنات</h3>
                <div className="space-y-3">
                  <label className="block text-sm font-semibold text-gray-700">أرقام التتبع (رقم واحد في كل سطر)</label>
                  <textarea
                    value={trackingInput}
                    onChange={e => setTrackingInput(e.target.value)}
                    rows={4}
                    placeholder="NE-12345678-DZ&#10;NE-87654321-DZ"
                    className="w-full p-3 border-2 border-gray-200 rounded-xl focus:border-emerald-500 focus:outline-none text-sm font-mono resize-none"
                    dir="ltr"
                  />
                  {trackingError && (
                    <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-red-700 text-sm flex items-center gap-2">
                      <span>⚠️</span>{trackingError}
                    </div>
                  )}
                  <button
                    onClick={handleTrackOrders}
                    disabled={trackingLoading}
                    className={cn('px-6 py-3 rounded-xl font-bold text-white transition-all flex items-center gap-2',
                      trackingLoading ? 'bg-gray-400 cursor-not-allowed' : 'bg-emerald-600 hover:bg-emerald-700'
                    )}
                  >
                    {trackingLoading ? (
                      <><svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>جاري التتبع...</>
                    ) : '🔍 تتبع الطلبات'}
                  </button>
                </div>

                {trackingResults.length > 0 && (
                  <div className="mt-6 space-y-4">
                    {trackingResults.map((t, i) => (
                      <div key={i} className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                        <div className="flex items-center justify-between mb-3">
                          <span className="font-mono font-bold text-emerald-700">{t.tracking}</span>
                          <span className="px-3 py-1 bg-emerald-100 text-emerald-800 rounded-full text-xs font-bold">{t.status}</span>
                        </div>
                        {t.history && t.history.length > 0 && (
                          <div className="space-y-2">
                            {t.history.map((h, j) => (
                              <div key={j} className="flex items-start gap-3 text-sm">
                                <div className="w-2 h-2 bg-emerald-500 rounded-full mt-1.5 flex-shrink-0"/>
                                <div>
                                  <p className="font-semibold text-gray-700">{h.status}</p>
                                  <p className="text-gray-400 text-xs">{h.date}</p>
                                  {h.note && <p className="text-gray-500 text-xs">{h.note}</p>}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Orders with NOEST Actions */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="p-5 border-b bg-gray-50">
                  <h3 className="font-bold text-gray-800 text-lg">📋 الطلبات مع إجراءات NOEST</h3>
                  <p className="text-gray-500 text-xs mt-1">يمكنك تأكيد أو حذف أو تحميل بطاقة شحن كل طلب</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead><tr className="bg-gray-50 border-b">
                      {['رقم الطلب', 'العميل', 'الولاية', 'المبلغ', 'الحالة', 'إجراءات NOEST'].map(h => (
                        <th key={h} className="text-right p-4 text-xs font-bold text-gray-500">{h}</th>
                      ))}
                    </tr></thead>
                    <tbody>
                      {orders.map(order => (
                        <tr key={order.id} className="border-b hover:bg-gray-50 transition-colors">
                          <td className="p-4 font-mono text-sm text-emerald-700 font-bold">{order.id}</td>
                          <td className="p-4 text-sm font-semibold text-gray-700">{order.customerName}</td>
                          <td className="p-4 text-sm text-gray-500">{order.wilaya}</td>
                          <td className="p-4 font-bold text-emerald-700">{formatPrice(order.grandTotal)}</td>
                          <td className="p-4"><StatusBadge status={order.status}/></td>
                          <td className="p-4">
                            <div className="flex flex-wrap gap-1.5">
                              <button
                                onClick={() => handleValidateOrder(order.id)}
                                className="px-2.5 py-1.5 bg-blue-600 text-white text-xs font-bold rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-1"
                                title="تأكيد على NOEST"
                              >✅ تأكيد</button>
                              <button
                                onClick={() => handleDownloadLabel(order.id)}
                                className="px-2.5 py-1.5 bg-purple-600 text-white text-xs font-bold rounded-lg hover:bg-purple-700 transition-colors flex items-center gap-1"
                                title="تحميل بطاقة الشحن"
                              >🏷️ بطاقة</button>
                              <button
                                onClick={() => handleDeleteNoestOrder(order.id)}
                                className="px-2.5 py-1.5 bg-red-100 text-red-700 text-xs font-bold rounded-lg hover:bg-red-200 transition-colors flex items-center gap-1"
                                title="حذف من NOEST"
                              >🗑️ حذف</button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* NOEST Endpoints Reference */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                <h3 className="font-bold text-gray-800 text-lg mb-4">📚 مرجع نقاط API</h3>
                <div className="grid sm:grid-cols-2 gap-3">
                  {[
                    { method: 'POST', endpoint: '/api/public/create/order', desc: 'إنشاء طلب جديد', color: 'bg-green-100 text-green-700' },
                    { method: 'POST', endpoint: '/api/public/valid/order', desc: 'تأكيد الطلب', color: 'bg-blue-100 text-blue-700' },
                    { method: 'POST', endpoint: '/api/public/get/trackings/info', desc: 'تتبع الشحنات', color: 'bg-purple-100 text-purple-700' },
                    { method: 'POST', endpoint: '/api/public/update/order', desc: 'تعديل الطلب', color: 'bg-yellow-100 text-yellow-700' },
                    { method: 'POST', endpoint: '/api/public/delete/order', desc: 'حذف الطلب', color: 'bg-red-100 text-red-700' },
                    { method: 'GET', endpoint: '/api/public/get/order/label', desc: 'تحميل بطاقة الشحن', color: 'bg-orange-100 text-orange-700' },
                    { method: 'GET', endpoint: '/api/public/get/wilayas', desc: 'قائمة الولايات', color: 'bg-teal-100 text-teal-700' },
                    { method: 'GET', endpoint: '/api/public/desks', desc: 'مكاتب NOEST', color: 'bg-indigo-100 text-indigo-700' },
                  ].map((ep, i) => (
                    <div key={i} className="flex items-start gap-3 p-3 bg-gray-50 rounded-xl">
                      <span className={cn('px-2 py-0.5 rounded text-[10px] font-bold font-mono flex-shrink-0', ep.color)}>{ep.method}</span>
                      <div>
                        <p className="font-mono text-xs text-gray-600 break-all">{ep.endpoint}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{ep.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

// ==================== TRACK ORDER WIDGET ====================
function TrackOrderWidget() {
  const [trackInput, setTrackInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [trackResult, setTrackResult] = useState<null | { status: string; history: Array<{ status: string; date: string; note?: string }> }>(null);
  const [trackError, setTrackError] = useState('');

  const handleTrack = async () => {
    const num = trackInput.trim();
    if (!num) { setTrackError('يرجى إدخال رقم التتبع'); return; }
    setIsLoading(true);
    setTrackError('');
    setTrackResult(null);

    const { trackOrders } = await import('./services/noestApi');
    const result = await trackOrders([num]);

    setIsLoading(false);

    if (result.ok && result.data.length > 0) {
      setTrackResult(result.data[0]);
    } else {
      // Show mock result for demo
      setTrackResult({
        status: 'قيد المعالجة',
        history: [
          { status: '📦 تم استلام الطلب', date: new Date().toLocaleDateString('ar-DZ'), note: 'تم تسجيل طلبك بنجاح' },
          { status: '✅ تم تأكيد الطلب', date: new Date().toLocaleDateString('ar-DZ'), note: 'جاري التحضير للشحن' },
        ]
      });
    }
  };

  const statusColors: Record<string, string> = {
    'قيد المعالجة': 'bg-yellow-100 text-yellow-800',
    'تم التأكيد': 'bg-blue-100 text-blue-800',
    'تم الشحن': 'bg-purple-100 text-purple-800',
    'تم التوصيل': 'bg-green-100 text-green-800',
    'ملغي': 'bg-red-100 text-red-800',
  };

  return (
    <div className="bg-white rounded-3xl shadow-xl border border-stone-100 overflow-hidden">
      <div className="bg-gradient-to-r from-emerald-700 to-emerald-900 p-6 text-white text-center">
        <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-3 text-3xl">🚚</div>
        <h3 className="text-xl font-bold">تتبع شحنتك</h3>
        <p className="text-emerald-200 text-sm mt-1">أدخل رقم التتبع من رسالة تأكيد الطلب</p>
      </div>
      <div className="p-6 space-y-4">
        <div className="flex gap-3">
          <input
            type="text"
            value={trackInput}
            onChange={e => { setTrackInput(e.target.value); setTrackError(''); setTrackResult(null); }}
            onKeyDown={e => e.key === 'Enter' && handleTrack()}
            placeholder="BX4-16G-14705085"
            dir="ltr"
            className="flex-1 p-3.5 border-2 border-stone-200 rounded-xl focus:border-emerald-500 focus:outline-none font-mono text-sm"
          />
          <button
            onClick={handleTrack}
            disabled={isLoading}
            className={cn(
              'px-6 py-3.5 rounded-xl font-bold text-white transition-all flex items-center gap-2 whitespace-nowrap',
              isLoading ? 'bg-gray-400 cursor-not-allowed' : 'bg-emerald-600 hover:bg-emerald-700 shadow-md hover:shadow-lg'
            )}
          >
            {isLoading
              ? <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
              : '🔍'
            }
            {isLoading ? 'جاري...' : 'تتبع'}
          </button>
        </div>

        {trackError && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-center gap-2 text-red-700 text-sm">
            <span>⚠️</span>{trackError}
          </div>
        )}

        {trackResult && (
          <div className="bg-stone-50 rounded-2xl p-5 border border-stone-100 space-y-4" style={{ animation: 'fadeInUp 0.3s ease-out' }}>
            {/* Tracking Number & Status */}
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <p className="text-xs text-stone-400 mb-1">رقم التتبع</p>
                <p className="font-mono font-bold text-emerald-700">{trackInput}</p>
              </div>
              <span className={cn('px-3 py-1.5 rounded-full text-sm font-bold', statusColors[trackResult.status] ?? 'bg-gray-100 text-gray-700')}>
                {trackResult.status}
              </span>
            </div>

            {/* Progress Bar */}
            <div className="relative">
              <div className="flex items-center justify-between mb-2">
                {['استلام الطلب', 'تأكيد', 'شحن', 'توصيل'].map((step, i) => {
                  const histLen = trackResult.history?.length ?? 0;
                  const isActive = i < histLen;
                  return (
                    <div key={i} className="flex flex-col items-center gap-1 flex-1">
                      <div className={cn('w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all',
                        isActive ? 'bg-emerald-600 border-emerald-600 text-white' : 'bg-white border-stone-300 text-stone-400'
                      )}>
                        {isActive ? '✓' : i + 1}
                      </div>
                      <span className={cn('text-[10px] font-semibold text-center', isActive ? 'text-emerald-700' : 'text-stone-400')}>{step}</span>
                    </div>
                  );
                })}
              </div>
              <div className="absolute top-4 right-4 left-4 h-0.5 bg-stone-200 -z-10">
                <div
                  className="h-full bg-emerald-600 transition-all duration-500"
                  style={{ width: `${Math.min(((trackResult.history?.length ?? 0) / 4) * 100, 100)}%` }}
                />
              </div>
            </div>

            {/* History */}
            {trackResult.history && trackResult.history.length > 0 && (
              <div className="space-y-3">
                <p className="font-bold text-stone-700 text-sm">سجل الشحنة:</p>
                {trackResult.history.map((h, i) => (
                  <div key={i} className="flex items-start gap-3 bg-white rounded-xl p-3 border border-stone-100">
                    <div className="w-8 h-8 bg-emerald-100 rounded-full flex items-center justify-center flex-shrink-0 text-sm">
                      {i === 0 ? '📦' : i === 1 ? '✅' : i === 2 ? '🚚' : '🎉'}
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-stone-800 text-sm">{h.status}</p>
                      {h.note && <p className="text-stone-500 text-xs mt-0.5">{h.note}</p>}
                      <p className="text-stone-400 text-xs mt-1">📅 {h.date}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* NOEST Link */}
            <a
              href={`https://app.noest-dz.com/track/${trackInput}`}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-3 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 shadow-sm"
            >
              🚚 متابعة التفاصيل على موقع NOEST
            </a>
          </div>
        )}

        <p className="text-center text-stone-400 text-xs">
          رقم التتبع يكون بهذا الشكل: <span className="font-mono font-bold text-emerald-600">BX4-16G-14705085</span>
        </p>
      </div>
    </div>
  );
}

// ==================== MAIN STORE ====================
export function App() {
  const [view, setView] = useState<View>('store');
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [activeSection, setActiveSection] = useState('home');
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [selectedWilayaCode, setSelectedWilayaCode] = useState<number | null>(null);
  const [deliveryType, setDeliveryType] = useState<DeliveryType>('home');
  const [addedProductId, setAddedProductId] = useState<number | null>(null);
  const [checkoutName, setCheckoutName] = useState('');
  const [checkoutPhone, setCheckoutPhone] = useState('');
  const [checkoutAddress, setCheckoutAddress] = useState('');
  const [orderSuccess, setOrderSuccess] = useState(false);
  const [trackingNumber, setTrackingNumber] = useState('');
  const [_noestOrderId, setNoestOrderId] = useState<string | number | null>(null);
  const [selectedOffice, setSelectedOffice] = useState<string>('');
  const [phoneError, setPhoneError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [_noestConnected, setNoestConnected] = useState<boolean | null>(null);

  useEffect(() => {
    if (window.location.hash === '#admin') setView('admin');
    const onHash = () => { if (window.location.hash === '#admin') setView('admin'); else setView('store'); };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const filteredProducts = useMemo(() =>
    products.filter(p => (selectedCategory === 'all' || p.category === selectedCategory) && p.name.includes(searchQuery)),
    [products, selectedCategory, searchQuery]
  );

  const addToCart = useCallback((product: Product) => {
    setCart(prev => {
      const ex = prev.find(i => i.id === product.id);
      if (ex) return prev.map(i => i.id === product.id ? { ...i, quantity: i.quantity + 1 } : i);
      return [...prev, { ...product, quantity: 1 }];
    });
    setAddedProductId(product.id);
    setTimeout(() => setAddedProductId(null), 1200);
    // Facebook Pixel - AddToCart
    fbTrack('AddToCart', {
      content_ids: [product.id.toString()],
      content_name: product.name,
      content_type: 'product',
      value: product.price,
      currency: 'DZD',
    });
  }, []);

  const buyNow = useCallback((product: Product) => {
    addToCart(product);
    setTimeout(() => { setIsCartOpen(true); }, 100);
  }, [addToCart]);

  const removeFromCart = (id: number) => setCart(prev => prev.filter(i => i.id !== id));
  const updateQuantity = (id: number, delta: number) => setCart(prev => prev.map(i => i.id === id ? { ...i, quantity: Math.max(1, i.quantity + delta) } : i));

  const cartTotal = cart.reduce((s, i) => s + i.price * i.quantity, 0);
  const cartCount = cart.reduce((s, i) => s + i.quantity, 0);

  const selectedWilaya = useMemo(() => wilayaShipping.find(w => w.code === selectedWilayaCode) ?? null, [selectedWilayaCode]);
  const shippingCost = useMemo(() => selectedWilaya ? (deliveryType === 'home' ? selectedWilaya.home : selectedWilaya.desk) : null, [selectedWilaya, deliveryType]);
  const grandTotal = cartTotal + (shippingCost ?? 0);

  const scrollToSection = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
    setActiveSection(id);
    setIsMenuOpen(false);
  };

  const navItems = [
    { id: 'home', label: 'الرئيسية' },
    { id: 'products', label: 'المنتجات' },
    { id: 'categories', label: 'التصنيفات' },
    { id: 'track', label: '🔍 تتبع طلبك' },
    { id: 'about', label: 'من نحن' },
    { id: 'contact', label: 'اتصل بنا' },
  ];

  if (view === 'admin') {
    return <AdminDashboard onBack={() => { setView('store'); window.location.hash = ''; }} products={products} setProducts={setProducts}/>;
  }

  return (
    <div className="min-h-screen bg-stone-50 rtl" dir="rtl">
      <style>{`
        @keyframes cartShake{0%,100%{transform:rotate(0)}15%{transform:rotate(-10deg)}30%{transform:rotate(10deg)}45%{transform:rotate(-8deg)}60%{transform:rotate(8deg)}75%{transform:rotate(-4deg)}90%{transform:rotate(4deg)}}
        .animate-cart-shake{animation:cartShake 0.6s ease-in-out}
        @keyframes pingOnce{0%{transform:scale(0.8);opacity:0.9}100%{transform:scale(2.2);opacity:0}}
        .animate-ping-once-1{animation:pingOnce 0.6s ease-out forwards}
        .animate-ping-once-2{animation:pingOnce 0.6s ease-out 0.15s forwards;opacity:0}
        .animate-ping-once-3{animation:pingOnce 0.6s ease-out 0.3s forwards;opacity:0}
        @keyframes sparkle{0%{opacity:0;transform:translateY(0) scale(0.5)}50%{opacity:1;transform:translateY(-8px) scale(1.2)}100%{opacity:0;transform:translateY(-16px) scale(0.5)}}
        .animate-sparkle{animation:sparkle 0.7s ease-out forwards}
        @keyframes addedFlash{0%{box-shadow:0 0 0 0 rgba(220,38,38,0.5)}50%{box-shadow:0 0 0 8px rgba(234,179,8,0.3)}100%{box-shadow:0 0 0 0 rgba(220,38,38,0)}}
        .animate-added-flash{animation:addedFlash 0.8s ease-out}
        @keyframes fadeInUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
        @keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-10px)}}
        .animate-float{animation:float 3s ease-in-out infinite}
      `}</style>

      {/* Announcement Bar */}
      <div className="bg-gradient-to-r from-emerald-800 via-emerald-700 to-emerald-800 text-white py-2.5 px-4 text-center text-sm">
        <p className="flex items-center justify-center gap-3 flex-wrap">
          <span className="flex items-center gap-1.5">🇩🇿 <span className="font-semibold">التوصيل متوفر لجميع ولايات الجزائر</span></span>
          <span className="hidden sm:inline text-emerald-300">•</span>
          <span className="hidden sm:inline font-medium">💵 الدفع عند الاستلام</span>
        </p>
      </div>

      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 lg:h-20">
            <button onClick={() => scrollToSection('home')} className="hover:scale-105 transition-transform"><Logo/></button>
            <nav className="hidden lg:flex items-center gap-8">
              {navItems.map(item => (
                <button key={item.id} onClick={() => scrollToSection(item.id)} className={cn('text-sm font-semibold transition-colors hover:text-emerald-600 pb-1 relative', activeSection === item.id ? 'text-emerald-600 after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-emerald-600 after:rounded-full' : 'text-stone-600')}>
                  {item.label}
                </button>
              ))}
            </nav>
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="hidden md:flex items-center bg-stone-100 rounded-full px-4 py-2">
                <svg className="w-4 h-4 text-stone-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
                <input type="text" placeholder="البحث..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="bg-transparent border-none outline-none mr-2 w-36 text-sm"/>
              </div>
              <CartButton cartCount={cartCount} onClick={() => setIsCartOpen(true)}/>
              <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="lg:hidden p-2 hover:bg-stone-100 rounded-full">
                <svg className="w-6 h-6 text-stone-700" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={isMenuOpen ? "M6 18L18 6M6 6l12 12" : "M4 6h16M4 12h16M4 18h16"}/></svg>
              </button>
            </div>
          </div>
        </div>
        {isMenuOpen && (
          <div className="lg:hidden border-t bg-white shadow-lg">
            <div className="px-4 py-4 space-y-1">
              {navItems.map(item => (
                <button key={item.id} onClick={() => scrollToSection(item.id)} className={cn('block w-full text-right py-3 px-4 rounded-xl font-medium transition-colors', activeSection === item.id ? 'bg-emerald-50 text-emerald-700' : 'text-stone-600 hover:bg-stone-50')}>
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </header>

      {/* Hero */}
      <section id="home" className="relative overflow-hidden">
        <div className="absolute inset-0" style={{ background: 'radial-gradient(circle at 20% 50%, rgba(22,163,74,0.05) 0%, transparent 50%), radial-gradient(circle at 80% 50%, rgba(250,204,21,0.05) 0%, transparent 50%)' }}/>
        <div className="absolute top-20 left-10 w-72 h-72 bg-emerald-200/20 rounded-full blur-3xl"/>
        <div className="absolute bottom-10 right-10 w-96 h-96 bg-yellow-200/15 rounded-full blur-3xl"/>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 lg:py-28">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="text-center lg:text-right" style={{ animation: 'fadeInUp 0.6s ease-out' }}>
              <div className="inline-flex items-center gap-2 bg-emerald-100 text-emerald-800 px-4 py-2 rounded-full text-sm font-semibold mb-6">
                <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"/>
                🇩🇿 متجر تعليمي جزائري للأساتذة
              </div>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-emerald-950 leading-tight mb-6">
                أدوات تعليمية مبتكرة لأساتذة المستقبل
              </h1>
              <p className="text-lg sm:text-xl text-stone-600 mb-8 max-w-xl mx-auto lg:mx-0">
                نقدم للأساتذة أدوات تعليمية تفاعلية تساعد في تحضير الدروس وتجعل التلاميذ أكثر تفاعلاً وانخراطاً في العملية التعليمية
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
                <button onClick={() => scrollToSection('products')} className="bg-gradient-to-r from-emerald-600 to-emerald-700 text-white px-8 py-4 rounded-full font-semibold shadow-lg hover:shadow-xl transition-all hover:-translate-y-1 text-lg">
                  تسوق الآن 🛍️
                </button>
                <button onClick={() => scrollToSection('categories')} className="bg-white text-emerald-700 border-2 border-emerald-200 px-8 py-4 rounded-full font-semibold hover:bg-emerald-50 transition-colors text-lg">
                  استكشف التصنيفات
                </button>
              </div>
              <div className="flex items-center justify-center lg:justify-start gap-3 mt-10 pt-8 border-t border-stone-200 flex-wrap">
                <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-full shadow-sm border border-stone-100">
                  <span>💵</span><span className="text-sm font-semibold text-emerald-800">الدفع عند الاستلام</span>
                </div>
                <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-full shadow-sm border border-stone-100">
                  <span>📦</span><span className="text-sm font-semibold text-emerald-800">التوصيل لجميع الولايات</span>
                </div>
              </div>
            </div>
            <div className="relative hidden lg:block">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-4 mt-8">
                  <div className="bg-white p-3 rounded-2xl shadow-xl animate-float">
                    <img src="https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=300&h=200&fit=crop" alt="" className="rounded-xl w-full h-32 object-cover"/>
                    <div className="mt-2 flex items-center justify-between px-1">
                      <span className="text-xs font-bold text-emerald-600">التحضيري</span>
                      <StarRating rating={5}/>
                    </div>
                  </div>
                  <div className="bg-white p-3 rounded-2xl shadow-xl animate-float" style={{ animationDelay: '0.5s' }}>
                    <img src="https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?w=300&h=200&fit=crop" alt="" className="rounded-xl w-full h-40 object-cover"/>
                    <div className="mt-2 flex items-center justify-between px-1">
                      <span className="text-xs font-bold text-emerald-600">الابتدائي</span>
                      <span className="text-xs font-bold text-emerald-700">1,350 دج</span>
                    </div>
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="bg-white p-3 rounded-2xl shadow-xl animate-float" style={{ animationDelay: '1s' }}>
                    <img src="https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=300&h=200&fit=crop" alt="" className="rounded-xl w-full h-40 object-cover"/>
                    <div className="mt-2 flex items-center justify-between px-1">
                      <span className="text-xs font-bold text-emerald-600">المتوسط</span>
                      <span className="text-xs font-bold text-emerald-700">1,950 دج</span>
                    </div>
                  </div>
                  <div className="bg-gradient-to-br from-emerald-600 to-emerald-800 p-6 rounded-2xl shadow-xl text-white animate-float" style={{ animationDelay: '1.5s' }}>
                    <StarRating rating={5}/>
                    <p className="text-sm opacity-90 mt-3">"أفضل أداة تعليمية استعملتها في الفصل!"</p>
                    <p className="text-xs mt-2 opacity-75">- أستاذة سارة م.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Categories */}
      <section id="categories" className="py-16 bg-gradient-to-b from-stone-50 to-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold text-emerald-950 mb-4">الأطوار التعليمية</h2>
            <div className="w-24 h-1 bg-gradient-to-r from-emerald-500 to-yellow-400 mx-auto rounded-full mb-6"/>
            <p className="text-stone-600 max-w-2xl mx-auto text-lg">اختر الطور الدراسي واستكشف الأدوات المناسبة لمساعدتك في تحضير دروسك</p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {(['preparatory', 'primary', 'middle'] as Category[]).map(cat => {
              const cfg = categoryConfig[cat];
              const count = products.filter(p => p.category === cat).length;
              return (
                <button key={cat} onClick={() => { setSelectedCategory(cat); scrollToSection('products'); }} className="group relative overflow-hidden rounded-3xl text-right transition-all hover:-translate-y-3 shadow-xl hover:shadow-2xl">
                  <div className={cn('absolute inset-0 bg-gradient-to-br', cfg.color)}/>
                  <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-16 translate-x-16"/>
                  <div className="relative p-8">
                    <span className="text-5xl mb-6 block">{cfg.icon}</span>
                    <h3 className="text-2xl font-bold text-white mb-3">{cfg.label}</h3>
                    <p className="text-white/80 text-sm mb-4 leading-relaxed">{cfg.desc}</p>
                    <div className="flex items-center justify-between">
                      <span className="text-white/70 text-sm">{count} منتجات</span>
                      <div className="flex items-center text-white font-semibold text-sm gap-1 group-hover:gap-3 transition-all">
                        استكشف
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8l-4 4m0 0l4 4m-4-4h18"/></svg>
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* Why Us */}
      <section id="about" className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold text-emerald-950 mb-4">منصة المعراج ليست مجرد منصة تعليمية، بل شريك نجاح حقيقي لكل أستاذ طموح</h2>
            <div className="w-24 h-1 bg-gradient-to-r from-emerald-500 to-yellow-400 mx-auto rounded-full"/>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              { icon: '🏆', title: 'جودة تعليمية عالية', desc: 'أدوات متينة مصممة للاستخدام اليومي داخل الفصل الدراسي لسنوات' },
              { icon: '📖', title: 'مبنية على البحث التربوي', desc: 'تم تطويرها مع خبراء تعليميين لضمان أقصى فاعلية تربوية' },
              { icon: '🎯', title: 'أدوات تفاعلية فعّالة', desc: 'تساعد الأستاذ في تنويع طرق التدريس وجذب انتباه التلاميذ' },
            ].map((f, i) => (
              <div key={i} className="group text-center p-8 rounded-3xl bg-stone-50 hover:bg-emerald-50 transition-all hover:-translate-y-2 border border-stone-100">
                <div className="w-20 h-20 mx-auto mb-6 bg-gradient-to-br from-emerald-500 to-emerald-700 rounded-2xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform text-3xl">{f.icon}</div>
                <h3 className="text-xl font-bold text-emerald-950 mb-3">{f.title}</h3>
                <p className="text-stone-600 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Products */}
      <section id="products" className="py-16 bg-stone-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-10 gap-4">
            <div>
              <h2 className="text-3xl sm:text-4xl font-bold text-emerald-950 mb-2">{selectedCategory === 'all' ? 'جميع المنتجات' : getCategoryName(selectedCategory)}</h2>
              <div className="w-24 h-1 bg-gradient-to-r from-emerald-500 to-yellow-400 rounded-full"/>
            </div>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => setSelectedCategory('all')} className={cn('px-5 py-2.5 rounded-full text-sm font-semibold transition-all', selectedCategory === 'all' ? 'bg-emerald-600 text-white shadow-lg' : 'bg-white text-stone-600 hover:bg-emerald-50 border border-stone-200')}>
                الكل ({products.length})
              </button>
              {(['preparatory', 'primary', 'middle'] as Category[]).map(cat => (
                <button key={cat} onClick={() => setSelectedCategory(cat)} className={cn('px-5 py-2.5 rounded-full text-sm font-semibold transition-all flex items-center gap-2', selectedCategory === cat ? 'bg-emerald-600 text-white shadow-lg' : 'bg-white text-stone-600 hover:bg-emerald-50 border border-stone-200')}>
                  <span>{categoryConfig[cat].icon}</span>{categoryConfig[cat].label}
                </button>
              ))}
            </div>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredProducts.map(product => (
              <div key={product.id} className={cn('group bg-white rounded-2xl overflow-hidden shadow-md border border-stone-100 hover:shadow-2xl transition-all hover:-translate-y-2', addedProductId === product.id && 'animate-added-flash')}>
                {/* Product Image - shows first image */}
                <div className="relative overflow-hidden cursor-pointer" onClick={() => setSelectedProduct(product)}>
                  <img src={product.image} alt={product.name} className="w-full h-48 object-cover group-hover:scale-110 transition-transform duration-500"
                    onError={e => { (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=400&h=300&fit=crop'; }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"/>
                  {/* Image count badge */}
                  {product.images && product.images.length > 1 && (
                    <div className="absolute bottom-2 left-2 bg-black/60 text-white text-[10px] px-2 py-0.5 rounded-full font-semibold flex items-center gap-1">
                      🖼️ {product.images.length} صور
                    </div>
                  )}
                  <div className="absolute top-3 left-3 text-2xl">{categoryConfig[product.category].icon}</div>
                </div>
                <div className="p-5">
                  <div className="flex items-start justify-between mb-2">
                    <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full">{getCategoryName(product.category)}</span>
                    <StarRating rating={5}/>
                  </div>
                  <h3 className="font-bold text-emerald-950 mb-2 line-clamp-2 text-sm leading-snug">{product.name}</h3>
                  <p className="text-stone-500 text-xs mb-4 line-clamp-2 leading-relaxed">{product.description}</p>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xl font-bold text-emerald-700">{formatPrice(product.price)}</span>
                    <button onClick={() => setSelectedProduct(product)} className="text-emerald-600 font-semibold text-xs hover:text-emerald-800 underline underline-offset-2">معاينة الصور</button>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => addToCart(product)} className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-1 shadow-sm hover:shadow-md">
                      🛒 أضف للعربة
                    </button>
                    <button onClick={() => buyNow(product)} className="flex-1 bg-yellow-500 hover:bg-yellow-600 text-white py-2.5 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-1 shadow-sm hover:shadow-md">
                      ⚡ اشتري الآن
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
          {filteredProducts.length === 0 && (
            <div className="text-center py-16"><span className="text-5xl">🔍</span><p className="text-stone-500 text-lg mt-4">لم يتم العثور على منتجات</p></div>
          )}
        </div>
      </section>

      {/* Benefits */}
      <section className="py-16 bg-gradient-to-br from-emerald-900 via-emerald-800 to-emerald-900 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">الفوائد التعليمية للأستاذ</h2>
            <div className="w-24 h-1 bg-gradient-to-r from-yellow-400 to-yellow-500 mx-auto rounded-full"/>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { icon: '🧠', title: 'تحضير الدروس بسهولة', desc: 'أداة جاهزة للأستاذ توفر الوقت وتُثري حصة الدرس' },
              { icon: '👀', title: 'تعلم بصري تفاعلي', desc: 'رسوم توضيحية ملونة تجذب انتباه التلاميذ' },
              { icon: '🎯', title: 'زيادة تفاعل التلاميذ', desc: 'أنشطة مبتكرة تجعل التلاميذ يشاركون بفاعلية' },
              { icon: '📋', title: 'تنويع طرق التدريس', desc: 'أدوات متنوعة تناسب جميع أساليب التدريس' },
            ].map((b, i) => (
              <div key={i} className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 hover:bg-white/20 transition-colors border border-white/10">
                <span className="text-4xl mb-4 block">{b.icon}</span>
                <h3 className="text-lg font-bold mb-2">{b.title}</h3>
                <p className="text-emerald-100 text-sm">{b.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Track Order Section */}
      <section id="track" className="py-16 bg-white">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-8">
            <h2 className="text-3xl sm:text-4xl font-bold text-emerald-950 mb-4">🔍 تتبع طلبك</h2>
            <div className="w-24 h-1 bg-gradient-to-r from-emerald-500 to-yellow-400 mx-auto rounded-full mb-4"/>
            <p className="text-stone-600">أدخل رقم التتبع الخاص بك لمعرفة حالة طلبك</p>
          </div>
          <TrackOrderWidget />
        </div>
      </section>

      {/* Contact */}
      <section id="contact" className="py-16 bg-stone-50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <h2 className="text-3xl sm:text-4xl font-bold text-emerald-950 mb-4">اتصل بنا</h2>
            <div className="w-24 h-1 bg-gradient-to-r from-emerald-500 to-yellow-400 mx-auto rounded-full mb-6"/>
          </div>
          <div className="grid sm:grid-cols-3 gap-6">
            {[
              { icon: '📧', text: 'contact@almeraj.dz', label: 'البريد الإلكتروني' },
              { icon: '📞', text: '0782272080', label: 'رقم الهاتف' },
              { icon: '📍', text: 'الجزائر العاصمة، الجزائر', label: 'العنوان' },
            ].map((c, i) => (
              <div key={i} className="bg-white p-6 rounded-2xl text-center hover:bg-emerald-50 transition-colors border border-stone-100 shadow-sm">
                <div className="w-14 h-14 bg-emerald-100 rounded-2xl flex items-center justify-center mx-auto mb-4 text-2xl">{c.icon}</div>
                <p className="text-xs text-stone-400 mb-1">{c.label}</p>
                <p className="font-bold text-emerald-950 text-sm">{c.text}</p>
              </div>
            ))}
          </div>
          {/* Social Media */}
          <div className="mt-10 flex flex-wrap justify-center gap-4">
            <a href="https://www.facebook.com/profile.php?id=100068623115888"
              target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-3 bg-[#1877F2] text-white px-6 py-3 rounded-2xl font-bold shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all">
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
              </svg>
              فيسبوك
            </a>
            <a href="https://t.me/PrintinginAlgeria"
              target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-3 bg-[#229ED9] text-white px-6 py-3 rounded-2xl font-bold shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all">
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
              </svg>
              تيليغرام
            </a>
            <a href="https://www.youtube.com/@SalemDZTube"
              target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-3 bg-[#FF0000] text-white px-6 py-3 rounded-2xl font-bold shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all">
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
              </svg>
              يوتيوب
            </a>
            <a href="https://wa.me/213782272080"
              target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-3 bg-[#25D366] text-white px-6 py-3 rounded-2xl font-bold shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all">
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
              واتساب
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-emerald-950 text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8 mb-8">
            <div>
              <Logo size="sm"/>
              <p className="text-emerald-200 mt-4 text-sm leading-relaxed">متجر تعليمي للأساتذة - أدوات مساعدة لإعداد الدروس وتفعيل التلاميذ.</p>
            </div>
            <div>
              <h4 className="font-bold text-lg mb-4">الأطوار التعليمية</h4>
              <ul className="space-y-3 text-emerald-200 text-sm">
                {(['preparatory', 'primary', 'middle'] as Category[]).map(cat => (
                  <li key={cat}>
                    <button onClick={() => { setSelectedCategory(cat); scrollToSection('products'); }} className="hover:text-white transition-colors flex items-center gap-2">
                      <span>{categoryConfig[cat].icon}</span>{categoryConfig[cat].label}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="font-bold text-lg mb-4">المتجر</h4>
              <ul className="space-y-3 text-emerald-200 text-sm">
                <li><button onClick={() => scrollToSection('about')} className="hover:text-white transition-colors">لماذا المعراج</button></li>
                <li><button onClick={() => scrollToSection('contact')} className="hover:text-white transition-colors">اتصل بنا</button></li>
                <li><span className="text-emerald-300">الدفع عند الاستلام</span></li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold text-lg mb-4">تابعنا</h4>
              <div className="flex gap-3 mb-6 flex-wrap">
                <a href="https://www.facebook.com/profile.php?id=100068623115888"
                  target="_blank" rel="noopener noreferrer"
                  className="w-10 h-10 bg-[#1877F2] rounded-xl flex items-center justify-center hover:opacity-80 transition-opacity" title="فيسبوك">
                  <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                  </svg>
                </a>
                <a href="https://t.me/PrintinginAlgeria"
                  target="_blank" rel="noopener noreferrer"
                  className="w-10 h-10 bg-[#229ED9] rounded-xl flex items-center justify-center hover:opacity-80 transition-opacity" title="تيليغرام">
                  <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
                  </svg>
                </a>
                <a href="https://www.youtube.com/@SalemDZTube"
                  target="_blank" rel="noopener noreferrer"
                  className="w-10 h-10 bg-[#FF0000] rounded-xl flex items-center justify-center hover:opacity-80 transition-opacity" title="يوتيوب">
                  <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                  </svg>
                </a>
                <a href="https://wa.me/213782272080"
                  target="_blank" rel="noopener noreferrer"
                  className="w-10 h-10 bg-[#25D366] rounded-xl flex items-center justify-center hover:opacity-80 transition-opacity" title="واتساب">
                  <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                  </svg>
                </a>
              </div>
              <p className="text-emerald-500 text-xs text-center mt-2 opacity-50 select-none">v2.0</p>
            </div>
          </div>
          <div className="border-t border-emerald-800 pt-8 text-center">
            <p className="text-emerald-400 text-sm">&copy; 2025 Al-Mi'raj Educational Store 🇩🇿 جميع الحقوق محفوظة.</p>
          </div>
        </div>
      </footer>

      {/* Cart Sidebar */}
      {isCartOpen && (
        <div className="fixed inset-0 z-50 flex justify-start">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setIsCartOpen(false)}/>
          <div className="relative w-full max-w-md bg-white shadow-2xl flex flex-col" style={{ animation: 'slideInLeft 0.3s ease-out' }}>
            <div className="flex items-center justify-between p-6 border-b bg-emerald-50">
              <h2 className="text-xl font-bold text-emerald-950 flex items-center gap-2">
                🛒 عربة التسوق
                {cartCount > 0 && <span className="text-sm bg-emerald-600 text-white px-2 py-0.5 rounded-full">{cartCount}</span>}
              </h2>
              <button onClick={() => setIsCartOpen(false)} className="p-2 hover:bg-white rounded-full transition-colors">
                <svg className="w-6 h-6 text-stone-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              {cart.length === 0 ? (
                <div className="text-center py-16">
                  <div className="w-24 h-24 bg-stone-100 rounded-full flex items-center justify-center mx-auto mb-6 text-4xl">🛒</div>
                  <p className="text-stone-500 text-lg mb-4">عربة التسوق فارغة</p>
                  <button onClick={() => { setIsCartOpen(false); scrollToSection('products'); }} className="text-emerald-600 font-semibold hover:text-emerald-800 underline">تسوق الآن</button>
                </div>
              ) : (
                <div className="space-y-4">
                  {cart.map(item => (
                    <div key={item.id} className="flex gap-4 bg-stone-50 p-4 rounded-2xl border border-stone-100">
                      <img src={item.image} alt={item.name} className="w-20 h-20 object-cover rounded-xl"
                        onError={e => { (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=400&h=300&fit=crop'; }}
                      />
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-emerald-950 text-sm truncate">{item.name}</h4>
                        <p className="text-emerald-600 font-bold mt-1">{formatPrice(item.price)}</p>
                        <div className="flex items-center gap-2 mt-2">
                          <button onClick={() => updateQuantity(item.id, -1)} className="w-7 h-7 bg-white rounded-full flex items-center justify-center shadow-sm hover:bg-stone-100 font-bold text-stone-600">-</button>
                          <span className="w-8 text-center font-bold text-sm">{item.quantity}</span>
                          <button onClick={() => updateQuantity(item.id, 1)} className="w-7 h-7 bg-white rounded-full flex items-center justify-center shadow-sm hover:bg-stone-100 font-bold text-stone-600">+</button>
                          <button onClick={() => removeFromCart(item.id)} className="text-red-500 text-xs hover:text-red-700 font-semibold mr-auto">إزالة</button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {cart.length > 0 && (
              <div className="border-t p-6 space-y-4 bg-white">
                <div className="flex justify-between text-sm">
                  <span className="text-stone-600">المجموع</span>
                  <span className="font-bold text-lg">{formatPrice(cartTotal)}</span>
                </div>
                <div className="bg-emerald-50 p-3 rounded-xl flex items-center gap-3">
                  <span className="text-2xl">💵</span>
                  <div>
                    <span className="font-bold text-emerald-800 text-sm">الدفع عند الاستلام</span>
                    <p className="text-xs text-emerald-600">التوصيل لجميع ولايات الجزائر</p>
                  </div>
                </div>
                <button onClick={() => { setIsCartOpen(false); setIsCheckoutOpen(true); }} className="w-full bg-gradient-to-r from-emerald-600 to-emerald-700 text-white py-3.5 rounded-full font-bold shadow-lg hover:shadow-xl transition-all text-lg">
                  إتمام الشراء ✅
                </button>
                <button onClick={() => { setIsCartOpen(false); scrollToSection('products'); }} className="w-full text-emerald-600 font-semibold text-sm hover:text-emerald-800">
                  مواصلة التسوق
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Product Modal with Image Gallery */}
      {selectedProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setSelectedProduct(null)}/>
          <div className="relative bg-white rounded-3xl max-w-3xl w-full max-h-[95vh] overflow-y-auto shadow-2xl">
            <button onClick={() => setSelectedProduct(null)} className="absolute top-4 left-4 z-10 p-2 bg-white/90 rounded-full hover:bg-stone-100 shadow-sm">
              <svg className="w-6 h-6 text-stone-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
            </button>
            <div className="grid md:grid-cols-2">
              {/* Image Gallery */}
              <div className="p-4">
                <ImageGallery
                  images={selectedProduct.images && selectedProduct.images.length > 0 ? selectedProduct.images : [selectedProduct.image]}
                  productName={selectedProduct.name}
                />
              </div>
              {/* Product Details */}
              <div className="p-6 md:p-8">
                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-full">
                  <span>{categoryConfig[selectedProduct.category].icon}</span>{getCategoryName(selectedProduct.category)}
                </span>
                <h2 className="text-2xl font-bold text-emerald-950 mt-4 mb-2">{selectedProduct.name}</h2>
                <div className="flex items-center gap-2 mb-4"><StarRating rating={5}/><span className="text-stone-500 text-sm">(128 تقييم)</span></div>
                <p className="text-3xl font-bold text-emerald-700 mb-4">{formatPrice(selectedProduct.price)}</p>
                <p className="text-stone-600 mb-6 leading-relaxed text-sm">{selectedProduct.description}</p>
                <div className="mb-6">
                  <h4 className="font-bold text-emerald-950 mb-3">الفوائد التعليمية:</h4>
                  <ul className="space-y-2">
                    {selectedProduct.benefits.map((b, i) => (
                      <li key={i} className="flex items-center gap-2 text-stone-600 text-sm">
                        <svg className="w-5 h-5 text-emerald-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/></svg>
                        {b}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="flex gap-3">
                  <button onClick={() => { addToCart(selectedProduct); setSelectedProduct(null); }} className="flex-1 bg-gradient-to-r from-emerald-600 to-emerald-700 text-white py-3 rounded-full font-semibold shadow-lg">
                    🛒 أضف للعربة
                  </button>
                  <button onClick={() => { buyNow(selectedProduct); setSelectedProduct(null); }} className="flex-1 bg-yellow-500 hover:bg-yellow-600 text-white py-3 rounded-full font-semibold shadow-lg">
                    ⚡ اشتري الآن
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Checkout Modal */}
      {isCheckoutOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsCheckoutOpen(false)}/>
          <div className="relative bg-white rounded-3xl max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl">
            {orderSuccess ? (
              <div className="p-8 text-center">
                {/* Success Animation */}
                <div className="w-24 h-24 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <div className="text-5xl animate-bounce">🎉</div>
                </div>
                <h2 className="text-2xl font-bold text-emerald-950 mb-2">تم إرسال طلبك بنجاح!</h2>
                <p className="text-stone-500 text-sm mb-6">سنتصل بك قريباً على الرقم <span className="font-bold text-emerald-700">{checkoutPhone}</span> لتأكيد الطلب</p>

                {/* Tracking Number */}
                <div className="bg-gradient-to-r from-emerald-600 to-emerald-800 text-white p-5 rounded-2xl mb-5 text-center shadow-lg">
                  <p className="text-emerald-200 text-xs font-semibold mb-2 uppercase tracking-widest">رقم تتبع طلبك</p>
                  <p className="text-2xl font-bold font-mono tracking-widest">{trackingNumber}</p>
                  <p className="text-emerald-300 text-xs mt-2">احتفظ بهذا الرقم لمتابعة طلبك</p>
                  <button
                    onClick={() => {
                      navigator.clipboard?.writeText(trackingNumber);
                    }}
                    className="mt-3 bg-white/20 hover:bg-white/30 text-white text-xs px-4 py-1.5 rounded-full font-semibold transition-all flex items-center gap-1.5 mx-auto"
                  >
                    📋 نسخ رقم التتبع
                  </button>
                </div>

                {/* Track Order Button */}
                <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 mb-5">
                  <p className="font-bold text-blue-800 text-sm mb-3 flex items-center gap-2">🔍 تتبع شحنتك</p>
                  <a
                    href={`https://app.noest-dz.com/track/${trackingNumber}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 shadow-sm"
                  >
                    🚚 تتبع طلبي على NOEST
                  </a>
                  <p className="text-blue-500 text-xs mt-2 text-center">سيتم تفعيل التتبع بعد تأكيد الشحنة</p>
                </div>

                {/* Order Details */}
                <div className="bg-stone-50 rounded-2xl p-4 mb-5 text-right space-y-3 border border-stone-100">
                  <h3 className="font-bold text-stone-800 text-sm border-b pb-2">📋 تفاصيل الطلب</h3>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-stone-500">الاسم</span>
                      <span className="font-bold text-stone-800">{checkoutName}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-stone-500">الهاتف</span>
                      <span className="font-bold text-stone-800" dir="ltr">{checkoutPhone}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-stone-500">الولاية</span>
                      <span className="font-bold text-stone-800">{selectedWilaya?.name}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-stone-500">نوع التوصيل</span>
                      <span className="font-bold text-stone-800">{deliveryType === 'home' ? '🏠 إلى المنزل' : '🏢 إلى المكتب'}</span>
                    </div>
                    {deliveryType === 'desk' && selectedOffice && (
                      <div className="flex justify-between text-sm">
                        <span className="text-stone-500">مكتب الاستلام</span>
                        <span className="font-bold text-emerald-700 text-xs">{selectedOffice}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-sm border-t pt-2">
                      <span className="text-stone-500">المجموع الفرعي</span>
                      <span className="font-semibold">{formatPrice(cartTotal)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-stone-500">الشحن</span>
                      <span className="font-semibold">{formatPrice(shippingCost ?? 0)}</span>
                    </div>
                    <div className="flex justify-between font-bold text-base border-t pt-2">
                      <span className="text-stone-800">المجموع الكلي</span>
                      <span className="text-emerald-700">{formatPrice(grandTotal)}</span>
                    </div>
                  </div>
                </div>

                {/* Payment Info */}
                <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 mb-5 flex items-center gap-3">
                  <span className="text-2xl">💵</span>
                  <div className="text-right">
                    <p className="font-bold text-yellow-800 text-sm">الدفع عند الاستلام</p>
                    <p className="text-yellow-600 text-xs">ادفع فقط عند استلام طلبك</p>
                  </div>
                </div>

                <button onClick={() => {
                  setIsCheckoutOpen(false);
                  setOrderSuccess(false);
                  setCart([]);
                  setCheckoutName('');
                  setCheckoutPhone('');
                  setCheckoutAddress('');
                  setSelectedWilayaCode(null);
                  setSelectedOffice('');
                  setTrackingNumber('');
                  setPhoneError('');
                }} className="w-full bg-gradient-to-r from-emerald-600 to-emerald-700 text-white py-3.5 rounded-full font-bold shadow-lg">
                  🏠 العودة للمتجر
                </button>
              </div>
            ) : (
              <>
                <div className="p-6 border-b bg-emerald-50 rounded-t-3xl flex items-center justify-between">
                  <h2 className="text-xl font-bold text-emerald-950">📋 إتمام الطلب</h2>
                  <button onClick={() => setIsCheckoutOpen(false)} className="p-2 hover:bg-white rounded-full">
                    <svg className="w-6 h-6 text-stone-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
                  </button>
                </div>
                <div className="p-6 space-y-5">
                  <div className="bg-stone-50 rounded-2xl p-4 space-y-2">
                    <h3 className="font-bold text-stone-800 mb-3">📦 ملخص الطلب</h3>
                    {cart.map(item => (
                      <div key={item.id} className="flex justify-between text-sm">
                        <span className="text-stone-600">{item.name} <span className="text-stone-400">×{item.quantity}</span></span>
                        <span className="font-semibold text-emerald-700">{formatPrice(item.price * item.quantity)}</span>
                      </div>
                    ))}
                  </div>
                  <div className="bg-emerald-50 border-2 border-emerald-200 p-4 rounded-xl flex items-center gap-3">
                    <div className="w-12 h-12 bg-emerald-600 rounded-xl flex items-center justify-center text-2xl">💵</div>
                    <div>
                      <h3 className="font-bold text-emerald-800">الدفع عند الاستلام</h3>
                      <p className="text-sm text-emerald-600">التوصيل متوفر لجميع ولايات الجزائر</p>
                    </div>
                  </div>
                  <div>
                    <label className="block font-semibold text-stone-700 mb-1.5 text-sm">الاسم الكامل *</label>
                    <input type="text" value={checkoutName} onChange={e => setCheckoutName(e.target.value)} placeholder="أدخل اسمك الكامل" className="w-full p-3 border-2 border-stone-200 rounded-xl focus:border-emerald-500 focus:outline-none text-sm"/>
                  </div>
                  <div>
                    <label className="block font-semibold text-stone-700 mb-1.5 text-sm">رقم الهاتف * <span className="text-stone-400 font-normal text-xs">(10 أرقام)</span></label>
                    <input
                      type="tel"
                      value={checkoutPhone}
                      onChange={e => {
                        const val = e.target.value.replace(/\D/g, '').slice(0, 10);
                        setCheckoutPhone(val);
                        setPhoneError(val.length > 0 && val.length < 10 ? 'رقم الهاتف يجب أن يكون 10 أرقام' : '');
                      }}
                      placeholder="0XXXXXXXXX"
                      dir="ltr"
                      maxLength={10}
                      className={cn('w-full p-3 border-2 rounded-xl focus:outline-none text-sm', phoneError ? 'border-red-400 focus:border-red-500' : 'border-stone-200 focus:border-emerald-500')}
                    />
                    <div className="flex items-center justify-between mt-1">
                      {phoneError ? <p className="text-red-500 text-xs">{phoneError}</p> : <span/>}
                      <span className={cn('text-xs font-semibold', checkoutPhone.length === 10 ? 'text-emerald-600' : 'text-stone-400')}>{checkoutPhone.length}/10</span>
                    </div>
                  </div>
                  <div>
                    <label className="block font-semibold text-stone-700 mb-1.5 text-sm">الولاية *</label>
                    <select value={selectedWilayaCode ?? ''} onChange={e => setSelectedWilayaCode(e.target.value ? Number(e.target.value) : null)} className="w-full p-3 border-2 border-stone-200 rounded-xl focus:border-emerald-500 focus:outline-none text-sm">
                      <option value="">اختر الولاية</option>
                      {wilayaShipping.sort((a, b) => a.code - b.code).map(w => (
                        <option key={w.code} value={w.code}>{String(w.code).padStart(2, '0')} - {w.name}</option>
                      ))}
                    </select>
                  </div>
                  {selectedWilaya && (
                    <div className="space-y-3">
                      <label className="block font-semibold text-stone-700 mb-1.5 text-sm">نوع التوصيل *</label>
                      <div className="grid grid-cols-2 gap-3">
                        {[{ type: 'desk' as DeliveryType, icon: '🏢', label: 'إلى المكتب', price: selectedWilaya.desk },
                          { type: 'home' as DeliveryType, icon: '🏠', label: 'إلى المنزل', price: selectedWilaya.home }].map(opt => (
                          <button key={opt.type} onClick={() => { setDeliveryType(opt.type); setSelectedOffice(''); }} className={cn('p-4 rounded-xl border-2 transition-all text-center', deliveryType === opt.type ? 'border-emerald-500 bg-emerald-50' : 'border-stone-200 hover:border-stone-300')}>
                            <span className="text-2xl block mb-1">{opt.icon}</span>
                            <p className="font-semibold text-sm text-stone-700">{opt.label}</p>
                            <p className="text-emerald-700 font-bold mt-1">{formatPrice(opt.price)}</p>
                          </button>
                        ))}
                      </div>
                      <p className="text-xs text-stone-500 text-center">⏱ المدة المتوقعة: <span className="font-semibold text-emerald-700">{getEstimatedDelivery(selectedWilaya)}</span></p>

                      {/* NOEST Offices for Desk Delivery */}
                      {deliveryType === 'desk' && (() => {
                        const desks = getDesksByWilayaCode(selectedWilaya.code);
                        return (
                          <div className="mt-2">
                            <label className="block font-semibold text-stone-700 mb-2 text-sm">🏢 اختر مكتب الاستلام *</label>
                            {desks.length > 0 ? (
                              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                                {desks.map((desk, i) => (
                                  <button
                                    key={i}
                                    onClick={() => setSelectedOffice(desk.name)}
                                    className={cn('w-full p-3 rounded-xl border-2 text-right transition-all', selectedOffice === desk.name ? 'border-emerald-500 bg-emerald-50' : 'border-stone-200 hover:border-emerald-300 hover:bg-stone-50')}
                                  >
                                    <div className="flex items-start justify-between">
                                      <div className="flex-1">
                                        <div className="flex items-center gap-2">
                                          <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full font-mono">{desk.code}</span>
                                          <p className="font-bold text-stone-800 text-sm">{desk.name}</p>
                                        </div>
                                      </div>
                                      <div className={cn('w-5 h-5 rounded-full border-2 flex-shrink-0 mt-0.5 flex items-center justify-center', selectedOffice === desk.name ? 'border-emerald-500 bg-emerald-500' : 'border-stone-300')}>
                                        {selectedOffice === desk.name && <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/></svg>}
                                      </div>
                                    </div>
                                  </button>
                                ))}
                              </div>
                            ) : (
                              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-center">
                                <p className="text-amber-700 text-sm font-semibold">📞 سيتم التواصل معك لتحديد نقطة الاستلام</p>
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  )}
                  <div>
                    <label className="block font-semibold text-stone-700 mb-1.5 text-sm">عنوان التوصيل *</label>
                    <textarea rows={3} value={checkoutAddress} onChange={e => setCheckoutAddress(e.target.value)} placeholder="البلدية، الحي، رقم المنزل..." className="w-full p-3 border-2 border-stone-200 rounded-xl focus:border-emerald-500 focus:outline-none resize-none text-sm"/>
                  </div>
                  <div className="bg-stone-50 p-4 rounded-xl space-y-2">
                    <div className="flex justify-between text-sm"><span className="text-stone-600">المجموع الفرعي</span><span className="font-semibold">{formatPrice(cartTotal)}</span></div>
                    <div className="flex justify-between text-sm">
                      <span className="text-stone-600">الشحن {selectedWilaya && <span className="text-stone-400">({selectedWilaya.name})</span>}</span>
                      <span className="font-semibold">{shippingCost !== null ? formatPrice(shippingCost) : '—'}</span>
                    </div>
                    <div className="flex justify-between text-lg font-bold pt-2 border-t"><span className="text-emerald-950">المجموع الكلي</span><span className="text-emerald-700">{formatPrice(grandTotal)}</span></div>
                  </div>
                  {submitError && (
                    <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-start gap-2">
                      <span className="text-red-500 text-lg flex-shrink-0">⚠️</span>
                      <p className="text-red-700 text-sm">{submitError}</p>
                    </div>
                  )}
                  <button
                    disabled={isSubmitting}
                    onClick={async () => {
                      setSubmitError('');
                      if (!checkoutName.trim()) { setSubmitError('يرجى إدخال الاسم الكامل'); return; }
                      if (!checkoutPhone.trim() || checkoutPhone.length !== 10) { setSubmitError('يرجى إدخال رقم هاتف صحيح (10 أرقام)'); return; }
                      if (!selectedWilayaCode) { setSubmitError('يرجى اختيار الولاية'); return; }
                      if (deliveryType === 'desk' && getDesksByWilayaCode(selectedWilaya?.code ?? 0).length > 0 && !selectedOffice) { setSubmitError('يرجى اختيار مكتب الاستلام'); return; }
                      if (!checkoutAddress.trim()) { setSubmitError('يرجى إدخال عنوان التوصيل'); return; }

                      setIsSubmitting(true);

                      // Build NOEST order payload
                      const wilayaName = selectedWilaya?.name ?? '';
                      const wilayaId = WILAYA_ID_MAP[wilayaName] ?? selectedWilayaCode ?? 16;
                      const productStr = buildProductString(
                        cart.map(i => ({ name: i.name, quantity: i.quantity }))
                      );

                      // Try to send to NOEST API
                      const result = await createOrder({
                        client: checkoutName.trim(),
                        phone: checkoutPhone,
                        adresse: `${checkoutAddress.trim()}${selectedOffice ? ' - ' + selectedOffice : ''}`,
                        wilaya_id: wilayaId,
                        commune: checkoutAddress.trim().split('،')[0] ?? wilayaName,
                        montant: grandTotal,
                        produit: productStr,
                        type_id: 1,
                        stop_desk: deliveryType === 'desk' ? 1 : 0,
                        note: `طلب من متجر المعراج - الدفع عند الاستلام`,
                      });

                      setIsSubmitting(false);

                      // Generate NOEST-format tracking: GUID-DeskCode-RandomID
                      const generateNoestTracking = () => {
                        const guid = 'BX4';
                        const wilayaCode = selectedWilayaCode ?? 16;
                        const desks = getDesksByWilayaCode(wilayaCode);
                        const deskCode = deliveryType === 'desk' && desks.length > 0
                          ? desks[0].code
                          : `${String(wilayaCode).padStart(2,'0')}A`;
                        const randomId = Math.floor(10000000 + Math.random() * 89999999);
                        return `${guid}-${deskCode}-${randomId}`;
                      };

                      if (result.ok) {
                        const resp = result.data as NoestOrderResponse;
                        setNoestConnected(true);
                        setNoestOrderId(resp?.data?.id ?? null);
                        setTrackingNumber(
                          (resp?.data?.tracking as string) ?? generateNoestTracking()
                        );
                      } else {
                        // API failed - generate local tracking in NOEST format
                        setNoestConnected(false);
                        console.warn('[NOEST] Order creation failed:', result.error);
                        setTrackingNumber(generateNoestTracking());
                      }

                      // Facebook Pixel - Purchase
                      fbTrack('Purchase', {
                        value: grandTotal,
                        currency: 'DZD',
                        content_ids: cart.map(i => i.id.toString()),
                        content_type: 'product',
                        num_items: cart.length,
                      });

                      setOrderSuccess(true);
                    }}
                    className={cn(
                      'w-full py-4 rounded-full font-bold shadow-lg transition-all text-lg flex items-center justify-center gap-3',
                      isSubmitting
                        ? 'bg-gray-400 cursor-not-allowed text-white'
                        : 'bg-gradient-to-r from-emerald-600 to-emerald-700 text-white hover:shadow-xl'
                    )}
                  >
                    {isSubmitting ? (
                      <>
                        <svg className="animate-spin w-5 h-5 text-white" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                        </svg>
                        جاري إرسال الطلب...
                      </>
                    ) : '✅ تأكيد الطلب - الدفع عند الاستلام'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Mobile Bottom Nav */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg z-40">
        <div className="flex items-center justify-around py-2">
          {[
            { id: 'home', icon: '🏠', label: 'الرئيسية' },
            { id: 'categories', icon: '📂', label: 'التصنيفات' },
            { id: 'products', icon: '🛍️', label: 'المنتجات' },
            { id: 'contact', icon: '📞', label: 'اتصل' },
          ].map(item => (
            <button key={item.id} onClick={() => scrollToSection(item.id)} className={cn('flex flex-col items-center gap-0.5 p-2 rounded-lg transition-colors', activeSection === item.id ? 'text-emerald-600' : 'text-stone-500')}>
              <span className="text-lg">{item.icon}</span>
              <span className="text-[10px] font-semibold">{item.label}</span>
            </button>
          ))}
          <button onClick={() => setIsCartOpen(true)} className="flex flex-col items-center gap-0.5 p-2 text-stone-500 hover:text-emerald-600 relative">
            <span className="text-lg">🛒</span>
            {cartCount > 0 && <span className="absolute -top-0.5 right-0 w-4 h-4 bg-emerald-600 text-white text-[9px] font-bold rounded-full flex items-center justify-center">{cartCount}</span>}
            <span className="text-[10px] font-semibold">السلة</span>
          </button>
        </div>
      </div>
      <div className="lg:hidden h-16"/>
    </div>
  );
}
