-- ╔══════════════════════════════════════════════════════════════╗
-- ║  المعراج — Supabase Complete Setup (v5 FINAL)               ║
-- ║  Safe to run multiple times. No DO $$ blocks.               ║
-- ║  Compatible with: App.tsx, api/products.js, api/orders.js,  ║
-- ║  api/admin/landing-pages.js, api/landing-page/[slug].js     ║
-- ╚══════════════════════════════════════════════════════════════╝

-- ═══════════════════════════════════════════════════════════════
-- 1. PRODUCTS TABLE
-- ═══════════════════════════════════════════════════════════════
-- Frontend uses: id (number), name, description, price, category,
--                images (string[]), stock, sales, benefits (string[]),
--                badge (string|undefined)
-- New products use: id = Date.now() → BIGINT
-- Seed data uses:   id = 1, 2, 3... → BIGINT
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS products (
  id              BIGINT       PRIMARY KEY,
  name            TEXT         NOT NULL DEFAULT '',
  description     TEXT         NOT NULL DEFAULT '',
  price           INTEGER      NOT NULL DEFAULT 0,
  category        TEXT         NOT NULL DEFAULT 'تحضيري',
  images          TEXT[]       NOT NULL DEFAULT '{}',
  stock           INTEGER      NOT NULL DEFAULT 0,
  sales           INTEGER      NOT NULL DEFAULT 0,
  benefits        TEXT[]       NOT NULL DEFAULT '{}',
  badge           TEXT         DEFAULT NULL,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Add columns that might be missing (safe for existing tables)
ALTER TABLE products ADD COLUMN IF NOT EXISTS name        TEXT NOT NULL DEFAULT '';
ALTER TABLE products ADD COLUMN IF NOT EXISTS description TEXT NOT NULL DEFAULT '';
ALTER TABLE products ADD COLUMN IF NOT EXISTS price       INTEGER NOT NULL DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS category    TEXT NOT NULL DEFAULT 'تحضيري';
ALTER TABLE products ADD COLUMN IF NOT EXISTS images      TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE products ADD COLUMN IF NOT EXISTS stock       INTEGER NOT NULL DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS sales       INTEGER NOT NULL DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS benefits    TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE products ADD COLUMN IF NOT EXISTS badge       TEXT DEFAULT NULL;
ALTER TABLE products ADD COLUMN IF NOT EXISTS created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE products ADD COLUMN IF NOT EXISTS updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Fix any existing NULL values that would crash the frontend
UPDATE products SET name        = ''   WHERE name        IS NULL;
UPDATE products SET description = ''   WHERE description IS NULL;
UPDATE products SET price       = 0    WHERE price       IS NULL;
UPDATE products SET category    = 'تحضيري' WHERE category IS NULL;
UPDATE products SET images      = '{}'  WHERE images     IS NULL;
UPDATE products SET stock       = 0    WHERE stock       IS NULL;
UPDATE products SET sales       = 0    WHERE sales       IS NULL;
UPDATE products SET benefits    = '{}'  WHERE benefits   IS NULL;

-- Set defaults on existing columns (safe to re-run)
ALTER TABLE products ALTER COLUMN name        SET DEFAULT '';
ALTER TABLE products ALTER COLUMN description SET DEFAULT '';
ALTER TABLE products ALTER COLUMN price       SET DEFAULT 0;
ALTER TABLE products ALTER COLUMN category    SET DEFAULT 'تحضيري';
ALTER TABLE products ALTER COLUMN images      SET DEFAULT '{}';
ALTER TABLE products ALTER COLUMN stock       SET DEFAULT 0;
ALTER TABLE products ALTER COLUMN sales       SET DEFAULT 0;
ALTER TABLE products ALTER COLUMN benefits    SET DEFAULT '{}';

-- Indexes
CREATE INDEX IF NOT EXISTS idx_products_category   ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_created_at ON products(created_at);


-- ═══════════════════════════════════════════════════════════════
-- 2. ORDERS TABLE
-- ═══════════════════════════════════════════════════════════════
-- Frontend uses: id = 'ORD-1719000000' → TEXT
-- Fields: tracking, customer, phone, wilaya, address,
--         items (CartItem[] → JSONB), total, shipping,
--         deliveryType → delivery_type, selectedOffice → selected_office,
--         status, date, noestId → noest_id
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS orders (
  id              TEXT         PRIMARY KEY,
  tracking        TEXT         NOT NULL DEFAULT '',
  customer        TEXT         NOT NULL DEFAULT '',
  phone           TEXT         NOT NULL DEFAULT '',
  wilaya          TEXT         NOT NULL DEFAULT '',
  address         TEXT         NOT NULL DEFAULT '',
  items           JSONB        NOT NULL DEFAULT '[]'::jsonb,
  total           INTEGER      NOT NULL DEFAULT 0,
  shipping        INTEGER      NOT NULL DEFAULT 0,
  delivery_type   TEXT         NOT NULL DEFAULT 'home',
  selected_office TEXT         DEFAULT NULL,
  status          TEXT         NOT NULL DEFAULT 'pending',
  date            TEXT         NOT NULL DEFAULT '',
  noest_id        TEXT         DEFAULT NULL,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Add columns that might be missing
ALTER TABLE orders ADD COLUMN IF NOT EXISTS tracking        TEXT NOT NULL DEFAULT '';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer        TEXT NOT NULL DEFAULT '';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS phone           TEXT NOT NULL DEFAULT '';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS wilaya          TEXT NOT NULL DEFAULT '';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS address         TEXT NOT NULL DEFAULT '';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS items           JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS total           INTEGER NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping        INTEGER NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_type   TEXT NOT NULL DEFAULT 'home';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS selected_office TEXT DEFAULT NULL;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS status          TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS date            TEXT NOT NULL DEFAULT '';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS noest_id        TEXT DEFAULT NULL;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE orders ADD COLUMN IF NOT EXISTS updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Fix NULL values
UPDATE orders SET tracking      = '' WHERE tracking      IS NULL;
UPDATE orders SET customer      = '' WHERE customer      IS NULL;
UPDATE orders SET phone         = '' WHERE phone         IS NULL;
UPDATE orders SET wilaya        = '' WHERE wilaya        IS NULL;
UPDATE orders SET address       = '' WHERE address       IS NULL;
UPDATE orders SET items         = '[]'::jsonb WHERE items IS NULL;
UPDATE orders SET total         = 0  WHERE total         IS NULL;
UPDATE orders SET shipping      = 0  WHERE shipping      IS NULL;
UPDATE orders SET delivery_type = 'home' WHERE delivery_type IS NULL;
UPDATE orders SET status        = 'pending' WHERE status IS NULL;
UPDATE orders SET date          = '' WHERE date          IS NULL;

-- Set defaults
ALTER TABLE orders ALTER COLUMN tracking      SET DEFAULT '';
ALTER TABLE orders ALTER COLUMN customer      SET DEFAULT '';
ALTER TABLE orders ALTER COLUMN phone         SET DEFAULT '';
ALTER TABLE orders ALTER COLUMN wilaya        SET DEFAULT '';
ALTER TABLE orders ALTER COLUMN address       SET DEFAULT '';
ALTER TABLE orders ALTER COLUMN items         SET DEFAULT '[]'::jsonb;
ALTER TABLE orders ALTER COLUMN total         SET DEFAULT 0;
ALTER TABLE orders ALTER COLUMN shipping      SET DEFAULT 0;
ALTER TABLE orders ALTER COLUMN delivery_type SET DEFAULT 'home';
ALTER TABLE orders ALTER COLUMN status        SET DEFAULT 'pending';
ALTER TABLE orders ALTER COLUMN date          SET DEFAULT '';

-- Indexes
CREATE INDEX IF NOT EXISTS idx_orders_status     ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_tracking   ON orders(tracking);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);
CREATE INDEX IF NOT EXISTS idx_orders_noest_id   ON orders(noest_id);


-- ═══════════════════════════════════════════════════════════════
-- 3. LANDING PAGES TABLE
-- ═══════════════════════════════════════════════════════════════
-- Frontend uses: id (UUID auto), slug (unique), product_id (BIGINT → FK),
--                title, headline, description, image_url, cta_text,
--                cta_url, is_active (bool)
-- product_id type MUST match products.id → BIGINT
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS landing_pages (
  id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  title           TEXT         NOT NULL DEFAULT '',
  slug            TEXT         NOT NULL DEFAULT '',
  product_id      BIGINT       DEFAULT NULL,
  headline        TEXT         DEFAULT NULL,
  description     TEXT         DEFAULT NULL,
  image_url       TEXT         DEFAULT NULL,
  cta_text        TEXT         NOT NULL DEFAULT 'اشتري الآن',
  cta_url         TEXT         DEFAULT NULL,
  is_active       BOOLEAN      NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Add columns that might be missing
ALTER TABLE landing_pages ADD COLUMN IF NOT EXISTS title       TEXT NOT NULL DEFAULT '';
ALTER TABLE landing_pages ADD COLUMN IF NOT EXISTS slug        TEXT NOT NULL DEFAULT '';
ALTER TABLE landing_pages ADD COLUMN IF NOT EXISTS product_id  BIGINT DEFAULT NULL;
ALTER TABLE landing_pages ADD COLUMN IF NOT EXISTS headline    TEXT DEFAULT NULL;
ALTER TABLE landing_pages ADD COLUMN IF NOT EXISTS description TEXT DEFAULT NULL;
ALTER TABLE landing_pages ADD COLUMN IF NOT EXISTS image_url   TEXT DEFAULT NULL;
ALTER TABLE landing_pages ADD COLUMN IF NOT EXISTS cta_text    TEXT NOT NULL DEFAULT 'اشتري الآن';
ALTER TABLE landing_pages ADD COLUMN IF NOT EXISTS cta_url     TEXT DEFAULT NULL;
ALTER TABLE landing_pages ADD COLUMN IF NOT EXISTS is_active   BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE landing_pages ADD COLUMN IF NOT EXISTS created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE landing_pages ADD COLUMN IF NOT EXISTS updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Unique constraint on slug
CREATE UNIQUE INDEX IF NOT EXISTS idx_landing_pages_slug
  ON landing_pages(slug);

-- Other indexes
CREATE INDEX IF NOT EXISTS idx_landing_pages_product_id ON landing_pages(product_id);
CREATE INDEX IF NOT EXISTS idx_landing_pages_is_active  ON landing_pages(is_active);

-- Foreign key: product_id → products.id (both BIGINT)
-- Drop old FK if it exists (might have wrong type from earlier attempt)
ALTER TABLE landing_pages DROP CONSTRAINT IF EXISTS landing_pages_product_id_fkey;

-- Add FK (both are BIGINT → compatible)
ALTER TABLE landing_pages
  ADD CONSTRAINT landing_pages_product_id_fkey
  FOREIGN KEY (product_id)
  REFERENCES products(id)
  ON DELETE SET NULL;


-- ═══════════════════════════════════════════════════════════════
-- 4. AUTO-UPDATE TRIGGER (updated_at)
-- ═══════════════════════════════════════════════════════════════
-- Uses $fn$ delimiter (not $$) to avoid Supabase Dashboard breakage

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $fn$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$fn$ LANGUAGE plpgsql;

-- Products trigger
DROP TRIGGER IF EXISTS trg_products_updated_at ON products;
CREATE TRIGGER trg_products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Orders trigger
DROP TRIGGER IF EXISTS trg_orders_updated_at ON orders;
CREATE TRIGGER trg_orders_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Landing pages trigger
DROP TRIGGER IF EXISTS trg_landing_pages_updated_at ON landing_pages;
CREATE TRIGGER trg_landing_pages_updated_at
  BEFORE UPDATE ON landing_pages
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- ═══════════════════════════════════════════════════════════════
-- 5. ROW LEVEL SECURITY (RLS)
-- ═══════════════════════════════════════════════════════════════
-- Strategy:
--   products:      PUBLIC read (anon SELECT) — write via SERVICE_ROLE only
--   orders:        NO public access — all via SERVICE_ROLE
--   landing_pages: PUBLIC read active pages (anon SELECT WHERE is_active)
--                  — write via SERVICE_ROLE only
-- ═══════════════════════════════════════════════════════════════

-- Enable RLS on all tables
ALTER TABLE products      ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders        ENABLE ROW LEVEL SECURITY;
ALTER TABLE landing_pages ENABLE ROW LEVEL SECURITY;

-- ── Products policies ─────────────────────────────────────────
DROP POLICY IF EXISTS "Public read products"        ON products;
DROP POLICY IF EXISTS "Service role full products"  ON products;

-- Anyone can read products (store visitors)
CREATE POLICY "Public read products"
  ON products
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- service_role bypasses RLS automatically (no policy needed for writes)

-- ── Orders policies ───────────────────────────────────────────
DROP POLICY IF EXISTS "Service role full orders" ON orders;

-- No anon policies. All access via SERVICE_ROLE (api/orders.js)
-- service_role bypasses RLS automatically

-- ── Landing pages policies ────────────────────────────────────
DROP POLICY IF EXISTS "Public read active landing pages" ON landing_pages;
DROP POLICY IF EXISTS "Service role full landing pages"  ON landing_pages;

-- Anyone can read ACTIVE landing pages (for /l/:slug public route)
CREATE POLICY "Public read active landing pages"
  ON landing_pages
  FOR SELECT
  TO anon, authenticated
  USING (is_active = true);

-- service_role bypasses RLS automatically (admin creates/updates/deletes)


-- ═══════════════════════════════════════════════════════════════
-- 6. SEED DATA (only if products table is empty)
-- ═══════════════════════════════════════════════════════════════

INSERT INTO products (id, name, description, price, category, images, stock, sales, benefits, badge)
SELECT * FROM (VALUES
  (1::bigint,
   'بطاقات الأبجدية الإنجليزية'::text,
   'أداة مساعدة للأستاذ في تعليم الحروف الإنجليزية بطريقة تفاعلية وممتعة، تجعل التلاميذ أكثر انخراطاً في الدرس'::text,
   1200::int,
   'تحضيري'::text,
   ARRAY['https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=400']::text[],
   50::int, 120::int,
   ARRAY['تساعد الأستاذ في توضيح الحروف بصرياً','تجعل التلاميذ أكثر تفاعلاً','مناسبة للاستخدام الفردي والجماعي']::text[],
   'الأكثر مبيعاً'::text),

  (2::bigint,
   'بطاقات الأرقام والحساب',
   'تساعد الأستاذ في تعليم الأرقام والعمليات الحسابية الأساسية بطريقة بصرية وتفاعلية',
   1100, 'تحضيري',
   ARRAY['https://images.unsplash.com/photo-1518133910546-b6c2fb7d79e3?w=400'],
   45, 95,
   ARRAY['تبسيط مفاهيم الأرقام للتلاميذ','أداة فعالة للتدريب على الحساب','تناسب النشاطات الجماعية'],
   'جديد'),

  (3::bigint,
   'بطاقات الألوان والأشكال',
   'مجموعة بطاقات ملونة تساعد الأستاذ في تعليم الألوان والأشكال الهندسية بأسلوب ممتع',
   950, 'تحضيري',
   ARRAY['https://images.unsplash.com/photo-1513542789411-b6a5d4f31634?w=400'],
   60, 80,
   ARRAY['تنمية الإدراك البصري لدى التلاميذ','تفعيل مشاركة التلاميذ في الدرس','سهلة الاستخدام في الفصل'],
   NULL),

  (4::bigint,
   'بطاقات الفرنسية للمبتدئين',
   'أداة مساعدة لأستاذ الطور التحضيري في تقديم اللغة الفرنسية بطريقة بسيطة وجذابة',
   1300, 'تحضيري',
   ARRAY['https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?w=400'],
   35, 70,
   ARRAY['تقديم اللغة الفرنسية بأسلوب بسيط','تحفيز التلاميذ على التعلم','مناسبة لمستوى التحضيري'],
   NULL),

  (5::bigint,
   'بطاقات المفردات الإنجليزية',
   'تساعد الأستاذ في إثراء حصة اللغة الإنجليزية وتجعل التلاميذ يتعلمون مفردات جديدة بسهولة',
   1400, 'ابتدائي',
   ARRAY['https://images.unsplash.com/photo-1546521343-4eb2c01aa44b?w=400'],
   40, 110,
   ARRAY['إثراء الرصيد اللغوي للتلاميذ','تحسين مهارات القراءة والكتابة','تفعيل الحصة بأنشطة تفاعلية'],
   'الأكثر مبيعاً'),

  (6::bigint,
   'بطاقات قواعد اللغة الإنجليزية',
   'أداة مرجعية للأستاذ تساعد التلاميذ على فهم قواعد اللغة الإنجليزية بصرياً',
   1500, 'ابتدائي',
   ARRAY['https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=400'],
   30, 85,
   ARRAY['تبسيط قواعد اللغة للتلاميذ','مرجع سريع أثناء الحصة','تحسين مستوى الكتابة'],
   NULL),

  (7::bigint,
   'بطاقات الأفعال الفرنسية',
   'تساعد الأستاذ في تدريس الأفعال الفرنسية وتصريفها بطريقة منظمة وسهلة الفهم',
   1350, 'ابتدائي',
   ARRAY['https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?w=400'],
   25, 75,
   ARRAY['تنظيم تدريس الأفعال الفرنسية','تسهيل حفظ التصريفات','مناسبة للتدريب الصفي'],
   NULL),

  (8::bigint,
   'بطاقات الشعر والأناشيد الفرنسية',
   'مجموعة بطاقات تحتوي على أناشيد وقصائد فرنسية تجعل حصة الفرنسية أكثر حيوية',
   1100, 'ابتدائي',
   ARRAY['https://images.unsplash.com/photo-1513542789411-b6a5d4f31634?w=400'],
   55, 60,
   ARRAY['تنشيط الحصة بالأناشيد','تحسين النطق لدى التلاميذ','تحفيز الحفظ والإلقاء'],
   NULL),

  (9::bigint,
   'بطاقات الرياضيات المتقدمة',
   'أدوات بصرية تساعد الأستاذ في شرح مفاهيم الرياضيات المتقدمة بطريقة مبسطة',
   1600, 'ابتدائي',
   ARRAY['https://images.unsplash.com/photo-1518133910546-b6c2fb7d79e3?w=400'],
   20, 90,
   ARRAY['تبسيط المفاهيم الرياضية المعقدة','تفعيل مشاركة التلاميذ','ربط النظرية بالتطبيق'],
   'جديد'),

  (10::bigint,
   'بطاقات العلوم الطبيعية',
   'بطاقات علمية تساعد الأستاذ في تقديم دروس العلوم بمحتوى بصري غني ومعلومات دقيقة',
   1800, 'متوسط',
   ARRAY['https://images.unsplash.com/photo-1532094349884-543bc11b234d?w=400'],
   15, 65,
   ARRAY['تقديم المفاهيم العلمية بصرياً','ربط الدرس بالواقع','تحفيز الفضول العلمي'],
   'الأكثر مبيعاً'),

  (11::bigint,
   'بطاقات المحادثة الإنجليزية',
   'أداة تفاعلية تساعد الأستاذ في تطوير مهارات المحادثة والتعبير الشفهي لدى التلاميذ',
   1700, 'متوسط',
   ARRAY['https://images.unsplash.com/photo-1546521343-4eb2c01aa44b?w=400'],
   22, 55,
   ARRAY['تطوير مهارة التحدث بالإنجليزية','تشجيع التلاميذ على المشاركة','سيناريوهات حوارية متنوعة'],
   NULL),

  (12::bigint,
   'بطاقات الأدب الفرنسي',
   'مقتطفات أدبية فرنسية منتقاة تساعد الأستاذ في تقديم النصوص الأدبية بأسلوب شيق',
   1900, 'متوسط',
   ARRAY['https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?w=400'],
   18, 45,
   ARRAY['تقديم التراث الأدبي الفرنسي','تحسين مهارات التحليل النصي','توسيع آفاق التلاميذ الثقافية'],
   NULL),

  (13::bigint,
   'بطاقات قواعد الفرنسية المتقدمة',
   'مرجع شامل يساعد الأستاذ في تدريس قواعد اللغة الفرنسية المتقدمة بطريقة منهجية',
   2000, 'متوسط',
   ARRAY['https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=400'],
   12, 40,
   ARRAY['تغطية شاملة لقواعد الفرنسية','تدريبات تطبيقية متنوعة','مرجع سريع للأستاذ والتلميذ'],
   'جديد')
) AS seed(id, name, description, price, category, images, stock, sales, benefits, badge)
WHERE NOT EXISTS (SELECT 1 FROM products LIMIT 1);


-- ═══════════════════════════════════════════════════════════════
-- 7. VERIFICATION
-- ═══════════════════════════════════════════════════════════════

SELECT '✅ Setup complete!' AS status;

SELECT
  'products' AS table_name,
  (SELECT COUNT(*) FROM products) AS row_count
UNION ALL
SELECT
  'orders',
  (SELECT COUNT(*) FROM orders)
UNION ALL
SELECT
  'landing_pages',
  (SELECT COUNT(*) FROM landing_pages);
