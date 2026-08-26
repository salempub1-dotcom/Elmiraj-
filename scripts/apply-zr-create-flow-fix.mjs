import fs from 'node:fs';

function replaceOnce(file, from, to, label) {
  let src = fs.readFileSync(file, 'utf8');
  if (src.includes(to)) return;
  if (!src.includes(from)) throw new Error(`Expected block not found: ${label}`);
  src = src.replace(from, to);
  fs.writeFileSync(file, src);
  console.log(`✅ ${label}`);
}

replaceOnce(
  'lib/deliveryProviders.js',
  `export async function createZrShipment(order, { sourceHubId = null, pickupHubId = null } = {}) {\n  const destination = await resolveZrDestination(order);\n  if (!destination.ok) return destination;\n  const hubsResult = await getZrHubs();\n  if (!hubsResult.ok) return hubsResult;\n\n  const isOffice = order.delivery_type === 'office';\n  const chosenHubId = String(isOffice ? (pickupHubId || '') : (sourceHubId || '')).trim();\n  if (!chosenHubId) {\n    return {\n      ok: false,\n      error: isOffice ? 'ZR_PICKUP_HUB_REQUIRED' : 'ZR_SOURCE_HUB_REQUIRED',\n      message: isOffice ? 'اختر مكتب ZR Express للاستلام.' : 'اختر مركز ZR Express المصدر قبل إنشاء الشحنة.',\n    };\n  }\n\n  const selectedHub = hubsResult.data.find((h) => h.id === chosenHubId);\n  if (!selectedHub) return { ok: false, error: 'ZR_HUB_INVALID', message: 'مركز ZR Express المختار غير صالح أو لم يعد متاحاً.' };\n\n  if (isOffice) {\n    if (!selectedHub.isPickupPoint) return { ok: false, error: 'ZR_HUB_NOT_PICKUP', message: 'المركز المختار ليس مكتب استلام لدى ZR Express.' };\n    const d = destination.data;\n    const matchesDestination =\n      (selectedHub.districtTerritoryId && selectedHub.districtTerritoryId === d.districtTerritoryId)\n      || (selectedHub.cityTerritoryId && selectedHub.cityTerritoryId === d.cityTerritoryId)\n      || samePlace(selectedHub.communeName, order.commune)\n      || samePlace(selectedHub.cityName, order.wilaya);\n    if (!matchesDestination) return { ok: false, error: 'ZR_PICKUP_HUB_WRONG_DESTINATION', message: 'مكتب ZR Express المختار لا يتبع وجهة هذا الطلب.' };\n  }\n\n  // Critical ZR NEW rule: the parcel must be created in ReadyToDispatch,\n  // otherwise it can remain in OrderReceived and never be picked up by the hub.\n  // We fail safely instead of creating a silently-stuck parcel.\n  const readyState = await resolveReadyToDispatchStateId();\n  if (!readyState.ok) return readyState;`,
  `export async function createZrShipment(order, { sourceHubId = null, pickupHubId = null } = {}) {\n  const destination = await resolveZrDestination(order);\n  if (!destination.ok) return destination;\n\n  const isOffice = order.delivery_type === 'office';\n  // ZR v1 accepts hubId as the destination pickup point for pickup-point delivery.\n  // For home delivery hubId is nullable and must not force the admin to choose a source hub.\n  const chosenHubId = String(isOffice ? (pickupHubId || '') : '').trim();\n  if (isOffice && !chosenHubId) {\n    return { ok: false, error: 'ZR_PICKUP_HUB_REQUIRED', message: 'اختر مكتب ZR Express للاستلام.' };\n  }\n\n  if (isOffice) {\n    const hubsResult = await getZrHubs();\n    if (!hubsResult.ok) return hubsResult;\n    const selectedHub = hubsResult.data.find((h) => h.id === chosenHubId);\n    if (!selectedHub) return { ok: false, error: 'ZR_HUB_INVALID', message: 'مكتب ZR Express المختار غير صالح أو لم يعد متاحاً.' };\n    if (!selectedHub.isPickupPoint) return { ok: false, error: 'ZR_HUB_NOT_PICKUP', message: 'المركز المختار ليس مكتب استلام لدى ZR Express.' };\n    const d = destination.data;\n    const matchesDestination =\n      (selectedHub.districtTerritoryId && selectedHub.districtTerritoryId === d.districtTerritoryId)\n      || (selectedHub.cityTerritoryId && selectedHub.cityTerritoryId === d.cityTerritoryId)\n      || samePlace(selectedHub.communeName, order.commune)\n      || samePlace(selectedHub.cityName, order.wilaya);\n    if (!matchesDestination) return { ok: false, error: 'ZR_PICKUP_HUB_WRONG_DESTINATION', message: 'مكتب ZR Express المختار لا يتبع وجهة هذا الطلب.' };\n  }\n\n  // stateId is nullable in ZR v1. Prefer ReadyToDispatch when the account exposes\n  // it, but do not block creation when workflows/search does not expose state rows.\n  const readyState = await resolveReadyToDispatchStateId();\n  if (!readyState.ok) {\n    console.warn('[ZREXPRESS] ReadyToDispatch id is not exposed by this account; creating with provider default state.');\n  }`,
  'ZR optional state/hub semantics'
);

replaceOnce(
  'lib/deliveryProviders.js',
  `  const orderedProducts = items.length > 0\n    ? items.map((i) => ({\n        productName: String(i.name || 'منتج المعراج'),\n        unitPrice: Number(i.price) || 0,\n        quantity: Math.max(1, Number(i.quantity) || 1),\n        stockType: 'none',\n      }))\n    : [{ productName: 'منتجات المعراج', unitPrice: Number(order.total) || 0, quantity: 1, stockType: 'none' }];\n\n  const payload = {\n    hubId: chosenHubId,\n    stateId: readyState.data,`,
  `  const orderedProducts = items.length > 0\n    ? items.map((i) => ({\n        productName: String(i.name || 'منتج المعراج'),\n        unitPrice: Number(i.price) || 0,\n        quantity: Math.max(1, Number(i.quantity) || 1),\n        length: 1,\n        width: 1,\n        height: 1,\n        stockType: 'none',\n      }))\n    : [{ productName: 'منتجات المعراج', unitPrice: Number(order.total) || 0, quantity: 1, length: 1, width: 1, height: 1, stockType: 'none' }];\n\n  const payload = {\n    ...(isOffice && chosenHubId ? { hubId: chosenHubId } : {}),\n    ...(readyState.ok && readyState.data ? { stateId: readyState.data } : {}),`,
  'ZR parcel required dimensions and optional state'
);

replaceOnce(
  'lib/deliveryProviders.js',
  `    description: description.slice(0, 250),\n    amount: Number(order.total) || 0,\n    externalId: String(order.tracking || order.id),`,
  `    description: description.slice(0, 250),\n    amount: Number(order.total) || 0,\n    weight: { weight: 1 },\n    externalId: String(order.tracking || order.id),`,
  'ZR parcel weight'
);

replaceOnce(
  'lib/deliveryProviders.js',
  `  const full = await zrRequest(\`parcels/\${encodeURIComponent(parcelId)}\`, { method: 'GET', timeoutMs: 20_000 });\n  const tracking = String(full.ok ? (full.data?.trackingNumber || parcelId) : parcelId).trim();\n  return { ok: true, tracking, shipmentId: parcelId };`,
  `  const full = await zrRequest(\`parcels/\${encodeURIComponent(parcelId)}\`, { method: 'GET', timeoutMs: 20_000 });\n  const parcel = full.ok ? extractZrParcel(full.data) : null;\n  const tracking = String(parcel?.trackingNumber || parcelId).trim();\n  const rawStatus = String(parcel?.state?.name || parcel?.situation?.name || parcel?.status || 'unknown');\n  const defaultStateWarning = !readyState.ok && ['orderreceived', 'commanderecue'].includes(zrStatusKey(rawStatus))\n    ? 'تم إنشاء الشحنة لدى ZR Express في الحالة الأولية. راقب أول تحديث في لوحة ZR قبل تسليم الطرد.'\n    : null;\n  return { ok: true, tracking, shipmentId: parcelId, rawStatus, warning: defaultStateWarning };`,
  'ZR post-create parcel extraction'
);

replaceOnce(
  'lib/deliveryProviders.js',
  `function zrStatusKey(raw) {`,
  `function extractZrParcel(payload) {\n  if (!payload || typeof payload !== 'object') return null;\n  const candidates = [\n    payload,\n    payload.item,\n    payload.parcel,\n    payload.data?.item,\n    payload.data?.parcel,\n    payload.data,\n  ];\n  for (const candidate of candidates) {\n    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) continue;\n    if (candidate.id || candidate.trackingNumber || candidate.customer || candidate.deliveryAddress) return candidate;\n  }\n  return null;\n}\n\nfunction zrStatusKey(raw) {`,
  'ZR nested parcel extractor'
);

replaceOnce(
  'lib/deliveryProviders.js',
  `  if (!r.ok || !r.data) return { ok: false };\n\n  const rawStatus = String(r.data?.state?.name || r.data?.situation?.name || r.data?.status || 'unknown');\n  const dateRaw = r.data?.updatedAt || r.data?.modifiedAt || r.data?.createdAt || null;`,
  `  if (!r.ok || !r.data) return { ok: false };\n  const parcel = extractZrParcel(r.data);\n  if (!parcel) return { ok: false };\n\n  const rawStatus = String(parcel?.state?.name || parcel?.situation?.name || parcel?.status || 'unknown');\n  const dateRaw = parcel?.updatedAt || parcel?.modifiedAt || parcel?.createdAt || null;`,
  'ZR tracking nested response support'
);

// Simplify admin UI: no source-hub selection for home; pickup point only for office.
let dialog = fs.readFileSync('src/components/admin/DeliveryProviderDialog.tsx', 'utf8');
dialog = dialog.replace("  const [sourceHubId, setSourceHubId] = useState('');\n", '');
dialog = dialog.replace(/\n\s*setSourceHubId\(''\);/g, '');
dialog = dialog.replace(/\n\s*if \(data\.delivery_type === 'home'\) \{[\s\S]*?\n\s*\}/, '');
dialog = dialog.replace("  const sourceHubs = useMemo(() => prepared?.source_hubs || [], [prepared]);\n", '');
const oldHome = `              {prepared.delivery_type === 'home' ? (\n                <div>\n                  <label className=\"block text-sm font-bold text-gray-700 dark:text-gray-200 mb-2\">مركز ZR المصدر *</label>\n                  <select\n                    value={sourceHubId}\n                    onChange={(e) => setSourceHubId(e.target.value)}\n                    className=\"w-full border border-gray-300 dark:border-gray-700 dark:bg-gray-900 dark:text-white rounded-xl p-3\"\n                  >\n                    <option value=\"\">— اختر المركز الذي تُسلّم منه طرود المعراج —</option>\n                    {sourceHubs.map((h) => <option key={h.id} value={h.id}>{hubLabel(h)}</option>)}\n                  </select>\n                  <p className=\"text-xs text-gray-500 mt-2\">سيُحفظ اختيارك محليًا على هذا الجهاز لتسهيل الطلبات القادمة، ويمكن تغييره قبل كل إرسال.</p>\n                </div>\n              ) : (`;
const newHome = `              {prepared.delivery_type === 'home' ? (\n                <div className=\"rounded-xl bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900 p-3 text-sm text-blue-800 dark:text-blue-300\">\n                  🏠 توصيل إلى المنزل — لا يحتاج اختيار مركز ZR يدويًا.\n                </div>\n              ) : (`;
if (!dialog.includes(oldHome)) throw new Error('Home hub UI block not found');
dialog = dialog.replace(oldHome, newHome);
const oldConfirm = `                    if (prepared.delivery_type === 'home') {\n                      if (!sourceHubId) { setError('اختر مركز ZR المصدر أولاً.'); return; }\n                      try { localStorage.setItem('almiraj_zr_source_hub_id', sourceHubId); } catch { /* ignore */ }\n                      finish({ provider: 'zrexpress', source_hub_id: sourceHubId });\n                    } else {`;
const newConfirm = `                    if (prepared.delivery_type === 'home') {\n                      finish({ provider: 'zrexpress' });\n                    } else {`;
if (!dialog.includes(oldConfirm)) throw new Error('Home confirm block not found');
dialog = dialog.replace(oldConfirm, newConfirm);
fs.writeFileSync('src/components/admin/DeliveryProviderDialog.tsx', dialog);
console.log('✅ ZR admin home flow simplified');

// Update static safety assertions to match optional-state semantics.
let verify = fs.readFileSync('scripts/verify-delivery-integration.mjs', 'utf8');
verify = verify.replace("assert.match(providerSource, /stateId: readyState\\.data/);", "assert.ok(providerSource.includes(\"...(readyState.ok && readyState.data ? { stateId: readyState.data } : {})\"));");
verify = verify.replace("assert.match(providerSource, /ZR_READY_STATE_NOT_FOUND/);", "assert.match(providerSource, /ZR_READY_STATE_NOT_FOUND/);\nassert.match(providerSource, /weight: \\{ weight: 1 \\}/);\nassert.match(providerSource, /length: 1/);\nassert.match(providerSource, /extractZrParcel/);");
fs.writeFileSync('scripts/verify-delivery-integration.mjs', verify);
console.log('✅ ZR create-flow safety assertions updated');
