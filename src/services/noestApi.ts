// ============================================================
// NOEST Delivery API Service
// Names in FRENCH as required by NOEST delivery company
// ============================================================

export interface NoestWilaya {
  code: number;
  nom: string;       // French name (sent to NOEST API)
  nom_ar: string;    // Arabic name (for display)
}

export interface NoestCommune {
  wilaya_id: number;
  nom: string;       // French name (sent to NOEST API)
  nom_ar: string;    // Arabic name (for display)
}

export interface NoestDesk {
  code: string;
  name: string;       // French name
  name_ar: string;    // Arabic name
}

interface ApiResponse<T> {
  ok: boolean;
  data?: T;
  error?: string;
}

// ═══════════════════════════════════════════════════════════
// WILAYAS (58 wilayas - French + Arabic)
// ═══════════════════════════════════════════════════════════
const wilayasData: NoestWilaya[] = [
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
  { code: 28, nom: "M'Sila", nom_ar: 'المسيلة' },
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
  { code: 57, nom: 'El M\'Ghair', nom_ar: 'المغير' },
  { code: 58, nom: 'El Meniaa', nom_ar: 'المنيعة' },
];

// ═══════════════════════════════════════════════════════════
// COMMUNES PER WILAYA (French + Arabic)
// ═══════════════════════════════════════════════════════════
interface CommuneEntry { fr: string; ar: string; }
const communesData: Record<number, CommuneEntry[]> = {
  1: [
    { fr: 'Adrar', ar: 'أدرار' }, { fr: 'Timimoun', ar: 'تيميمون' }, { fr: 'Reggane', ar: 'رقان' },
    { fr: 'Aoulef', ar: 'أولف' }, { fr: 'Zaouiet Kounta', ar: 'زاوية كنتة' }, { fr: 'Tsabit', ar: 'تسابيت' },
    { fr: 'Charouine', ar: 'شروين' }, { fr: 'Fenoughil', ar: 'فنوغيل' }, { fr: 'Tit', ar: 'تيت' },
    { fr: 'Tamest', ar: 'تامست' }, { fr: 'In Zghmir', ar: 'إن زغمير' }, { fr: 'Sali', ar: 'صالي' },
  ],
  2: [
    { fr: 'Chlef', ar: 'الشلف' }, { fr: 'Ténès', ar: 'تنس' }, { fr: 'El Karimia', ar: 'الكريمية' },
    { fr: 'Boukadir', ar: 'بوقادير' }, { fr: 'Oued Fodda', ar: 'واد فضة' }, { fr: 'Abou El Hassane', ar: 'أبو الحسن' },
    { fr: 'Aïn Mérane', ar: 'عين مران' }, { fr: 'Oued Sly', ar: 'وادي سلي' }, { fr: 'Chettia', ar: 'الشطية' },
    { fr: 'Oum Drou', ar: 'أم الذروع' }, { fr: 'Breira', ar: 'بريرة' }, { fr: 'Beni Haoua', ar: 'بني حواء' },
  ],
  3: [
    { fr: 'Laghouat', ar: 'الأغواط' }, { fr: 'Aflou', ar: 'آفلو' }, { fr: 'Hassi R\'Mel', ar: 'حاسي الرمل' },
    { fr: 'Ksar El Hirane', ar: 'قصر الحيران' }, { fr: 'Aïn Madhi', ar: 'عين ماضي' }, { fr: 'Brida', ar: 'بريدة' },
    { fr: 'Sidi Makhlouf', ar: 'سيدي مخلوف' }, { fr: 'El Ghicha', ar: 'الغيشة' }, { fr: 'Hadj Mechri', ar: 'حاج مشري' },
    { fr: 'Tadjmout', ar: 'تاجموت' }, { fr: 'El Assafia', ar: 'العسافية' },
  ],
  4: [
    { fr: 'Oum El Bouaghi', ar: 'أم البواقي' }, { fr: 'Aïn Beïda', ar: 'عين البيضاء' }, { fr: 'Aïn M\'lila', ar: 'عين مليلة' },
    { fr: 'Aïn Fakroun', ar: 'عين فكرون' }, { fr: 'Sigus', ar: 'سيقوس' }, { fr: 'Meskiana', ar: 'مسكيانة' },
    { fr: 'Fkirina', ar: 'فكيرينة' }, { fr: 'Souk Naamane', ar: 'سوق نعمان' }, { fr: 'Dhalaa', ar: 'الضلعة' },
    { fr: 'Ksar Sbahi', ar: 'قصر الصباحي' },
  ],
  5: [
    { fr: 'Batna', ar: 'باتنة' }, { fr: 'Barika', ar: 'بريكة' }, { fr: 'Aïn Touta', ar: 'عين التوتة' },
    { fr: 'N\'Gaous', ar: 'نقاوس' }, { fr: 'Merouana', ar: 'مروانة' }, { fr: 'Arris', ar: 'أريس' },
    { fr: 'Tazoult', ar: 'تازولت' }, { fr: 'Timgad', ar: 'تيمقاد' }, { fr: 'Seriana', ar: 'سريانة' },
    { fr: 'Menaa', ar: 'منعة' }, { fr: 'El Madher', ar: 'المعذر' }, { fr: 'Chemora', ar: 'شمورة' },
    { fr: 'Ras El Aioun', ar: 'رأس العيون' }, { fr: 'Djezzar', ar: 'جزار' },
  ],
  6: [
    { fr: 'Béjaïa', ar: 'بجاية' }, { fr: 'Akbou', ar: 'أقبو' }, { fr: 'Sidi Aïch', ar: 'سيدي عيش' },
    { fr: 'Kherrata', ar: 'خراطة' }, { fr: 'Tichy', ar: 'تيشي' }, { fr: 'Amizour', ar: 'أميزور' },
    { fr: 'Souk El Ténine', ar: 'سوق الإثنين' }, { fr: 'Ighil Ali', ar: 'إغيل علي' }, { fr: 'El Kseur', ar: 'القصر' },
    { fr: 'Seddouk', ar: 'صدوق' }, { fr: 'Tazmalt', ar: 'تازمالت' }, { fr: 'Aokas', ar: 'أوقاس' },
    { fr: 'Darguina', ar: 'دارقينة' }, { fr: 'Adekar', ar: 'أدكار' },
  ],
  7: [
    { fr: 'Biskra', ar: 'بسكرة' }, { fr: 'Tolga', ar: 'طولقة' }, { fr: 'Oumeche', ar: 'أوماش' },
    { fr: 'Sidi Okba', ar: 'سيدي عقبة' }, { fr: 'Zeribet El Oued', ar: 'زريبة الوادي' }, { fr: 'Foughala', ar: 'فوغالة' },
    { fr: 'Ourlal', ar: 'أورلال' }, { fr: 'El Hadjeb', ar: 'الحاجب' }, { fr: 'Sidi Khaled', ar: 'سيدي خالد' },
    { fr: 'Doucen', ar: 'الدوسن' }, { fr: 'El Kantara', ar: 'القنطرة' }, { fr: 'M\'Chouneche', ar: 'مشونش' },
    { fr: 'Djemorah', ar: 'جمورة' }, { fr: 'El Outaya', ar: 'الوطاية' },
  ],
  8: [
    { fr: 'Béchar', ar: 'بشار' }, { fr: 'Kenadsa', ar: 'القنادسة' }, { fr: 'Beni Ounif', ar: 'بني ونيف' },
    { fr: 'Abadla', ar: 'عبادلة' }, { fr: 'Taghit', ar: 'تاغيت' }, { fr: 'Béni Abbès', ar: 'بني عباس' },
    { fr: 'Kerzaz', ar: 'كرزاز' }, { fr: 'Igli', ar: 'إيغلي' }, { fr: 'Meridja', ar: 'مريجة' },
  ],
  9: [
    { fr: 'Blida', ar: 'البليدة' }, { fr: 'Boufarik', ar: 'بوفاريك' }, { fr: 'Bouinan', ar: 'بوعينان' },
    { fr: 'Larbaa', ar: 'الأربعاء' }, { fr: 'Meftah', ar: 'مفتاح' }, { fr: 'Chiffa', ar: 'الشفة' },
    { fr: 'Bougara', ar: 'بوقرة' }, { fr: 'Mouzaia', ar: 'موزاية' }, { fr: 'Oued El Alleug', ar: 'وادي العلايق' },
    { fr: 'Chréa', ar: 'الشريعة' }, { fr: 'Guerrouaou', ar: 'قرواو' }, { fr: 'El Affroun', ar: 'العفرون' },
    { fr: 'Ouled Yaïch', ar: 'أولاد يعيش' }, { fr: 'Soumaa', ar: 'الصومعة' }, { fr: 'Beni Tamou', ar: 'بني تامو' },
  ],
  10: [
    { fr: 'Bouira', ar: 'البويرة' }, { fr: 'Lakhdaria', ar: 'الأخضرية' }, { fr: 'Sour El Ghozlane', ar: 'سور الغزلان' },
    { fr: 'Bordj Okhriss', ar: 'برج أوخريص' }, { fr: 'Aïn Bessam', ar: 'عين بسام' }, { fr: 'Bir Ghbalou', ar: 'بئر غبالو' },
    { fr: 'M\'Chedallah', ar: 'مشدالة' }, { fr: 'Kadiria', ar: 'قادرية' }, { fr: 'Bechloul', ar: 'بشلول' },
    { fr: 'El Hachimia', ar: 'الهاشمية' }, { fr: 'Aomar', ar: 'عومر' },
  ],
  11: [
    { fr: 'Tamanrasset', ar: 'تمنراست' }, { fr: 'Aïn Salah', ar: 'عين صالح' }, { fr: 'Aïn Guezzam', ar: 'عين قزام' },
    { fr: 'Tazrouk', ar: 'تاظروك' }, { fr: 'Idlès', ar: 'إدلس' }, { fr: 'In Amguel', ar: 'إن أمقل' },
    { fr: 'Abalessa', ar: 'أبلسة' }, { fr: 'In Salah', ar: 'إن صالح' },
  ],
  12: [
    { fr: 'Tébessa', ar: 'تبسة' }, { fr: 'Bir El Ater', ar: 'بئر العاتر' }, { fr: 'Chéria', ar: 'الشريعة' },
    { fr: 'El Aouinet', ar: 'العوينات' }, { fr: 'Bekkaria', ar: 'بكارية' }, { fr: 'Morsott', ar: 'مرسط' },
    { fr: 'Ouenza', ar: 'ونزة' }, { fr: 'El Hammamet', ar: 'الحمامات' }, { fr: 'El Kouif', ar: 'الكويف' },
    { fr: 'Negrine', ar: 'نقرين' }, { fr: 'El Ogla', ar: 'العقلة' },
  ],
  13: [
    { fr: 'Tlemcen', ar: 'تلمسان' }, { fr: 'Maghnia', ar: 'مغنية' }, { fr: 'Remchi', ar: 'الرمشي' },
    { fr: 'Nedroma', ar: 'ندرومة' }, { fr: 'Ghazaouet', ar: 'الغزوات' }, { fr: 'Honaine', ar: 'هنين' },
    { fr: 'Sebdou', ar: 'سبدو' }, { fr: 'Beni Snous', ar: 'بني سنوس' }, { fr: 'Mansourah', ar: 'المنصورة' },
    { fr: 'Chetouane', ar: 'شتوان' }, { fr: 'Hennaya', ar: 'الحناية' }, { fr: 'Bab El Assa', ar: 'باب العسة' },
  ],
  14: [
    { fr: 'Tiaret', ar: 'تيارت' }, { fr: 'Aïn Deheb', ar: 'عين الذهب' }, { fr: 'Frenda', ar: 'فرندة' },
    { fr: 'Ksar Chellala', ar: 'قصر الشلالة' }, { fr: 'Mahdia', ar: 'مهدية' }, { fr: 'Sougueur', ar: 'سوقر' },
    { fr: 'Mechraa Sfa', ar: 'مشرع الصفا' }, { fr: 'Rahouia', ar: 'الرحوية' }, { fr: 'Dahmouni', ar: 'دحموني' },
    { fr: 'Oued Lilli', ar: 'وادي ليلي' }, { fr: 'Hammadia', ar: 'حمادية' },
  ],
  15: [
    { fr: 'Tizi Ouzou', ar: 'تيزي وزو' }, { fr: 'Azazga', ar: 'عزازقة' }, { fr: 'Draa El Mizan', ar: 'ذراع الميزان' },
    { fr: 'Larba Nath Irathen', ar: 'لاربعا ناث إيراثن' }, { fr: 'Ouadhias', ar: 'واضية' }, { fr: 'Beni Douala', ar: 'بني دوالة' },
    { fr: 'Aïn El Hammam', ar: 'عين الحمام' }, { fr: 'Boghni', ar: 'بوغني' }, { fr: 'Mekla', ar: 'مقلع' },
    { fr: 'Tigzirt', ar: 'تيقزيرت' }, { fr: 'Maatkas', ar: 'معاتقة' }, { fr: 'Ouaguenoun', ar: 'واقنون' },
    { fr: 'Bouzeguene', ar: 'بوزقن' }, { fr: 'Iferhounene', ar: 'إفرحونن' },
  ],
  16: [
    { fr: 'Alger Centre', ar: 'الجزائر الوسطى' }, { fr: 'Bab El Oued', ar: 'باب الوادي' },
    { fr: 'Bir Mourad Raïs', ar: 'بئر مراد رايس' }, { fr: 'El Harrach', ar: 'الحراش' },
    { fr: 'Dely Ibrahim', ar: 'دالي إبراهيم' }, { fr: 'Bouzareah', ar: 'بوزريعة' },
    { fr: 'Bir Khadem', ar: 'بئر خادم' }, { fr: 'Draria', ar: 'الدرارية' },
    { fr: 'Baraki', ar: 'براقي' }, { fr: 'Sidi Moussa', ar: 'سيدي موسى' },
    { fr: 'Rouïba', ar: 'الرويبة' }, { fr: 'Reghaia', ar: 'رغاية' },
    { fr: 'Aïn Benian', ar: 'عين بنيان' }, { fr: 'Staoueli', ar: 'سطاوالي' },
    { fr: 'Zeralda', ar: 'زرالدة' }, { fr: 'Mohammadia', ar: 'المحمدية' },
    { fr: 'Bordj El Kiffan', ar: 'برج الكيفان' }, { fr: 'El Biar', ar: 'الأبيار' },
    { fr: 'Bab Ezzouar', ar: 'باب الزوار' }, { fr: 'Hussein Dey', ar: 'حسين داي' },
    { fr: 'Kouba', ar: 'القبة' }, { fr: 'Bachdjerrah', ar: 'باش جراح' },
    { fr: 'El Mouradia', ar: 'المرادية' }, { fr: 'Hydra', ar: 'حيدرة' },
    { fr: 'Ben Aknoun', ar: 'بن عكنون' }, { fr: 'Chéraga', ar: 'الشراقة' },
    { fr: 'Ouled Fayet', ar: 'أولاد فايت' }, { fr: 'El Achour', ar: 'الأشعور' },
    { fr: 'Dar El Beïda', ar: 'الدار البيضاء' }, { fr: 'Beni Messous', ar: 'بني مسوس' },
    { fr: 'Les Eucalyptus', ar: 'الأوكاليبتوس' }, { fr: 'Oued Smar', ar: 'واد السمار' },
    { fr: 'Khraïcia', ar: 'خرايسية' }, { fr: 'Saoula', ar: 'السحاولة' },
    { fr: 'Aïn Taya', ar: 'عين طاية' }, { fr: 'Bordj El Bahri', ar: 'برج البحري' },
    { fr: 'El Marsa', ar: 'المرسى' }, { fr: 'Heraoua', ar: 'حراوة' },
    { fr: 'Hammamet', ar: 'حمامات' }, { fr: 'Rahmania', ar: 'الرحمانية' },
    { fr: 'Souidania', ar: 'سويدانية' }, { fr: 'Douera', ar: 'الدويرة' },
    { fr: 'Tessala El Merdja', ar: 'تسالة المرجة' },
  ],
  17: [
    { fr: 'Djelfa', ar: 'الجلفة' }, { fr: 'Messaad', ar: 'مسعد' }, { fr: 'Aïn Oussera', ar: 'عين وسارة' },
    { fr: 'Hassi Bahbah', ar: 'حاسي بحبح' }, { fr: 'El Idrissia', ar: 'الإدريسية' },
    { fr: 'Sidi Ladjel', ar: 'سيدي لعجال' }, { fr: 'Faidh El Botma', ar: 'فيض البطمة' },
    { fr: 'Dar Chioukh', ar: 'دار الشيوخ' }, { fr: 'Moudjebara', ar: 'مجبارة' },
    { fr: 'Charef', ar: 'الشارف' }, { fr: 'Had Sahary', ar: 'حد الصحاري' },
    { fr: 'Birine', ar: 'بيرين' },
  ],
  18: [
    { fr: 'Jijel', ar: 'جيجل' }, { fr: 'El Taher', ar: 'الطاهير' }, { fr: 'El Milia', ar: 'الميلية' },
    { fr: 'Texenna', ar: 'تاكسنة' }, { fr: 'Chekfa', ar: 'الشقفة' }, { fr: 'Ziama Mansouriah', ar: 'زيامة منصورية' },
    { fr: 'Selma Ben Ziada', ar: 'سلمى بن زيادة' }, { fr: 'Settara', ar: 'السطارة' },
    { fr: 'Djimla', ar: 'جيملة' }, { fr: 'Sidi Maarouf', ar: 'سيدي معروف' },
    { fr: 'Kaous', ar: 'القاوس' },
  ],
  19: [
    { fr: 'Sétif', ar: 'سطيف' }, { fr: 'El Eulma', ar: 'العلمة' }, { fr: 'Aïn Oulmene', ar: 'عين ولمان' },
    { fr: 'Aïn Azel', ar: 'عين أزال' }, { fr: 'Bougaa', ar: 'بوقاعة' },
    { fr: 'Djemila', ar: 'جميلة' }, { fr: 'Beni Aziz', ar: 'بني عزيز' },
    { fr: 'Aïn Arnat', ar: 'عين أرنات' }, { fr: 'Guenzet', ar: 'قنزات' },
    { fr: 'Beni Oussine', ar: 'بني وسين' }, { fr: 'Babor', ar: 'بابور' },
    { fr: 'Hammam Guergour', ar: 'حمام قرقور' }, { fr: 'Maaoklane', ar: 'معاوقلان' },
  ],
  20: [
    { fr: 'Saïda', ar: 'سعيدة' }, { fr: 'Aïn El Hadjar', ar: 'عين الحجر' }, { fr: 'Youb', ar: 'يوب' },
    { fr: 'Hassasna', ar: 'الحساسنة' }, { fr: 'Ouled Khaled', ar: 'أولاد خالد' },
    { fr: 'Ouled Brahim', ar: 'أولاد إبراهيم' }, { fr: 'Sidi Boubekeur', ar: 'سيدي بوبكر' },
    { fr: 'El Hassasna', ar: 'الحساسنة' },
  ],
  21: [
    { fr: 'Skikda', ar: 'سكيكدة' }, { fr: 'Collo', ar: 'القل' }, { fr: 'Azzaba', ar: 'عزابة' },
    { fr: 'Tamalous', ar: 'تمالوس' }, { fr: 'El Harrouch', ar: 'الحروش' },
    { fr: 'Ramdane Djamel', ar: 'رمضان جمال' }, { fr: 'Aïn Kechra', ar: 'عين قشرة' },
    { fr: 'Oum Toub', ar: 'أم الطوب' }, { fr: 'Zitouna', ar: 'الزيتونة' },
    { fr: 'Ben Azzouz', ar: 'بن عزوز' },
  ],
  22: [
    { fr: 'Sidi Bel Abbès', ar: 'سيدي بلعباس' }, { fr: 'Aïn El Berd', ar: 'عين البرد' },
    { fr: 'Ben Badis', ar: 'بن باديس' }, { fr: 'Telagh', ar: 'تلاغ' },
    { fr: 'Sidi Lahcene', ar: 'سيدي لحسن' }, { fr: 'Tessala', ar: 'تسالة' },
    { fr: 'Ras El Ma', ar: 'رأس الماء' }, { fr: 'Sfisef', ar: 'سفيزف' },
    { fr: 'Moulay Slissen', ar: 'مولاي سليسن' }, { fr: 'Mostefa Ben Brahim', ar: 'مصطفى بن إبراهيم' },
  ],
  23: [
    { fr: 'Annaba', ar: 'عنابة' }, { fr: 'El Bouni', ar: 'البوني' }, { fr: 'El Hadjar', ar: 'الحجار' },
    { fr: 'Sidi Amar', ar: 'سيدي عمار' }, { fr: 'Berrahal', ar: 'برحال' },
    { fr: 'Aïn El Berda', ar: 'عين الباردة' }, { fr: 'Chetaïbi', ar: 'شطايبي' },
    { fr: 'Seraïdi', ar: 'سرايدي' }, { fr: 'Oued El Aneb', ar: 'واد العنب' },
    { fr: 'Cheurfa', ar: 'الشرفة' }, { fr: 'El Eulma', ar: 'العلمة' }, { fr: 'Treat', ar: 'تريعات' },
  ],
  24: [
    { fr: 'Guelma', ar: 'قالمة' }, { fr: 'Bouchegouf', ar: 'بوشقوف' }, { fr: 'Aïn Makhlouf', ar: 'عين مخلوف' },
    { fr: 'Heliopolis', ar: 'هيليوبوليس' }, { fr: 'Oued Zenati', ar: 'وادي الزناتي' },
    { fr: 'Hammam Debagh', ar: 'حمام دباغ' }, { fr: 'Khezaras', ar: 'خزارة' },
    { fr: 'Hammam N\'Bail', ar: 'حمام النبايل' }, { fr: 'Nechmaya', ar: 'نشماية' },
    { fr: 'Houri', ar: 'هوري' },
  ],
  25: [
    { fr: 'Constantine', ar: 'قسنطينة' }, { fr: 'El Khroub', ar: 'الخروب' }, { fr: 'Aïn Smara', ar: 'عين سمارة' },
    { fr: 'Hamma Bouziane', ar: 'حامة بوزيان' }, { fr: 'Didouche Mourad', ar: 'ديدوش مراد' },
    { fr: 'Zighoud Youcef', ar: 'زيغود يوسف' }, { fr: 'Ibn Badis', ar: 'ابن باديس' },
    { fr: 'Aïn Abid', ar: 'عين عبيد' }, { fr: 'Beni Hmidene', ar: 'بني حميدان' },
    { fr: 'Ouled Rahmoun', ar: 'أولاد رحمون' }, { fr: 'Ibn Ziad', ar: 'ابن زياد' },
    { fr: 'Messaoud Boudjeriou', ar: 'مسعود بوجريو' },
  ],
  26: [
    { fr: 'Médéa', ar: 'المدية' }, { fr: 'Ksar El Boukhari', ar: 'قصر البخاري' }, { fr: 'Beni Slimane', ar: 'بني سليمان' },
    { fr: 'Berrouaghia', ar: 'البرواقية' }, { fr: 'Tablat', ar: 'تابلاط' },
    { fr: 'Chellalet El Adhaoura', ar: 'شلالة العذاورة' }, { fr: 'Oued Jer', ar: 'واد جر' },
    { fr: 'Ain Boucif', ar: 'عين بوسيف' }, { fr: 'Ouamri', ar: 'عمري' },
    { fr: 'Si Mahdjoub', ar: 'سي المحجوب' }, { fr: 'Seghouane', ar: 'سغوان' },
  ],
  27: [
    { fr: 'Mostaganem', ar: 'مستغانم' }, { fr: 'Aïn Tedles', ar: 'عين تادلس' },
    { fr: 'Sidi Lakhdar', ar: 'سيدي لخضر' }, { fr: 'Kheir Eddine', ar: 'خير الدين' },
    { fr: 'Hassi Mameche', ar: 'حاسي ماماش' }, { fr: 'Achaacha', ar: 'عشعاشة' },
    { fr: 'Sayada', ar: 'صيادة' }, { fr: 'Mazagran', ar: 'مزغران' },
    { fr: 'Stidia', ar: 'ستيدية' }, { fr: 'Fornaka', ar: 'فرناكة' },
    { fr: 'Bouguirat', ar: 'بوقيراط' },
  ],
  28: [
    { fr: 'M\'Sila', ar: 'المسيلة' }, { fr: 'Bou Saâda', ar: 'بوسعادة' }, { fr: 'Sidi Aïssa', ar: 'سيدي عيسى' },
    { fr: 'Aïn El Melh', ar: 'عين الملح' }, { fr: 'Magra', ar: 'مقرة' },
    { fr: 'Hammam Dalaa', ar: 'حمام الضلعة' }, { fr: 'Ouled Derradj', ar: 'أولاد دراج' },
    { fr: 'Khoubana', ar: 'خبانة' }, { fr: 'Djebel Messaad', ar: 'جبل مساعد' },
    { fr: 'Berhoum', ar: 'برهوم' }, { fr: 'Chellal', ar: 'شلال' },
    { fr: 'Oultem', ar: 'أولتام' },
  ],
  29: [
    { fr: 'Mascara', ar: 'معسكر' }, { fr: 'Tighennif', ar: 'تيغنيف' }, { fr: 'Sig', ar: 'سيق' },
    { fr: 'Bouhanifia', ar: 'بوحنيفية' }, { fr: 'Mohammadia', ar: 'المحمدية' },
    { fr: 'Oued El Abtal', ar: 'وادي الأبطال' }, { fr: 'Ghriss', ar: 'غريس' },
    { fr: 'Oggaz', ar: 'عقاز' }, { fr: 'Ain Fekan', ar: 'عين فكان' },
    { fr: 'Hachem', ar: 'الحشم' }, { fr: 'Tizi', ar: 'تيزي' },
  ],
  30: [
    { fr: 'Ouargla', ar: 'ورقلة' }, { fr: 'Hassi Messaoud', ar: 'حاسي مسعود' },
    { fr: 'Touggourt', ar: 'تقرت' }, { fr: 'Temacine', ar: 'تماسين' },
    { fr: 'Rouissat', ar: 'الرويسات' }, { fr: 'Aïn Beïda', ar: 'عين البيضاء' },
    { fr: 'Sidi Khouiled', ar: 'سيدي خويلد' }, { fr: 'N\'Goussa', ar: 'نقوسة' },
    { fr: 'El Hadjira', ar: 'الحجيرة' }, { fr: 'El Borma', ar: 'البرمة' },
    { fr: 'Hassi Ben Abdellah', ar: 'حاسي بن عبد الله' },
  ],
  31: [
    { fr: 'Oran', ar: 'وهران' }, { fr: 'Bir El Djir', ar: 'بئر الجير' }, { fr: 'Es Sénia', ar: 'السانية' },
    { fr: 'Aïn El Türck', ar: 'عين الترك' }, { fr: 'Arzew', ar: 'أرزيو' },
    { fr: 'Mers El Kébir', ar: 'المرسى الكبير' }, { fr: 'Oued Tlelat', ar: 'وادي تليلات' },
    { fr: 'Hassi Bounif', ar: 'حاسي بونيف' }, { fr: 'Gdyel', ar: 'قديل' },
    { fr: 'Misserghin', ar: 'مسرغين' }, { fr: 'Boutlélis', ar: 'بوتليليس' },
    { fr: 'Bethioua', ar: 'بطيوة' }, { fr: 'Hassi Ben Okba', ar: 'حاسي بن عقبة' },
    { fr: 'Sidi Chahmi', ar: 'سيدي الشحمي' },
  ],
  32: [
    { fr: 'El Bayadh', ar: 'البيض' }, { fr: 'Bougtob', ar: 'بوقطب' },
    { fr: 'El Abiodh Sidi Cheikh', ar: 'الأبيض سيدي الشيخ' }, { fr: 'Brezina', ar: 'بريزينة' },
    { fr: 'Cheguig', ar: 'الشقيق' }, { fr: 'Stitten', ar: 'ستيتن' },
    { fr: 'Rogassa', ar: 'رقاصة' }, { fr: 'Ghassoul', ar: 'الغسول' },
  ],
  33: [
    { fr: 'Illizi', ar: 'إليزي' }, { fr: 'Djanet', ar: 'جانت' }, { fr: 'In Amenas', ar: 'عين أمناس' },
    { fr: 'Bordj El Haouès', ar: 'برج الحواس' }, { fr: 'Debdeb', ar: 'دبداب' },
  ],
  34: [
    { fr: 'Bordj Bou Arréridj', ar: 'برج بوعريريج' }, { fr: 'Ras El Oued', ar: 'رأس الوادي' },
    { fr: 'El Mansourah', ar: 'المنصورة' }, { fr: 'Aïn Taghrout', ar: 'عين تاقروت' },
    { fr: 'Medjana', ar: 'مجانة' }, { fr: 'Djaafra', ar: 'الجعافرة' },
    { fr: 'Bir Kasdali', ar: 'بئر قاصد علي' }, { fr: 'El Achir', ar: 'الأشير' },
    { fr: 'Sidi Embarek', ar: 'سيدي مبارك' }, { fr: 'Bordj Ghedir', ar: 'برج الغدير' },
    { fr: 'Hasnaoua', ar: 'حسناوة' },
  ],
  35: [
    { fr: 'Boumerdès', ar: 'بومرداس' }, { fr: 'Thénia', ar: 'الثنية' }, { fr: 'Bordj Menaïel', ar: 'برج منايل' },
    { fr: 'Khemis El Khechna', ar: 'خميس الخشنة' }, { fr: 'Dellys', ar: 'دلس' },
    { fr: 'Larbaatache', ar: 'الأربعطاش' }, { fr: 'Boudouaou', ar: 'بودواو' },
    { fr: 'Baghlia', ar: 'بغلية' }, { fr: 'Si Mustapha', ar: 'سي مصطفى' },
    { fr: 'Hamadi', ar: 'حمادي' }, { fr: 'Tidjelabine', ar: 'تيجلابين' },
    { fr: 'Naciria', ar: 'الناصرية' }, { fr: 'Corso', ar: 'كورسو' },
    { fr: 'Ouled Moussa', ar: 'أولاد موسى' },
  ],
  36: [
    { fr: 'El Tarf', ar: 'الطارف' }, { fr: 'El Kala', ar: 'القالة' }, { fr: 'Bouteldja', ar: 'بوثلجة' },
    { fr: 'Ben M\'Hidi', ar: 'بن مهيدي' }, { fr: 'Drean', ar: 'الذرعان' },
    { fr: 'Aïn El Karma', ar: 'عين الكرمة' }, { fr: 'Bouhadjar', ar: 'بوحجار' },
    { fr: 'Asfour', ar: 'عصفور' }, { fr: 'Berrihane', ar: 'بريحان' },
    { fr: 'Besbes', ar: 'البسباس' }, { fr: 'Lac des Oiseaux', ar: 'بحيرة الطيور' },
    { fr: 'Zitouna', ar: 'الزيتونة' },
  ],
  37: [
    { fr: 'Tindouf', ar: 'تندوف' }, { fr: 'Oum El Assel', ar: 'أم العسل' },
  ],
  38: [
    { fr: 'Tissemsilt', ar: 'تيسمسيلت' }, { fr: 'Theniet El Had', ar: 'ثنية الحد' },
    { fr: 'Bordj Bounaama', ar: 'برج بونعامة' }, { fr: 'Lazharia', ar: 'لزهرية' },
    { fr: 'Layoune', ar: 'لعيون' }, { fr: 'Amir Abdelkader', ar: 'الأمير عبد القادر' },
    { fr: 'Lardjem', ar: 'لرجام' }, { fr: 'Khemisti', ar: 'خميستي' },
    { fr: 'Beni Chaib', ar: 'بني شعيب' },
  ],
  39: [
    { fr: 'El Oued', ar: 'الوادي' }, { fr: 'Guemar', ar: 'قمار' }, { fr: 'Debila', ar: 'الدبيلة' },
    { fr: 'Hassi Khalifa', ar: 'حاسي خليفة' }, { fr: 'Robbah', ar: 'الرباح' },
    { fr: 'Taleb Larbi', ar: 'الطالب العربي' }, { fr: 'Reguiba', ar: 'الرقيبة' },
    { fr: 'Bayadha', ar: 'البياضة' }, { fr: 'Nakhla', ar: 'النخلة' },
    { fr: 'Magrane', ar: 'المقران' }, { fr: 'Kouinine', ar: 'كوينين' },
    { fr: 'Hamraia', ar: 'حمراية' },
  ],
  40: [
    { fr: 'Khenchela', ar: 'خنشلة' }, { fr: 'Kaïs', ar: 'قايس' }, { fr: 'Babar', ar: 'بابار' },
    { fr: 'Aïn Touila', ar: 'عين الطويلة' }, { fr: 'Bouhmama', ar: 'بوحمامة' },
    { fr: 'El Hamma', ar: 'الحامة' }, { fr: 'Chechar', ar: 'ششار' },
    { fr: 'El Mahmal', ar: 'المحمل' }, { fr: 'Tamza', ar: 'تامزة' },
    { fr: 'Ouled Rechache', ar: 'أولاد رشاش' },
  ],
  41: [
    { fr: 'Souk Ahras', ar: 'سوق أهراس' }, { fr: 'Sedrata', ar: 'سدراتة' }, { fr: 'Taoura', ar: 'تاورة' },
    { fr: 'Haddada', ar: 'الحدادة' }, { fr: 'Mechroha', ar: 'المشروحة' },
    { fr: 'Ouled Driss', ar: 'أولاد دريس' }, { fr: 'M\'Daourouch', ar: 'مداوروش' },
    { fr: 'Oum El Adhaïm', ar: 'أم العظايم' }, { fr: 'Aïn Zana', ar: 'عين الزانة' },
    { fr: 'Merahna', ar: 'مراحنة' },
  ],
  42: [
    { fr: 'Tipaza', ar: 'تيبازة' }, { fr: 'Hadjout', ar: 'حجوط' }, { fr: 'Cherchell', ar: 'شرشال' },
    { fr: 'Koléa', ar: 'القليعة' }, { fr: 'Fouka', ar: 'فوكة' },
    { fr: 'Bou Ismaïl', ar: 'بواسماعيل' }, { fr: 'Ahmer El Aïn', ar: 'أحمر العين' },
    { fr: 'Sidi Amar', ar: 'سيدي عمر' }, { fr: 'Gouraya', ar: 'قوراية' },
    { fr: 'Damous', ar: 'دامس' }, { fr: 'Nador', ar: 'نادر' },
    { fr: 'Attatba', ar: 'حطاطبة' }, { fr: 'Sidi Rached', ar: 'سيدي راشد' },
    { fr: 'Chaïba', ar: 'شعيبة' },
  ],
  43: [
    { fr: 'Mila', ar: 'ميلة' }, { fr: 'Chelghoum Laïd', ar: 'شلغوم العيد' }, { fr: 'Ferdjioua', ar: 'فرجيوة' },
    { fr: 'Oued Athmania', ar: 'وادي عتمانية' }, { fr: 'Tadjenanet', ar: 'تاجنانت' },
    { fr: 'Aïn Mellouk', ar: 'عين ملوك' }, { fr: 'Teleghma', ar: 'التلاغمة' },
    { fr: 'Grarem Gouga', ar: 'قرارم قوقة' }, { fr: 'Sidi Merouane', ar: 'سيدي مروان' },
    { fr: 'Tassadane Haddada', ar: 'تسدان الحدادة' },
  ],
  44: [
    { fr: 'Aïn Defla', ar: 'عين الدفلى' }, { fr: 'Khemis Miliana', ar: 'خميس مليانة' },
    { fr: 'Miliana', ar: 'مليانة' }, { fr: 'El Djendel', ar: 'الجندل' },
    { fr: 'El Attaf', ar: 'العطاف' }, { fr: 'Hammam Righa', ar: 'حمام ريغة' },
    { fr: 'Bathia', ar: 'بطحية' }, { fr: 'El Abadia', ar: 'العبادية' },
    { fr: 'Djelida', ar: 'جليدة' }, { fr: 'Bourached', ar: 'بوراشد' },
    { fr: 'Mekhatria', ar: 'مخاطرية' },
  ],
  45: [
    { fr: 'Naâma', ar: 'النعامة' }, { fr: 'Mécheria', ar: 'مشرية' }, { fr: 'Aïn Sefra', ar: 'عين الصفراء' },
    { fr: 'Tiout', ar: 'تيوت' }, { fr: 'Moghrar', ar: 'المقرار' },
    { fr: 'Djenien Bourezg', ar: 'جنين بورزق' }, { fr: 'Asla', ar: 'عسلة' },
    { fr: 'Sfissifa', ar: 'صفيصيفة' },
  ],
  46: [
    { fr: 'Aïn Témouchent', ar: 'عين تيموشنت' }, { fr: 'El Malah', ar: 'المالح' },
    { fr: 'Béni Saf', ar: 'بني صاف' }, { fr: 'Hammam Bou Hadjar', ar: 'حمام بوحجر' },
    { fr: 'El Amria', ar: 'العمرية' }, { fr: 'Aghlal', ar: 'أغلال' },
    { fr: 'Oulhassa', ar: 'ولهاصة' }, { fr: 'Terga', ar: 'تارقة' },
    { fr: 'Hassi El Ghella', ar: 'حاسي الغلة' }, { fr: 'Sidi Ben Adda', ar: 'سيدي بن عدة' },
  ],
  47: [
    { fr: 'Ghardaïa', ar: 'غرداية' }, { fr: 'El Meniaa', ar: 'المنيعة' }, { fr: 'Berriane', ar: 'بريان' },
    { fr: 'El Guerrara', ar: 'القرارة' }, { fr: 'Metlili', ar: 'متليلي' },
    { fr: 'Bounoura', ar: 'بنورة' }, { fr: 'El Atteuf', ar: 'الأطفيش' },
    { fr: 'Dhayet Bendhahoua', ar: 'ضاية بن ضحوة' }, { fr: 'Zelfana', ar: 'زلفانة' },
    { fr: 'Sebseb', ar: 'سبسب' },
  ],
  48: [
    { fr: 'Relizane', ar: 'غليزان' }, { fr: 'Ammi Moussa', ar: 'عمي موسى' },
    { fr: 'Mazouna', ar: 'مازونة' }, { fr: 'Oued Rhiou', ar: 'واد رهيو' },
    { fr: 'Ramka', ar: 'الرمكة' }, { fr: 'Sidi Lazreg', ar: 'سيدي لزرق' },
    { fr: 'Yellel', ar: 'يلل' }, { fr: 'Zemmoura', ar: 'زمورة' },
    { fr: 'Mendes', ar: 'مندس' }, { fr: 'El Matmar', ar: 'المطمر' },
    { fr: 'Djidioua', ar: 'جديوية' },
  ],
  49: [
    { fr: 'Timimoun', ar: 'تيميمون' }, { fr: 'Ougrout', ar: 'أوقروت' }, { fr: 'Charouine', ar: 'شروين' },
    { fr: 'Talmine', ar: 'طلمين' }, { fr: 'Metarfa', ar: 'المطارفة' },
    { fr: 'Aougrout', ar: 'أوقروت' },
  ],
  50: [
    { fr: 'Bordj Badji Mokhtar', ar: 'برج باجي مختار' }, { fr: 'Timiaouine', ar: 'تيمياوين' },
  ],
  51: [
    { fr: 'Ouled Djellal', ar: 'أولاد جلال' }, { fr: 'Sidi Khaled', ar: 'سيدي خالد' },
    { fr: 'Doucen', ar: 'الدوسن' }, { fr: 'Chaïba', ar: 'الشعيبة' },
    { fr: 'Ras El Miaad', ar: 'رأس الميعاد' }, { fr: 'Bessbès', ar: 'بسباس' },
    { fr: 'Lioua', ar: 'ليوة' },
  ],
  52: [
    { fr: 'Béni Abbès', ar: 'بني عباس' }, { fr: 'Igli', ar: 'إيغلي' },
    { fr: 'Tamtert', ar: 'تامترت' }, { fr: 'El Ouata', ar: 'الواتة' },
    { fr: 'Kerzaz', ar: 'كرزاز' }, { fr: 'Ksabi', ar: 'القصابي' },
  ],
  53: [
    { fr: 'Aïn Salah', ar: 'عين صالح' }, { fr: 'Foggaret Ezzoua', ar: 'فقارة الزوى' },
    { fr: 'In Ghar', ar: 'إينغر' }, { fr: 'Hassi El Gara', ar: 'حاسي القارة' },
  ],
  54: [
    { fr: 'Aïn Guezzam', ar: 'عين قزام' }, { fr: 'Tin Zaouatine', ar: 'تين زواتين' },
  ],
  55: [
    { fr: 'Touggourt', ar: 'تقرت' }, { fr: 'Temacine', ar: 'تماسين' }, { fr: 'Megarine', ar: 'مقارين' },
    { fr: 'Blidet Amor', ar: 'بلدة عمر' }, { fr: 'Nezla', ar: 'النزلة' },
    { fr: 'Tebesbest', ar: 'الطيبات' }, { fr: 'Zaouia El Abidia', ar: 'الزاوية العابدية' },
    { fr: 'Benaceur', ar: 'بن الناصر' }, { fr: 'Sidi Slimane', ar: 'سيدي سليمان' },
  ],
  56: [
    { fr: 'Djanet', ar: 'جانت' }, { fr: 'Bordj El Haouès', ar: 'برج الحواس' },
    { fr: 'El Mihan', ar: 'الميهان' },
  ],
  57: [
    { fr: 'El M\'Ghair', ar: 'المغير' }, { fr: 'Djamaa', ar: 'جامعة' },
    { fr: 'Sidi Khélil', ar: 'سيدي خليل' }, { fr: 'Oum Touyour', ar: 'أم الطيور' },
    { fr: 'M\'Rara', ar: 'مرارة' }, { fr: 'Sidi Amrane', ar: 'سيدي عمران' },
    { fr: 'Still', ar: 'ستيل' },
  ],
  58: [
    { fr: 'El Meniaa', ar: 'المنيعة' }, { fr: 'Hassi El Gara', ar: 'حاسي الغلة' },
    { fr: 'Berriane', ar: 'بريان' }, { fr: 'Hassi Fehal', ar: 'حاسي الفحل' },
  ],
};

// ═══════════════════════════════════════════════════════════
// DESKS (Stop Desk / Bureau) - French + Arabic
// ═══════════════════════════════════════════════════════════
const desksData: NoestDesk[] = [
  // Adrar (1)
  { code: '1A', name: 'Bureau Adrar', name_ar: 'مكتب أدرار' },
  // Chlef (2)
  { code: '2A', name: 'Bureau Chlef', name_ar: 'مكتب الشلف' },
  // Laghouat (3)
  { code: '3A', name: 'Bureau Laghouat', name_ar: 'مكتب الأغواط' },
  // Oum El Bouaghi (4)
  { code: '4A', name: 'Bureau Oum El Bouaghi', name_ar: 'مكتب أم البواقي' },
  // Batna (5)
  { code: '5A', name: 'Bureau Batna', name_ar: 'مكتب باتنة' },
  // Bejaia (6)
  { code: '6A', name: 'Bureau Béjaïa', name_ar: 'مكتب بجاية' },
  { code: '6B', name: 'Bureau Akbou', name_ar: 'مكتب أقبو' },
  // Biskra (7)
  { code: '7A', name: 'Bureau Biskra', name_ar: 'مكتب بسكرة' },
  // Bechar (8)
  { code: '8A', name: 'Bureau Béchar', name_ar: 'مكتب بشار' },
  // Blida (9)
  { code: '9A', name: 'Bureau Blida', name_ar: 'مكتب البليدة' },
  { code: '9B', name: 'Bureau Boufarik', name_ar: 'مكتب بوفاريك' },
  // Bouira (10)
  { code: '10A', name: 'Bureau Bouira', name_ar: 'مكتب البويرة' },
  // Tamanrasset (11)
  { code: '11A', name: 'Bureau Tamanrasset', name_ar: 'مكتب تمنراست' },
  // Tebessa (12)
  { code: '12A', name: 'Bureau Tébessa', name_ar: 'مكتب تبسة' },
  // Tlemcen (13)
  { code: '13A', name: 'Bureau Tlemcen', name_ar: 'مكتب تلمسان' },
  // Tiaret (14)
  { code: '14A', name: 'Bureau Tiaret', name_ar: 'مكتب تيارت' },
  // Tizi Ouzou (15)
  { code: '15A', name: 'Bureau Tizi Ouzou', name_ar: 'مكتب تيزي وزو' },
  { code: '15B', name: 'Bureau Draa El Mizan', name_ar: 'مكتب ذراع الميزان' },
  // Alger (16)
  { code: '16A', name: 'Bureau Alger Centre', name_ar: 'مكتب الجزائر الوسطى' },
  { code: '16B', name: 'Bureau Bab Ezzouar', name_ar: 'مكتب باب الزوار' },
  { code: '16C', name: 'Bureau El Harrach', name_ar: 'مكتب الحراش' },
  { code: '16D', name: 'Bureau Draria', name_ar: 'مكتب الدرارية' },
  { code: '16E', name: 'Bureau Bir Khadem', name_ar: 'مكتب بئر خادم' },
  { code: '16F', name: 'Bureau Baraki', name_ar: 'مكتب براقي' },
  { code: '16G', name: 'Bureau Rouïba', name_ar: 'مكتب الرويبة' },
  // Djelfa (17)
  { code: '17A', name: 'Bureau Djelfa', name_ar: 'مكتب الجلفة' },
  // Jijel (18)
  { code: '18A', name: 'Bureau Jijel', name_ar: 'مكتب جيجل' },
  // Setif (19)
  { code: '19A', name: 'Bureau Sétif', name_ar: 'مكتب سطيف' },
  { code: '19B', name: 'Bureau El Eulma', name_ar: 'مكتب العلمة' },
  // Saida (20)
  { code: '20A', name: 'Bureau Saïda', name_ar: 'مكتب سعيدة' },
  // Skikda (21)
  { code: '21A', name: 'Bureau Skikda', name_ar: 'مكتب سكيكدة' },
  // Sidi Bel Abbes (22)
  { code: '22A', name: 'Bureau Sidi Bel Abbès', name_ar: 'مكتب سيدي بلعباس' },
  // Annaba (23)
  { code: '23A', name: 'Bureau Annaba', name_ar: 'مكتب عنابة' },
  { code: '23B', name: 'Bureau El Bouni', name_ar: 'مكتب البوني' },
  // Guelma (24)
  { code: '24A', name: 'Bureau Guelma', name_ar: 'مكتب قالمة' },
  // Constantine (25)
  { code: '25A', name: 'Bureau Constantine', name_ar: 'مكتب قسنطينة' },
  { code: '25B', name: 'Bureau El Khroub', name_ar: 'مكتب الخروب' },
  // Medea (26)
  { code: '26A', name: 'Bureau Médéa', name_ar: 'مكتب المدية' },
  // Mostaganem (27)
  { code: '27A', name: 'Bureau Mostaganem', name_ar: 'مكتب مستغانم' },
  // Msila (28)
  { code: '28A', name: 'Bureau M\'Sila', name_ar: 'مكتب المسيلة' },
  // Mascara (29)
  { code: '29A', name: 'Bureau Mascara', name_ar: 'مكتب معسكر' },
  // Ouargla (30)
  { code: '30A', name: 'Bureau Ouargla', name_ar: 'مكتب ورقلة' },
  // Oran (31)
  { code: '31A', name: 'Bureau Oran Centre', name_ar: 'مكتب وهران المركزي' },
  { code: '31B', name: 'Bureau Bir El Djir', name_ar: 'مكتب بئر الجير' },
  { code: '31C', name: 'Bureau Es Sénia', name_ar: 'مكتب السانية' },
  // El Bayadh (32)
  { code: '32A', name: 'Bureau El Bayadh', name_ar: 'مكتب البيض' },
  // Illizi (33)
  { code: '33A', name: 'Bureau Illizi', name_ar: 'مكتب إليزي' },
  // BBA (34)
  { code: '34A', name: 'Bureau Bordj Bou Arréridj', name_ar: 'مكتب برج بوعريريج' },
  // Boumerdes (35)
  { code: '35A', name: 'Bureau Boumerdès', name_ar: 'مكتب بومرداس' },
  { code: '35B', name: 'Bureau Boudouaou', name_ar: 'مكتب بودواو' },
  // El Tarf (36)
  { code: '36A', name: 'Bureau El Tarf', name_ar: 'مكتب الطارف' },
  // Tindouf (37)
  { code: '37A', name: 'Bureau Tindouf', name_ar: 'مكتب تندوف' },
  // Tissemsilt (38)
  { code: '38A', name: 'Bureau Tissemsilt', name_ar: 'مكتب تيسمسيلت' },
  // El Oued (39)
  { code: '39A', name: 'Bureau El Oued', name_ar: 'مكتب الوادي' },
  // Khenchela (40)
  { code: '40A', name: 'Bureau Khenchela', name_ar: 'مكتب خنشلة' },
  // Souk Ahras (41)
  { code: '41A', name: 'Bureau Souk Ahras', name_ar: 'مكتب سوق أهراس' },
  // Tipaza (42)
  { code: '42A', name: 'Bureau Tipaza', name_ar: 'مكتب تيبازة' },
  { code: '42B', name: 'Bureau Chéraga', name_ar: 'مكتب الشراقة' },
  // Mila (43)
  { code: '43A', name: 'Bureau Mila', name_ar: 'مكتب ميلة' },
  // Ain Defla (44)
  { code: '44A', name: 'Bureau Aïn Defla', name_ar: 'مكتب عين الدفلى' },
  // Naama (45)
  { code: '45A', name: 'Bureau Naâma', name_ar: 'مكتب النعامة' },
  // Ain Temouchent (46)
  { code: '46A', name: 'Bureau Aïn Témouchent', name_ar: 'مكتب عين تيموشنت' },
  // Ghardaia (47)
  { code: '47A', name: 'Bureau Ghardaïa', name_ar: 'مكتب غرداية' },
  // Relizane (48)
  { code: '48A', name: 'Bureau Relizane', name_ar: 'مكتب غليزان' },
  // Timimoun (49)
  { code: '49A', name: 'Bureau Timimoun', name_ar: 'مكتب تيميمون' },
  // Ouled Djellal (51)
  { code: '51A', name: 'Bureau Ouled Djellal', name_ar: 'مكتب أولاد جلال' },
  // Beni Abbes (52)
  { code: '52A', name: 'Bureau Béni Abbès', name_ar: 'مكتب بني عباس' },
  // Ain Salah (53)
  { code: '53A', name: 'Bureau Aïn Salah', name_ar: 'مكتب عين صالح' },
  // Touggourt (55)
  { code: '55A', name: 'Bureau Touggourt', name_ar: 'مكتب تقرت' },
  // Djanet (56)
  { code: '56A', name: 'Bureau Djanet', name_ar: 'مكتب جانت' },
  // El Mghair (57)
  { code: '57A', name: 'Bureau El M\'Ghair', name_ar: 'مكتب المغير' },
  // El Meniaa (58)
  { code: '58A', name: 'Bureau El Meniaa', name_ar: 'مكتب المنيعة' },
];

// ═══════════════════════════════════════════════════════════
// Helper: extract wilaya code from desk code
// ═══════════════════════════════════════════════════════════
export function getWilayaCodeFromDeskCode(deskCode: string): number {
  const match = deskCode.match(/^(\d+)/);
  return match ? parseInt(match[1], 10) : 0;
}

// ═══════════════════════════════════════════════════════════
// API FUNCTIONS
// ═══════════════════════════════════════════════════════════
export async function getWilayas(): Promise<ApiResponse<NoestWilaya[]>> {
  return { ok: true, data: wilayasData };
}

export async function getCommunes(wilayaId: number): Promise<ApiResponse<NoestCommune[]>> {
  const entries = communesData[wilayaId] || [];
  const communes: NoestCommune[] = entries.map(e => ({
    wilaya_id: wilayaId,
    nom: e.fr,       // French name for API
    nom_ar: e.ar,    // Arabic name for display
  }));
  return { ok: true, data: communes };
}

export async function getDesks(): Promise<ApiResponse<NoestDesk[]>> {
  return { ok: true, data: desksData };
}

export interface CreateOrderParams {
  client: string;
  phone: string;
  adresse: string;
  wilaya_id: number;
  commune: string;     // Must be French name for NOEST
  montant: number;
  produit: string;
  type_id: number;
  stop_desk: number;
  station_code?: string;
}

export interface CreateOrderResult {
  ok: boolean;
  data?: { id: string; tracking: string };
  error?: string;
  debug?: string;
}

/**
 * Send order to NOEST via /api/noest serverless function.
 * 
 * IMPORTANT:
 * - /api/noest only works on Vercel deployment (serverless function)
 * - In Arena/local dev, it returns 404 — this is EXPECTED
 * - NEVER returns ok:true unless NOEST actually confirmed the order
 * - NEVER generates fake tracking numbers
 */
export async function createOrder(params: CreateOrderParams): Promise<CreateOrderResult> {
  console.log('[NOEST] ═══ createOrder START ═══');
  console.log('[NOEST] Params:', JSON.stringify(params));

  // ── Step 1: Call /api/noest ──
  let response: Response;
  try {
    response = await fetch('/api/noest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'create_order', ...params }),
    });
  } catch (networkErr: unknown) {
    const msg = networkErr instanceof Error ? networkErr.message : String(networkErr);
    console.error('[NOEST] ❌ fetch() threw:', msg);
    return {
      ok: false,
      error: 'فشل الاتصال بالخادم. تأكد من أن التطبيق منشور على Vercel وأن الدومين صحيح.',
      debug: `fetch error: ${msg}`,
    };
  }

  // ── Step 2: Read raw response ──
  const rawText = await response.text();
  console.log(`[NOEST] HTTP ${response.status} — ${rawText.substring(0, 500)}`);

  // ── Step 3: Handle 404 = serverless not deployed ──
  if (response.status === 404) {
    const isHtml = rawText.includes('<html') || rawText.includes('<!DOCTYPE') || rawText.includes('Not Found') || rawText.includes('404');
    if (isHtml) {
      console.error('[NOEST] ❌ /api/noest returned HTML 404 — serverless NOT deployed');
      return {
        ok: false,
        error: '⚠️ خدمة التوصيل غير متوفرة. يجب نشر التطبيق على Vercel لإرسال الطلبات إلى NOEST.',
        debug: 'Serverless function /api/noest not found. Deploy to Vercel.',
      };
    }
  }

  // ── Step 4: Parse JSON ──
  let result: {
    ok?: boolean;
    data?: { id?: string; tracking?: string; endpoint_used?: string; raw?: unknown };
    error?: string;
    debug?: unknown;
    fix?: string;
  };

  try {
    result = JSON.parse(rawText);
  } catch {
    console.error('[NOEST] ❌ Non-JSON response from /api/noest');
    return {
      ok: false,
      error: `الخادم أرجع استجابة غير صالحة (HTTP ${response.status})`,
      debug: rawText.substring(0, 300),
    };
  }

  // ── Step 5: Server said ok:false → propagate error with full details ──
  if (result.ok === false) {
    const errorMsg = result.error || `فشل إرسال الطلب (HTTP ${response.status})`;
    console.error('[NOEST] ❌ Proxy returned ok:false:', errorMsg);
    if (result.debug) console.error('[NOEST] Debug:', JSON.stringify(result.debug));
    return {
      ok: false,
      error: errorMsg,
      debug: result.fix || (typeof result.debug === 'string' ? result.debug : JSON.stringify(result.debug || '').substring(0, 500)),
    };
  }

  // ── Step 6: Server said ok:true → verify data ──
  if (result.ok === true && result.data) {
    const orderId = result.data.id || '';
    let tracking = result.data?.tracking || '';

if (!tracking && (result as any).raw) {
  try {
    const parsed = JSON.parse((result as any).raw);
    tracking = parsed.tracking || '';
  } catch {}
}

    if (!orderId && !tracking) {
      console.error('[NOEST] ❌ ok:true but empty tracking/id:', JSON.stringify(result.data));
      return {
        ok: false,
        error: 'شركة التوصيل لم تُرجع رقم تتبع أو معرف طلب — تحقق من حسابك على NOEST',
      };
    }

    console.log(`[NOEST] ✅ ORDER CONFIRMED — tracking=${tracking}, id=${orderId}, endpoint=${result.data.endpoint_used || '?'}`);
    return {
      ok: true,
      data: { id: orderId, tracking: tracking || orderId },
    };
  }

  // ── Step 7: Unexpected shape ──
  console.error('[NOEST] ❌ Unexpected response shape:', JSON.stringify(result).substring(0, 300));
  return {
    ok: false,
    error: `استجابة غير متوقعة من الخادم (HTTP ${response.status})`,
    debug: JSON.stringify(result).substring(0, 300),
  };
}
