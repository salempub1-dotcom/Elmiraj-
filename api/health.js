// ============================================================
// Health Check — Vercel Serverless Function
// ============================================================
// GET /api/health — returns status of ALL required env vars
//                   + DB connection + RLS policy validation
// ============================================================

export const config = { api: { bodyParser: false } };

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const env = {
    SUPABASE_URL: process.env.SUPABASE_URL ? '✅ Set' : '❌ MISSING',
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ? '✅ Set' : '❌ MISSING',
    SUPABASE_BUCKET: process.env.SUPABASE_BUCKET || 'product-images (default)',
    ADMIN_USERNAME: process.env.ADMIN_USERNAME ? '✅ Set' : '❌ MISSING',
    ADMIN_PASSWORD: process.env.ADMIN_PASSWORD ? '✅ Set' : '❌ MISSING',
    NOEST_API_TOKEN: process.env.NOEST_API_TOKEN ? '✅ Set' : '❌ MISSING',
    NOEST_USER_GUID: process.env.NOEST_USER_GUID ? '✅ Set' : '❌ MISSING',
    UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL ? '✅ Set' : '⚠️ Not set (in-memory fallback)',
    UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN ? '✅ Set' : '⚠️ Not set',
    VITE_SUPABASE_URL: process.env.VITE_SUPABASE_URL ? '✅ Set' : '⚠️ Not set (optional)',
  };

  const required = [
    'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY',
    'ADMIN_USERNAME', 'ADMIN_PASSWORD',
    'NOEST_API_TOKEN', 'NOEST_USER_GUID',
  ];
  const missing = required.filter(k => !process.env[k]);

  // ── Database + RLS + Storage checks ──
  let database = { status: 'not_tested', details: '', tables: {}, rls: {} };

  if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    try {
      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY,
        { auth: { autoRefreshToken: false, persistSession: false } }
      );

      // ── Check tables exist + row counts ──
      const tables = {};
      for (const table of ['products', 'orders', 'landing_pages']) {
        const { count, error } = await supabase
          .from(table)
          .select('id', { count: 'exact', head: true });

        if (error) {
          if (error.code === '42P01') {
            tables[table] = { exists: false, error: 'TABLE DOES NOT EXIST — run SQL setup' };
          } else {
            tables[table] = { exists: 'unknown', error: error.message, code: error.code };
          }
        } else {
          tables[table] = { exists: true, rows: count };
        }
      }

      // ── Check RLS policies ──
      // Use SERVICE_ROLE to query pg_policies (only works with service key)
      const rls = {};
      for (const table of ['products', 'orders', 'landing_pages']) {
        try {
          const { data: policies, error: polErr } = await supabase
            .rpc('get_policies_for_table', { table_name: table })
            .maybeSingle();

          if (polErr) {
            // RPC doesn't exist — try raw query via REST
            // SERVICE_ROLE can read from information_schema
            const { data: rlsEnabled, error: rlsErr } = await supabase
              .from(table)
              .select('id')
              .limit(1);

            if (rlsErr && rlsErr.message?.includes('row-level security')) {
              rls[table] = { rls_enabled: true, accessible: false, note: 'RLS blocks SERVICE_ROLE — this should not happen' };
            } else {
              rls[table] = { rls_enabled: 'check_manually', accessible: !rlsErr, note: 'SERVICE_ROLE bypasses RLS — check policies in Supabase Dashboard' };
            }
          } else {
            rls[table] = { policies };
          }
        } catch {
          rls[table] = { status: 'check_manually', note: 'Query pg_policies manually in Supabase SQL Editor' };
        }
      }

      // ── Check anon access to products (simulates frontend) ──
      let anonProductsCheck = 'not_tested';
      try {
        // Create a separate client with anon key to test public access
        // We can't do this without anon key, but we can verify via the actual API
        anonProductsCheck = 'SERVICE_ROLE bypasses RLS. Ensure SELECT policy exists for anon role on products table.';
      } catch {
        anonProductsCheck = 'error';
      }

      // ── Check storage bucket ──
      let storage = 'not_tested';
      const bucketName = process.env.SUPABASE_BUCKET || 'product-images';
      try {
        const { data: bucketData, error: bucketErr } = await supabase.storage.getBucket(bucketName);
        if (bucketErr) {
          storage = `❌ Bucket "${bucketName}" error: ${bucketErr.message}`;
        } else {
          const isPublic = bucketData?.public;
          storage = `✅ Bucket "${bucketName}" exists (public: ${isPublic ? 'yes' : 'no — set to PUBLIC for image display'})`;

          // Test file listing
          const { error: listErr } = await supabase.storage
            .from(bucketName)
            .list('products', { limit: 1 });
          if (listErr) {
            storage += ` | list: ❌ ${listErr.message}`;
          } else {
            storage += ' | list: ✅';
          }
        }
      } catch (e) {
        storage = `❌ ${e.message}`;
      }

      // Determine overall DB status
      const allTablesOk = Object.values(tables).every(t => t.exists === true);
      database = {
        status: allTablesOk ? 'connected' : 'issues',
        details: allTablesOk
          ? `products: ${tables.products?.rows} rows | orders: ${tables.orders?.rows} rows | landing_pages: ${tables.landing_pages?.rows} rows`
          : 'Some tables missing or errored — see details',
        tables,
        rls,
        storage,
        anon_access_note: anonProductsCheck,
        url: process.env.SUPABASE_URL.replace(/https?:\/\//, '').split('.')[0] + '.supabase.co',
      };
    } catch (e) {
      database = {
        status: 'error',
        details: e.message,
        tables: {},
        rls: {},
      };
    }
  } else {
    database = {
      status: 'not_configured',
      details: 'SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing',
      tables: {},
      rls: {},
    };
  }

  // ── Required RLS policies (for reference) ──
  const requiredPolicies = {
    products: [
      { operation: 'SELECT', role: 'anon', expression: 'true', purpose: 'Public read — customers see products' },
      { operation: 'INSERT/UPDATE/DELETE', role: 'none', purpose: 'Handled by SERVICE_ROLE (API routes) — no anon write policy needed' },
    ],
    orders: [
      { operation: 'SELECT/INSERT/UPDATE/DELETE', role: 'none', purpose: 'All access via SERVICE_ROLE (API routes) — no anon policies needed' },
    ],
    landing_pages: [
      { operation: 'SELECT', role: 'anon', expression: 'is_active = true', purpose: 'Public read — visitors see active landing pages via /lp/:slug' },
      { operation: 'INSERT/UPDATE/DELETE', role: 'none', purpose: 'Admin only via SERVICE_ROLE (/api/admin/landing-pages)' },
    ],
    'product-images (storage)': [
      { operation: 'SELECT', role: 'anon', expression: 'true', purpose: 'Public read — images display on website' },
      { operation: 'INSERT/DELETE', role: 'none', purpose: 'Handled by SERVICE_ROLE via /api/upload-image' },
    ],
  };

  const sqlSetup = `
-- ═══════ Run this in Supabase SQL Editor ═══════

-- Products Table
CREATE TABLE IF NOT EXISTS products (
  id BIGINT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  price INTEGER NOT NULL,
  category TEXT NOT NULL,
  images TEXT[] DEFAULT '{}',
  stock INTEGER DEFAULT 0,
  sales INTEGER DEFAULT 0,
  benefits TEXT[] DEFAULT '{}',
  badge TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Orders Table
CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  tracking TEXT,
  customer TEXT NOT NULL,
  phone TEXT NOT NULL,
  wilaya TEXT,
  address TEXT,
  items JSONB DEFAULT '[]',
  total INTEGER DEFAULT 0,
  shipping INTEGER DEFAULT 0,
  delivery_type TEXT DEFAULT 'home',
  selected_office TEXT,
  status TEXT DEFAULT 'pending',
  date TEXT,
  noest_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Landing Pages Table
CREATE TABLE IF NOT EXISTS landing_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  product_id BIGINT REFERENCES products(id) ON DELETE SET NULL,
  headline TEXT,
  description TEXT,
  image_url TEXT,
  cta_text TEXT DEFAULT 'اشتري الآن',
  cta_url TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for landing_pages
CREATE INDEX IF NOT EXISTS idx_landing_pages_slug ON landing_pages(slug);
CREATE INDEX IF NOT EXISTS idx_landing_pages_product_id ON landing_pages(product_id);
CREATE INDEX IF NOT EXISTS idx_landing_pages_is_active ON landing_pages(is_active);

-- Enable RLS
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE landing_pages ENABLE ROW LEVEL SECURITY;

-- Products: public read (SELECT for anon)
CREATE POLICY "Public read products"
  ON products FOR SELECT
  USING (true);

-- Landing Pages: public read for active pages (visitors access /lp/:slug)
CREATE POLICY "Public read active landing pages"
  ON landing_pages FOR SELECT
  USING (is_active = true);

-- Orders: NO anon access (all access via SERVICE_ROLE API routes)
-- No policies needed — SERVICE_ROLE bypasses RLS

-- Landing Pages write: NO anon access (all via SERVICE_ROLE admin API)
-- No policies needed — SERVICE_ROLE bypasses RLS
  `.trim();

  return res.status(200).json({
    ok: missing.length === 0 && database.status === 'connected',
    timestamp: new Date().toISOString(),
    environment: process.env.VERCEL_ENV || 'unknown',
    region: process.env.VERCEL_REGION || 'unknown',
    project: process.env.VERCEL_PROJECT_PRODUCTION_URL || 'unknown',
    env,
    missing: missing.length > 0 ? missing : undefined,
    database,
    required_policies: requiredPolicies,
    sql_setup: database.status !== 'connected' ? sqlSetup : '(tables OK — not shown)',
    help: missing.length > 0
      ? 'Add missing env vars in Vercel Dashboard → Settings → Environment Variables → Redeploy'
      : database.status !== 'connected'
        ? 'Run the sql_setup in Supabase SQL Editor, then redeploy'
        : '✅ All systems operational',
  });
}
