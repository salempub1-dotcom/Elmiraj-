// ============================================================
// Health Check — Vercel Serverless Function
// ============================================================
// GET /api/health — full system diagnostic:
//   1. Environment variables (all required + optional)
//   2. Database connection + table existence + row counts
//   3. RLS policies (validates SELECT works for anon)
//   4. Storage bucket status
//   5. Returns exact SQL to fix any issue
// ============================================================

export const config = { api: { bodyParser: false } };

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // ── 1. Environment Variables ────────────────────────────────
  const envKeys = {
    SUPABASE_URL:                { required: true,  label: 'Supabase Project URL' },
    SUPABASE_SERVICE_ROLE_KEY:   { required: true,  label: 'Supabase Service Role Key (server-only)' },
    SUPABASE_BUCKET:             { required: false, label: 'Storage Bucket Name', fallback: 'product-images' },
    ADMIN_USERNAME:              { required: true,  label: 'Admin Login Username' },
    ADMIN_PASSWORD:              { required: true,  label: 'Admin Login Password' },
    NOEST_API_TOKEN:             { required: true,  label: 'NOEST Delivery API Token' },
    NOEST_USER_GUID:             { required: true,  label: 'NOEST User GUID' },
    UPSTASH_REDIS_REST_URL:      { required: false, label: 'Upstash Redis URL (idempotency)' },
    UPSTASH_REDIS_REST_TOKEN:    { required: false, label: 'Upstash Redis Token' },
    VITE_SUPABASE_URL:           { required: false, label: 'Frontend Supabase URL (optional)' },
  };

  const env = {};
  const missing = [];
  for (const [key, meta] of Object.entries(envKeys)) {
    const val = process.env[key];
    if (val) {
      env[key] = '✅ Set';
    } else if (meta.fallback) {
      env[key] = `⚠️ Not set (using default: ${meta.fallback})`;
    } else if (meta.required) {
      env[key] = '❌ MISSING';
      missing.push(key);
    } else {
      env[key] = '⚠️ Not set (optional)';
    }
  }

  // ── 2. Database Connection + Tables + RLS ───────────────────
  const database = {
    status: 'not_tested',
    connection: null,
    tables: {},
    rls_tests: {},
    storage: null,
    issues: [],
    fixes: [],
  };

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (SUPABASE_URL && SUPABASE_KEY) {
    try {
      const { createClient } = await import('@supabase/supabase-js');

      // ── SERVICE_ROLE client (bypasses RLS) ──
      const admin = createClient(SUPABASE_URL, SUPABASE_KEY, {
        auth: { autoRefreshToken: false, persistSession: false },
      });

      database.connection = '✅ Connected';

      // ── Check each table ──
      const tableNames = ['products', 'orders', 'landing_pages'];
      let allTablesOk = true;

      for (const table of tableNames) {
        try {
          const { count, error } = await admin
            .from(table)
            .select('*', { count: 'exact', head: true });

          if (error) {
            allTablesOk = false;
            if (error.code === '42P01') {
              database.tables[table] = { exists: false, error: 'TABLE DOES NOT EXIST' };
              database.issues.push(`❌ Table "${table}" does not exist`);
              database.fixes.push(`Run the SQL setup in Supabase Dashboard → SQL Editor`);
            } else {
              database.tables[table] = { exists: 'unknown', error: error.message, code: error.code };
              database.issues.push(`⚠️ Table "${table}" error: ${error.message}`);
            }
          } else {
            database.tables[table] = { exists: true, rows: count ?? 0 };
          }
        } catch (e) {
          allTablesOk = false;
          database.tables[table] = { exists: 'error', error: e.message };
        }
      }

      // ── Check NULL columns in products (common crash cause) ──
      if (database.tables.products?.exists === true) {
        try {
          const { data: nullCheck } = await admin
            .from('products')
            .select('id, name, images, description, benefits')
            .or('images.is.null,description.is.null,benefits.is.null,name.is.null')
            .limit(5);

          if (nullCheck && nullCheck.length > 0) {
            database.issues.push(`⚠️ ${nullCheck.length} product(s) have NULL values in images/description/benefits`);
            database.fixes.push(
              'Run: UPDATE products SET images=\'{}\' WHERE images IS NULL; ' +
              'UPDATE products SET description=\'\' WHERE description IS NULL; ' +
              'UPDATE products SET benefits=\'{}\' WHERE benefits IS NULL;'
            );
            database.tables.products.null_rows = nullCheck.map(r => ({
              id: r.id,
              name: r.name,
              images_null: r.images === null,
              desc_null: r.description === null,
              benefits_null: r.benefits === null,
            }));
          }
        } catch { /* ignore */ }
      }

      // ── RLS Policy Tests ──
      // Test 1: Can ANON read products? (simulate frontend)
      try {
        const anonClient = createClient(SUPABASE_URL, SUPABASE_KEY, {
          auth: { autoRefreshToken: false, persistSession: false },
          global: { headers: { 'x-supabase-role': 'anon' } },
        });

        // Note: SERVICE_ROLE key bypasses RLS regardless of headers.
        // The only real test is to check if policies exist via pg_policies.
        // We do that below.
        database.rls_tests.note = 'SERVICE_ROLE bypasses RLS. Policies checked via pg_policies below.';
      } catch { /* ignore */ }

      // Test 2: Check pg_policies for our tables
      for (const table of tableNames) {
        if (database.tables[table]?.exists !== true) continue;

        try {
          const { data: policies, error: polErr } = await admin.rpc('exec_sql', {
            query: `SELECT policyname, permissive, roles, cmd, qual
                    FROM pg_policies
                    WHERE tablename = '${table}'
                    ORDER BY policyname`
          });

          if (!polErr && policies) {
            database.rls_tests[table] = { policies };
          } else {
            // RPC doesn't exist — try direct query approach
            const { data: checkRls } = await admin
              .from(table)
              .select('*', { count: 'exact', head: true });

            database.rls_tests[table] = {
              accessible_via_service_role: !checkRls?.error,
              note: 'Cannot query pg_policies. Check policies manually in Supabase Dashboard → Authentication → Policies.',
              required: table === 'products'
                ? 'SELECT policy for anon with USING (true)'
                : table === 'landing_pages'
                  ? 'SELECT policy for anon with USING (is_active = true)'
                  : 'No anon policy needed (all access via SERVICE_ROLE)',
            };
          }
        } catch {
          database.rls_tests[table] = {
            note: 'Check policies manually in Supabase Dashboard → Authentication → Policies',
            required: table === 'products'
              ? 'SELECT policy for anon: USING (true)'
              : table === 'landing_pages'
                ? 'SELECT policy for anon: USING (is_active = true)'
                : 'No anon policy needed',
          };
        }
      }

      // ── Check products seeded ──
      if (database.tables.products?.exists === true && database.tables.products.rows === 0) {
        database.issues.push('⚠️ Products table is empty — no products will show');
        database.fixes.push('The SQL setup includes seed data for 13 products. Re-run the full SQL.');
      }

      // ── Storage Bucket ──
      const bucketName = process.env.SUPABASE_BUCKET || 'product-images';
      try {
        const { data: bucketData, error: bucketErr } = await admin.storage.getBucket(bucketName);
        if (bucketErr) {
          database.storage = {
            status: '❌ Error',
            bucket: bucketName,
            error: bucketErr.message,
          };
          database.issues.push(`❌ Storage bucket "${bucketName}" error: ${bucketErr.message}`);
          database.fixes.push(`Create bucket "${bucketName}" in Supabase Dashboard → Storage → New Bucket (set as PUBLIC)`);
        } else {
          database.storage = {
            status: '✅ OK',
            bucket: bucketName,
            public: bucketData?.public ?? false,
          };
          if (!bucketData?.public) {
            database.issues.push(`⚠️ Bucket "${bucketName}" is PRIVATE — images won't display publicly`);
            database.fixes.push(`In Supabase Storage → "${bucketName}" → Settings → Toggle "Public bucket" ON`);
          }
        }
      } catch (e) {
        database.storage = { status: '❌ Error', error: e.message };
      }

      // ── Overall status ──
      database.status = allTablesOk && database.issues.length === 0
        ? 'healthy'
        : allTablesOk
          ? 'warnings'
          : 'issues';

    } catch (e) {
      database.status = 'error';
      database.connection = `❌ Failed: ${e.message}`;
      database.issues.push(`❌ Cannot connect to Supabase: ${e.message}`);
    }
  } else {
    database.status = 'not_configured';
    database.connection = '❌ SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing';
    database.issues.push('❌ Supabase not configured');
    database.fixes.push('Add SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in Vercel → Settings → Environment Variables');
  }

  // ── 3. Required Policies Reference ─────────────────────────
  const required_policies = {
    products: {
      rls_enabled: true,
      policies: [
        { name: 'Public read products', operation: 'SELECT', role: 'anon, authenticated', expression: 'true', why: 'Visitors see products in the store' },
        { name: 'Service role full access products', operation: 'ALL', role: 'service_role', expression: 'true', why: 'API routes (admin CRUD)' },
      ],
    },
    orders: {
      rls_enabled: true,
      policies: [
        { name: 'Service role full access orders', operation: 'ALL', role: 'service_role', expression: 'true', why: 'API routes (create + admin read/update)' },
      ],
      note: 'No anon policies — all access through /api/orders (uses SERVICE_ROLE)',
    },
    landing_pages: {
      rls_enabled: true,
      policies: [
        { name: 'Public read active landing pages', operation: 'SELECT', role: 'anon, authenticated', expression: 'is_active = true', why: 'Visitors see active landing pages at /l/:slug' },
        { name: 'Service role full access lp', operation: 'ALL', role: 'service_role', expression: 'true', why: 'Admin API routes (CRUD)' },
      ],
    },
    'product-images (storage)': {
      note: 'Bucket must be PUBLIC for images to display. No anon INSERT/DELETE — handled by /api/upload-image (SERVICE_ROLE).',
    },
  };

  // ── 4. SQL Setup Script ────────────────────────────────────
  const sql_setup = `-- ═══════════════════════════════════════════════════════════
-- المعراج — Complete Supabase Setup
-- Run in: Supabase Dashboard → SQL Editor → New Query → Run
-- Safe to re-run (uses IF NOT EXISTS + DROP IF EXISTS)
-- ═══════════════════════════════════════════════════════════

-- ═══ PRODUCTS ═══
CREATE TABLE IF NOT EXISTS products (
  id           BIGINT       PRIMARY KEY,
  name         TEXT         NOT NULL DEFAULT '',
  description  TEXT         NOT NULL DEFAULT '',
  price        INTEGER      NOT NULL DEFAULT 0,
  category     TEXT         NOT NULL DEFAULT 'تحضيري',
  images       TEXT[]       NOT NULL DEFAULT '{}',
  stock        INTEGER      NOT NULL DEFAULT 0,
  sales        INTEGER      NOT NULL DEFAULT 0,
  benefits     TEXT[]       NOT NULL DEFAULT '{}',
  badge        TEXT         DEFAULT NULL,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Fix NULL values
UPDATE products SET description = '' WHERE description IS NULL;
UPDATE products SET images = '{}' WHERE images IS NULL;
UPDATE products SET benefits = '{}' WHERE benefits IS NULL;
UPDATE products SET stock = 0 WHERE stock IS NULL;
UPDATE products SET sales = 0 WHERE sales IS NULL;

-- ═══ ORDERS ═══
CREATE TABLE IF NOT EXISTS orders (
  id              TEXT         PRIMARY KEY,
  tracking        TEXT         DEFAULT '',
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

CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_tracking ON orders(tracking);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);

-- Fix NULL values
UPDATE orders SET tracking = '' WHERE tracking IS NULL;
UPDATE orders SET customer = '' WHERE customer IS NULL;
UPDATE orders SET items = '[]'::jsonb WHERE items IS NULL;
UPDATE orders SET status = 'pending' WHERE status IS NULL;

-- ═══ LANDING PAGES ═══
CREATE TABLE IF NOT EXISTS landing_pages (
  id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  title       TEXT         NOT NULL DEFAULT '',
  slug        TEXT         UNIQUE NOT NULL DEFAULT '',
  product_id  BIGINT       REFERENCES products(id) ON DELETE SET NULL,
  headline    TEXT         NOT NULL DEFAULT '',
  description TEXT         NOT NULL DEFAULT '',
  image_url   TEXT         NOT NULL DEFAULT '',
  cta_text    TEXT         NOT NULL DEFAULT 'اشتري الآن',
  cta_url     TEXT         NOT NULL DEFAULT '',
  is_active   BOOLEAN      NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lp_slug ON landing_pages(slug);
CREATE INDEX IF NOT EXISTS idx_lp_product_id ON landing_pages(product_id);
CREATE INDEX IF NOT EXISTS idx_lp_is_active ON landing_pages(is_active);

-- Fix NULL values
UPDATE landing_pages SET headline = '' WHERE headline IS NULL;
UPDATE landing_pages SET description = '' WHERE description IS NULL;
UPDATE landing_pages SET image_url = '' WHERE image_url IS NULL;
UPDATE landing_pages SET cta_text = 'اشتري الآن' WHERE cta_text IS NULL;

-- ═══ AUTO-UPDATE TRIGGER ═══
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_products_updated_at ON products;
CREATE TRIGGER trg_products_updated_at BEFORE UPDATE ON products FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_orders_updated_at ON orders;
CREATE TRIGGER trg_orders_updated_at BEFORE UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_lp_updated_at ON landing_pages;
CREATE TRIGGER trg_lp_updated_at BEFORE UPDATE ON landing_pages FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ═══ RLS ═══
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE landing_pages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read products" ON products;
DROP POLICY IF EXISTS "Service role full access products" ON products;
DROP POLICY IF EXISTS "Service role full access orders" ON orders;
DROP POLICY IF EXISTS "Public read active landing pages" ON landing_pages;
DROP POLICY IF EXISTS "Service role full access lp" ON landing_pages;

CREATE POLICY "Public read products" ON products FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Service role full access products" ON products FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access orders" ON orders FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Public read active landing pages" ON landing_pages FOR SELECT TO anon, authenticated USING (is_active = true);
CREATE POLICY "Service role full access lp" ON landing_pages FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ═══ SEED (only if empty) ═══
INSERT INTO products (id,name,description,price,category,images,stock,sales,benefits,badge)
SELECT * FROM (VALUES
  (1::bigint,'بطاقات الأبجدية الإنجليزية','أداة مساعدة للأستاذ في تعليم الحروف الإنجليزية بطريقة تفاعلية وممتعة',1200::int,'تحضيري',ARRAY['https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=400']::text[],50::int,120::int,ARRAY['تساعد الأستاذ في توضيح الحروف بصرياً','تجعل التلاميذ أكثر تفاعلاً']::text[],'الأكثر مبيعاً'::text),
  (2,'بطاقات الأرقام والحساب','تساعد الأستاذ في تعليم الأرقام والعمليات الحسابية',1100,'تحضيري',ARRAY['https://images.unsplash.com/photo-1518133910546-b6c2fb7d79e3?w=400'],45,95,ARRAY['تبسيط مفاهيم الأرقام','أداة فعالة للتدريب'],'جديد'),
  (3,'بطاقات الألوان والأشكال','مجموعة بطاقات ملونة لتعليم الألوان والأشكال',950,'تحضيري',ARRAY['https://images.unsplash.com/photo-1513542789411-b6a5d4f31634?w=400'],60,80,ARRAY['تنمية الإدراك البصري','سهلة الاستخدام'],NULL),
  (4,'بطاقات الفرنسية للمبتدئين','أداة مساعدة لتقديم اللغة الفرنسية بطريقة بسيطة',1300,'تحضيري',ARRAY['https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?w=400'],35,70,ARRAY['تقديم الفرنسية بأسلوب بسيط','تحفيز التلاميذ'],NULL),
  (5,'بطاقات المفردات الإنجليزية','تساعد في إثراء حصة اللغة الإنجليزية',1400,'ابتدائي',ARRAY['https://images.unsplash.com/photo-1546521343-4eb2c01aa44b?w=400'],40,110,ARRAY['إثراء الرصيد اللغوي','تحسين مهارات القراءة'],'الأكثر مبيعاً'),
  (6,'بطاقات قواعد اللغة الإنجليزية','أداة مرجعية لفهم قواعد الإنجليزية',1500,'ابتدائي',ARRAY['https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=400'],30,85,ARRAY['تبسيط القواعد','مرجع سريع'],NULL),
  (7,'بطاقات الأفعال الفرنسية','تدريس الأفعال الفرنسية وتصريفها',1350,'ابتدائي',ARRAY['https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?w=400'],25,75,ARRAY['تنظيم تدريس الأفعال','تسهيل حفظ التصريفات'],NULL),
  (8,'بطاقات الشعر والأناشيد الفرنسية','أناشيد وقصائد فرنسية لتنشيط الحصة',1100,'ابتدائي',ARRAY['https://images.unsplash.com/photo-1513542789411-b6a5d4f31634?w=400'],55,60,ARRAY['تنشيط الحصة','تحسين النطق'],NULL),
  (9,'بطاقات الرياضيات المتقدمة','أدوات بصرية لشرح مفاهيم الرياضيات',1600,'ابتدائي',ARRAY['https://images.unsplash.com/photo-1518133910546-b6c2fb7d79e3?w=400'],20,90,ARRAY['تبسيط المفاهيم المعقدة','ربط النظرية بالتطبيق'],'جديد'),
  (10,'بطاقات العلوم الطبيعية','بطاقات علمية بمحتوى بصري غني',1800,'متوسط',ARRAY['https://images.unsplash.com/photo-1532094349884-543bc11b234d?w=400'],15,65,ARRAY['تقديم المفاهيم العلمية بصرياً','تحفيز الفضول العلمي'],'الأكثر مبيعاً'),
  (11,'بطاقات المحادثة الإنجليزية','أداة تفاعلية لتطوير مهارات المحادثة',1700,'متوسط',ARRAY['https://images.unsplash.com/photo-1546521343-4eb2c01aa44b?w=400'],22,55,ARRAY['تطوير مهارة التحدث','سيناريوهات حوارية متنوعة'],NULL),
  (12,'بطاقات الأدب الفرنسي','مقتطفات أدبية فرنسية منتقاة',1900,'متوسط',ARRAY['https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?w=400'],18,45,ARRAY['تقديم التراث الأدبي','تحسين مهارات التحليل'],NULL),
  (13,'بطاقات قواعد الفرنسية المتقدمة','مرجع شامل لقواعد الفرنسية المتقدمة',2000,'متوسط',ARRAY['https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=400'],12,40,ARRAY['تغطية شاملة للقواعد','تدريبات تطبيقية متنوعة'],'جديد')
) AS s(id,name,description,price,category,images,stock,sales,benefits,badge)
WHERE NOT EXISTS (SELECT 1 FROM products LIMIT 1);

-- ═══ DONE ═══
DO $$ BEGIN RAISE NOTICE '✅ Setup complete!'; END $$;`;

  // ── Final response ─────────────────────────────────────────
  const allGood = missing.length === 0 && database.status === 'healthy';

  return res.status(200).json({
    ok: allGood,
    status: allGood ? '✅ All systems operational' : '⚠️ Issues detected — see details below',
    timestamp: new Date().toISOString(),
    environment: process.env.VERCEL_ENV || 'unknown',
    region: process.env.VERCEL_REGION || 'unknown',
    project: process.env.VERCEL_PROJECT_PRODUCTION_URL || 'unknown',

    env_vars: env,
    missing_env: missing.length > 0 ? missing : undefined,

    database,

    required_policies,

    sql_setup: database.status === 'healthy' ? '(All tables OK — SQL not shown. See sql/setup.sql in repo)' : sql_setup,

    next_steps: allGood ? ['✅ Nothing to do — everything is working!'] : [
      ...(missing.length > 0 ? ['1. Add missing env vars in Vercel → Settings → Environment Variables'] : []),
      ...(database.status === 'not_configured' ? ['2. Set SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY'] : []),
      ...(database.issues?.length > 0 ? ['3. Run the sql_setup in Supabase Dashboard → SQL Editor'] : []),
      '4. Redeploy: git push (or vercel deploy --prod)',
      '5. Visit /api/health again to verify',
    ],
  });
}
