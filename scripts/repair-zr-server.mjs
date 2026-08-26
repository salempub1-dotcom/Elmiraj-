import fs from 'node:fs';

// 1) Remove the temporary Preview diagnostics block that became corrupted,
// keeping only the permanent, safe workflow diagnostics used by the resolver.
{
  const file = 'lib/deliveryProviders.js';
  let src = fs.readFileSync(file, 'utf8');
  const startMarker = 'function collectZrWorkflowPrimitivePaths(root) {';
  const endMarker = 'async function resolveReadyToDispatchStateId() {';
  const start = src.indexOf(startMarker);
  const end = src.indexOf(endMarker);
  if (start < 0 || end <= start) throw new Error('ZR diagnostic repair markers not found');

  const cleanDiagnostics = [
    'function collectZrWorkflowDiagnostics(root) {',
    '  const labels = new Set();',
    "  const topKeys = root && typeof root === 'object' && !Array.isArray(root) ? Object.keys(root).slice(0, 20) : [];",
    '  const queue = [root];',
    '  const seen = new WeakSet();',
    '  let visited = 0;',
    '',
    '  while (queue.length && visited < 2_000 && labels.size < 30) {',
    '    const value = queue.shift();',
    "    if (!value || typeof value !== 'object') continue;",
    '    if (seen.has(value)) continue;',
    '    seen.add(value);',
    '    visited += 1;',
    '',
    '    if (Array.isArray(value)) {',
    '      queue.push(...value);',
    '      continue;',
    '    }',
    '',
    '    for (const [key, child] of Object.entries(value)) {',
    "      if (typeof child === 'string') {",
    '        const keyToken = normalizeZrWorkflowToken(key);',
    "        if (/name|state|status|code|key|slug|title|label/.test(keyToken)) {",
    '          const clean = child.trim().slice(0, 80);',
    '          if (clean) labels.add(clean);',
    '        }',
    "      } else if (child && typeof child === 'object') {",
    '        queue.push(child);',
    '      }',
    '    }',
    '  }',
    '  return { topKeys, labels: [...labels].slice(0, 30), visited };',
    '}',
    '',
  ].join('\n');

  src = src.slice(0, start) + cleanDiagnostics + src.slice(end);
  fs.writeFileSync(file, src);
}

// 2) Remove the temporary GET ?debug=zr-workflows endpoint and import.
{
  const file = 'api/noest.js';
  let src = fs.readFileSync(file, 'utf8');
  src = src.replace(
    "import { diagnoseZrWorkflows, getZrDeliveryQuote, getZrSafeConfig, prepareZrOrder } from '../lib/deliveryProviders.js';",
    "import { getZrDeliveryQuote, getZrSafeConfig, prepareZrOrder } from '../lib/deliveryProviders.js';",
  );
  const debugBlock = [
    "    if (req.query?.debug === 'zr-workflows' && process.env.VERCEL_ENV !== 'production') {",
    '      const result = await diagnoseZrWorkflows();',
    "      res.setHeader('Cache-Control', 'no-store');",
    '      return res.status(result.ok ? 200 : 502).json(result);',
    '    }',
    '',
  ].join('\n');
  if (!src.includes(debugBlock)) throw new Error('Temporary ZR debug endpoint block not found');
  src = src.replace(debugBlock, '');
  fs.writeFileSync(file, src);
}

console.log('✅ ZR server cleanup complete');
