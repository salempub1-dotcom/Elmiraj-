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
  hint?: string;
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
  contents?: string[];
  level?: string | null;
  badge?: string | null;
}

interface DbOrder {
  id: string;
  tracking: string;
  customer: string;
  phone: string;
  wilaya: string;
  wilaya_id?: number | null;
  commune?: string | null;
  address: string;
  items: unknown[];
  total: number;
  shipping: number;
  delivery_type: string;
  selected_office?: string | null;
  status: string;
  date: string;
    noest_id?: string | null;
  internal_note?: string | null;
  reminder_date?: string | null;
  sent_to_delivery_at?: string | null;
  delivery_last_sent_at?: string | null;
  delivery_send_count?: number;
  archived?: boolean;
  archived_at?: string | null;
  delivery_status?: string | null;
  delivery_status_updated_at?: string | null;
}

/** Result of a successful send/resend to NOEST — see api/orders.js `send_to_delivery` / `resend_to_delivery`. */
export interface DeliverySendResult {
  noest_id: string;
  tracking: string;
  sent_to_delivery_at: string | null;
  delivery_last_sent_at: string;
  delivery_send_count: number;
}

/** Public tracking DTO returned by GET /api/track-order — see that file for field guarantees (no NOEST identifiers/secrets, no admin-only data). */
export interface TrackOrderData {
  orderNumber: string;
  orderStatus: 'pending' | 'confirmed' | 'waiting_customer' | 'cancelled';
  wilaya: string | null;
  commune: string | null;
  sentToDeliveryAt: string | null;
  deliveryStatus: 'in_preparation' | 'shipped' | 'out_for_delivery' | 'delivered' | 'delivery_issue' | 'unknown' | null;
  deliveryLabel: string | null;
  lastUpdate: string | null;
  history: { label: string; occurredAt: string | null }[];
  message: string;
  noestUnavailable?: boolean;
}

// ── Helper ───────────────────────────────────────────────────

function getToken(): string {
  try { return localStorage.getItem('almiraj_token') || ''; }
  catch { return ''; }
}

// ═════════════════════════════════════════════════════════════
// ADMIN SESSION EXPIRY — centralized handling
// ═════════════════════════════════════════════════════════════
// Any admin-authenticated API call that gets a 401 should clear the
// stored admin session and notify the app so it can log the user out
// and show the login screen with a clear message. This event is the
// single source of truth for that behavior — dispatched here, and
// consumed by exactly one listener at the top level of the admin UI.

export const ADMIN_AUTH_EXPIRED_EVENT = 'almiraj-admin-auth-expired';
export const AUTH_EXPIRED = 'AUTH_EXPIRED';
export const SESSION_EXPIRED_MESSAGE = 'انتهت جلسة الإدارة، يرجى تسجيل الدخول مجدداً';

/**
 * Call after any admin-authenticated fetch. If the response status is 401,
 * clears the stored admin session and dispatches ADMIN_AUTH_EXPIRED_EVENT
 * so the UI can log the user out and show the login screen.
 * Returns true if this was an auth-expiry (caller should stop further handling).
 */
export function notifyIfAdminAuthExpired(status: number): boolean {
  if (status !== 401) return false;
  try {
    localStorage.removeItem('almiraj_admin');
    localStorage.removeItem('almiraj_token');
  } catch { /* ignore */ }
  try {
    window.dispatchEvent(new CustomEvent(ADMIN_AUTH_EXPIRED_EVENT, { detail: { message: SESSION_EXPIRED_MESSAGE } }));
  } catch { /* ignore */ }
  return true;
}

/**
 * Client-side check of whether a token is still within the (unchanged) 24h
 * validity window used by the server. This is only a UX gate to avoid
 * showing the admin dashboard with a stale token before the first API
 * call — the server remains the source of truth for actual validity.
 */
export function isTokenLikelyValid(token: string): boolean {
  if (!token) return false;
  try {
    const decoded = atob(token);
    const c1 = decoded.indexOf(':');
    const c2 = decoded.indexOf(':', c1 + 1);
    if (c1 === -1 || c2 === -1) return false;
    const ts = decoded.substring(c1 + 1, c2);
    const age = Date.now() - parseInt(ts, 10);
    if (isNaN(age) || age > 86400000 || age < 0) return false;
    return true;
  } catch {
    return false;
  }
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
    if (notifyIfAdminAuthExpired(r.status)) {
      return { ok: false, error: AUTH_EXPIRED, message: SESSION_EXPIRED_MESSAGE };
    }
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
    if (notifyIfAdminAuthExpired(r.status)) {
      return { ok: false, error: AUTH_EXPIRED, message: SESSION_EXPIRED_MESSAGE };
    }
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

      if (notifyIfAdminAuthExpired(r.status)) {
        return { ok: false, error: AUTH_EXPIRED, message: SESSION_EXPIRED_MESSAGE };
      }

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
    if (notifyIfAdminAuthExpired(r.status)) {
      return { ok: false, error: AUTH_EXPIRED, message: SESSION_EXPIRED_MESSAGE };
    }
    const result = await r.json();
    if (result.ok) console.log(`[DB] ✅ Order ${id} → ${status}`);
    return result;
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

/**
 * Archive / restore an order — admin only. Never deletes data; only
 * flips the `archived` flag (and `archived_at`) so it can be hidden
 * from "آخر الطلبات" / "إدارة الطلبات" while staying in the database.
 */
export async function setOrderArchived(id: string, archived: boolean): Promise<DbResult> {
  const token = getToken();
  try {
    const r = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ action: archived ? 'archive' : 'unarchive', id }),
    });
    if (notifyIfAdminAuthExpired(r.status)) {
      return { ok: false, error: AUTH_EXPIRED, message: SESSION_EXPIRED_MESSAGE };
    }
    const result = await r.json();
    if (result.ok) console.log(`[DB] ✅ Order ${id} ${archived ? 'archived' : 'restored'}`);
    else console.warn(`[DB] ⚠️ Archive toggle failed: ${result.error}`);
    return result;
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

/** One order whose delivery_status (and possibly archived flag) changed during a sync — see syncDeliveryStatus. */
export interface DeliverySyncUpdate {
  id: string;
  deliveryStatus: string;
  deliveryStatusUpdatedAt: string;
  archived: boolean;
  archivedAt?: string;
}
export interface DeliverySyncResult {
  checked: number;
  updated: DeliverySyncUpdate[];
  unavailable: number;
}

/**
 * Batched, on-demand NOEST delivery-status sync — admin only. ONE NOEST
 * request covers every order that has a shipment and isn't already in a
 * terminal state (delivered/returned) — never one request per order.
 * Auto-archives any order NOEST confirms has actually entered its delivery
 * network (never just "shipment created"); see api/orders.js for the exact
 * NOEST status mapping. Call this on an explicit admin action only (opening
 * the Archive tab once per session, or a manual "sync now" button) — never
 * on render or a timer.
 */
export async function syncDeliveryStatus(): Promise<DbResult<DeliverySyncResult>> {
  const token = getToken();
  try {
    const r = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ action: 'sync_delivery_status' }),
    });
    if (notifyIfAdminAuthExpired(r.status)) {
      return { ok: false, error: AUTH_EXPIRED, message: SESSION_EXPIRED_MESSAGE };
    }
    return await r.json();
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

// ═════════════════════════════════════════════════════════════
// ANALYTICS (📊 الإحصائيات) — lightweight internal page-view tracking
// ═════════════════════════════════════════════════════════════

/**
 * Fire-and-forget page-view tracking for the storefront/landing pages only
 * (never called for /admin — the caller in App.tsx already guards that).
 * Deliberately non-blocking and silent on failure: never awaited by the
 * caller, never throws, never delays Hero/images/checkout/CTA rendering.
 * Counts simple "Page Views" (not deduplicated unique "Visits") — see
 * StatisticsPage.tsx for how this is surfaced to the admin.
 */
export function trackPageView(page: string): void {
  try {
    void fetch('/api/analytics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'track', page }),
      keepalive: true,
    }).catch(() => { /* never surfaced — tracking must never affect the UI */ });
  } catch {
    /* never surfaced */
  }
}

export interface AnalyticsDailyPoint {
  date: string; // 'YYYY-MM-DD' (Africa/Algiers)
  views: number;
}
export interface AnalyticsStatsResult {
  totalViews: number;
  byDate: AnalyticsDailyPoint[];
}

/**
 * Admin-only aggregated page-view totals for a date range (inclusive,
 * 'YYYY-MM-DD' Algiers-local keys) — a single grouped query, used to
 * drive the 👥 زيارات الموقع KPI and the "أداء المتجر" chart in
 * StatisticsPage.tsx. Never returns per-visitor data — only daily totals.
 */
export async function fetchAnalyticsStats(from: string, to: string): Promise<DbResult<AnalyticsStatsResult>> {
  const token = getToken();
  try {
    const r = await fetch('/api/analytics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ action: 'stats', from, to }),
    });
    if (notifyIfAdminAuthExpired(r.status)) {
      return { ok: false, error: AUTH_EXPIRED, message: SESSION_EXPIRED_MESSAGE };
    }
    return await r.json();
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

/**
 * Permanently delete an order — admin only. Reserved for test/incorrect
 * orders; the caller is responsible for confirming with the user first.
 */
export async function deleteOrder(id: string): Promise<DbResult> {
  const token = getToken();
  try {
    const r = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ action: 'delete', id }),
    });
    if (notifyIfAdminAuthExpired(r.status)) {
      return { ok: false, error: AUTH_EXPIRED, message: SESSION_EXPIRED_MESSAGE };
    }
    const result = await r.json();
    if (result.ok) console.log(`[DB] ✅ Order deleted: id=${id}`);
    return result;
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

/**
 * Update the admin-only internal note on an order — admin only. Never
 * visible to the customer; used to leave context ("العميل يريد إضافة
 * منتج قبل الإرسال") regardless of the order's status.
 */
export async function updateOrderNote(id: string, internalNote: string | null): Promise<DbResult> {
  const token = getToken();
  try {
    const r = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ action: 'update_note', id, internal_note: internalNote }),
    });
    if (notifyIfAdminAuthExpired(r.status)) {
      return { ok: false, error: AUTH_EXPIRED, message: SESSION_EXPIRED_MESSAGE };
    }
    const result = await r.json();
    if (result.ok) console.log(`[DB] ✅ Order ${id} note updated`);
    return result;
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

/**
 * Set/clear the optional follow-up reminder date on an order — admin only.
 * Pass null to clear it. Expects/produces a 'YYYY-MM-DD' string.
 */
export async function updateOrderReminder(id: string, reminderDate: string | null): Promise<DbResult> {
  const token = getToken();
  try {
    const r = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ action: 'update_reminder', id, reminder_date: reminderDate }),
    });
    if (notifyIfAdminAuthExpired(r.status)) {
      return { ok: false, error: AUTH_EXPIRED, message: SESSION_EXPIRED_MESSAGE };
    }
    const result = await r.json();
    if (result.ok) console.log(`[DB] ✅ Order ${id} reminder updated`);
    return result;
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

export interface OrderItemLine {
  productId: number;
  quantity: number;
}
export interface UpdateOrderItemsResult {
  items: unknown[]; // shape matches Order['items'] (CartItem[]) — cast at the call site, which already knows that type
  subtotal: number;
  shipping: number;
  total: number;
  updatedAt: string;
}

/**
 * "✏️ تعديل الطلب" — add/remove products or change quantities on an
 * EXISTING order (admin only) — never creates a new order. Sends ONLY
 * { productId, quantity } per line — deliberately no price/subtotal/total
 * field exists to send, because the server recomputes all of that itself
 * from trusted data (see api/orders.js action='update_items') and never
 * reads a client-submitted money value for this action.
 */
export async function updateOrderItems(id: string, lines: OrderItemLine[]): Promise<DbResult<UpdateOrderItemsResult>> {
  const token = getToken();
  try {
    const r = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ action: 'update_items', id, lines }),
    });
    if (notifyIfAdminAuthExpired(r.status)) {
      return { ok: false, error: AUTH_EXPIRED, message: SESSION_EXPIRED_MESSAGE };
    }
    const result = await r.json();
    if (result.ok) console.log(`[DB] ✅ Order ${id} items updated (${lines.length} line(s))`);
    return result;
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

/**
 * Send a CONFIRMED order to the delivery company (NOEST) for the first
 * time — admin only. The server re-reads the order and re-validates its
 * status before ever calling NOEST; a client-side status check is not
 * sufficient on its own. Fails with a clear message (no secrets) if the
 * order isn't confirmed yet or was already sent.
 */
export async function sendOrderToDelivery(id: string): Promise<DbResult<DeliverySendResult>> {
  const token = getToken();
  try {
    const r = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ action: 'send_to_delivery', id }),
    });
    if (notifyIfAdminAuthExpired(r.status)) {
      return { ok: false, error: AUTH_EXPIRED, message: SESSION_EXPIRED_MESSAGE };
    }
    return await r.json();
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

/**
 * Re-send an order to NOEST after a previous shipment was created —
 * admin only. Reserved for cases where the earlier NOEST shipment was
 * deleted by mistake. The caller is responsible for confirming with the
 * admin first (this creates a brand-new NOEST shipment; there is no
 * NOEST endpoint to verify the old one still exists).
 */
export async function resendOrderToDelivery(id: string): Promise<DbResult<DeliverySendResult>> {
  const token = getToken();
  try {
    const r = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ action: 'resend_to_delivery', id }),
    });
    if (notifyIfAdminAuthExpired(r.status)) {
      return { ok: false, error: AUTH_EXPIRED, message: SESSION_EXPIRED_MESSAGE };
    }
    return await r.json();
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

/**
 * Public order tracking — no admin auth. The customer supplies only the
 * Al Miraj order number; the server maps it to a Supabase order and, if a
 * real NOEST shipment exists, queries NOEST server-side for live status.
 * Never sends/receives NOEST identifiers or admin-only fields.
 */
export async function trackOrder(orderNumber: string): Promise<DbResult<TrackOrderData>> {
  try {
    const r = await fetch(`/api/track-order?order_number=${encodeURIComponent(orderNumber)}`);
    const result = await r.json();
    return result;
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}
