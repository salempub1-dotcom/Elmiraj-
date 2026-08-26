import fs from 'node:fs';

function patchFile(file, operations) {
  let source = fs.readFileSync(file, 'utf8');
  let changed = false;
  for (const op of operations) {
    if (op.marker && source.includes(op.marker)) continue;
    if (!source.includes(op.from)) throw new Error(`[PATCH] Expected text not found in ${file}: ${op.name}`);
    source = source.replace(op.from, op.to);
    changed = true;
    console.log(`✅ ${file}: ${op.name}`);
  }
  if (changed) fs.writeFileSync(file, source);
}

patchFile('lib/deliveryProviders.js', [
  {
    name: 'ZR live pricing quote helper',
    marker: 'export async function getZrDeliveryQuote(order)',
    from: "export async function testZrCredentials() {\n  const r = await zrRequest('workflows/search', { method: 'POST', body: { pageNumber: 1, pageSize: 1 } });\n  return { ok: r.ok, error: r.error, message: r.message };\n}\n",
    to: "export async function testZrCredentials() {\n  const r = await zrRequest('workflows/search', { method: 'POST', body: { pageNumber: 1, pageSize: 1 } });\n  return { ok: r.ok, error: r.error, message: r.message };\n}\n\n// Live ZR Express tariff lookup. Never reuse NOEST's local price table for ZR.\n// The new ZR platform publishes effective rates at GET /delivery-pricing/rates,\n// with home / pickup-point prices at commune and/or wilaya level.\nexport async function getZrDeliveryQuote(order) {\n  const destination = await resolveZrDestination(order);\n  if (!destination.ok) return destination;\n\n  const pricing = await zrRequest('delivery-pricing/rates', { method: 'GET' });\n  if (!pricing.ok) return pricing;\n  const rates = Array.isArray(pricing.data?.rates) ? pricing.data.rates : [];\n  const d = destination.data;\n\n  const byId = (id) => rates.find((rate) => String(rate?.toTerritoryId || '') === String(id || ''));\n  const byLevelAndCode = (level, code) => rates.find((rate) =>\n    String(rate?.toTerritoryLevel || '').toLowerCase() === level && Number(rate?.toTerritoryCode || 0) === Number(code || 0));\n\n  // Commune price is more specific and wins. Wilaya is a safe fallback only\n  // when ZR does not publish an override for that commune.\n  const rate = byId(d.districtTerritoryId)\n    || byLevelAndCode('commune', d.commune.code)\n    || byId(d.cityTerritoryId)\n    || byLevelAndCode('wilaya', d.wilaya.code);\n\n  if (!rate) {\n    return { ok: false, error: 'ZR_RATE_NOT_FOUND', message: 'لم تُرجع ZR Express تسعيرة لهذه الوجهة.' };\n  }\n\n  let home = null;\n  let office = null;\n  let returnPrice = null;\n  for (const entry of Array.isArray(rate.deliveryPrices) ? rate.deliveryPrices : []) {\n    const type = String(entry?.deliveryType || '').toLowerCase();\n    const price = Number(entry?.price);\n    if (!Number.isFinite(price)) continue;\n    if (type === 'home') home = price;\n    else if (type === 'pickup-point') office = price;\n    else if (type === 'return') returnPrice = price;\n  }\n\n  return {\n    ok: true,\n    data: {\n      home,\n      office,\n      returnPrice,\n      territoryId: rate.toTerritoryId || null,\n      territoryLevel: String(rate.toTerritoryLevel || '').toLowerCase() || null,\n      territoryName: rate.toTerritoryNameArabic || rate.toTerritoryName || null,\n    },\n  };\n}\n"
  }
]);

patchFile('api/noest.js', [
  {
    name: 'import live ZR quote helper',
    marker: 'getZrDeliveryQuote, getZrSafeConfig',
    from: "import { getZrSafeConfig, prepareZrOrder } from '../lib/deliveryProviders.js';",
    to: "import { getZrDeliveryQuote, getZrSafeConfig, prepareZrOrder } from '../lib/deliveryProviders.js';"
  },
  {
    name: 'public read-only ZR quote action',
    marker: "action === 'checkout_zr_quote'",
    from: "  // Provider-aware admin actions are handled BEFORE the legacy NOEST env check,",
    to: "  if (action === 'checkout_zr_quote') {\n    const wilayaId = Number(body.wilaya_id);\n    const commune = String(body.commune || '').trim();\n    if (!wilayaId || !commune) return res.status(400).json({ ok: false, error: 'wilaya_id and commune are required' });\n\n    const settings = await readDeliverySettings(getSupabaseForDeliverySettings());\n    if (!settings.data.zrexpress) {\n      return res.status(200).json({ ok: false, error: 'PROVIDER_DISABLED', message: 'ZR Express غير متاحة في المتجر حاليًا.' });\n    }\n\n    const quote = await getZrDeliveryQuote({ wilaya_id: wilayaId, commune, wilaya: String(wilayaId) });\n    return res.status(quote.ok ? 200 : 200).json(quote);\n  }\n\n  // Provider-aware admin actions are handled BEFORE the legacy NOEST env check,"
  }
]);

patchFile('src/services/deliveryCheckout.ts', [
  {
    name: 'ZR quote type and browser helper',
    marker: 'export interface ZrShippingQuote',
    from: "export interface ZrCheckoutOptions {\n  destination: {\n    wilaya: { id: string; code: number; name: string; nameArabic?: string | null };\n    commune: { id: string; code: number; name: string; nameArabic?: string | null };\n  };\n  pickup_hubs: ZrPickupHub[];\n}\n",
    to: "export interface ZrCheckoutOptions {\n  destination: {\n    wilaya: { id: string; code: number; name: string; nameArabic?: string | null };\n    commune: { id: string; code: number; name: string; nameArabic?: string | null };\n  };\n  pickup_hubs: ZrPickupHub[];\n}\n\nexport interface ZrShippingQuote {\n  home: number | null;\n  office: number | null;\n  returnPrice?: number | null;\n  territoryId?: string | null;\n  territoryLevel?: string | null;\n  territoryName?: string | null;\n}\n"
  },
  {
    name: 'fetch live ZR shipping quote',
    marker: 'export async function fetchZrShippingQuote',
    from: "export async function fetchZrCheckoutOptions(wilayaId: number, commune: string): Promise<{ ok: boolean; data?: ZrCheckoutOptions; message?: string }> {\n  try {\n    const { result } = await jsonPost({\n      action: 'checkout_zr_options',\n      wilaya_id: wilayaId,\n      commune,\n    });\n    return result;\n  } catch {\n    return { ok: false, message: 'تعذر تحميل مكاتب ZR Express.' };\n  }\n}\n",
    to: "export async function fetchZrCheckoutOptions(wilayaId: number, commune: string): Promise<{ ok: boolean; data?: ZrCheckoutOptions; message?: string }> {\n  try {\n    const { result } = await jsonPost({\n      action: 'checkout_zr_options',\n      wilaya_id: wilayaId,\n      commune,\n    });\n    return result;\n  } catch {\n    return { ok: false, message: 'تعذر تحميل مكاتب ZR Express.' };\n  }\n}\n\nexport async function fetchZrShippingQuote(wilayaId: number, commune: string): Promise<{ ok: boolean; data?: ZrShippingQuote; message?: string }> {\n  try {\n    const { result } = await jsonPost({\n      action: 'checkout_zr_quote',\n      wilaya_id: wilayaId,\n      commune,\n    });\n    return result;\n  } catch {\n    return { ok: false, message: 'تعذر تحميل تسعيرة ZR Express.' };\n  }\n}\n"
  }
]);

patchFile('src/App.tsx', [
  {
    name: 'import ZR live pricing helper',
    marker: 'fetchZrShippingQuote, checkoutOfficeLabel',
    from: "import { checkoutOfficeLabel, decodeCheckoutDeliverySelection, deliveryProviderLabel, encodeCheckoutDeliverySelection } from './services/deliveryCheckout';",
    to: "import { fetchZrShippingQuote, checkoutOfficeLabel, decodeCheckoutDeliverySelection, deliveryProviderLabel, encodeCheckoutDeliverySelection } from './services/deliveryCheckout';"
  },
  {
    name: 'ZR quote state',
    marker: 'const [zrShippingPrice, setZrShippingPrice]',
    from: "  const [deliveryType, setDeliveryType] = useState<'home' | 'office'>('home');\n  const [selectedOffice, setSelectedOffice] = useState('');",
    to: "  const [deliveryType, setDeliveryType] = useState<'home' | 'office'>('home');\n  const [selectedOffice, setSelectedOffice] = useState('');\n  const [zrShippingPrice, setZrShippingPrice] = useState<number | null>(null);\n  const [zrShippingLoading, setZrShippingLoading] = useState(false);\n  const [zrShippingError, setZrShippingError] = useState('');"
  },
  {
    name: 'live ZR quote effect and isolated price calculation',
    marker: 'NOEST price table is intentionally used ONLY for NOEST',
    from: "  const selectedWilayaObj = customerWilayaId ? wilayaShipping.find(w => w.code === customerWilayaId) : undefined;\n  const shippingCost = selectedWilayaObj ? (deliveryType === 'home' ? selectedWilayaObj.home : selectedWilayaObj.office) : 0;\n  const cartTotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);",
    to: "  const selectedDeliveryProvider = decodeCheckoutDeliverySelection(selectedOffice)?.provider || null;\n\n  useEffect(() => {\n    if (selectedDeliveryProvider !== 'zrexpress' || !customerWilayaId || !commune) {\n      setZrShippingPrice(null);\n      setZrShippingLoading(false);\n      setZrShippingError('');\n      return;\n    }\n\n    let cancelled = false;\n    setZrShippingLoading(true);\n    setZrShippingError('');\n    setZrShippingPrice(null);\n    void fetchZrShippingQuote(Number(customerWilayaId), commune).then((result) => {\n      if (cancelled) return;\n      const price = deliveryType === 'home' ? result.data?.home : result.data?.office;\n      if (result.ok && typeof price === 'number' && Number.isFinite(price) && price > 0) {\n        setZrShippingPrice(price);\n      } else {\n        setZrShippingPrice(null);\n        setZrShippingError(result.message || `لا توجد تسعيرة ZR Express صالحة للتوصيل ${deliveryType === 'home' ? 'للمنزل' : 'للمكتب'} في هذه الوجهة.`);\n      }\n      setZrShippingLoading(false);\n    });\n    return () => { cancelled = true; };\n  }, [selectedDeliveryProvider, customerWilayaId, commune, deliveryType]);\n\n  const selectedWilayaObj = customerWilayaId ? wilayaShipping.find(w => w.code === customerWilayaId) : undefined;\n  // NOEST price table is intentionally used ONLY for NOEST. ZR Express always\n  // uses its own live API tariff and is never allowed to inherit a NOEST price.\n  const noestShippingCost = selectedWilayaObj ? (deliveryType === 'home' ? selectedWilayaObj.home : selectedWilayaObj.office) : 0;\n  const shippingCost = selectedDeliveryProvider === 'zrexpress' ? (zrShippingPrice ?? 0) : noestShippingCost;\n  const cartTotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);"
  },
  {
    name: 'block ZR order when live quote unavailable',
    marker: "checkoutSelection.provider === 'zrexpress' && (zrShippingLoading || zrShippingPrice === null)",
    from: "    if (deliveryType === 'office' && !checkoutSelection.officeId) {\n      showToast('يرجى اختيار مكتب الاستلام', 'error');\n      return;\n    }",
    to: "    if (deliveryType === 'office' && !checkoutSelection.officeId) {\n      showToast('يرجى اختيار مكتب الاستلام', 'error');\n      return;\n    }\n    if (checkoutSelection.provider === 'zrexpress' && (zrShippingLoading || zrShippingPrice === null)) {\n      showToast(zrShippingLoading ? 'جاري جلب سعر ZR Express، انتظر لحظة' : (zrShippingError || 'تعذر التحقق من سعر ZR Express لهذه الوجهة'), 'error');\n      return;\n    }"
  },
  {
    name: 'show ZR tariff status in checkout summary',
    marker: 'تسعيرة ZR Express من API',
    from: "                    <div className=\"border-t pt-2 space-y-1\"><div className=\"flex justify-between text-sm\"><span>المجموع الفرعي:</span><span>{cartTotal.toLocaleString()} دج</span></div>{shippingCost > 0 && <div className=\"flex justify-between text-sm\"><span>تكلفة الشحن:</span><span>{shippingCost.toLocaleString()} دج</span></div>}<div className=\"flex justify-between font-bold text-lg border-t pt-1\"><span>المجموع الكلي:</span><span className=\"text-blue-700\">{orderTotal.toLocaleString()} دج</span></div></div>",
    to: "                    <div className=\"border-t pt-2 space-y-1\"><div className=\"flex justify-between text-sm\"><span>المجموع الفرعي:</span><span>{cartTotal.toLocaleString()} دج</span></div>{selectedDeliveryProvider === 'zrexpress' && zrShippingLoading && <div className=\"text-xs text-amber-600 font-bold\">⏳ جاري جلب تسعيرة ZR Express من API...</div>}{selectedDeliveryProvider === 'zrexpress' && zrShippingError && !zrShippingLoading && <div className=\"text-xs text-red-600 font-bold\">⚠️ {zrShippingError}</div>}{shippingCost > 0 && <div className=\"flex justify-between text-sm\"><span>تكلفة الشحن:</span><span>{shippingCost.toLocaleString()} دج</span></div>}<div className=\"flex justify-between font-bold text-lg border-t pt-1\"><span>المجموع الكلي:</span><span className=\"text-blue-700\">{orderTotal.toLocaleString()} دج</span></div></div>"
  }
]);

patchFile('scripts/verify-delivery-integration.mjs', [
  {
    name: 'pricing isolation verification',
    marker: 'ZR live tariffs must never fall back to NOEST',
    from: "const trackingSource = read('api/track-order.js');\n",
    to: "const trackingSource = read('api/track-order.js');\nconst appSource = read('src/App.tsx');\nconst checkoutSource = read('src/services/deliveryCheckout.ts');\n\n// ZR live tariffs must never fall back to NOEST's static table.\nassert.match(providerSource, /delivery-pricing\\/rates/);\nassert.match(proxySource, /checkout_zr_quote/);\nassert.match(checkoutSource, /fetchZrShippingQuote/);\nassert.match(appSource, /const shippingCost = selectedDeliveryProvider === 'zrexpress' \? \(zrShippingPrice \?\? 0\) : noestShippingCost/);\nassert.match(appSource, /checkoutSelection\.provider === 'zrexpress' && \(zrShippingLoading \|\| zrShippingPrice === null\)/);\n"
  }
]);

console.log('✅ ZR pricing isolation patch applied.');
