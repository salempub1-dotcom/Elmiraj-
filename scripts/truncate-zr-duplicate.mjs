import fs from 'node:fs';

const file = 'lib/deliveryProviders.js';
let src = fs.readFileSync(file, 'utf8');
const marker = "export function isParcelInDeliveryNetwork(group) {\n  return group !== 'in_preparation' && group !== 'unknown';\n}";
const first = src.indexOf(marker);
if (first < 0) throw new Error('Canonical end marker not found');
const end = first + marker.length;
const trailing = src.slice(end).trim();
if (!trailing) {
  console.log('No trailing duplicate found.');
  process.exit(0);
}
src = src.slice(0, end) + '\n';
fs.writeFileSync(file, src);
console.log(`✅ Removed ${trailing.length} bytes of duplicated/corrupted trailing ZR code`);
