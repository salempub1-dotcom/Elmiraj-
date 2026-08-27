import fs from 'node:fs';

const path = 'scripts/verify-delivery-integration.mjs';
let source = fs.readFileSync(path, 'utf8');
const bad = "assert.match(appSource, /إرسال إلى \\{providerLabel\\}/);";
const good = "assert.ok(appSource.includes('إرسال إلى ${providerLabel}'));";
if (source.includes(bad)) {
  source = source.replace(bad, good);
  fs.writeFileSync(path, source);
  console.log('✅ Fixed compact card verifier pattern.');
} else if (source.includes(good)) {
  console.log('Verifier pattern already fixed.');
} else {
  console.log('Verifier line not present yet; no change needed before patching.');
}
