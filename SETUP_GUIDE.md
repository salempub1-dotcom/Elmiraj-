# 🚀 دليل إعداد متجر المعراج - Supabase + Vercel

## 📋 المتطلبات

- حساب [Supabase](https://supabase.com) (مجاني)
- حساب [Vercel](https://vercel.com) (مجاني)
- حساب [GitHub](https://github.com)

---

## 1️⃣ إعداد Supabase

### أ) إنشاء مشروع جديد
1. اذهب إلى [app.supabase.com](https://app.supabase.com)
2. اضغط **New Project**
3. اختر اسم المشروع: `almiraj-store`
4. اختر كلمة مرور لقاعدة البيانات
5. اختر أقرب منطقة (مثلاً: `eu-west-1`)
6. اضغط **Create new project**

### ب) إنشاء جدول المنتجات
1. اذهب إلى **SQL Editor** في القائمة الجانبية
2. الصق الكود التالي واضغط **Run**:

```sql
-- Create products table
CREATE TABLE IF NOT EXISTS products (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  id_num SERIAL,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  long_description TEXT DEFAULT '',
  price NUMERIC NOT NULL DEFAULT 0,
  original_price NUMERIC DEFAULT NULL,
  image_url TEXT DEFAULT '',
  image_emoji TEXT DEFAULT '📦',
  category TEXT DEFAULT 'flashcards',
  grade TEXT DEFAULT 'preparatory' CHECK (grade IN ('preparatory', 'elementary', 'middle')),
  year INTEGER DEFAULT NULL,
  language TEXT DEFAULT 'english' CHECK (language IN ('english', 'french')),
  card_count INTEGER DEFAULT 30,
  benefits TEXT DEFAULT '',
  in_stock BOOLEAN DEFAULT TRUE,
  badge TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

-- Public read access (anyone can view products)
CREATE POLICY "Public read access" ON products
  FOR SELECT USING (true);

-- Admin insert/update/delete (authenticated users only)
CREATE POLICY "Admin insert" ON products
  FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Admin update" ON products
  FOR UPDATE TO authenticated
  USING (true);

CREATE POLICY "Admin delete" ON products
  FOR DELETE TO authenticated
  USING (true);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();
```

### ج) إنشاء Storage Bucket للصور
1. اذهب إلى **Storage** في القائمة الجانبية
2. اضغط **New Bucket**
3. الاسم: `product-images`
4. ✅ فعّل **Public bucket**
5. اضغط **Create bucket**
6. اذهب إلى **Policies** للـ bucket
7. أضف سياسة جديدة:
   - اسم: `Public read`
   - نوع: `SELECT` - للجميع (`anon, authenticated`)
   - أضف سياسة أخرى: `Admin upload`
   - نوع: `INSERT` - لـ `authenticated` فقط

### د) إنشاء حساب أدمن
1. اذهب إلى **Authentication** → **Users**
2. اضغط **Add User** → **Create new user**
3. أدخل البريد الإلكتروني وكلمة المرور
4. ✅ فعّل **Auto Confirm User**
5. اضغط **Create User**

### هـ) الحصول على مفاتيح API
1. اذهب إلى **Settings** → **API**
2. انسخ:
   - **Project URL**: `https://xxxxxxxx.supabase.co`
   - **anon public key**: `eyJhbGci...`

---

## 2️⃣ إعداد متغيرات البيئة في Vercel

1. اذهب إلى مشروعك في [Vercel Dashboard](https://vercel.com/dashboard)
2. اضغط **Settings** → **Environment Variables**
3. أضف المتغيرات التالية:

| Variable Name | Value |
|---|---|
| `VITE_SUPABASE_URL` | `https://xxxxxxxx.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | `eyJhbGci...` |

4. اضغط **Save**
5. أعد نشر المشروع (**Redeploy**)

---

## 3️⃣ الوصول للوحة التحكم

بعد النشر:
1. افتح الموقع
2. أضف `#admin` للرابط: `https://yoursite.vercel.app/#admin`
3. سجّل الدخول بالبريد وكلمة المرور التي أنشأتها في الخطوة 1(د)

---

## 4️⃣ استخدام لوحة التحكم

### إضافة منتج جديد:
1. اضغط **➕ إضافة منتج**
2. املأ البيانات (الاسم، الوصف، السعر...)
3. ارفع صورة أو اختر إيموجي
4. اضغط **إضافة المنتج**

### تعديل منتج:
1. مرر الماوس فوق المنتج
2. اضغط أيقونة التعديل ✏️
3. عدّل البيانات
4. اضغط **تحديث المنتج**

### حذف منتج:
1. مرر الماوس فوق المنتج
2. اضغط أيقونة الحذف 🗑️
3. أكّد الحذف

---

## 📊 Facebook Pixel

البيكسل مُفعّل تلقائياً:
- **Pixel ID**: `852210374033980`
- **الأحداث المتتبعة**: PageView, ViewContent, AddToCart, InitiateCheckout, Purchase

---

## 🚚 Noest API

API شركة التوصيل مُدمج تلقائياً:
- **إنشاء الطلبات** تلقائياً عند الشراء
- **الأسعار** الحقيقية حسب الولاية
- **تتبع الطرود** عبر رقم التتبع
- **نقاط الاستلام** (Stop Desk) متاحة

---

## 🔧 للتطوير المحلي

```bash
# إنشاء ملف .env.local
echo "VITE_SUPABASE_URL=https://xxx.supabase.co" > .env.local
echo "VITE_SUPABASE_ANON_KEY=eyJhbGci..." >> .env.local

# تثبيت المكتبات
npm install

# تشغيل المشروع
npm run dev
```

---

## ⚡ ملاحظات مهمة

- **بدون Supabase**: المتجر يعمل بالمنتجات المحلية الافتراضية
- **مع Supabase**: المنتجات تُجلب من قاعدة البيانات ديناميكياً
- **لوحة التحكم**: محمية بتسجيل الدخول (Supabase Auth)
- **الصور**: تُرفع إلى Supabase Storage وتُحفظ الروابط في قاعدة البيانات
- **الأمان**: مفاتيح API العامة فقط تُستخدم في الواجهة الأمامية
