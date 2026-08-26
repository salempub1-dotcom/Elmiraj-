import { useEffect, useMemo, useState } from 'react';
import {
  DELIVERY_SELECTION_EVENT,
  type DeliverySelectionRequest,
} from '../../services/deliveryBridge';

type ZrHub = {
  id: string;
  name: string;
  isPickupPoint: boolean;
  cityName: string;
  communeName: string;
  address: string;
};

type ZrPreparation = {
  delivery_type: 'home' | 'office';
  destination: {
    wilaya: { id: string; code: number; name: string; nameArabic?: string | null };
    commune: { id: string; code: number; name: string; nameArabic?: string | null };
  };
  source_hubs: ZrHub[];
  pickup_hubs: ZrHub[];
};

function hubLabel(h: ZrHub): string {
  return [h.name, h.communeName, h.cityName].filter(Boolean).join(' — ');
}

export default function DeliveryProviderDialog() {
  const [request, setRequest] = useState<DeliverySelectionRequest | null>(null);
  const [stage, setStage] = useState<'provider' | 'loading' | 'zr'>('provider');
  const [error, setError] = useState('');
  const [prepared, setPrepared] = useState<ZrPreparation | null>(null);
  const [sourceHubId, setSourceHubId] = useState('');
  const [pickupHubId, setPickupHubId] = useState('');

  const reset = () => {
    setRequest(null);
    setStage('provider');
    setError('');
    setPrepared(null);
    setSourceHubId('');
    setPickupHubId('');
  };

  const finish = (selection: { provider: 'noest' | 'zrexpress'; source_hub_id?: string; pickup_hub_id?: string } | null) => {
    const current = request;
    reset();
    current?.resolve(selection);
  };

  const apiCall = async (authorization: string, payload: Record<string, unknown>) => {
    const r = await fetch('/api/noest', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(authorization ? { Authorization: authorization } : {}),
      },
      body: JSON.stringify(payload),
    });
    if (r.status === 401) {
      return { ok: false, error: 'AUTH_EXPIRED', message: 'انتهت جلسة الإدارة. سجّل الدخول من جديد.' };
    }
    return r.json();
  };

  const loadZrPreparation = async (req: DeliverySelectionRequest) => {
    setStage('loading');
    setError('');
    const result = await apiCall(req.authorization, { action: 'delivery_prepare_zrexpress', id: req.orderId });
    if (!result.ok || !result.data) {
      setError(result.message || result.error || 'تعذر تحميل بيانات ZR Express.');
      setStage('provider');
      return;
    }

    const data = result.data as ZrPreparation;
    setPrepared(data);

    if (data.delivery_type === 'home') {
      try {
        const saved = localStorage.getItem('almiraj_zr_source_hub_id') || '';
        if (saved && data.source_hubs.some((h) => h.id === saved)) setSourceHubId(saved);
      } catch { /* ignore */ }
    }

    setStage('zr');
  };

  useEffect(() => {
    const listener = (event: Event) => {
      const detail = (event as CustomEvent<DeliverySelectionRequest>).detail;
      if (!detail?.orderId || typeof detail.resolve !== 'function') return;
      setRequest(detail);
      setError('');
      setPrepared(null);
      setSourceHubId('');
      setPickupHubId('');

      if (detail.mode === 'resend') {
        setStage('loading');
        void apiCall(detail.authorization, { action: 'delivery_provider_info', id: detail.orderId }).then((result) => {
          if (!result.ok || !result.data?.provider) {
            setError(result.message || result.error || 'تعذر تحديد شركة التوصيل السابقة.');
            setStage('provider');
            return;
          }
          if (result.data.provider === 'noest') {
            detail.resolve({ provider: 'noest' });
            reset();
            return;
          }
          void loadZrPreparation(detail);
        });
      } else {
        setStage('provider');
      }
    };

    window.addEventListener(DELIVERY_SELECTION_EVENT, listener);
    return () => window.removeEventListener(DELIVERY_SELECTION_EVENT, listener);
    // The helper functions intentionally use the request captured by each event.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sourceHubs = useMemo(() => prepared?.source_hubs || [], [prepared]);
  const pickupHubs = useMemo(() => prepared?.pickup_hubs || [], [prepared]);

  if (!request) return null;

  const destinationName = prepared
    ? `${prepared.destination.commune.nameArabic || prepared.destination.commune.name} — ${prepared.destination.wilaya.nameArabic || prepared.destination.wilaya.name}`
    : '';

  return (
    <div className="fixed inset-0 z-[12000] bg-black/60 flex items-center justify-center p-4" dir="rtl">
      <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-[#111827] shadow-2xl overflow-hidden border border-gray-200 dark:border-gray-700">
        <div className="px-5 py-4 bg-[#0B1833] text-white flex items-center justify-between gap-3">
          <div>
            <h2 className="font-bold text-lg">🚚 اختيار شركة التوصيل</h2>
            <p className="text-xs text-blue-200 mt-1">الطلب: {request.orderId}</p>
          </div>
          <button type="button" onClick={() => finish(null)} className="w-9 h-9 rounded-full hover:bg-white/10 text-xl" aria-label="إلغاء">×</button>
        </div>

        <div className="p-5">
          {error && (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 dark:bg-red-950/30 dark:border-red-900 p-3 text-sm text-red-700 dark:text-red-300">
              {error}
            </div>
          )}

          {stage === 'loading' && (
            <div className="py-10 text-center">
              <div className="text-4xl mb-3 animate-pulse">🚚</div>
              <p className="font-bold text-gray-700 dark:text-gray-200">جاري قراءة بيانات شركة التوصيل…</p>
              <p className="text-xs text-gray-500 mt-2">لا يتم إنشاء أي شحنة في هذه الخطوة.</p>
            </div>
          )}

          {stage === 'provider' && (
            <div className="space-y-4">
              <p className="text-sm text-gray-600 dark:text-gray-300">اختر الشركة التي تريد إرسال هذا الطلب إليها:</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => finish({ provider: 'noest' })}
                  className="rounded-2xl border-2 border-blue-200 dark:border-blue-900 p-5 text-right hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-950/30 transition-all"
                >
                  <div className="font-extrabold text-[#0B1833] dark:text-blue-200 text-lg">NOEST</div>
                  <div className="text-xs text-gray-500 mt-1">الربط الحالي</div>
                </button>
                <button
                  type="button"
                  onClick={() => void loadZrPreparation(request)}
                  className="rounded-2xl border-2 border-amber-200 dark:border-amber-900 p-5 text-right hover:border-amber-500 hover:bg-amber-50 dark:hover:bg-amber-950/30 transition-all"
                >
                  <div className="font-extrabold text-[#0B1833] dark:text-amber-200 text-lg">ZR Express</div>
                  <div className="text-xs text-gray-500 mt-1">API الجديدة v1</div>
                </button>
              </div>
              <button type="button" onClick={() => finish(null)} className="w-full py-2.5 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 font-bold">إلغاء</button>
            </div>
          )}

          {stage === 'zr' && prepared && (
            <div className="space-y-4">
              <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900 p-3 text-sm">
                <div className="font-bold text-emerald-800 dark:text-emerald-300">✅ تمّت مطابقة وجهة ZR Express</div>
                <div className="text-emerald-700 dark:text-emerald-400 mt-1">{destinationName}</div>
              </div>

              {prepared.delivery_type === 'home' ? (
                <div>
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-200 mb-2">مركز ZR المصدر *</label>
                  <select
                    value={sourceHubId}
                    onChange={(e) => setSourceHubId(e.target.value)}
                    className="w-full border border-gray-300 dark:border-gray-700 dark:bg-gray-900 dark:text-white rounded-xl p-3"
                  >
                    <option value="">— اختر المركز الذي تُسلّم منه طرود المعراج —</option>
                    {sourceHubs.map((h) => <option key={h.id} value={h.id}>{hubLabel(h)}</option>)}
                  </select>
                  <p className="text-xs text-gray-500 mt-2">سيُحفظ اختيارك محليًا على هذا الجهاز لتسهيل الطلبات القادمة، ويمكن تغييره قبل كل إرسال.</p>
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-200 mb-2">مكتب ZR للاستلام *</label>
                  <select
                    value={pickupHubId}
                    onChange={(e) => setPickupHubId(e.target.value)}
                    className="w-full border border-gray-300 dark:border-gray-700 dark:bg-gray-900 dark:text-white rounded-xl p-3"
                  >
                    <option value="">— اختر مكتب ZR في وجهة العميل —</option>
                    {pickupHubs.map((h) => <option key={h.id} value={h.id}>{hubLabel(h)}</option>)}
                  </select>
                  {pickupHubs.length === 0 && <p className="text-xs text-red-600 mt-2">لم تُرجع ZR أي Pickup Point مطابق لهذه الوجهة. لن نرسل الطلب حتى تتوفر مطابقة آمنة.</p>}
                </div>
              )}

              <div className="rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 p-3 text-xs text-amber-800 dark:text-amber-300">
                سيتم إنشاء الشحنة فقط بعد الضغط على «تأكيد الإرسال». فتح هذه النافذة وجلب المراكز عملية قراءة فقط.
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (prepared.delivery_type === 'home') {
                      if (!sourceHubId) { setError('اختر مركز ZR المصدر أولاً.'); return; }
                      try { localStorage.setItem('almiraj_zr_source_hub_id', sourceHubId); } catch { /* ignore */ }
                      finish({ provider: 'zrexpress', source_hub_id: sourceHubId });
                    } else {
                      if (!pickupHubId) { setError('اختر مكتب ZR للاستلام أولاً.'); return; }
                      finish({ provider: 'zrexpress', pickup_hub_id: pickupHubId });
                    }
                  }}
                  disabled={prepared.delivery_type === 'office' && pickupHubs.length === 0}
                  className="flex-1 py-3 rounded-xl bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white font-extrabold"
                >
                  تأكيد الإرسال إلى ZR Express
                </button>
                {request.mode === 'send' ? (
                  <button type="button" onClick={() => { setError(''); setPrepared(null); setStage('provider'); }} className="px-4 py-3 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 font-bold">رجوع</button>
                ) : (
                  <button type="button" onClick={() => finish(null)} className="px-4 py-3 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 font-bold">إلغاء</button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
