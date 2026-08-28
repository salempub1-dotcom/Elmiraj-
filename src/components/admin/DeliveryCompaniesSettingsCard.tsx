import { useEffect, useState } from 'react';
import {
  fetchDeliveryProviderSettings,
  saveDeliveryProviderSettings,
  type DeliveryProviderSettings,
} from '../../services/deliveryCheckout';

const DEFAULTS: DeliveryProviderSettings = { noest: true, zrexpress: true, whatsappConfirmation: false };

type DeliveryVisibilityMode = 'noest' | 'zrexpress' | 'both';

function settingsToMode(settings: DeliveryProviderSettings): DeliveryVisibilityMode {
  if (settings.noest && settings.zrexpress) return 'both';
  return settings.zrexpress ? 'zrexpress' : 'noest';
}

function modeToSettings(mode: DeliveryVisibilityMode, current: DeliveryProviderSettings): DeliveryProviderSettings {
  if (mode === 'noest') return { ...current, noest: true, zrexpress: false };
  if (mode === 'zrexpress') return { ...current, noest: false, zrexpress: true };
  return { ...current, noest: true, zrexpress: true };
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
        if (!cancelled) setError('تعذر تحميل إعدادات المتجر.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const mode = settingsToMode(settings);
  const savedMode = settingsToMode(saved);
  const dirty = mode !== savedMode || settings.whatsappConfirmation !== saved.whatsappConfirmation;

  const selectMode = (nextMode: DeliveryVisibilityMode) => {
    if (loading || saving) return;
    setMessage('');
    setError('');
    setSettings(modeToSettings(nextMode, settings));
  };

  const toggleWhatsApp = () => {
    if (loading || saving) return;
    setMessage('');
    setError('');
    setSettings((current) => ({ ...current, whatsappConfirmation: !current.whatsappConfirmation }));
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
      setMessage('تم تحديث إعدادات المتجر الظاهرة للزبون.');
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

      <div className="mt-6 pt-5 border-t border-gray-200 dark:border-gray-700">
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-emerald-200 dark:border-emerald-900/70 bg-emerald-50/60 dark:bg-emerald-950/20 p-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xl">💬</span>
              <h4 className="font-extrabold text-gray-800 dark:text-gray-50">تأكيد الطلب عبر WhatsApp</h4>
              <span className={`text-[11px] font-extrabold px-2.5 py-1 rounded-full ${settings.whatsappConfirmation
                ? 'bg-emerald-500 text-white'
                : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300'}`}>
                {settings.whatsappConfirmation ? 'ظاهر للزبون' : 'مخفي'}
              </span>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1.5 leading-5">
              عند التفعيل يظهر خيار موافقة WhatsApp في صفحة تأكيد الطلب. عند الإخفاء لا يظهر الخيار ولا تُرسل رسالة WhatsApp حتى لو كانت إعدادات Meta جاهزة.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={settings.whatsappConfirmation}
            disabled={loading || saving}
            onClick={toggleWhatsApp}
            className={`shrink-0 min-w-28 px-4 py-2.5 rounded-xl text-sm font-extrabold transition-all disabled:opacity-60 ${settings.whatsappConfirmation
              ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
              : 'bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-100'}`}
          >
            {settings.whatsappConfirmation ? 'إخفاء الميزة' : 'إظهار الميزة'}
          </button>
        </div>
      </div>

      {dirty && !error && (
        <div className="mt-3 text-xs font-bold text-amber-700 dark:text-amber-300">
          لديك تغييرات غير محفوظة.
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
          {saving ? '⏳ جارٍ الحفظ...' : '💾 تطبيق الإعدادات في المتجر'}
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
