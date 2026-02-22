// src/utils/communes.ts
// Practical communes list (FR) per wilaya code (1..58).
// Not an exhaustive national list (1500+ communes), but includes the most used communes.
// You can extend any wilaya array anytime.

export const COMMUNES_BY_WILAYA: Record<number, string[]> = {
  // 01 Adrar
  1: ["Adrar", "Reggane", "Aoulef", "Timimoun", "Zaouiet Kounta", "Tsabit", "Charouine", "In Zghmir", "Tinerkouk"],
  // 02 Chlef
  2: ["Chlef", "Tenes", "Oued Fodda", "El Karimia", "Beni Haoua", "Abou El Hassan", "Sendjas", "Zeboudja", "Ouled Fares"],
  // 03 Laghouat
  3: ["Laghouat", "Aflou", "Hassi R'Mel", "Ksar El Hirane", "Gueltat Sidi Saad", "Brida", "Oued Morra"],
  // 04 Oum El Bouaghi
  4: ["Oum El Bouaghi", "Ain Beida", "Ain Mlila", "Sigus", "Ain Kercha", "Fkirina", "Souk Naamane", "Meskiana"],
  // 05 Batna
  5: ["Batna", "Barika", "Arris", "Merouana", "N'Gaous", "Ain Touta", "Tazoult", "Ras El Aioun", "Seriana"],
  // 06 Bejaia
  6: ["Bejaia", "Akbou", "Sidi Aich", "Tazmalt", "Amizour", "El Kseur", "Kherrata", "Tichy", "Aokas", "Souk El Tenine"],
  // 07 Biskra
  7: ["Biskra", "Tolga", "Ouled Djellal", "Sidi Okba", "El Kantara", "Zeribet El Oued", "Foughala", "Ourlal"],
  // 08 Bechar
  8: ["Bechar", "Kenadsa", "Abadla", "Beni Ounif", "Taghit", "Igli", "Lahmar"],
  // 09 Blida
  9: ["Blida", "Boufarik", "Bougara", "Beni Mered", "Ouled Yaich", "Chiffa", "Meftah", "Oued El Alleug", "El Affroun", "Soumaa"],
  // 10 Bouira
  10: ["Bouira", "Lakhdaria", "Sour El Ghozlane", "Ain Bessem", "M'Chedallah", "Kadiria", "Chorfa", "El Hachimia"],
  // 11 Tamanrasset
  11: ["Tamanrasset", "In Salah", "In Guezzam", "Tazrouk", "Abalessa"],
  // 12 Tebessa
  12: ["Tebessa", "Bir El Ater", "Cheria", "Negrine", "El Aouinet", "El Kouif", "Ouenza"],
  // 13 Tlemcen
  13: ["Tlemcen", "Mansourah", "Chetouane", "Maghnia", "Ghazaouet", "Nedroma", "Remchi", "Hennaya", "Sebdou"],
  // 14 Tiaret
  14: ["Tiaret", "Sougueur", "Frenda", "Mahdia", "Ain Deheb", "Ksar Chellala", "Medroussa"],
  // 15 Tizi Ouzou
  15: ["Tizi Ouzou", "Azazga", "Draa Ben Khedda", "Draa El Mizan", "Tigzirt", "Boghni", "Ain El Hammam", "Beni Douala", "Makouda", "Ouadhias"],
  // 16 Alger
  16: [
    "Alger Centre","Sidi M'Hamed","El Madania","Belouizdad","Bab El Oued","Bologhine","Casbah","Oued Koriche",
    "Bir Mourad Rais","El Biar","Bouzareah","Birkhadem","Hydra","Kouba","Bachedjerah","Hussein Dey","El Harrach",
    "Baraki","Les Eucalyptus","Bourouba","Dar El Beida","Oued Smar","Mohammadia","Bordj El Kiffan","Bab Ezzouar",
    "Djasr Kasentina","Ben Aknoun","Dely Ibrahim","El Achour","Draria","Saoula","Ain Benian","Staoueli","Zeralda",
    "Cheraga","Ouled Fayet","Sidi Moussa","Ain Taya","Reghaia","Rouiba","Heuraoua"
  ],
  // 17 Djelfa
  17: ["Djelfa", "Hassi Bahbah", "Ain Oussera", "Dar Chioukh", "Messaad", "Charef", "El Idrissia", "Faidh El Botma"],
  // 18 Jijel
  18: ["Jijel", "El Milia", "Taher", "Chekfa", "El Ancer", "Ziama Mansouriah", "Sidi Maarouf"],
  // 19 Setif
  19: ["Setif", "El Eulma", "Ain Oulmene", "Bougaa", "Ain Arnat", "Guidjel", "Salah Bey", "Beni Aziz", "Djemila"],
  // 20 Saida
  20: ["Saida", "Ain El Hadjar", "Ouled Khaled", "Youb", "Sidi Ahmed", "Hounet"],
  // 21 Skikda
  21: ["Skikda", "Azzaba", "Collo", "El Harrouch", "Tamalous", "Ben Azzouz", "Hammadi Krouma"],
  // 22 Sidi Bel Abbes
  22: ["Sidi Bel Abbes", "Telagh", "Ben Badis", "Tessala", "Sidi Ali Benyoub", "Marhoum", "Sidi Lahcene"],
  // 23 Annaba
  23: ["Annaba", "El Bouni", "El Hadjar", "Seraidi", "Berrahal", "Ain El Berda", "Chetaibi"],
  // 24 Guelma
  24: ["Guelma", "Hammam Debagh", "Oued Zenati", "Bouchegouf", "Heliopolis", "Khezaras", "Guelaat Bou Sbaa"],
  // 25 Constantine
  25: ["Constantine", "El Khroub", "Hamma Bouziane", "Didouche Mourad", "Ain Smara", "Zighoud Youcef"],
  // 26 Medea
  26: ["Medea", "Berrouaghia", "Ksar El Boukhari", "El Omaria", "Ouzera", "Ouled Brahim", "Tablat"],
  // 27 Mostaganem
  27: ["Mostaganem", "Mazagran", "Hassi Mameche", "Ain Nouissy", "Sidi Ali", "Mesra", "Bouguirat", "Kheir Eddine"],
  // 28 M'Sila
  28: ["M'Sila", "Bousaada", "Ain El Hadjel", "Sidi Aissa", "Magra", "Hammam Dhalaa", "Ouled Derradj"],
  // 29 Mascara
  29: ["Mascara", "Tighennif", "Mohammadia", "Ghriss", "Sig", "Oued Taria", "Ain Fares", "Bouhanifia"],
  // 30 Ouargla
  30: ["Ouargla", "Hassi Messaoud", "Rouissat", "N'Goussa", "Sidi Khouiled", "Ain Beida", "El Borma"],
  // 31 Oran
  31: ["Oran", "Es Senia", "Bir El Djir", "Ain El Turk", "Gdyel", "Arzew", "Bethioua", "Sidi Chami", "Mers El Kebir", "Oued Tlelat", "Bousfer"],
  // 32 El Bayadh
  32: ["El Bayadh", "Bougtob", "Rogassa", "Brezina", "El Abiodh Sidi Cheikh", "Cheguig"],
  // 33 Illizi
  33: ["Illizi", "Djanet", "In Amenas", "Bordj Omar Driss"],
  // 34 Bordj Bou Arreridj
  34: ["Bordj Bou Arreridj", "Ras El Oued", "Bir Kasdali", "Mansoura", "El Achir", "Medjana"],
  // 35 Boumerdes
  35: ["Boumerdes", "Boudouaou", "Corso", "Bordj Menaiel", "Dellys", "Isser", "Thenia", "Tidjelabine", "Zemmouri", "Ouled Moussa", "Larbatache"],
  // 36 El Tarf
  36: ["El Tarf", "El Kala", "Bouhadjar", "Ben M'Hidi", "Bouteldja", "Drean", "Ain El Assel"],
  // 37 Tindouf
  37: ["Tindouf", "Oum El Assel"],
  // 38 Tissemsilt
  38: ["Tissemsilt", "Theniet El Had", "Bordj Emir Abdelkader", "Khemisti", "Lazharia"],
  // 39 El Oued
  39: ["El Oued", "Guemar", "Reguiba", "Magrane", "Robbah", "Bayadha", "Debila", "Mih Ouensa", "Taleb Larbi"],
  // 40 Khenchela
  40: ["Khenchela", "Ain Touila", "El Hamma", "Kais", "Babar", "Chelia", "Bouhmama"],
  // 41 Souk Ahras
  41: ["Souk Ahras", "Sedrata", "M'Daourouch", "Taoura", "Hanancha", "Ouled Driss", "Sidi Fredj"],
  // 42 Tipaza
  42: ["Tipaza", "Kolea", "Cherchell", "Gouraya", "Fouka", "Douaouda", "Hadjout", "Bou Ismail", "Ahmer El Ain", "Damous"],
  // 43 Mila
  43: ["Mila", "Chelghoum Laid", "Telerghma", "Grarem Gouga", "Tadjenanet", "Ferdjioua", "Oued Athmenia"],
  // 44 Ain Defla
  44: ["Ain Defla", "El Attaf", "Khemis Miliana", "El Abadia", "Miliana", "Djendel", "Arib"],
  // 45 Naama
  45: ["Naama", "Mecheria", "Ain Sefra", "Sfissifa", "Tiout"],
  // 46 Ain Temouchent
  46: ["Ain Temouchent", "Hammam Bou Hadjar", "El Malah", "Beni Saf", "Terga", "Oulhaça El Gheraba"],
  // 47 Ghardaia
  47: ["Ghardaia", "Berriane", "El Atteuf", "Metlili", "Zelfana", "Bounoura", "Sebseb"],
  // 48 Relizane
  48: ["Relizane", "Oued Rhiou", "Zemmoura", "Mazouna", "Yellel", "Ammi Moussa", "Mendes"],

  // 49 Timimoun (new wilaya)
  49: ["Timimoun", "Tinerkouk", "Aougrout", "Deldoul", "Ouled Said", "Charouine"],
  // 50 Bordj Badji Mokhtar
  50: ["Bordj Badji Mokhtar", "Timiaouine"],
  // 51 Ouled Djellal
  51: ["Ouled Djellal", "Doucen", "Sidi Khaled"],
  // 52 Beni Abbes
  52: ["Beni Abbes", "Igli", "El Ouata", "Kerzaz", "Tamtert"],
  // 53 In Salah
  53: ["In Salah", "Foggaret Ezzaouia", "In Ghar"],
  // 54 In Guezzam
  54: ["In Guezzam", "Tin Zaouatine"],
  // 55 Touggourt
  55: ["Touggourt", "Nezla", "Tebesbest", "Zaouia El Abidia", "El Hadjira"],
  // 56 Djanet
  56: ["Djanet", "Bordj El Haouas"],
  // 57 El M'Ghair
  57: ["El M'Ghair", "Djamaa", "Oum Touyour", "Sidi Amrane", "Still"],
  // 58 El Meniaa
  58: ["El Meniaa", "Hassi Gara", "Hassi Fehal"],
};

// Small helper (optional): get communes list safely
export const getCommunesByWilaya = (wilayaCode: number | '' | null | undefined): string[] => {
  if (!wilayaCode) return [];
  const list = COMMUNES_BY_WILAYA[Number(wilayaCode)] || [];
  // unique + sort
  return Array.from(new Set(list)).sort((a, b) => a.localeCompare(b));
};
