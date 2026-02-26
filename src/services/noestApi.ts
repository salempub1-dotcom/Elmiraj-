// ============================================================
// NOEST Delivery API Service
// ============================================================
// In PRODUCTION (Vercel): calls /api/noest serverless function
// In DEMO/STATIC: falls back to embedded reference data
// ============================================================

export interface NoestWilaya {
  code: number;
  nom: string;
  nom_ar: string;
}

export interface NoestCommune {
  wilaya_id: number;
  nom: string;
  nom_ar: string;
}

export interface NoestDesk {
  code: string;
  name: string;
  name_ar: string;
}

export interface CreateOrderResult {
  ok: boolean;
  data?: {
    id?: string;
    tracking?: string;
  };
  error?: string;
  debug?: string;
  dedup?: boolean;       // true if this was a cached/deduplicated response
  dedup_age_ms?: number; // how old the cached response is
}

interface CreateOrderParams {
  client: string;
  phone: string;
  adresse: string;
  wilaya_id: number;
  commune: string;
  montant: number;
  produit: string;
  type_id: number;
  stop_desk: number;
  station_code?: string;
  request_id?: string;  // Idempotency key — prevents duplicate orders
}

interface ApiResponse<T> {
  ok: boolean;
  data?: T;
  error?: string;
  debug?: string;
}

// ── Proxy base URL ───────────────────────────────────────────
const API_BASE = '/api/noest';

// ── Call the Vercel serverless proxy ──────────────────────────
async function callProxy<T>(action: string, payload: Record<string, unknown> = {}): Promise<ApiResponse<T>> {
  try {
    const response = await fetch(API_BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, ...payload }),
    });

    const result = await response.json();
    return result as ApiResponse<T>;
  } catch (error) {
    console.warn(`[NOEST] Proxy call failed for "${action}":`, error);
    return { ok: false, error: 'proxy_unreachable' };
  }
}

// ── Check if proxy is available ──────────────────────────────
let proxyAvailable: boolean | null = null;

async function isProxyAvailable(): Promise<boolean> {
  if (proxyAvailable !== null) return proxyAvailable;
  try {
    const r = await fetch(API_BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'ping' }),
    });
    const data = await r.json();
    proxyAvailable = data?.ok === true && data?.pong === true;
  } catch {
    proxyAvailable = false;
  }
  console.log(`[NOEST] Proxy available: ${proxyAvailable}`);
  return proxyAvailable;
}

// ============================================================
// EMBEDDED FALLBACK DATA (used when API proxy is unreachable)
// ============================================================

const FALLBACK_WILAYAS: NoestWilaya[] = [
  { code: 1, nom: 'Adrar', nom_ar: 'أدرار' },
  { code: 2, nom: 'Chlef', nom_ar: 'الشلف' },
  { code: 3, nom: 'Laghouat', nom_ar: 'الأغواط' },
  { code: 4, nom: 'Oum El Bouaghi', nom_ar: 'أم البواقي' },
  { code: 5, nom: 'Batna', nom_ar: 'باتنة' },
  { code: 6, nom: 'Béjaïa', nom_ar: 'بجاية' },
  { code: 7, nom: 'Biskra', nom_ar: 'بسكرة' },
  { code: 8, nom: 'Béchar', nom_ar: 'بشار' },
  { code: 9, nom: 'Blida', nom_ar: 'البليدة' },
  { code: 10, nom: 'Bouira', nom_ar: 'البويرة' },
  { code: 11, nom: 'Tamanrasset', nom_ar: 'تمنراست' },
  { code: 12, nom: 'Tébessa', nom_ar: 'تبسة' },
  { code: 13, nom: 'Tlemcen', nom_ar: 'تلمسان' },
  { code: 14, nom: 'Tiaret', nom_ar: 'تيارت' },
  { code: 15, nom: 'Tizi Ouzou', nom_ar: 'تيزي وزو' },
  { code: 16, nom: 'Alger', nom_ar: 'الجزائر' },
  { code: 17, nom: 'Djelfa', nom_ar: 'الجلفة' },
  { code: 18, nom: 'Jijel', nom_ar: 'جيجل' },
  { code: 19, nom: 'Sétif', nom_ar: 'سطيف' },
  { code: 20, nom: 'Saïda', nom_ar: 'سعيدة' },
  { code: 21, nom: 'Skikda', nom_ar: 'سكيكدة' },
  { code: 22, nom: 'Sidi Bel Abbès', nom_ar: 'سيدي بلعباس' },
  { code: 23, nom: 'Annaba', nom_ar: 'عنابة' },
  { code: 24, nom: 'Guelma', nom_ar: 'قالمة' },
  { code: 25, nom: 'Constantine', nom_ar: 'قسنطينة' },
  { code: 26, nom: 'Médéa', nom_ar: 'المدية' },
  { code: 27, nom: 'Mostaganem', nom_ar: 'مستغانم' },
  { code: 28, nom: "M'sila", nom_ar: 'المسيلة' },
  { code: 29, nom: 'Mascara', nom_ar: 'معسكر' },
  { code: 30, nom: 'Ouargla', nom_ar: 'ورقلة' },
  { code: 31, nom: 'Oran', nom_ar: 'وهران' },
  { code: 32, nom: 'El Bayadh', nom_ar: 'البيض' },
  { code: 33, nom: 'Illizi', nom_ar: 'إليزي' },
  { code: 34, nom: 'Bordj Bou Arréridj', nom_ar: 'برج بوعريريج' },
  { code: 35, nom: 'Boumerdès', nom_ar: 'بومرداس' },
  { code: 36, nom: 'El Tarf', nom_ar: 'الطارف' },
  { code: 37, nom: 'Tindouf', nom_ar: 'تندوف' },
  { code: 38, nom: 'Tissemsilt', nom_ar: 'تيسمسيلت' },
  { code: 39, nom: 'El Oued', nom_ar: 'الوادي' },
  { code: 40, nom: 'Khenchela', nom_ar: 'خنشلة' },
  { code: 41, nom: 'Souk Ahras', nom_ar: 'سوق أهراس' },
  { code: 42, nom: 'Tipaza', nom_ar: 'تيبازة' },
  { code: 43, nom: 'Mila', nom_ar: 'ميلة' },
  { code: 44, nom: 'Aïn Defla', nom_ar: 'عين الدفلى' },
  { code: 45, nom: 'Naâma', nom_ar: 'النعامة' },
  { code: 46, nom: 'Aïn Témouchent', nom_ar: 'عين تيموشنت' },
  { code: 47, nom: 'Ghardaïa', nom_ar: 'غرداية' },
  { code: 48, nom: 'Relizane', nom_ar: 'غليزان' },
  { code: 49, nom: 'Timimoun', nom_ar: 'تيميمون' },
  { code: 50, nom: 'Bordj Badji Mokhtar', nom_ar: 'برج باجي مختار' },
  { code: 51, nom: 'Ouled Djellal', nom_ar: 'أولاد جلال' },
  { code: 52, nom: 'Béni Abbès', nom_ar: 'بني عباس' },
  { code: 53, nom: 'Aïn Salah', nom_ar: 'عين صالح' },
  { code: 54, nom: 'Aïn Guezzam', nom_ar: 'عين قزام' },
  { code: 55, nom: 'Touggourt', nom_ar: 'تقرت' },
  { code: 56, nom: 'Djanet', nom_ar: 'جانت' },
  { code: 57, nom: "El M'Ghair", nom_ar: 'المغير' },
  { code: 58, nom: 'El Meniaa', nom_ar: 'المنيعة' },
];

const FALLBACK_COMMUNES: Record<number, { nom: string; nom_ar: string }[]> = {
  1: [{ nom: 'Adrar', nom_ar: 'أدرار' }, { nom: 'Reggane', nom_ar: 'رقان' }, { nom: 'Aoulef', nom_ar: 'أولف' }, { nom: 'Fenoughil', nom_ar: 'فنوغيل' }, { nom: 'Zaouiet Kounta', nom_ar: 'زاوية كنتة' }, { nom: 'Tsabit', nom_ar: 'تسابيت' }],
  2: [{ nom: 'Chlef', nom_ar: 'الشلف' }, { nom: 'Ténès', nom_ar: 'تنس' }, { nom: 'Oued Fodda', nom_ar: 'وادي الفضة' }, { nom: 'Boukadir', nom_ar: 'بوقادير' }, { nom: 'Chettia', nom_ar: 'الشطية' }, { nom: 'Ain Merane', nom_ar: 'عين مران' }],
  3: [{ nom: 'Laghouat', nom_ar: 'الأغواط' }, { nom: 'Aflou', nom_ar: 'أفلو' }, { nom: 'Ksar El Hirane', nom_ar: 'قصر الحيران' }, { nom: "Hassi R'Mel", nom_ar: 'حاسي الرمل' }, { nom: 'Ain Madhi', nom_ar: 'عين ماضي' }],
  4: [{ nom: 'Oum El Bouaghi', nom_ar: 'أم البواقي' }, { nom: 'Ain Beida', nom_ar: 'عين البيضاء' }, { nom: "Ain M'lila", nom_ar: 'عين مليلة' }, { nom: 'Meskiana', nom_ar: 'مسكيانة' }, { nom: 'Sigus', nom_ar: 'سيقوس' }],
  5: [{ nom: 'Batna', nom_ar: 'باتنة' }, { nom: 'Barika', nom_ar: 'بريكة' }, { nom: "N'Gaous", nom_ar: 'نقاوس' }, { nom: 'Merouana', nom_ar: 'مروانة' }, { nom: 'Arris', nom_ar: 'آريس' }, { nom: 'Ain Touta', nom_ar: 'عين التوتة' }],
  6: [{ nom: 'Béjaïa', nom_ar: 'بجاية' }, { nom: 'Akbou', nom_ar: 'أقبو' }, { nom: 'Sidi Aich', nom_ar: 'سيدي عيش' }, { nom: 'El Kseur', nom_ar: 'القصر' }, { nom: 'Amizour', nom_ar: 'أميزور' }, { nom: 'Tichy', nom_ar: 'تيشي' }, { nom: 'Kherrata', nom_ar: 'خراطة' }],
  7: [{ nom: 'Biskra', nom_ar: 'بسكرة' }, { nom: 'Tolga', nom_ar: 'طولقة' }, { nom: 'Sidi Okba', nom_ar: 'سيدي عقبة' }, { nom: 'El Kantara', nom_ar: 'القنطرة' }, { nom: 'Zeribet El Oued', nom_ar: 'زريبة الوادي' }],
  8: [{ nom: 'Béchar', nom_ar: 'بشار' }, { nom: 'Kenadsa', nom_ar: 'القنادسة' }, { nom: 'Abadla', nom_ar: 'العبادلة' }, { nom: 'Beni Ounif', nom_ar: 'بني ونيف' }, { nom: 'Taghit', nom_ar: 'تاغيت' }],
  9: [{ nom: 'Blida', nom_ar: 'البليدة' }, { nom: 'Boufarik', nom_ar: 'بوفاريك' }, { nom: 'Mouzaia', nom_ar: 'موزاية' }, { nom: 'El Affroun', nom_ar: 'العفرون' }, { nom: 'Beni Mered', nom_ar: 'بني مراد' }, { nom: 'Bouinan', nom_ar: 'بوعينان' }, { nom: 'Larbaa', nom_ar: 'الأربعاء' }, { nom: 'Bougara', nom_ar: 'بوقرة' }],
  10: [{ nom: 'Bouira', nom_ar: 'البويرة' }, { nom: 'Lakhdaria', nom_ar: 'الأخضرية' }, { nom: 'Sour El Ghozlane', nom_ar: 'سور الغزلان' }, { nom: 'Ain Bessem', nom_ar: 'عين بسام' }, { nom: "M'Chedallah", nom_ar: 'مشدالله' }, { nom: 'Kadiria', nom_ar: 'قادرية' }],
  11: [{ nom: 'Tamanrasset', nom_ar: 'تمنراست' }, { nom: 'Abalessa', nom_ar: 'أبلسة' }],
  12: [{ nom: 'Tébessa', nom_ar: 'تبسة' }, { nom: 'Bir El Ater', nom_ar: 'بئر العاتر' }, { nom: 'Cheria', nom_ar: 'الشريعة' }, { nom: 'El Aouinet', nom_ar: 'العوينات' }, { nom: 'Morsott', nom_ar: 'مرسط' }],
  13: [{ nom: 'Tlemcen', nom_ar: 'تلمسان' }, { nom: 'Maghnia', nom_ar: 'مغنية' }, { nom: 'Ghazaouet', nom_ar: 'الغزوات' }, { nom: 'Remchi', nom_ar: 'الرمشي' }, { nom: 'Nedroma', nom_ar: 'ندرومة' }, { nom: 'Sebdou', nom_ar: 'سبدو' }],
  14: [{ nom: 'Tiaret', nom_ar: 'تيارت' }, { nom: 'Sougueur', nom_ar: 'السوقر' }, { nom: 'Frenda', nom_ar: 'فرندة' }, { nom: 'Mahdia', nom_ar: 'مهدية' }, { nom: 'Ksar Chellala', nom_ar: 'قصر الشلالة' }],
  15: [{ nom: 'Tizi Ouzou', nom_ar: 'تيزي وزو' }, { nom: 'Azazga', nom_ar: 'عزازقة' }, { nom: 'Draa El Mizan', nom_ar: 'ذراع الميزان' }, { nom: 'Ain El Hammam', nom_ar: 'عين الحمام' }, { nom: 'Tigzirt', nom_ar: 'تيقزيرت' }, { nom: 'Boghni', nom_ar: 'بوغني' }],
  16: [{ nom: 'Alger Centre', nom_ar: 'الجزائر الوسطى' }, { nom: 'Bab El Oued', nom_ar: 'باب الوادي' }, { nom: 'Hussein Dey', nom_ar: 'حسين داي' }, { nom: 'El Harrach', nom_ar: 'الحراش' }, { nom: 'Bab Ezzouar', nom_ar: 'باب الزوار' }, { nom: 'Bir Mourad Rais', nom_ar: 'بئر مراد رايس' }, { nom: 'Draria', nom_ar: 'الدرارية' }, { nom: 'Birkhadem', nom_ar: 'بئر خادم' }, { nom: 'Kouba', nom_ar: 'القبة' }, { nom: 'Chéraga', nom_ar: 'الشراقة' }, { nom: 'Dar El Beida', nom_ar: 'الدار البيضاء' }, { nom: 'Rouiba', nom_ar: 'الرويبة' }, { nom: 'Reghaia', nom_ar: 'الرغاية' }, { nom: 'Zeralda', nom_ar: 'زرالدة' }, { nom: 'Hydra', nom_ar: 'حيدرة' }, { nom: 'Bordj El Kiffan', nom_ar: 'برج الكيفان' }, { nom: 'Baraki', nom_ar: 'براقي' }, { nom: 'Sidi Moussa', nom_ar: 'سيدي موسى' }],
  17: [{ nom: 'Djelfa', nom_ar: 'الجلفة' }, { nom: 'Messaad', nom_ar: 'مسعد' }, { nom: 'Ain Oussera', nom_ar: 'عين وسارة' }, { nom: 'Hassi Bahbah', nom_ar: 'حاسي بحبح' }, { nom: 'Charef', nom_ar: 'الشارف' }],
  18: [{ nom: 'Jijel', nom_ar: 'جيجل' }, { nom: 'El Milia', nom_ar: 'الميلية' }, { nom: 'Taher', nom_ar: 'الطاهير' }, { nom: 'Chekfa', nom_ar: 'الشقفة' }],
  19: [{ nom: 'Sétif', nom_ar: 'سطيف' }, { nom: 'El Eulma', nom_ar: 'العلمة' }, { nom: 'Ain Oulmene', nom_ar: 'عين ولمان' }, { nom: 'Ain Arnat', nom_ar: 'عين أرنات' }, { nom: 'Bougaa', nom_ar: 'بوقاعة' }, { nom: 'Ain El Kebira', nom_ar: 'عين الكبيرة' }],
  20: [{ nom: 'Saïda', nom_ar: 'سعيدة' }, { nom: 'Ain El Hadjar', nom_ar: 'عين الحجر' }, { nom: 'Youb', nom_ar: 'يوب' }],
  21: [{ nom: 'Skikda', nom_ar: 'سكيكدة' }, { nom: 'Azzaba', nom_ar: 'عزابة' }, { nom: 'Collo', nom_ar: 'القل' }, { nom: 'El Harrouch', nom_ar: 'الحروش' }, { nom: 'Tamalous', nom_ar: 'تمالوس' }],
  22: [{ nom: 'Sidi Bel Abbès', nom_ar: 'سيدي بلعباس' }, { nom: 'Telagh', nom_ar: 'تلاغ' }, { nom: 'Sfisef', nom_ar: 'سفيزف' }, { nom: 'Ben Badis', nom_ar: 'بن باديس' }],
  23: [{ nom: 'Annaba', nom_ar: 'عنابة' }, { nom: 'El Bouni', nom_ar: 'البوني' }, { nom: 'El Hadjar', nom_ar: 'الحجار' }, { nom: 'Sidi Amar', nom_ar: 'سيدي عمار' }, { nom: 'Berrahal', nom_ar: 'برحال' }],
  24: [{ nom: 'Guelma', nom_ar: 'قالمة' }, { nom: 'Oued Zenati', nom_ar: 'وادي الزناتي' }, { nom: 'Bouchegouf', nom_ar: 'بوشقوف' }, { nom: 'Hammam Debagh', nom_ar: 'حمام دباغ' }],
  25: [{ nom: 'Constantine', nom_ar: 'قسنطينة' }, { nom: 'El Khroub', nom_ar: 'الخروب' }, { nom: 'Hamma Bouziane', nom_ar: 'حامة بوزيان' }, { nom: 'Didouche Mourad', nom_ar: 'ديدوش مراد' }, { nom: 'Ain Smara', nom_ar: 'عين سمارة' }, { nom: 'Zighoud Youcef', nom_ar: 'زيغود يوسف' }],
  26: [{ nom: 'Médéa', nom_ar: 'المدية' }, { nom: 'Berrouaghia', nom_ar: 'البرواقية' }, { nom: 'Ksar El Boukhari', nom_ar: 'قصر البخاري' }, { nom: 'Tablat', nom_ar: 'تابلاط' }],
  27: [{ nom: 'Mostaganem', nom_ar: 'مستغانم' }, { nom: 'Ain Tedeles', nom_ar: 'عين تادلس' }, { nom: 'Sidi Ali', nom_ar: 'سيدي علي' }],
  28: [{ nom: "M'sila", nom_ar: 'المسيلة' }, { nom: 'Bou Saada', nom_ar: 'بوسعادة' }, { nom: 'Sidi Aissa', nom_ar: 'سيدي عيسى' }, { nom: 'Magra', nom_ar: 'مقرة' }, { nom: 'Hammam Dalaa', nom_ar: 'حمام الضلعة' }],
  29: [{ nom: 'Mascara', nom_ar: 'معسكر' }, { nom: 'Sig', nom_ar: 'سيق' }, { nom: 'Tighennif', nom_ar: 'تيغنيف' }, { nom: 'Ghriss', nom_ar: 'غريس' }],
  30: [{ nom: 'Ouargla', nom_ar: 'ورقلة' }, { nom: 'Hassi Messaoud', nom_ar: 'حاسي مسعود' }, { nom: "N'Goussa", nom_ar: 'نقوسة' }],
  31: [{ nom: 'Oran', nom_ar: 'وهران' }, { nom: 'Es Sénia', nom_ar: 'السانية' }, { nom: 'Bir El Djir', nom_ar: 'بئر الجير' }, { nom: 'Ain El Turk', nom_ar: 'عين الترك' }, { nom: 'Arzew', nom_ar: 'أرزيو' }, { nom: 'Gdyel', nom_ar: 'قديل' }, { nom: 'Sidi Chahmi', nom_ar: 'سيدي الشحمي' }],
  32: [{ nom: 'El Bayadh', nom_ar: 'البيض' }, { nom: 'Bougtob', nom_ar: 'بوقطب' }, { nom: 'Brezina', nom_ar: 'بريزينة' }],
  33: [{ nom: 'Illizi', nom_ar: 'إليزي' }, { nom: 'In Amenas', nom_ar: 'عين أميناس' }],
  34: [{ nom: 'Bordj Bou Arréridj', nom_ar: 'برج بوعريريج' }, { nom: 'Ras El Oued', nom_ar: 'رأس الوادي' }, { nom: 'Mansourah', nom_ar: 'المنصورة' }, { nom: 'Medjana', nom_ar: 'مجانة' }],
  35: [{ nom: 'Boumerdès', nom_ar: 'بومرداس' }, { nom: 'Bordj Menaiel', nom_ar: 'برج منايل' }, { nom: 'Dellys', nom_ar: 'دلس' }, { nom: 'Khemis El Khechna', nom_ar: 'خميس الخشنة' }, { nom: 'Thénia', nom_ar: 'ثنية' }, { nom: 'Boudouaou', nom_ar: 'بودواو' }, { nom: 'Naciria', nom_ar: 'الناصرية' }],
  36: [{ nom: 'El Tarf', nom_ar: 'الطارف' }, { nom: 'El Kala', nom_ar: 'القالة' }, { nom: 'Bouhadjar', nom_ar: 'بوحجار' }, { nom: 'Besbes', nom_ar: 'بسباس' }],
  37: [{ nom: 'Tindouf', nom_ar: 'تندوف' }, { nom: 'Oum El Assel', nom_ar: 'أم العسل' }],
  38: [{ nom: 'Tissemsilt', nom_ar: 'تيسمسيلت' }, { nom: 'Theniet El Had', nom_ar: 'ثنية الحد' }, { nom: 'Bordj Bounama', nom_ar: 'برج بونعامة' }, { nom: 'Khemisti', nom_ar: 'خميستي' }],
  39: [{ nom: 'El Oued', nom_ar: 'الوادي' }, { nom: 'Guemar', nom_ar: 'قمار' }, { nom: 'Robbah', nom_ar: 'الرباح' }, { nom: 'Debila', nom_ar: 'الدبيلة' }, { nom: 'Hassi Khalifa', nom_ar: 'حاسي خليفة' }],
  40: [{ nom: 'Khenchela', nom_ar: 'خنشلة' }, { nom: 'Kais', nom_ar: 'قايس' }, { nom: 'Babar', nom_ar: 'بابار' }, { nom: 'Chechar', nom_ar: 'ششار' }],
  41: [{ nom: 'Souk Ahras', nom_ar: 'سوق أهراس' }, { nom: 'Sedrata', nom_ar: 'سدراتة' }, { nom: 'Mechroha', nom_ar: 'المشروحة' }],
  42: [{ nom: 'Tipaza', nom_ar: 'تيبازة' }, { nom: 'Cherchell', nom_ar: 'شرشال' }, { nom: 'Koléa', nom_ar: 'قليعة' }, { nom: 'Hadjout', nom_ar: 'حجوط' }, { nom: 'Fouka', nom_ar: 'فوكة' }, { nom: 'Bou Ismaïl', nom_ar: 'بوإسماعيل' }],
  43: [{ nom: 'Mila', nom_ar: 'ميلة' }, { nom: 'Ferdjioua', nom_ar: 'فرجيوة' }, { nom: 'Chelghoum Laïd', nom_ar: 'شلغوم العيد' }, { nom: 'Tadjenanet', nom_ar: 'تاجنانت' }],
  44: [{ nom: 'Aïn Defla', nom_ar: 'عين الدفلى' }, { nom: 'Miliana', nom_ar: 'مليانة' }, { nom: 'Khemis Miliana', nom_ar: 'خميس مليانة' }, { nom: 'El Attaf', nom_ar: 'العطاف' }],
  45: [{ nom: 'Naâma', nom_ar: 'النعامة' }, { nom: 'Mecheria', nom_ar: 'المشرية' }, { nom: 'Ain Sefra', nom_ar: 'عين الصفراء' }],
  46: [{ nom: 'Aïn Témouchent', nom_ar: 'عين تيموشنت' }, { nom: 'El Malah', nom_ar: 'المالح' }, { nom: 'Hammam Bouhadjar', nom_ar: 'حمام بوحجر' }, { nom: 'Beni Saf', nom_ar: 'بني صاف' }],
  47: [{ nom: 'Ghardaïa', nom_ar: 'غرداية' }, { nom: 'Metlili', nom_ar: 'متليلي' }, { nom: 'El Guerrara', nom_ar: 'القرارة' }, { nom: 'Berriane', nom_ar: 'بريان' }],
  48: [{ nom: 'Relizane', nom_ar: 'غليزان' }, { nom: 'Oued Rhiou', nom_ar: 'وادي رهيو' }, { nom: 'Mazouna', nom_ar: 'مازونة' }, { nom: 'Zemmora', nom_ar: 'زمورة' }],
  49: [{ nom: 'Timimoun', nom_ar: 'تيميمون' }, { nom: 'Ouled Said', nom_ar: 'أولاد سعيد' }, { nom: 'Charouine', nom_ar: 'شروين' }],
  50: [{ nom: 'Bordj Badji Mokhtar', nom_ar: 'برج باجي مختار' }, { nom: 'Timiaouine', nom_ar: 'تيمياوين' }],
  51: [{ nom: 'Ouled Djellal', nom_ar: 'أولاد جلال' }, { nom: 'Sidi Khaled', nom_ar: 'سيدي خالد' }, { nom: 'Doucen', nom_ar: 'الدوسن' }],
  52: [{ nom: 'Béni Abbès', nom_ar: 'بني عباس' }, { nom: 'Igli', nom_ar: 'إقلي' }],
  53: [{ nom: 'Aïn Salah', nom_ar: 'عين صالح' }, { nom: 'In Ghar', nom_ar: 'عين غار' }],
  54: [{ nom: 'Aïn Guezzam', nom_ar: 'عين قزام' }, { nom: 'Tin Zaouatine', nom_ar: 'تين زاوتين' }],
  55: [{ nom: 'Touggourt', nom_ar: 'تقرت' }, { nom: 'Megarine', nom_ar: 'مقارين' }, { nom: 'Temacine', nom_ar: 'تماسين' }],
  56: [{ nom: 'Djanet', nom_ar: 'جانت' }, { nom: 'Bordj El Haouass', nom_ar: 'برج الحواس' }],
  57: [{ nom: "El M'Ghair", nom_ar: 'المغير' }, { nom: 'Djamaa', nom_ar: 'جامعة' }, { nom: 'Still', nom_ar: 'سطيل' }],
  58: [{ nom: 'El Meniaa', nom_ar: 'المنيعة' }, { nom: 'Hassi El Gara', nom_ar: 'حاسي القارة' }],
};

// ✅ NOEST Official Stop-Desk Stations — Complete List
const FALLBACK_DESKS: NoestDesk[] = [
  // 01 - Adrar أدرار
  { code: '01A', name: 'Adrar', name_ar: 'أدرار' },

  // 02 - Chlef الشلف
  { code: '02A', name: 'Chlef', name_ar: 'الشلف' },
  { code: '02B', name: 'Chlef « Tenes »', name_ar: 'الشلف « تنس »' },

  // 03 - Laghouat الأغواط
  { code: '03A', name: 'Laghouat', name_ar: 'الأغواط' },
  { code: '03B', name: 'Laghouat « Aflou »', name_ar: 'الأغواط « أفلو »' },

  // 04 - Oum El Bouaghi أم البواقي
  { code: '04A', name: 'Oum El Bouaghi « Ain Mlila »', name_ar: 'أم البواقي « عين مليلة »' },
  { code: '04B', name: 'Oum El Bouaghi', name_ar: 'أم البواقي' },
  { code: '04C', name: 'Oum El Bouaghi « Aïn El Béïda »', name_ar: 'أم البواقي « عين البيضاء »' },

  // 05 - Batna باتنة
  { code: '05A', name: 'Batna', name_ar: 'باتنة' },
  { code: '05B', name: 'Batna « Barika »', name_ar: 'باتنة « بريكة »' },
  { code: '05C', name: 'Batna', name_ar: 'باتنة (2)' },

  // 06 - Béjaïa بجاية
  { code: '06A', name: 'Bejaïa', name_ar: 'بجاية' },
  { code: '06B', name: 'Bejaïa « Akbou »', name_ar: 'بجاية « أقبو »' },
  { code: '06C', name: 'Bejaïa « El-Kseur »', name_ar: 'بجاية « القصر »' },

  // 07 - Biskra بسكرة
  { code: '07A', name: 'Biskra', name_ar: 'بسكرة' },

  // 08 - Béchar بشار
  { code: '08A', name: 'Béchar', name_ar: 'بشار' },

  // 09 - Blida البليدة
  { code: '09A', name: 'Blida', name_ar: 'البليدة' },
  { code: '09B', name: 'Blida « Boufarik »', name_ar: 'البليدة « بوفاريك »' },

  // 10 - Bouira البويرة
  { code: '10A', name: 'Bouira', name_ar: 'البويرة' },
  { code: '10B', name: 'Bouira « Lakhdaria »', name_ar: 'البويرة « الأخضرية »' },

  // 11 - Tamanrasset تمنراست
  { code: '11A', name: 'Tamanrasset', name_ar: 'تمنراست' },

  // 12 - Tébessa تبسة
  { code: '12A', name: 'Tébessa', name_ar: 'تبسة' },

  // 13 - Tlemcen تلمسان
  { code: '13A', name: 'Tlemcen', name_ar: 'تلمسان' },
  { code: '13B', name: 'Tlemcen « Maghnia »', name_ar: 'تلمسان « مغنية »' },

  // 14 - Tiaret تيارت
  { code: '14A', name: 'Tiaret', name_ar: 'تيارت' },
  { code: '14B', name: 'Tiaret « Frenda »', name_ar: 'تيارت « فرندة »' },

  // 15 - Tizi Ouzou تيزي وزو
  { code: '15A', name: 'Tizi Ouzou', name_ar: 'تيزي وزو' },
  { code: '15B', name: 'Tizi Ouzou « Azazga »', name_ar: 'تيزي وزو « عزازقة »' },
  { code: '15C', name: 'Tizi Ouzou « Draa Ben Khedda »', name_ar: 'تيزي وزو « ذراع بن خدة »' },

  // 16 - Alger الجزائر
  { code: '16A', name: 'Alger « Bir Mourad Raïs »', name_ar: 'الجزائر « بئر مراد رايس »' },
  { code: '16B', name: 'Alger « Bab Ezzouar »', name_ar: 'الجزائر « باب الزوار »' },
  { code: '16C', name: 'Alger « Chéraga »', name_ar: 'الجزائر « الشراقة »' },
  { code: '16D', name: 'Alger « Reghaia »', name_ar: 'الجزائر « الرغاية »' },
  { code: '16E', name: 'Alger « Centre - Sacré-Cœur »', name_ar: 'الجزائر « الوسط - ساكري كور »' },
  { code: '16F', name: 'Alger « Baba Hassen »', name_ar: 'الجزائر « بابا حسن »' },
  { code: '16G', name: 'Alger « Baraki »', name_ar: 'الجزائر « براقي »' },
  { code: '16H', name: 'Alger « Bordj El Bahri »', name_ar: 'الجزائر « برج البحري »' },
  { code: '16I', name: 'Alger « Zeralda »', name_ar: 'الجزائر « زرالدة »' },

  // 17 - Djelfa الجلفة
  { code: '17A', name: 'Djelfa', name_ar: 'الجلفة' },
  { code: '17B', name: 'Djelfa « Ain Ouassara »', name_ar: 'الجلفة « عين وسارة »' },

  // 18 - Jijel جيجل
  { code: '18A', name: 'Jijel', name_ar: 'جيجل' },

  // 19 - Sétif سطيف
  { code: '19A', name: 'Sétif', name_ar: 'سطيف' },
  { code: '19B', name: 'Sétif « El Eulma »', name_ar: 'سطيف « العلمة »' },
  { code: '19C', name: 'Sétif « Ain Oulmene »', name_ar: 'سطيف « عين ولمان »' },
  { code: '19RE', name: 'Sétif « Guidjel »', name_ar: 'سطيف « قجال »' },

  // 20 - Saïda سعيدة
  { code: '20A', name: 'Saïda', name_ar: 'سعيدة' },

  // 21 - Skikda سكيكدة
  { code: '21A', name: 'Skikda', name_ar: 'سكيكدة' },
  { code: '21B', name: 'Skikda « Azzaba »', name_ar: 'سكيكدة « عزابة »' },

  // 22 - Sidi Bel Abbès سيدي بلعباس
  { code: '22A', name: 'Sidi Bel Abbès', name_ar: 'سيدي بلعباس' },

  // 23 - Annaba عنابة
  { code: '23A', name: 'Annaba', name_ar: 'عنابة' },
  { code: '23B', name: 'Annaba « El Bouni »', name_ar: 'عنابة « البوني »' },

  // 24 - Guelma قالمة
  { code: '24A', name: 'Guelma', name_ar: 'قالمة' },

  // 25 - Constantine قسنطينة
  { code: '25A', name: 'Constantine « Zouaghi »', name_ar: 'قسنطينة « الزواغي »' },
  { code: '25B', name: 'Constantine « Ali Mendjeli »', name_ar: 'قسنطينة « علي منجلي »' },
  { code: '25C', name: 'Constantine', name_ar: 'قسنطينة' },

  // 26 - Médéa المدية
  { code: '26A', name: 'Médéa', name_ar: 'المدية' },

  // 27 - Mostaganem مستغانم
  { code: '27A', name: 'Mostaganem', name_ar: 'مستغانم' },
  { code: '27B', name: 'Mostaganem « Sidi Lakhder »', name_ar: 'مستغانم « سيدي لخضر »' },

  // 28 - M'sila المسيلة
  { code: '28A', name: "M'sila", name_ar: 'المسيلة' },
  { code: '28B', name: "M'sila « Bousaada »", name_ar: 'المسيلة « بوسعادة »' },

  // 29 - Mascara معسكر
  { code: '29A', name: 'Mascara « Mohammadia »', name_ar: 'معسكر « المحمدية »' },
  { code: '29B', name: 'Mascara « Ville »', name_ar: 'معسكر « المدينة »' },

  // 30 - Ouargla ورقلة
  { code: '30A', name: 'Ouargla', name_ar: 'ورقلة' },
  { code: '30B', name: 'Ouargla « Hassi Messaoud »', name_ar: 'ورقلة « حاسي مسعود »' },

  // 31 - Oran وهران
  { code: '31A', name: 'Oran « Maraval »', name_ar: 'وهران « مارافال »' },
  { code: '31B', name: 'Oran « Bir El Djir »', name_ar: 'وهران « بئر الجير »' },
  { code: '31C', name: 'Oran « Gambita »', name_ar: 'وهران « قمبيطة »' },
  { code: '31D', name: 'Oran « Arzew »', name_ar: 'وهران « أرزيو »' },

  // 32 - El Bayadh البيض
  { code: '32A', name: 'El Bayadh', name_ar: 'البيض' },

  // 33 - Illizi إليزي
  { code: '33A', name: 'Illizi', name_ar: 'إليزي' },

  // 34 - Bordj Bou Arreridj برج بوعريريج
  { code: '34A', name: 'Bordj Bou Arreridj', name_ar: 'برج بوعريريج' },

  // 35 - Boumerdès بومرداس
  { code: '35A', name: 'Boumerdès', name_ar: 'بومرداس' },
  { code: '35B', name: 'Boumerdès « Ouled Moussa »', name_ar: 'بومرداس « أولاد موسى »' },
  { code: '35C', name: 'Boumerdès « Bordj Menaiel »', name_ar: 'بومرداس « برج منايل »' },
  { code: '35D', name: 'Boumerdès « Dellys »', name_ar: 'بومرداس « دلس »' },

  // 36 - El Taref الطارف
  { code: '36A', name: 'El Taref', name_ar: 'الطارف' },

  // 37 - Tindouf تندوف
  { code: '37A', name: 'Tindouf', name_ar: 'تندوف' },

  // 38 - Tissemsilt تيسمسيلت
  { code: '38A', name: 'Tissemsilt', name_ar: 'تيسمسيلت' },

  // 39 - El Oued الوادي
  { code: '39A', name: 'El Oued', name_ar: 'الوادي' },

  // 40 - Khenchela خنشلة
  { code: '40A', name: 'Khenchela', name_ar: 'خنشلة' },

  // 41 - Souk Ahras سوق أهراس
  { code: '41A', name: 'Souk Ahras', name_ar: 'سوق أهراس' },

  // 42 - Tipaza تيبازة
  { code: '42A', name: 'Tipaza', name_ar: 'تيبازة' },
  { code: '42B', name: 'Tipaza « Koléa »', name_ar: 'تيبازة « قليعة »' },

  // 43 - Mila ميلة
  { code: '43A', name: 'Mila', name_ar: 'ميلة' },
  { code: '43B', name: 'Mila « Chelghoum El Aid »', name_ar: 'ميلة « شلغوم العيد »' },
  { code: '43C', name: 'Mila « Tadjenanet »', name_ar: 'ميلة « تاجنانت »' },

  // 44 - Ain Defla عين الدفلى
  { code: '44A', name: 'Ain Defla', name_ar: 'عين الدفلى' },
  { code: '44B', name: 'Ain Defla « Khemis Miliana »', name_ar: 'عين الدفلى « خميس مليانة »' },

  // 45 - Naâma النعامة
  { code: '45A', name: 'Naâma « Mécheria »', name_ar: 'النعامة « المشرية »' },

  // 46 - Aïn Témouchent عين تيموشنت
  { code: '46A', name: 'Aïn Témouchent', name_ar: 'عين تيموشنت' },

  // 47 - Ghardaïa غرداية
  { code: '47A', name: 'Ghardaïa', name_ar: 'غرداية' },

  // 48 - Relizane غليزان
  { code: '48A', name: 'Relizane', name_ar: 'غليزان' },

  // 49 - Timimoun تيميمون
  { code: '49A', name: 'Timimoun', name_ar: 'تيميمون' },

  // 51 - Ouled Djellal أولاد جلال
  { code: '51A', name: 'Ouled Djellal', name_ar: 'أولاد جلال' },

  // 52 - Béni Abbès بني عباس
  { code: '52A', name: 'Béni Abbès', name_ar: 'بني عباس' },

  // 53 - In Salah عين صالح
  { code: '53A', name: 'In Salah', name_ar: 'عين صالح' },

  // 55 - Touggourt تقرت
  { code: '55A', name: 'Touggourt', name_ar: 'تقرت' },

  // 56 - Djanet جانت
  { code: '56A', name: 'Djanet', name_ar: 'جانت' },

  // 58 - El Meniaa المنيعة
  { code: '58A', name: 'El Meniaa', name_ar: 'المنيعة' },
];

// ── Helper: extract wilaya code from desk code ───────────────
// NOEST codes are like "01A", "16G", "19RE", "04C", etc.
// The wilaya number is always the leading digits (2 digits).
export function getWilayaCodeFromDeskCode(deskCode: string): number {
  const match = deskCode.match(/^(\d+)/);
  if (!match) return 0;
  return parseInt(match[1], 10);
}

// ── Fallback tracking generator (for demo only) ─────────────
function generateDemoTracking(): string {
  const prefix = 'DEMO';
  const wilaya = String(Math.floor(Math.random() * 58) + 1).padStart(2, '0');
  const suffix = String(Math.floor(Math.random() * 99999999)).padStart(8, '0');
  return `${prefix}-${wilaya}G-${suffix}`;
}

// ============================================================
// PUBLIC API FUNCTIONS
// ============================================================

export async function getWilayas(): Promise<ApiResponse<NoestWilaya[]>> {
  const proxy = await isProxyAvailable();
  if (proxy) {
    const result = await callProxy<NoestWilaya[]>('get_wilayas');
    if (result.ok && result.data) {
      console.log('[NOEST] ✅ Wilayas loaded from API');
      return result;
    }
  }
  console.log('[NOEST] 📦 Using fallback wilayas');
  return { ok: true, data: FALLBACK_WILAYAS };
}

export async function getCommunes(wilayaId: number): Promise<ApiResponse<NoestCommune[]>> {
  const proxy = await isProxyAvailable();
  if (proxy) {
    const result = await callProxy<NoestCommune[]>('get_communes', { wilaya_id: wilayaId });
    if (result.ok && result.data) {
      console.log(`[NOEST] ✅ Communes loaded from API for wilaya ${wilayaId}`);
      return result;
    }
  }
  console.log(`[NOEST] 📦 Using fallback communes for wilaya ${wilayaId}`);
  const communes = FALLBACK_COMMUNES[wilayaId];
  if (!communes) return { ok: true, data: [] };
  return {
    ok: true,
    data: communes.map(c => ({ wilaya_id: wilayaId, nom: c.nom, nom_ar: c.nom_ar })),
  };
}

export async function getDesks(): Promise<ApiResponse<NoestDesk[]>> {
  const proxy = await isProxyAvailable();
  if (proxy) {
    const result = await callProxy<NoestDesk[]>('get_desks');
    if (result.ok && result.data) {
      console.log('[NOEST] ✅ Desks loaded from API');
      return result;
    }
  }
  console.log('[NOEST] 📦 Using fallback desks');
  return { ok: true, data: FALLBACK_DESKS };
}

export async function createOrder(params: CreateOrderParams): Promise<CreateOrderResult> {
  const proxy = await isProxyAvailable();

  if (proxy) {
    // ── PRODUCTION: Send to real NOEST via proxy ──
    const reqId = params.request_id || 'NO_ID';
    console.log(`[NOEST] 🚀 Sending order to NOEST API... (request_id=${reqId})`);
    const result = await callProxy<{
      tracking?: string;
      id?: string;
      reference?: string;
      dedup?: boolean;
      dedup_age_ms?: number;
    }>('create_order', params as unknown as Record<string, unknown>);

    if (result.ok && result.data) {
      const wasDedup = (result as unknown as Record<string, unknown>).dedup === true;
      const dedupAge = (result as unknown as Record<string, unknown>).dedup_age_ms as number | undefined;

      if (wasDedup) {
        console.log(`[NOEST] ♻️ DEDUP: Cached response returned (age=${Math.round((dedupAge || 0) / 1000)}s, tracking=${result.data.tracking})`);
      } else {
        console.log(`[NOEST] ✅ NEW order created via API: ${result.data.tracking}`);
      }

      return {
        ok: true,
        data: {
          id: result.data.reference || result.data.id,
          tracking: result.data.tracking,
        },
        dedup: wasDedup,
        dedup_age_ms: dedupAge,
      };
    }

    // API returned error
    return {
      ok: false,
      error: result.error || 'فشل إنشاء الطلب عبر NOEST',
      debug: result.debug,
    };
  }

  // ── DEMO MODE: Simulate order creation ──
  console.log(`[NOEST] 🎭 Demo mode: simulating order creation... (request_id=${params.request_id || 'none'})`);

  // Validate required fields
  if (!params.client || !params.phone || !params.adresse || !params.commune) {
    return {
      ok: false,
      error: 'بيانات ناقصة: يرجى ملء جميع الحقول المطلوبة',
      debug: 'Missing required fields (demo validation)',
    };
  }

  if (params.phone.length !== 10) {
    return {
      ok: false,
      error: 'رقم الهاتف يجب أن يكون 10 أرقام',
      debug: 'Invalid phone length (demo validation)',
    };
  }

  if (params.stop_desk === 1 && !params.station_code) {
    return {
      ok: false,
      error: 'يرجى اختيار محطة الاستلام',
      debug: 'Missing station_code (demo validation)',
    };
  }

  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 1500));

  const tracking = generateDemoTracking();
  return {
    ok: true,
    data: {
      id: `DEMO-${Date.now()}`,
      tracking,
    },
  };
}

// ── Diagnose connectivity ────────────────────────────────────
export async function diagnoseNoest(): Promise<ApiResponse<unknown>> {
  return callProxy<unknown>('diagnose');
}

// ── Ping proxy ───────────────────────────────────────────────
export async function pingProxy(): Promise<boolean> {
  proxyAvailable = null; // Reset cache
  return isProxyAvailable();
}
