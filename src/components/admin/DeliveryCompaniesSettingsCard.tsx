import { useEffect, useState } from 'react';
import {
  fetchDeliveryProviderSettings,
  saveDeliveryProviderSettings,
  type DeliveryProviderSettings,
} from '../../services/deliveryCheckout';

const DEFAULTS: DeliveryProviderSettings = { noest: true, zrexpress: true };

export default function DeliveryCompaniesSettingsCard() {
  const [settings, setSettings] = useState<DeliveryProviderSettings>(DEFAULTS);
  const [saved, setSaved] = useState<DeliveryProviderSettings>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    void fetchDeliveryProviderSettings().then((next) => {
      if (cancelled) return;
      setSettings(next);
      setSaved(next);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  const toggle = (key: keyof DeliveryProviderSettings) => {
    setMessage('');
    setError('');
    setSettings((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      if (!next.noest && !next.zrexpress) {
        setError('يجب إبقاء شركة توصيل واحدة على الأقل مفعّلة في المتجر.');
        return prev;
      }
      return next;
    });
  };

  const dirty = settings.noest !== saved.noest || settings.zrexpress !== saved.zrexpress;

  const save = async () => {
    if (!settings.noest && !settings.zrexpress) {
      setError('يجب إبقاء شركة توصيل واحدة على الأقل مفعّلة.');
      return;
    }
    setSaving(true);
    setMessage('');
    setError('');
    const result = await saveDeliveryProviderSettings(settings);
    setSaving(false);
    if (result.ok && result.data) {
      setSettings(result.data);
      setSaved(result.data);
      setMessage('تم حفظ الشركات الظاهرة للزبون بنجاح.');
    } else {
      setError(result.message || 'تعذر حفظ الإعدادات.');
    }
  };

  const enabledCount = Number(settings.noest) + Number(settings.zrexpress);

  return (
    <section className="rounded-2xl border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5" dir="rtl">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
        <div>
          <h3 className="text-lg font-extrabold text-gray-800 dark:text-gray-50">🚚 شركات التوصيل في المتجر</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            تحكّم في الشركات التي يستطيع الزبون اختيارها أثناء إنشاء الطلب.
          </p>
        </div>
        <span className="text-xs font-bold px-3 py-1.5 rounded-full bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300">
          {loading ? 'جاري التحميل...' : `${enabledCount} مفعّلة`}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <ProviderToggle
          title="NOEST"
          subtitle="تظهر للزبون مع مكاتب Noest حسب الولاية"
          enabled={settings.noest}
          disabled={loading || saving}
          onClick={() => toggle('noest')}
        />
        <ProviderToggle
          title="ZR Express"
          subtitle="تظهر للزبون مع مكاتب ZR Express المتاحة لوجهته"
          enabled={settings.zrexpress}
          disabled={loading || saving}
          onClick={() => toggle('zrexpress')}
        />
      </div>

      <div className="mt-4 rounded-xl bg-gray-50 dark:bg-gray-900/60 p-3 text-xs text-gray-600 dark:text-gray-300 leading-6">
        إذا فعّلت شركة واحدة فقط، سيظهر للزبون خيارها وحده. وإذا فعّلت الشركتين، يختار الزبون الشركة أولًا ثم تظهر إعدادات ومكاتب الشركة المختارة.
      </div>

      {error && <div className="mt-3 rounded-xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 p-3 text-sm font-bold text-red-700 dark:text-red-300">{error}</div>}
      {message && <div className="mt-3 rounded-xl border border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/30 p-3 text-sm font-bold text-emerald-700 dark:text-emerald-300">✅ {message}</div>}

      <div className="mt-4 flex justify-end">
        <button
          type="button"
          disabled={!dirty || loading || saving}
          onClick={() => void save()}
          className="px-5 py-2.5 rounded-xl bg-[#102A52] hover:bg-[#0B1833] disabled:bg-gray-300 dark:disabled:bg-gray-700 disabled:cursor-not-allowed text-white text-sm font-extrabold transition-all"
        >
          {saving ? '⏳ جارٍ الحفظ...' : '💾 حفظ إعدادات شركات التوصيل'}
        </button>
      </div>
    </section>
  );
}

function ProviderToggle({ title, subtitle, enabled, disabled, onClick }: {
  title: string;
  subtitle: string;
  enabled: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      disabled={disabled}
      onClick={onClick}
      className={`w-full rounded-2xl border-2 p-4 text-right transition-all disabled:opacity-60 ${enabled
        ? 'border-emerald-300 dark:border-emerald-800 bg-emerald-50/60 dark:bg-emerald-950/20'
        : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40'}`}
    >
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="font-extrabold text-gray-800 dark:text-gray-50">{title}</div>
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">{subtitle}</div>
        </div>
        <span className={`relative inline-flex w-12 h-7 rounded-full transition-colors shrink-0 ${enabled ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-gray-600'}`}>
          <span className={`absolute top-1 w-5 h-5 rounded-full bg-white shadow transition-transform ${enabled ? 'translate-x-1' : 'translate-x-6'}`} />
        </span>
      </div>
      <div className={`mt-3 text-xs font-bold ${enabled ? 'text-emerald-700 dark:text-emerald-300' : 'text-gray-400'}`}>
        {enabled ? '✅ ظاهرة للزبون' : '⛔ مخفية من المتجر'}
      </div>
    </button>
  );
}
