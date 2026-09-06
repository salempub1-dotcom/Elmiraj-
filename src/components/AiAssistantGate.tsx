import { useEffect, useState } from 'react';
import { fetchDeliveryProviderSettings } from '../services/deliveryCheckout';
import AiAssistant from './AiAssistant';

const REFRESH_INTERVAL_MS = 30_000;

export default function AiAssistantGate() {
  const [enabled, setEnabled] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;

    const refresh = async () => {
      try {
        const settings = await fetchDeliveryProviderSettings();
        if (!cancelled) setEnabled(settings.assistant !== false);
      } catch {
        // Fail closed after the first successful/explicit state: if settings
        // cannot be verified, don't unexpectedly expose a disabled assistant.
        if (!cancelled) setEnabled((current) => current ?? false);
      }
    };

    void refresh();
    const interval = window.setInterval(() => void refresh(), REFRESH_INTERVAL_MS);
    const onVisible = () => { if (document.visibilityState === 'visible') void refresh(); };
    const onSettingsChanged = () => void refresh();

    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('miraj:storefront-settings-changed', onSettingsChanged);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('miraj:storefront-settings-changed', onSettingsChanged);
    };
  }, []);

  if (enabled !== true) return null;
  return <AiAssistant />;
}
