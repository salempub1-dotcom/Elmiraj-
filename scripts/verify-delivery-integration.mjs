import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  decodeDeliveryRef,
  encodeDeliveryRef,
  isParcelInDeliveryNetwork,
  mapZrAdminStatus,
} from '../lib/deliveryProviders.js';
import {
  checkoutOfficeId,
  checkoutPreferredProvider,
  decodeCheckoutDeliverySelection,
} from '../lib/checkoutDeliverySelection.js';

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

// ── Backward-compatible provider references ────────────────────────────────
assert.equal(encodeDeliveryRef('noest', 'BX4-123'), 'BX4-123');
assert.equal(encodeDeliveryRef('zrexpress', 'ZR-TRACK-123'), 'ZR:ZR-TRACK-123');
assert.deepEqual(decodeDeliveryRef('BX4-123'), { provider: 'noest', tracking: 'BX4-123' });
assert.deepEqual(decodeDeliveryRef('ZR:ZR-TRACK-123'), { provider: 'zrexpress', tracking: 'ZR-TRACK-123' });
assert.deepEqual(decodeDeliveryRef(''), { provider: null, tracking: null });

// ── Customer checkout provider/office metadata ─────────────────────────────
const noestCheckout = '@DP1:noest:ALG16-01:Alger%20Centre';
const zrCheckout = '@DP1:zrexpress:hub-uuid-123:Baraqi%20Hub';
assert.deepEqual(decodeCheckoutDeliverySelection(noestCheckout), {
  provider: 'noest', officeId: 'ALG16-01', officeName: 'Alger Centre',
});
assert.deepEqual(decodeCheckoutDeliverySelection(zrCheckout), {
  provider: 'zrexpress', officeId: 'hub-uuid-123', officeName: 'Baraqi Hub',
});
assert.equal(checkoutPreferredProvider({ selected_office: noestCheckout }), 'noest');
assert.equal(checkoutPreferredProvider({ selected_office: zrCheckout }), 'zrexpress');
assert.equal(checkoutOfficeId({ selected_office: noestCheckout }), 'ALG16-01');
assert.equal(checkoutOfficeId({ selected_office: zrCheckout }), 'hub-uuid-123');
assert.equal(checkoutOfficeId({ selected_office: 'ALG16-01 — Alger Centre' }), 'ALG16-01');

// ── ZR status normalization ────────────────────────────────────────────────
assert.equal(mapZrAdminStatus('ReadyToDispatch'), 'in_preparation');
assert.equal(mapZrAdminStatus('Dispatched'), 'in_transit');
assert.equal(mapZrAdminStatus('OutForDelivery'), 'in_transit');
assert.equal(mapZrAdminStatus('Delivered'), 'delivered');
assert.equal(mapZrAdminStatus('FailedDelivery'), 'delivery_attempt_failed');
assert.equal(mapZrAdminStatus('Returned'), 'returned');
assert.equal(mapZrAdminStatus('something-new-from-provider'), 'unknown');

// Auto-archive must never trigger while merely prepared/unknown.
assert.equal(isParcelInDeliveryNetwork('in_preparation'), false);
assert.equal(isParcelInDeliveryNetwork('unknown'), false);
assert.equal(isParcelInDeliveryNetwork('in_transit'), true);
assert.equal(isParcelInDeliveryNetwork('delivered'), true);
assert.equal(isParcelInDeliveryNetwork('returned'), true);

const providerSource = read('lib/deliveryProviders.js');
const orchestratorSource = read('lib/deliveryOrchestrator.js');
const proxySource = read('api/noest.js');
const trackingSource = read('api/track-order.js');
const settingsSource = read('lib/deliverySettings.js');
const checkoutServiceSource = read('src/services/deliveryCheckout.ts');
const checkoutUiSource = read('src/components/store/DeliveryCompanySelector.tsx');
const adminSettingsSource = read('src/components/admin/DeliveryCompaniesSettingsCard.tsx');
const appSource = read('src/App.tsx');

// ── ZR live tariffs must never fall back to NOEST's static table. ──────────
assert.ok(providerSource.includes("zrRequest('delivery-pricing/rates', { method: 'GET' })"));
assert.ok(proxySource.includes("action === 'checkout_zr_quote'"));
assert.ok(checkoutServiceSource.includes('fetchZrShippingQuote'));
assert.ok(appSource.includes("const shippingCost = selectedDeliveryProvider === 'zrexpress' ? (zrShippingPrice ?? 0) : noestShippingCost;"));
assert.ok(appSource.includes("checkoutSelection.provider === 'zrexpress' && (zrShippingLoading || zrShippingPrice === null)"));

// ── No secret may be hard-coded; credentials stay server-side in env vars. ──
assert.match(providerSource, /process\.env\.ZREXPRESS_TENANT_ID/);
assert.match(providerSource, /process\.env\.ZREXPRESS_API_KEY/);
assert.match(providerSource, /'X-Tenant': cfg\.tenant/);
assert.match(providerSource, /'X-Api-Key': cfg\.apiKey/);
assert.doesNotMatch(checkoutServiceSource, /ZREXPRESS_TENANT_ID|ZREXPRESS_API_KEY|X-Tenant|X-Api-Key/);

// ── ZR creation safety: explicit ReadyToDispatch + Al Miraj external ref. ──
assert.match(providerSource, /stateId: readyState\.data/);
assert.match(providerSource, /externalId: String\(order\.tracking \|\| order\.id\)/);
assert.match(providerSource, /ZR_READY_STATE_NOT_FOUND/);

// ── The read-only preparation route must not create a parcel. ──────────────
const prepareStart = orchestratorSource.indexOf("if (op === 'prepare_zrexpress')");
const sendStart = orchestratorSource.indexOf("if (op === 'send' || op === 'resend')");
assert.ok(prepareStart >= 0 && sendStart > prepareStart, 'Could not locate prepare/send route boundaries');
const prepareBlock = orchestratorSource.slice(prepareStart, sendStart);
assert.match(prepareBlock, /prepareZrOrder/);
assert.doesNotMatch(prepareBlock, /createZrShipment|createNoestShipment|delivery_send/);

// ── Storefront provider visibility + read-only office discovery. ───────────
assert.match(settingsSource, /__system_delivery_providers/);
assert.match(settingsSource, /noest:\s*true/);
assert.match(settingsSource, /zrexpress:\s*true/);
assert.match(proxySource, /checkout_delivery_settings/);
assert.match(proxySource, /checkout_zr_options/);
assert.match(proxySource, /prepareZrOrder/);
assert.match(checkoutUiSource, /NOEST/);
assert.match(checkoutUiSource, /ZR Express/);
assert.match(checkoutUiSource, /fetchZrCheckoutOptions/);
assert.match(adminSettingsSource, /saveDeliveryProviderSettings/);
assert.match(adminSettingsSource, /شركة توصيل واحدة على الأقل/);
assert.match(appSource, /<DeliveryCompanySelector/);
assert.match(appSource, /<DeliveryCompaniesSettingsCard/);

// Customer choice is preserved for admin sending; no silent switch to NOEST.
assert.match(orchestratorSource, /body\.provider \|\| checkoutPreferredProvider\(order\)/);
assert.match(orchestratorSource, /preferred_pickup_hub_id/);
assert.match(orchestratorSource, /checkoutOfficeId\(order\)/);

// ── Server-side workflow guards and duplicate-send protection. ─────────────
assert.match(orchestratorSource, /normalizeOrderStatus\(order\.status\) !== 'confirmed'/);
assert.match(orchestratorSource, /\.is\('noest_id', null\)/);
assert.match(orchestratorSource, /SEND_STATE_UNKNOWN/);
assert.match(orchestratorSource, /shouldKeepLockAfterFailure/);

// ── Existing NOEST function is reused to stay inside Vercel Hobby limit. ───
assert.match(proxySource, /action\.startsWith\('delivery_'\)/);
assert.match(proxySource, /ALMIRAJ_V5_MULTI_PROVIDER/);
assert.match(trackingSource, /decodeDeliveryRef/);
assert.match(trackingSource, /fetchZrTrackingInfo/);
assert.match(trackingSource, /fetchNoestTrackingInfo/);

function countServerlessJs(dir) {
  let count = 0;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) count += countServerlessJs(full);
    else if (entry.isFile() && entry.name.endsWith('.js')) count += 1;
  }
  return count;
}

const apiFunctionCount = countServerlessJs(path.join(root, 'api'));
assert.ok(apiFunctionCount <= 12, `Vercel Hobby serverless function limit exceeded: ${apiFunctionCount}/12`);

console.log(`✅ Delivery integration + storefront courier checks passed (${apiFunctionCount}/12 API functions).`);
