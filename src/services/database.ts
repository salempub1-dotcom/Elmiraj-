// ============================================================
// Database Service — Supabase via API Routes
// ============================================================
// All reads/writes go through /api/products and /api/orders
// The API routes use SERVICE_ROLE key (server-side only)
//
// Products: public read, admin write
// Orders: save (with tracking validation), admin read/update
// ============================================================

// ── Types ────────────────────────────────────────────────────

interface DbResult<T = void> {
  ok: boolean;
  data?: T;
  error?: string;
  code?: string;
  message?: string;
}

interface DbProduct {
  id: number;
  name: string;
  description: string;
  price: number;
  category: string;
  images: string[];
  stock: number;
  sales: number;
  benefits: string[];
  badge?: string | null;
}

interface DbOrder {
  id: string;
  tracking: string;
  customer: string;
  phone: string;
  wilaya: string;
  address: string;
  items: unknown[];
  total: number;
  shipping: number;
  delivery_type: string;
  selected_office?: string | null;
  status: string;
  date: string;
  noest_id?: string | null;
}

// ── Helper ───────────────────────────────────────────────────

function getToken(): string {
  try { return localStorage.getItem('almiraj_token') || ''; }
  catch { return ''; }
}

// ═════════════════════════════════════════════════════════════
// PRODUCTS
// ═════════════════════════════════════════════════════════════

/**
 * Fetch all products from Supabase (public, no auth needed)
 * Includes retry logic for transient failures
 */
export async function fetchProducts(retries = 2): Promise<DbResult<DbProduct[]>> {
  let lastError = '';

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      if (attempt > 0) {
        console.log(`[DB] 🔄 Retry ${attempt}/${retries} for products...`);
        await new Promise(r => setTimeout(r, 1000 * attempt)); // Backoff: 1s, 2s
      }

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000); // 10s timeout

      const r = await fetch('/api/products', { signal: controller.signal });
      clearTimeout(timeout);

      if (!r.ok) {
        lastError = `HTTP ${r.status} ${r.statusText}`;
        console.warn(`[DB] ⚠️ Products fetch HTTP error: ${lastError}`);
        continue; // Retry
      }

      let result;
      try {
        result = await r.json();
      } catch {
        lastError = 'Invalid JSON response from /api/products';
        console.warn('[DB] ⚠️', lastError);
        continue;
      }

      if (result.ok) {
        console.log(`[DB] ✅ Fetched ${result.data?.length || 0} products (attempt ${attempt + 1})`);
        return { ok: true, data: result.data || [] };
      }

      // Table doesn't exist — don't retry (structural issue)
      if (result.code === '42P01') {
        console.error('[DB] ❌ Table "products" does not exist — run SQL setup');
        return { ok: false, error: 'TABLE_NOT_FOUND', code: '42P01', message: result.hint || 'Run SQL setup in Supabase' };
      }

      // Permission denied — don't retry (RLS issue)
      if (result.code === '42501') {
        console.error('[DB] ❌ RLS permission denied for products — check policies');
        return { ok: false, error: 'RLS_DENIED', code: '42501', message: result.hint || 'Add SELECT policy for anon role' };
      }

      // Supabase not configured — don't retry
      if (result.error === 'SUPABASE_NOT_CONFIGURED') {
        console.warn('[DB] ⚠️ Supabase not configured — using local state');
        return { ok: false, error: 'SUPABASE_NOT_CONFIGURED' };
      }

      lastError = result.error || 'Unknown error from API';
      console.warn(`[DB] ⚠️ Products fetch error: ${lastError}`);
      // Fall through to retry
    } catch (e: unknown) {
      if (e instanceof DOMException && e.name === 'AbortError') {
        lastError = 'Request timed out after 10s';
        console.warn('[DB] ⚠️ Products fetch timeout');
      } else if (e instanceof TypeError && (e.message.includes('fetch') || e.message.includes('network'))) {
        console.warn('[DB] ⚠️ Products fetch failed — API unreachable');
        return { ok: false, error: 'API_UNREACHABLE' }; // Don't retry network failures
      } else {
        lastError = e instanceof Error ? e.message : String(e);
        console.warn('[DB] ⚠️ Products fetch exception:', lastError);
      }
    }
  }

  console.error(`[DB] ❌ All ${retries + 1} attempts failed for products: ${lastError}`);
  return { ok: false, error: lastError || 'All retries exhausted' };
}

/**
 * Save (upsert) a single product — admin only
 */
export async function saveProduct(product: DbProduct): Promise<DbResult> {
  const token = getToken();
  try {
    const r = await fetch('/api/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ action: 'save', product }),
    });
    const result = await r.json();
    if (result.ok) {
      console.log(`[DB] ✅ Product saved: ${product.name}`);
    } else {
      console.warn(`[DB] ⚠️ Product save failed: ${result.error}`);
    }
    return result;
  } catch (e) {
    console.error('[DB] ❌ Product save error:', e);
    return { ok: false, error: String(e) };
  }
}

/**
 * Delete a product — admin only
 */
export async function deleteProduct(id: number): Promise<DbResult> {
  const token = getToken();
  try {
    const r = await fetch('/api/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ action: 'delete', id }),
    });
    const result = await r.json();
    if (result.ok) console.log(`[DB] ✅ Product deleted: id=${id}`);
    return result;
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

/**
 * Seed products (only if table is empty) — no auth needed
 */
export async function seedProducts(products: DbProduct[]): Promise<DbResult> {
  try {
    const r = await fetch('/api/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'seed', products }),
    });
    const result = await r.json();
    if (result.ok) console.log(`[DB] ✅ Seeded ${products.length} products`);
    else console.warn(`[DB] ⚠️ Seed failed: ${result.error}`);
    return result;
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

// ═════════════════════════════════════════════════════════════
// ORDERS
// ═════════════════════════════════════════════════════════════

/**
 * Fetch all orders — admin only (with retry)
 */
export async function fetchOrders(retries = 1): Promise<DbResult<DbOrder[]>> {
  const token = getToken();
  if (!token) {
    return { ok: false, error: 'NO_TOKEN' };
  }

  let lastError = '';

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      if (attempt > 0) {
        console.log(`[DB] 🔄 Retry ${attempt}/${retries} for orders...`);
        await new Promise(r => setTimeout(r, 1000 * attempt));
      }

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);

      const r = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ action: 'list' }),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!r.ok) {
        lastError = `HTTP ${r.status}`;
        continue;
      }

      let result;
      try {
        result = await r.json();
      } catch {
        lastError = 'Invalid JSON response';
        continue;
      }

      if (result.ok) {
        console.log(`[DB] ✅ Fetched ${result.data?.length || 0} orders`);
        return { ok: true, data: result.data || [] };
      }

      if (result.code === '42P01') {
        return { ok: false, error: 'TABLE_NOT_FOUND', code: '42P01' };
      }

      if (result.error === 'SUPABASE_NOT_CONFIGURED') {
        return { ok: false, error: 'SUPABASE_NOT_CONFIGURED' };
      }

      if (r.status === 401 || result.error?.includes('auth')) {
        return { ok: false, error: 'AUTH_FAILED', message: 'جلسة المسؤول منتهية — أعد تسجيل الدخول' };
      }

      lastError = result.error || 'Unknown error';
    } catch (e: unknown) {
      if (e instanceof DOMException && e.name === 'AbortError') {
        lastError = 'Timeout';
      } else if (e instanceof TypeError) {
        return { ok: false, error: 'API_UNREACHABLE' };
      } else {
        lastError = e instanceof Error ? e.message : String(e);
      }
    }
  }

  console.error(`[DB] ❌ Orders fetch failed after retries: ${lastError}`);
  return { ok: false, error: lastError };
}

/**
 * Save a new order — no admin auth needed (customer creates it after NOEST confirms)
 */
export async function saveOrder(order: Record<string, unknown>): Promise<DbResult> {
  try {
    const r = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'save', order }),
    });
    const result = await r.json();
    if (result.ok) {
      console.log(`[DB] ✅ Order saved: ${order.tracking}`);
    } else {
      console.warn(`[DB] ⚠️ Order save failed: ${result.error}`);
    }
    return result;
  } catch (e) {
    console.error('[DB] ❌ Order save error:', e);
    return { ok: false, error: String(e) };
  }
}

/**
 * Update order status — admin only
 */
export async function updateOrderStatus(id: string, status: string): Promise<DbResult> {
  const token = getToken();
  try {
    const r = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ action: 'update_status', id, status }),
    });
    const result = await r.json();
    if (result.ok) console.log(`[DB] ✅ Order ${id} → ${status}`);
    return result;
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}
