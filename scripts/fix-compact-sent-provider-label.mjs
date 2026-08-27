import fs from 'node:fs';

const path = 'src/App.tsx';
let source = fs.readFileSync(path, 'utf8');
const before = "    ? (String(order.noestId).startsWith('ZR:') ? 'ZR Express' : providerLabel)\n";
const after = "    ? (String(order.noestId).startsWith('ZR:') ? 'ZR Express' : 'NOEST')\n";
if (source.includes(before)) {
  source = source.replace(before, after);
  fs.writeFileSync(path, source);
  console.log('✅ Sent courier label now comes from the provider-aware delivery reference.');
} else if (source.includes(after)) {
  console.log('Sent courier label already fixed.');
} else {
  throw new Error('Could not find sent courier label expression.');
}
