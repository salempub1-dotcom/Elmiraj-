import { useEffect, useMemo, useState } from 'react';
import {
  checkoutOfficeLabel,
  decodeCheckoutDeliverySelection,
  deliveryProviderLabel,
  encodeCheckoutDeliverySelection,
  fetchDeliveryProviderSettings,
  fetchZrCheckoutOptions,
  type DeliveryProvider,
  type DeliveryProviderSettings,
  type ZrPickupHub,
} from '../../services/deliveryCheckout';

type NoestDeskLike = {
  code: string;
  name: string;
  name_ar: string;
};

interface Props {
  deliveryType: 'home' | 'office';
  onDeliveryTypeChange: (value: 'home' | 'office') => void;
  selectedOffice: string;
  onSelectedOfficeChange: (value: string) => void;
  wilayaId: number | '';
  commune: string;
  noestDesks: NoestDeskLike[];
}

const DEFAULTS: DeliveryProviderSettings = { noest: true, zrexpress: true };

function providerButtonClasses(active: boolean) {
  return `p-4 rounded-2xl border-2 text-right transition-all ${active
    ? 'border-[#183C6B] bg-blue-50 ring-1 ring-[#183C6B]/10'
    : 'border-gray-200 bg-white hover:border-blue-300'}`;
}

function zrHubLabel(hub: ZrPickupHub) {
  const secondary = [hub.communeName, hub.cityName, hub.address].filter(Boolean).join(' — ');
  return { title: hub.name || hub.communeName || 'مكتب ZR Express', secondary };
}

export default function DeliveryCompanySelector({
  deliveryType,
  onDeliveryTypeChange,
  selectedOffice,
  onSelectedOfficeChange,
  wilayaId,
  commune,
  noestDesks,
}: Props) {
  const [settings, setSettings] = useState<DeliveryProviderSettings>(DEFAULTS);
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [zrHubs, setZrHubs] = useState<ZrPickupHub[]>([]);
  const [loadingZr, setLoadingZr] = useState(false);
  const [zrError, setZrError] = useState('');

  const decoded = useMemo(() => decodeCheckoutDeliverySelection(selectedOffice), [selectedOffice]);
  const enabledProviders = useMemo<DeliveryProvider[]>(() => {
    const list: DeliveryProvider[] = [];
    if (settings.noest) list.push('noest');
    if (settings.zrexpress) list.push('zrexpress');
    return list.length ? list : ['noest'];
  }, [settings]);

  const provider: DeliveryProvider = decoded?.provider && enabledProviders.includes(decoded.provider)
    ? decoded.provider
    : enabledProviders[0];

  useEffect(() => {
    let cancelled = false;
    void fetchDeliveryProviderSettings().then((next) => {
      if (cancelled) return;
      setSettings(next);
      setLoadingSettings(false);
    });
    return () => { cancelled = true; };
  }, []);

  // Keep a provider preference encoded even for home delivery so the admin
  // knows which courier the customer chose without adding a DB migration.
  useEffect(() => {
    if (loadingSettings) return;
    const current = decodeCheckoutDeliverySelection(selectedOffice);
    if (!current || !enabledProviders.includes(current.provider)) {
      onSelectedOfficeChange(encodeCheckoutDeliverySelection({ provider: enabledProviders[0] }));
    }
  }, [enabledProviders, loadingSettings, onSelectedOfficeChange, selectedOffice]);

  useEffect(() => {
    if (provider !== 'zrexpress' || deliveryType !== 'office' || !wilayaId || !commune) {
      setZrHubs([]);
      setZrError('');
      setLoadingZr(false);
      return;
    }

    let cancelled = false;
    setLoadingZr(true);
    setZrError('');
    void fetchZrCheckoutOptions(Number(wilayaId), commune).then((result) => {
      if (cancelled) return;
      if (result.ok && result.data) {
        setZrHubs(result.data.pickup_hubs || []);
        if ((result.data.pickup_hubs || []).length === 0) {
          setZrError('لا يوجد مكتب ZR Express متاح لهذه الوجهة حاليًا. يمكنك اختيار التوصيل للمنزل أو شركة أخرى.');
        }
      } else {
        setZrHubs([]);
        setZrError(result.message || 'تعذر تحميل مكاتب ZR Express.');
      }
      setLoadingZr(false);
    });
    return () => { cancelled = true; };
  }, [provider, deliveryType, wilayaId, commune]);

  const chooseProvider = (next: DeliveryProvider) => {
    onSelectedOfficeChange(encodeCheckoutDeliverySelection({ provider: next }));
  };

  const chooseDeliveryType = (next: 'home' | 'office') => {
    onDeliveryTypeChange(next);
    onSelectedOfficeChange(encodeCheckoutDeliverySelection({ provider }));
  };

  const chooseNoestDesk = (desk: NoestDeskLike) => {
    onSelectedOfficeChange(encodeCheckoutDeliverySelection({
      provider: 'noest',
      officeId: desk.code,
      officeName: `${desk.name_ar || desk.name} — ${desk.name}`,
    }));
  };

  const chooseZrHub = (hub: ZrPickupHub) => {
    const label = zrHubLabel(hub);
    onSelectedOfficeChange(encodeCheckoutDeliverySelection({
      provider: 'zrexpress',
      officeId: hub.id,
      officeName: [label.title, label.secondary].filter(Boolean).join(' — '),
    }));
  };

  const selectedOfficeId = decoded?.officeId || '';

  return (
    <div className="space-y-4">
      {enabledProviders.length > 1 ? (
        <div>
          <div className="flex items-center justify-between gap-2 mb-2">
            <label className="block text-sm font-bold text-gray-700">شركة التوصيل *</label>
            {loadingSettings && <span className="text-xs text-gray-400">جاري تحميل الشركات...</span>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            {enabledProviders.includes('noest') && (
              <button type="button" onClick={() => chooseProvider('noest')} className={providerButtonClasses(provider === 'noest')}>
                <div className="font-extrabold text-[#0B1833]">NOEST</div>
                <div className="text-xs text-gray-500 mt-1">نوسات</div>
              </button>
            )}
            {enabledProviders.includes('zrexpress') && (
              <button type="button" onClick={() => chooseProvider('zrexpress')} className={providerButtonClasses(provider === 'zrexpress')}>
                <div className="font-extrabold text-[#0B1833]">ZR Express</div>
                <div className="text-xs text-gray-500 mt-1">زد آر إكسبرس</div>
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
          <div>
            <div className="text-xs font-bold text-gray-400">شركة التوصيل</div>
            <div className="text-sm font-extrabold text-[#0B1833] mt-0.5">{deliveryProviderLabel(provider)}</div>
          </div>
          <span className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-3 py-1">متاحة</span>
        </div>
      )}

      <div>
        <label className="block text-sm font-bold text-gray-700 mb-2">نوع التوصيل *</label>
        <div className="grid grid-cols-2 gap-3">
          {[
            { value: 'home' as const, icon: '🏠', label: 'إلى المنزل' },
            { value: 'office' as const, icon: '🏢', label: 'إلى المكتب' },
          ].map((opt) => (
            <button
              type="button"
              key={opt.value}
              onClick={() => chooseDeliveryType(opt.value)}
              className={`p-3 rounded-xl border-2 font-bold text-sm transition-all ${deliveryType === opt.value
                ? 'border-[#183C6B] bg-blue-50 text-blue-700'
                : 'border-gray-200 text-gray-600 hover:border-blue-300'}`}
            >
              {opt.icon} {opt.label}
            </button>
          ))}
        </div>
      </div>

      {deliveryType === 'office' && (
        <div>
          <label className="block text-sm font-bold text-gray-700 mb-2">
            🏢 اختر مكتب {deliveryProviderLabel(provider)} للاستلام *
          </label>

          {!wilayaId || !commune ? (
            <div className="rounded-xl border-2 border-gray-200 bg-gray-50 p-4 text-center text-sm font-bold text-gray-500">
              اختر الولاية والبلدية أولًا لعرض المكاتب المتاحة.
            </div>
          ) : provider === 'noest' ? (
            noestDesks.length > 0 ? (
              <div className="max-h-56 overflow-y-auto space-y-2 border-2 border-gray-200 rounded-xl p-3">
                {noestDesks.map((desk) => {
                  const active = selectedOfficeId === desk.code;
                  return (
                    <button
                      type="button"
                      key={desk.code}
                      onClick={() => chooseNoestDesk(desk)}
                      className={`w-full flex items-center gap-3 p-3 rounded-xl text-right transition-all border-2 ${active ? 'border-[#183C6B] bg-blue-50' : 'border-gray-100 hover:border-blue-300'}`}
                    >
                      <span className="bg-[#102A52] text-white text-xs px-2 py-1 rounded-lg font-mono font-bold">{desk.code}</span>
                      <div className="flex-1 min-w-0">
                        <span className="font-bold text-gray-800 text-sm block">{desk.name_ar || desk.name}</span>
                        <span className="text-gray-500 text-xs block truncate">{desk.name}</span>
                      </div>
                      {active && <span className="text-[#183C6B] font-bold">✓</span>}
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="bg-amber-50 border-2 border-amber-200 rounded-xl p-4 text-amber-700 text-sm font-bold text-center">
                لا توجد مكاتب NOEST متاحة لهذه الولاية حاليًا. اختر التوصيل للمنزل أو شركة أخرى.
              </div>
            )
          ) : loadingZr ? (
            <div className="rounded-xl border-2 border-gray-200 p-4 text-center text-sm font-bold text-gray-500">⏳ جاري تحميل مكاتب ZR Express...</div>
          ) : zrHubs.length > 0 ? (
            <div className="max-h-56 overflow-y-auto space-y-2 border-2 border-gray-200 rounded-xl p-3">
              {zrHubs.map((hub) => {
                const label = zrHubLabel(hub);
                const active = selectedOfficeId === hub.id;
                return (
                  <button
                    type="button"
                    key={hub.id}
                    onClick={() => chooseZrHub(hub)}
                    className={`w-full flex items-start gap-3 p-3 rounded-xl text-right transition-all border-2 ${active ? 'border-amber-500 bg-amber-50' : 'border-gray-100 hover:border-amber-300'}`}
                  >
                    <span className="mt-0.5">📦</span>
                    <div className="flex-1 min-w-0">
                      <span className="font-bold text-gray-800 text-sm block">{label.title}</span>
                      {label.secondary && <span className="text-gray-500 text-xs block mt-0.5">{label.secondary}</span>}
                    </div>
                    {active && <span className="text-amber-600 font-bold">✓</span>}
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="bg-amber-50 border-2 border-amber-200 rounded-xl p-4 text-amber-700 text-sm font-bold text-center">
              {zrError || 'لا توجد مكاتب ZR Express متاحة لهذه الوجهة حاليًا.'}
            </div>
          )}

          {decoded?.officeName && (
            <p className="text-xs text-emerald-700 font-bold mt-2">✅ المكتب المختار: {checkoutOfficeLabel(selectedOffice)}</p>
          )}
        </div>
      )}
    </div>
  );
}
