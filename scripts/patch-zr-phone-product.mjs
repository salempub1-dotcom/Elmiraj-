import fs from 'node:fs';

const file = 'lib/deliveryProviders.js';
let s = fs.readFileSync(file, 'utf8');

const oldPhone = `function normalizeAlgerianPhone(value) {
  let p = String(value || '').trim().replace(/[^0-9+]/g, '');
  if (p.startsWith('+213')) p = \`0\${p.slice(4)}\`;
  else if (p.startsWith('00213')) p = \`0\${p.slice(5)}\`;
  else if (p.startsWith('213')) p = \`0\${p.slice(3)}\`;
  else if (!p.startsWith('0')) p = \`0\${p}\`;
  return p;
}`;

const newPhone = `function normalizeAlgerianPhone(value) {
  let p = String(value || '').trim().replace(/[^0-9+]/g, '');
  if (p.startsWith('+213')) p = p.slice(4);
  else if (p.startsWith('00213')) p = p.slice(5);
  else if (p.startsWith('213')) p = p.slice(3);
  else if (p.startsWith('0')) p = p.slice(1);
  p = p.replace(/\\D/g, '');
  return p.length === 9 ? \`+213\${p}\` : '';
}

function sanitizeZrProductName(value, fallback = 'Produit') {
  const clean = String(value || '')
    .replace(/[\\[\\]{}<>]/g, ' ')
    .replace(/[|]/g, ' ')
    .replace(/\\s+/g, ' ')
    .trim();
  return (clean || fallback).slice(0, 120);
}`;

if (!s.includes(oldPhone)) throw new Error('Expected phone normalizer not found');
s = s.replace(oldPhone, newPhone);

s = s.replace(
`  const items = Array.isArray(order.items) ? order.items : [];
  const description = items.map((i) => \`\${i.name || 'منتج'} x\${Number(i.quantity) || 1}\`).join(', ') || 'منتجات المعراج';
  const orderedProducts = items.length > 0`,
`  const items = Array.isArray(order.items) ? order.items : [];
  const orderedProducts = items.length > 0`
);

s = s.replace(
`        productName: String(i.name || 'منتج المعراج'),
        unitPrice: Number(i.price) || 0,`,
`        productName: sanitizeZrProductName(i.name, 'Produit'),
        productSku: null,
        unitPrice: Number(i.price) || 0,`
);

s = s.replaceAll(`        stockType: 'none',`, `        stockType: 'local',`);

s = s.replace(
`: [{ productId: randomUUID(), productName: 'منتجات المعراج', unitPrice: Number(order.total) || 0, quantity: 1, length: 1, width: 1, height: 1, weight: 1, stockType: 'none' }];`,
`: [{ productId: randomUUID(), productName: 'Produit', productSku: null, unitPrice: Number(order.total) || 0, quantity: 1, length: 1, width: 1, height: 1, weight: 1, stockType: 'local' }];`
);

const marker = `  const payload = {`;
const guard = `  const zrPhone = normalizeAlgerianPhone(order.phone);
  if (!/^\\+213[5-7]\\d{8}$/.test(zrPhone)) {
    return { ok: false, error: 'ZR_PHONE_INVALID', message: 'رقم هاتف العميل غير صالح لـ ZR Express. يجب أن يكون رقمًا جزائريًا صحيحًا يبدأ بـ 05 أو 06 أو 07.' };
  }
  const description = orderedProducts.map((p) => p.productName).filter(Boolean).join(' / ') || 'Produits El Miraj';

  const payload = {`;
if (!s.includes(marker)) throw new Error('Payload marker not found');
s = s.replace(marker, guard);

s = s.replace(`      phone: { number1: normalizeAlgerianPhone(order.phone) },`, `      phone: { number1: zrPhone, number2: null, number3: null },`);
s = s.replace(`    weight: { weight: 1 },`, `    weight: { weight: 1, dimensionalWeight: null },`);

fs.writeFileSync(file, s);
console.log('Patched ZR phone + product payload');
