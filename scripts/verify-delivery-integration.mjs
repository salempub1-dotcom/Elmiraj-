import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  decodeDeliveryRef,
  encodeDeliveryRef,
  isParcelInDeliveryNetwork,
  mapZrAdminStatus,
} from '../lib/deliveryProviders.js';

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

// ── Backward-compatible provider references ────────────────────────────────
assert.equal(encodeDeliveryRef('noest', 'BX4-123'), 'BX4-123');
assert.equal(encodeDeliveryRef('zrexpress', 'ZR-TRACK-123'), 'ZR:ZR-TRACK-123');
assert.deepEqual(decodeDeliveryRef('BX4-123'), { provider: 'noest', tracking: 'BX4-123' });
assert.deepEqual(decodeDeliveryRef('ZR:ZR-TRACK-123'), { provider: 'zrexpress', tracking: 'ZR-TRACK-123' });
assert.deepEqual(decodeDeliveryRef(''), { provider: null, tracking: null });

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

// ── No secret may be hard-coded; credentials stay server-side in env vars. ──
assert.match(providerSource, /process\.env\.ZREXPRESS_TENANT_ID/);
assert.match(providerSource, /process\.env\.ZREXPRESS_API_KEY/);
assert.match(providerSource, /'X-Tenant': cfg\.tenant/);
assert.match(providerSource, /'X-Api-Key': cfg\.apiKey/);

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

console.log(`✅ Delivery integration safety checks passed (${apiFunctionCount}/12 API functions).`);
