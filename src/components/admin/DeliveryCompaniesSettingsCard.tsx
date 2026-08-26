import { useEffect, useState } from 'react';
import {
  fetchDeliveryProviderSettings,
  saveDeliveryProviderSettings,
  type DeliveryProviderSettings,
} from '../../services/deliveryCheckout';

const DEFAULTS: DeliveryProviderSettings = { noest: true, zrexpress: true };

type DeliveryVisibilityMode = 'noest' | 'zrexpress' | 'both';

function settingsToMode(settings: DeliveryProviderSettings): DeliveryVisibilityMode {
  if (settings.noest && settings.zrexpress) return 'both';
  return settings.zrexpress ? 'zrexpress' : 'noest';
}

function modeToSettings(mode: DeliveryVisibilityMode): DeliveryProviderSettings {
  if (mode === 'noest') return { noest: true, zrexpress: false };
  if (mode === 'zrexpress') return { noest: false, zrexpress: true };
  return { noest: true, zrexpress: true };
}

export default function DeliveryCompaniesSettingsCard() {
  const [settings, setSettings] = useState<DeliveryProviderSettings>(DEFAULTS);
  const [saved, setSaved] = useState<DeliveryProviderSettings>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    void fetchDeliveryProviderSettings()
      .then((next) => {
        if (cancelled) return;
        setSettings(next);
        setSaved(next);
      })
      .catch(() => {
        if (!cancelled) setError('تعذر تحميل إعدادات شركات التوصيل.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const mode = settingsToMode(settings);
  const savedMode = settingsToMode(saved);
  const dirty = mode !== savedMode;

  const selectMode = (nextMode: DeliveryVisibilityMode) => {
    if (loading || saving) return;
    setMessage('');
    setError('');
    setSettings(modeToSettings(nextMode));
  };

  const save = async () => {
    setSaving(true);
    setMessage('');
    setError('');
    const result = await saveDeliveryProviderSettings(settings);
    setSaving(false);

    if (result.ok && result.data) {
      setSettings(result.data);
      setSaved(result.data);
      setMessage('تم تحديث شركات التوصيل الظاهرة للزبون.');
    } else {
      setError(result.message || 'تعذر حفظ الإعدادات.');
    }
  };

  const currentLabel = mode === 'both'
    ? 'NOEST + ZR Express'
    : mode === 'noest'
      ? 'NOEST فقط'
      : 'ZR Express فقط';

  return (
    <section className="rounded-2xl border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5" dir="rtl">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
        <div>
          <h3 className="text-lg font-extrabold text-gray-800 dark:text-gray-50">🚚 شركات التوصيل الظاهرة في المتجر</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            اختر ما يراه الزبون أثناء تأكيد الطلب. لا يمكن إخفاء الشركتين معًا.
          </p>
        </div>
        <span className="text-xs font-bold px-3 py-1.5 rounded-full bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300">
          {loading ? 'جاري التحميل...' : currentLabel}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <ModeOption
          title="NOEST فقط"
          subtitle="يظهر خيار NOEST وحده للزبون"
          icon="🔵"
          selected={mode === 'noest'}
          disabled={loading || saving}
          onClick={() => selectMode('noest')}
        />
        <ModeOption
          title="ZR Express فقط"
          subtitle="يظهر خيار ZR Express وحده للزبون"
          icon="🟠"
          selected={mode === 'zrexpress'}
          disabled={loading || saving}
          onClick={() => selectMode('zrexpress')}
        />
        <ModeOption
          title="الشركتان"
          subtitle="الزبون يختار NOEST أو ZR Express"
          icon="🚚"
          selected={mode === 'both'}
          disabled={loading || saving}
          onClick={() => selectMode('both')}
        />
      </div>

      <div className="mt-4 rounded-xl border border-blue-100 dark:border-blue-900/60 bg-blue-50/60 dark:bg-blue-950/20 p-3 text-xs text-blue-800 dark:text-blue-200 leading-6">
        💡 إذا اخترت شركة واحدة فقط فلن نطلب من الزبون اختيار شركة التوصيل، وسيكمل مباشرة إلى نوع التوصيل والمكتب عند الحاجة. اختيار «الشركتان» يعرض له المقارنة والاختيار بينهما.
      </div>

      {dirty && !error && (
        <div className="mt-3 text-xs font-bold text-amber-700 dark:text-amber-300">
          لديك تغيير غير محفوظ: {currentLabel}
        </div>
      )}
      {error && <div className="mt-3 rounded-xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 p-3 text-sm font-bold text-red-700 dark:text-red-300">{error}</div>}
      {message && <div className="mt-3 rounded-xl border border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/30 p-3 text-sm font-bold text-emerald-700 dark:text-emerald-300">✅ {message}</div>}

      <div className="mt-4 flex justify-end">
        <button
          type="button"
          disabled={!dirty || loading || saving}
          onClick={() => void save()}
          className="px-5 py-2.5 rounded-xl bg-[#102A52] hover:bg-[#0B1833] disabled:bg-gray-300 dark:disabled:bg-gray-700 disabled:cursor-not-allowed text-white text-sm font-extrabold transition-all"
        >
          {saving ? '⏳ جارٍ الحفظ...' : '💾 تطبيق الاختيار في المتجر'}
        </button>
      </div>
    </section>
  );
}

function ModeOption({ title, subtitle, icon, selected, disabled, onClick }: {
  title: string;
  subtitle: string;
  icon: string;
  selected: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      disabled={disabled}
      onClick={onClick}
      className={`relative w-full rounded-2xl border-2 p-4 text-right transition-all disabled:opacity-60 ${selected
        ? 'border-emerald-400 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-950/20 shadow-sm'
        : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40 hover:border-blue-300 dark:hover:border-blue-700'}`}
    >
      {selected && (
        <span className="absolute top-3 left-3 text-xs font-extrabold px-2 py-1 rounded-full bg-emerald-500 text-white">
          مفعّل
        </span>
      )}
      <div className="text-2xl mb-3">{icon}</div>
      <div className="font-extrabold text-gray-800 dark:text-gray-50">{title}</div>
      <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 leading-5">{subtitle}</div>
    </button>
  );
}
