import fs from 'node:fs';

const file = 'lib/deliveryProviders.js';
let s = fs.readFileSync(file, 'utf8');

s = s.replace(
`function safeMessage(data, fallback) {
  if (!data || typeof data !== 'object') return fallback;
  return String(data.message || data.detail || data.title || fallback).slice(0, 500);
}`,
`function safeMessage(data, fallback) {
  if (!data || typeof data !== 'object') return fallback;
  const errors = data.errors && typeof data.errors === 'object' ? data.errors : null;
  if (errors) {
    const details = Object.entries(errors)
      .flatMap(([field, messages]) => {
        const list = Array.isArray(messages) ? messages : [messages];
        return list.filter(Boolean).map((message) => \`${'${field}'}: ${'${String(message)}'}\`);
      })
      .slice(0, 8)
      .join(' | ');
    if (details) return details.slice(0, 900);
  }
  return String(data.message || data.detail || data.title || fallback).slice(0, 900);
}`
);

s = s.replace(
`function normalizeAlgerianPhone(value) {
  let p = String(value || '').trim().replace(/[\\s().-]/g, '');
  if (p.startsWith('00213')) p = \`+213${'${p.slice(5)}'}\`;
  else if (p.startsWith('213')) p = \`+${'${p}'}\`;
  else if (p.startsWith('0')) p = \`+213${'${p.slice(1)}'}\`;
  if (!p.startsWith('+')) p = \`+213${'${p}'}\`;
  return p;
}`,
`function normalizeAlgerianPhone(value) {
  let p = String(value || '').trim().replace(/[^0-9+]/g, '');
  if (p.startsWith('+213')) p = \`0${'${p.slice(4)}'}\`;
  else if (p.startsWith('00213')) p = \`0${'${p.slice(5)}'}\`;
  else if (p.startsWith('213')) p = \`0${'${p.slice(3)}'}\`;
  else if (!p.startsWith('0')) p = \`0${'${p}'}\`;
  return p;
}`
);

const productNeedle = `? items.map((i) => ({\n        productName: String(i.name || 'منتج المعراج'),`;
const productReplacement = `? items.map((i) => ({\n        productId: randomUUID(),\n        productName: String(i.name || 'منتج المعراج'),`;
if (s.includes(productNeedle) && !s.includes(`? items.map((i) => ({\n        productId: randomUUID(),`)) {
  s = s.replace(productNeedle, productReplacement);
}

s = s.replace(
`        height: 1,\n        stockType: 'none',`,
`        height: 1,\n        weight: 1,\n        stockType: 'none',`
);

s = s.replace(
`: [{ productName: 'منتجات المعراج', unitPrice: Number(order.total) || 0, quantity: 1, length: 1, width: 1, height: 1, stockType: 'none' }];`,
`: [{ productId: randomUUID(), productName: 'منتجات المعراج', unitPrice: Number(order.total) || 0, quantity: 1, length: 1, width: 1, height: 1, weight: 1, stockType: 'none' }];`
);

fs.writeFileSync(file, s);
console.log('Patched ZR validation diagnostics + phone/product payload');
