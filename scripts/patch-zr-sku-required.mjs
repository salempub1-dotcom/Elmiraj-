import fs from 'node:fs';

const providerFile = 'lib/deliveryProviders.js';
const verifyFile = 'scripts/verify-delivery-integration.mjs';

let s = fs.readFileSync(providerFile, 'utf8');

if (!s.includes('function sanitizeZrProductSku(')) {
  const marker = `function sanitizeZrProductName(value, fallback = 'Produit') {\n  const clean = String(value || '')\n    .replace(/[\\[\\]{}<>]/g, ' ')\n    .replace(/[|]/g, ' ')\n    .replace(/\\s+/g, ' ')\n    .trim();\n  return (clean || fallback).slice(0, 120);\n}`;
  const replacement = `${marker}\n\nfunction sanitizeZrProductSku(value, fallback = 'ALMIRAJ-ITEM') {\n  const clean = String(value || fallback || 'ALMIRAJ-ITEM')\n    .toUpperCase()\n    .replace(/[^A-Z0-9_-]+/g, '-')\n    .replace(/-+/g, '-')\n    .replace(/^[-_]+|[-_]+$/g, '')\n    .trim();\n  return (clean || 'ALMIRAJ-ITEM').slice(0, 80);\n}`;
  if (!s.includes(marker)) throw new Error('Product-name sanitizer marker not found');
  s = s.replace(marker, replacement);
}

const mapOld = `? items.map((i) => ({\n        productId: randomUUID(),\n        productName: sanitizeZrProductName(i.name, 'Produit'),\n        productSku: null,`;
const mapNew = `? items.map((i, index) => ({\n        productId: randomUUID(),\n        productName: sanitizeZrProductName(i.name, 'Produit'),\n        productSku: sanitizeZrProductSku(\n          i.productSku || i.sku,\n          \`ALMIRAJ-\${order.tracking || order.id || 'ORDER'}-\${String(index + 1).padStart(2, '0')}\`,\n        ),`;
if (s.includes(mapOld)) s = s.replace(mapOld, mapNew);
else if (!s.includes(`productSku: sanitizeZrProductSku(`)) throw new Error('ZR item mapping marker not found');

const fallbackOld = `: [{ productId: randomUUID(), productName: 'Produit', productSku: null, unitPrice: Number(order.total) || 0, quantity: 1, length: 1, width: 1, height: 1, weight: 1, stockType: 'local' }];`;
const fallbackNew = `: [{ productId: randomUUID(), productName: 'Produit', productSku: sanitizeZrProductSku(null, \`ALMIRAJ-\${order.tracking || order.id || 'ORDER'}-01\`), unitPrice: Number(order.total) || 0, quantity: 1, length: 1, width: 1, height: 1, weight: 1, stockType: 'local' }];`;
if (s.includes(fallbackOld)) s = s.replace(fallbackOld, fallbackNew);
else if (!s.includes(`productSku: sanitizeZrProductSku(null`)) throw new Error('ZR fallback product marker not found');

if (s.includes('productSku: null')) throw new Error('A null ZR productSku remains in deliveryProviders.js');

fs.writeFileSync(providerFile, s);

let v = fs.readFileSync(verifyFile, 'utf8');
// Remove the obsolete assertion from the previous nullable-SKU assumption.
v = v.replace(/\n?assert\.match\(providerSource, \/productSku: null\/\);/g, '');

const verifyMarker = `assert.match(providerSource, /weight: \\{ weight: 1, dimensionalWeight: null \\}/);`;
const verifyInsert = `${verifyMarker}\nassert.match(providerSource, /function sanitizeZrProductSku/);\nassert.match(providerSource, /productSku: sanitizeZrProductSku/);\nassert.doesNotMatch(providerSource, /productSku: null/);`;
if (!v.includes('assert.match(providerSource, /function sanitizeZrProductSku/);')) {
  if (!v.includes(verifyMarker)) throw new Error('Verification marker not found');
  v = v.replace(verifyMarker, verifyInsert);
}
fs.writeFileSync(verifyFile, v);

console.log('Patched ZR SKU requirement and verification');
