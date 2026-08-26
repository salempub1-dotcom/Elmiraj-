const PREFIX = '@DP1:';

export function decodeCheckoutDeliverySelection(value) {
  const raw = String(value || '');
  if (!raw.startsWith(PREFIX)) return null;
  const rest = raw.slice(PREFIX.length);
  const [providerRaw, idRaw = '', ...nameParts] = rest.split(':');
  if (providerRaw !== 'noest' && providerRaw !== 'zrexpress') return null;
  try {
    return {
      provider: providerRaw,
      officeId: decodeURIComponent(idRaw) || null,
      officeName: decodeURIComponent(nameParts.join(':')) || null,
    };
  } catch {
    return { provider: providerRaw, officeId: null, officeName: null };
  }
}

export function checkoutPreferredProvider(order) {
  return decodeCheckoutDeliverySelection(order?.selected_office)?.provider || null;
}

export function checkoutOfficeId(order) {
  const decoded = decodeCheckoutDeliverySelection(order?.selected_office);
  if (decoded) return decoded.officeId || null;
  // Backward compatibility with old NOEST rows: "CODE — Name".
  const legacy = String(order?.selected_office || '').split(' — ')[0].trim();
  return legacy || null;
}
