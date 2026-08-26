import fs from 'node:fs';

function patchFile(file, operations) {
  let source = fs.readFileSync(file, 'utf8');
  let changed = false;
  for (const op of operations) {
    if (op.marker && source.includes(op.marker)) continue;
    if (!source.includes(op.from)) {
      throw new Error(`[PATCH] Expected text not found in ${file}: ${op.name}`);
    }
    source = source.replace(op.from, op.to);
    changed = true;
    console.log(`✅ ${file}: ${op.name}`);
  }
  if (changed) fs.writeFileSync(file, source);
  return changed;
}

const changed = [];

if (patchFile('lib/deliveryProviders.js', [
  {
    name: 'checkout office parser import',
    marker: "from './checkoutDeliverySelection.js'",
    from: "import { randomUUID } from 'node:crypto';\n",
    to: "import { randomUUID } from 'node:crypto';\nimport { checkoutOfficeId } from './checkoutDeliverySelection.js';\n",
  },
  {
    name: 'NOEST office id supports new checkout metadata',
    marker: "station_code = checkoutOfficeId(order);",
    from: "station_code = String(order.selected_office || '').split(' — ')[0].trim();",
    to: "station_code = checkoutOfficeId(order);",
  },
])) changed.push('lib/deliveryProviders.js');

if (patchFile('lib/deliveryOrchestrator.js', [
  {
    name: 'delivery settings imports',
    marker: "from './deliverySettings.js'",
    from: "} from './deliveryProviders.js';\n",
    to: "} from './deliveryProviders.js';\nimport { readDeliverySettings, writeDeliverySettings } from './deliverySettings.js';\nimport { checkoutOfficeId, checkoutPreferredProvider } from './checkoutDeliverySelection.js';\n",
  },
  {
    name: 'admin settings action mapping',
    marker: "delivery_settings_update: 'settings_update'",
    from: "const actionMap = {\n    delivery_provider_info: 'provider_info',",
    to: "const actionMap = {\n    delivery_settings_update: 'settings_update',\n    delivery_provider_info: 'provider_info',",
  },
  {
    name: 'admin settings persistence handler',
    marker: "if (op === 'settings_update')",
    from: "  if (op === 'provider_info') {",
    to: "  if (op === 'settings_update') {\n    const saved = await writeDeliverySettings(supabase, body.settings || {});\n    return { handled: true, status: saved.ok ? 200 : 500, payload: saved };\n  }\n\n  if (op === 'provider_info') {",
  },
  {
    name: 'provider info includes customer preference',
    marker: 'preferred_provider: checkoutPreferredProvider(found.data)',
    from: "    return { handled: true, status: 200, payload: { ok: true, data: decodeDeliveryRef(found.data.noest_id) } };",
    to: "    return { handled: true, status: 200, payload: { ok: true, data: { ...decodeDeliveryRef(found.data.noest_id), preferred_provider: checkoutPreferredProvider(found.data) } } };",
  },
  {
    name: 'ZR prepared payload includes preferred pickup',
    marker: 'preferred_pickup_hub_id:',
    from: "          pickup_hubs: prepared.data.pickupHubs,",
    to: "          pickup_hubs: prepared.data.pickupHubs,\n          preferred_pickup_hub_id: checkoutPreferredProvider(found.data) === 'zrexpress' ? checkoutOfficeId(found.data) : null,",
  },
  {
    name: 'ZR shipment uses customer-selected office as fallback',
    marker: "pickupHubId: body.pickup_hub_id || (order.delivery_type === 'office' ? checkoutOfficeId(order) : null)",
    from: "      pickupHubId: body.pickup_hub_id || null,",
    to: "      pickupHubId: body.pickup_hub_id || (order.delivery_type === 'office' ? checkoutOfficeId(order) : null),",
  },
  {
    name: 'send defaults to customer preferred provider',
    marker: "body.provider || checkoutPreferredProvider(order)",
    from: "      provider = String(body.provider || '');",
    to: "      provider = String(body.provider || checkoutPreferredProvider(order) || '');",
  },
])) changed.push('lib/deliveryOrchestrator.js');

if (patchFile('api/noest.js', [
  {
    name: 'Supabase/settings/ZR checkout imports',
    marker: "from '../lib/deliverySettings.js'",
    from: "import { handleDeliveryAction } from '../lib/deliveryOrchestrator.js';\nimport { getZrSafeConfig } from '../lib/deliveryProviders.js';",
    to: "import { createClient } from '@supabase/supabase-js';\nimport { handleDeliveryAction } from '../lib/deliveryOrchestrator.js';\nimport { getZrSafeConfig, prepareZrOrder } from '../lib/deliveryProviders.js';\nimport { readDeliverySettings } from '../lib/deliverySettings.js';",
  },
  {
    name: 'Supabase settings helper',
    marker: 'function getSupabaseForDeliverySettings()',
    from: "function safeJson(v) {",
    to: "function getSupabaseForDeliverySettings() {\n  const url = process.env.SUPABASE_URL;\n  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;\n  if (!url || !key) return null;\n  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });\n}\n\nfunction safeJson(v) {",
  },
  {
    name: 'public storefront delivery actions',
    marker: "action === 'checkout_delivery_settings'",
    from: "  // Provider-aware admin actions are handled BEFORE the legacy NOEST env check,",
    to: "  // Public storefront provider configuration. This reveals only enabled/disabled\n  // booleans and safe office data; courier credentials never leave the server.\n  if (action === 'checkout_delivery_settings') {\n    const settings = await readDeliverySettings(getSupabaseForDeliverySettings());\n    return res.status(200).json({ ok: true, data: settings.data, source: settings.source });\n  }\n\n  if (action === 'checkout_zr_options') {\n    const wilayaId = Number(body.wilaya_id);\n    const commune = String(body.commune || '').trim();\n    if (!wilayaId || !commune) return res.status(400).json({ ok: false, error: 'wilaya_id and commune are required' });\n\n    const settings = await readDeliverySettings(getSupabaseForDeliverySettings());\n    if (!settings.data.zrexpress) {\n      return res.status(200).json({ ok: false, error: 'PROVIDER_DISABLED', message: 'ZR Express غير متاحة في المتجر حاليًا.' });\n    }\n\n    const prepared = await prepareZrOrder({\n      wilaya_id: wilayaId,\n      commune,\n      wilaya: String(wilayaId),\n      delivery_type: 'office',\n    });\n    if (!prepared.ok) return res.status(200).json({ ok: false, error: prepared.error, message: prepared.message || 'تعذر تحميل مكاتب ZR Express.' });\n    return res.status(200).json({\n      ok: true,\n      data: {\n        destination: { wilaya: prepared.data.destination.wilaya, commune: prepared.data.destination.commune },\n        pickup_hubs: prepared.data.pickupHubs,\n      },\n    });\n  }\n\n  // Provider-aware admin actions are handled BEFORE the legacy NOEST env check,",
  },
  {
    name: 'available actions documentation',
    marker: "'checkout_delivery_settings', 'checkout_zr_options'",
    from: "      'ping', 'diagnose', 'get_wilayas', 'get_communes', 'get_desks', 'create_order',",
    to: "      'ping', 'diagnose', 'get_wilayas', 'get_communes', 'get_desks', 'create_order',\n      'checkout_delivery_settings', 'checkout_zr_options',",
  },
])) changed.push('api/noest.js');

if (patchFile('api/admin/landing-pages.js', [
  {
    name: 'hide reserved system rows',
    marker: 'const visibleData = (data || []).filter',
    from: "      console.log(`[LANDING_PAGES] ✅ Fetched ${(data || []).length} landing pages`);\n      return res.status(200).json({\n        ok: true,\n        data: data || [],\n        count: (data || []).length,\n      });",
    to: "      const visibleData = (data || []).filter((page) => !String(page.slug || '').startsWith('__system_'));\n      console.log(`[LANDING_PAGES] ✅ Fetched ${visibleData.length} visible landing pages`);\n      return res.status(200).json({\n        ok: true,\n        data: visibleData,\n        count: visibleData.length,\n      });",
  },
])) changed.push('api/admin/landing-pages.js');

if (patchFile('api/orders.js', [
  {
    name: 'legacy courier preference parser import',
    marker: "from '../lib/checkoutDeliverySelection.js'",
    from: "import { createClient } from '@supabase/supabase-js';\n",
    to: "import { createClient } from '@supabase/supabase-js';\nimport { checkoutOfficeId, checkoutPreferredProvider } from '../lib/checkoutDeliverySelection.js';\n",
  },
  {
    name: 'legacy NOEST path refuses ZR-preferred order',
    marker: "checkoutPreferredProvider(order) === 'zrexpress'",
    from: "function buildNoestPayloadFromOrder(order) {\n  const missing = [];",
    to: "function buildNoestPayloadFromOrder(order) {\n  if (checkoutPreferredProvider(order) === 'zrexpress') {\n    return { error: 'العميل اختار ZR Express لهذا الطلب. استخدم مسار شركات التوصيل الجديد بدل مسار NOEST القديم.' };\n  }\n  const missing = [];",
  },
  {
    name: 'legacy NOEST office supports encoded metadata',
    marker: "station_code = checkoutOfficeId(order);",
    from: "station_code = String(order.selected_office || '').split(' — ')[0].trim();",
    to: "station_code = checkoutOfficeId(order);",
  },
])) changed.push('api/orders.js');

if (patchFile('src/components/admin/DeliveryProviderDialog.tsx', [
  {
    name: 'prepared preferred pickup field',
    marker: 'preferred_pickup_hub_id?: string | null;',
    from: "  pickup_hubs: ZrHub[];\n};",
    to: "  pickup_hubs: ZrHub[];\n  preferred_pickup_hub_id?: string | null;\n};",
  },
  {
    name: 'customer preferred provider state',
    marker: "const [preferredProvider, setPreferredProvider]",
    from: "  const [pickupHubId, setPickupHubId] = useState('');",
    to: "  const [pickupHubId, setPickupHubId] = useState('');\n  const [preferredProvider, setPreferredProvider] = useState<'noest' | 'zrexpress' | null>(null);",
  },
  {
    name: 'reset preferred provider',
    marker: 'setPreferredProvider(null);',
    from: "    setPickupHubId('');\n  };",
    to: "    setPickupHubId('');\n    setPreferredProvider(null);\n  };",
  },
  {
    name: 'preselect customer ZR pickup office',
    marker: 'data.preferred_pickup_hub_id',
    from: "    if (data.delivery_type === 'home') {",
    to: "    if (data.delivery_type === 'office' && data.preferred_pickup_hub_id && data.pickup_hubs.some((h) => h.id === data.preferred_pickup_hub_id)) {\n      setPickupHubId(data.preferred_pickup_hub_id);\n    }\n\n    if (data.delivery_type === 'home') {",
  },
  {
    name: 'load customer provider preference for first send',
    marker: "result.data?.preferred_provider",
    from: "      } else {\n        setStage('provider');\n      }",
    to: "      } else {\n        setStage('provider');\n        void apiCall(detail.authorization, { action: 'delivery_provider_info', id: detail.orderId }).then((result) => {\n          if (result.ok && (result.data?.preferred_provider === 'noest' || result.data?.preferred_provider === 'zrexpress')) {\n            setPreferredProvider(result.data.preferred_provider);\n          }\n        });\n      }",
  },
  {
    name: 'NOEST customer choice badge',
    marker: "preferredProvider === 'noest' ? 'اختيار العميل'",
    from: "                  <div className=\"text-xs text-gray-500 mt-1\">الربط الحالي</div>",
    to: "                  <div className=\"text-xs text-gray-500 mt-1\">{preferredProvider === 'noest' ? '✓ اختيار العميل' : 'الربط الحالي'}</div>",
  },
  {
    name: 'ZR customer choice badge',
    marker: "preferredProvider === 'zrexpress' ? 'اختيار العميل'",
    from: "                  <div className=\"text-xs text-gray-500 mt-1\">API الجديدة v1</div>",
    to: "                  <div className=\"text-xs text-gray-500 mt-1\">{preferredProvider === 'zrexpress' ? '✓ اختيار العميل' : 'API الجديدة v1'}</div>",
  },
])) changed.push('src/components/admin/DeliveryProviderDialog.tsx');

if (patchFile('src/App.tsx', [
  {
    name: 'storefront/admin courier component imports',
    marker: "import DeliveryCompanySelector from './components/store/DeliveryCompanySelector';",
    from: "import ClassroomShowcaseSection from './components/home/ClassroomShowcaseSection';\n",
    to: "import ClassroomShowcaseSection from './components/home/ClassroomShowcaseSection';\nimport DeliveryCompanySelector from './components/store/DeliveryCompanySelector';\nimport DeliveryCompaniesSettingsCard from './components/admin/DeliveryCompaniesSettingsCard';\nimport { checkoutOfficeLabel, decodeCheckoutDeliverySelection, deliveryProviderLabel, encodeCheckoutDeliverySelection } from './services/deliveryCheckout';\n",
  },
  {
    name: 'checkout office validation uses provider metadata',
    marker: "const checkoutSelection = decodeCheckoutDeliverySelection(selectedOffice);",
    from: "    if (deliveryType === 'office' && !selectedOffice) {\n      showToast('يرجى اختيار مكتب الاستلام', 'error');\n      return;\n    }",
    to: "    const checkoutSelection = decodeCheckoutDeliverySelection(selectedOffice);\n    if (!checkoutSelection) {\n      showToast('يرجى اختيار شركة التوصيل', 'error');\n      return;\n    }\n    if (deliveryType === 'office' && !checkoutSelection.officeId) {\n      showToast('يرجى اختيار مكتب الاستلام', 'error');\n      return;\n    }",
  },
  {
    name: 'replace fixed NOEST checkout controls with provider-aware selector',
    marker: '<DeliveryCompanySelector',
    from: "                  <div><label className=\"block text-sm font-bold text-gray-700 mb-2\">نوع التوصيل *</label><div className=\"grid grid-cols-2 gap-3\">{[{ value: 'home', icon: '🏠', label: 'إلى المنزل' }, { value: 'office', icon: '🏢', label: 'إلى المكتب' }].map(opt => (<button key={opt.value} onClick={() => { setDeliveryType(opt.value as 'home' | 'office'); setSelectedOffice(''); }} className={`p-3 rounded-xl border-2 font-bold text-sm transition-all ${deliveryType === opt.value ? 'border-[#183C6B] bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-600 hover:border-blue-300'}`}>{opt.icon} {opt.label}</button>))}</div></div>\n                  {deliveryType === 'office' && customerWilayaId && (<div><label className=\"block text-sm font-bold text-gray-700 mb-2\">🏢 اختر مكتب الاستلام * <span className=\"text-xs text-gray-400 font-normal\">(Stop Desk)</span></label>{desks.length > 0 ? (<div className=\"max-h-48 overflow-y-auto space-y-2 border-2 border-gray-200 rounded-xl p-3\">{desks.map(desk => (<button key={desk.code} onClick={() => setSelectedOffice(`${desk.code} — ${desk.name}`)} className={`w-full flex items-center gap-3 p-3 rounded-xl text-right transition-all border-2 ${selectedOffice === `${desk.code} — ${desk.name}` ? 'border-[#183C6B] bg-blue-50' : 'border-gray-100 hover:border-blue-300'}`}><span className=\"bg-[#102A52] text-white text-xs px-2 py-1 rounded-lg font-mono font-bold\">{desk.code}</span><div className=\"flex-1\"><span className=\"font-bold text-gray-800 text-sm block\">{desk.name_ar}</span><span className=\"text-gray-500 text-xs\">{desk.name}</span></div>{selectedOffice === `${desk.code} — ${desk.name}` && <span className=\"text-[#183C6B] mr-auto font-bold\">✓</span>}</button>))}</div>) : (<div className=\"bg-amber-50 border-2 border-amber-200 rounded-xl p-4 text-amber-700 text-sm font-bold text-center\">⚠️ سيتم التواصل معك لتحديد نقطة الاستلام</div>)}</div>)}",
    to: "                  <DeliveryCompanySelector\n                    deliveryType={deliveryType}\n                    onDeliveryTypeChange={setDeliveryType}\n                    selectedOffice={selectedOffice}\n                    onSelectedOfficeChange={setSelectedOffice}\n                    wilayaId={customerWilayaId}\n                    commune={commune}\n                    noestDesks={desks}\n                  />",
  },
  {
    name: 'order success shows courier and friendly office label',
    marker: 'شركة التوصيل:</span><span className="font-bold">{deliveryProviderLabel',
    from: "                  <div className=\"flex justify-between\"><span className=\"text-gray-500\">التوصيل:</span><span className=\"font-bold\">{currentOrder.deliveryType === 'home' ? 'إلى المنزل' : 'إلى المكتب'}</span></div>\n                  {currentOrder.selectedOffice && <div className=\"flex justify-between\"><span className=\"text-gray-500\">المكتب:</span><span className=\"font-bold text-xs\">{currentOrder.selectedOffice}</span></div>}",
    to: "                  <div className=\"flex justify-between\"><span className=\"text-gray-500\">شركة التوصيل:</span><span className=\"font-bold\">{deliveryProviderLabel(decodeCheckoutDeliverySelection(currentOrder.selectedOffice)?.provider)}</span></div>\n                  <div className=\"flex justify-between\"><span className=\"text-gray-500\">التوصيل:</span><span className=\"font-bold\">{currentOrder.deliveryType === 'home' ? 'إلى المنزل' : 'إلى المكتب'}</span></div>\n                  {currentOrder.deliveryType === 'office' && checkoutOfficeLabel(currentOrder.selectedOffice) && <div className=\"flex justify-between gap-3\"><span className=\"text-gray-500\">المكتب:</span><span className=\"font-bold text-xs text-left\">{checkoutOfficeLabel(currentOrder.selectedOffice)}</span></div>}",
  },
  {
    name: 'admin order card shows friendly provider/office',
    marker: "deliveryProviderLabel(decodeCheckoutDeliverySelection(order.selectedOffice)?.provider)",
    from: "          <p className=\"text-gray-600 dark:text-gray-300 text-sm\">🚚 {order.deliveryType === 'home' ? 'توصيل للمنزل' : `مكتب: ${order.selectedOffice || ''}`}</p>",
    to: "          <p className=\"text-gray-600 dark:text-gray-300 text-sm\">🚚 {deliveryProviderLabel(decodeCheckoutDeliverySelection(order.selectedOffice)?.provider)} — {order.deliveryType === 'home' ? 'توصيل للمنزل' : `مكتب: ${checkoutOfficeLabel(order.selectedOffice)}`}</p>",
  },
  {
    name: 'admin courier visibility settings card',
    marker: '<DeliveryCompaniesSettingsCard />',
    from: "              <h2 className=\"text-2xl font-bold text-gray-800 dark:text-gray-50\">⚙️ النظام والتكاملات</h2>\n\n              {/* Facebook Pixel Status */}",
    to: "              <h2 className=\"text-2xl font-bold text-gray-800 dark:text-gray-50\">⚙️ النظام والتكاملات</h2>\n\n              <DeliveryCompaniesSettingsCard />\n\n              {/* Facebook Pixel Status */}",
  },
])) changed.push('src/App.tsx');

console.log(`\nPatched files: ${changed.join(', ') || 'none (already applied)'}`);
