// الحقول المسموحة فقط:
const ALLOWED_FIELDS = [
  'name', 'description_short', 'description_long', 
  'price', 'original_price', 'image_url',
  'category', 'language', 'grade', 'year',
  'card_count', 'age_range', 'badge', 'is_active'
];

// تنظيف البيانات قبل الإرسال
const cleanData = {};
for (const key of ALLOWED_FIELDS) {
  if (data[key] !== undefined) cleanData[key] = data[key];
}
