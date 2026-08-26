import fs from 'node:fs';

function patch(file, from, to, marker) {
  let src = fs.readFileSync(file, 'utf8');
  if (src.includes(marker)) return;
  if (!src.includes(from)) throw new Error(`Expected block not found in ${file}`);
  src = src.replace(from, to);
  fs.writeFileSync(file, src);
}

patch(
  'lib/deliveryProviders.js',
  `function collectZrWorkflowDiagnostics(root) {\n  const labels = new Set();`,
  `function collectZrWorkflowPrimitivePaths(root) {\n  const out = [];\n  const queue = [{ value: root, path: '$', depth: 0 }];\n  const seen = new WeakSet();\n  while (queue.length && out.length < 300) {\n    const { value, path, depth } = queue.shift();\n    if (value === null || value === undefined) continue;\n    if (typeof value !== 'object') {\n      const text = typeof value === 'string' ? value.slice(0, 160) : value;\n      out.push({ path, value: text });\n      continue;\n    }\n    if (seen.has(value) || depth > 7) continue;\n    seen.add(value);\n    if (Array.isArray(value)) {\n      for (let i = 0; i < Math.min(value.length, 20); i += 1) {\n        queue.push({ value: value[i], path: path + '[' + i + ']', depth: depth + 1 });\n      }\n      continue;\n    }\n    for (const [key, child] of Object.entries(value)) {\n      queue.push({ value: child, path: path + '.' + key, depth: depth + 1 });\n    }\n  }\n  return out;\n}\n\nexport async function diagnoseZrWorkflows() {\n  const r = await zrRequest('workflows/search', { method: 'POST', body: { pageNumber: 1, pageSize: 100 } });\n  if (!r.ok) return { ok: false, error: r.error, message: r.message, status: r.status };\n  const diagnostics = collectZrWorkflowDiagnostics(r.data);\n  return {\n    ok: true,\n    diagnostics,\n    primitivePaths: collectZrWorkflowPrimitivePaths(r.data),\n  };\n}\n\nfunction collectZrWorkflowDiagnostics(root) {\n  const labels = new Set();`,
  'export async function diagnoseZrWorkflows()'
);

patch(
  'api/noest.js',
  `import { getZrDeliveryQuote, getZrSafeConfig, prepareZrOrder } from '../lib/deliveryProviders.js';`,
  `import { diagnoseZrWorkflows, getZrDeliveryQuote, getZrSafeConfig, prepareZrOrder } from '../lib/deliveryProviders.js';`,
  'diagnoseZrWorkflows, getZrDeliveryQuote'
);

patch(
  'api/noest.js',
  `  if (req.method === 'GET') {\n    const zr = getZrSafeConfig();`,
  `  if (req.method === 'GET') {\n    if (req.query?.debug === 'zr-workflows' && process.env.VERCEL_ENV !== 'production') {\n      const result = await diagnoseZrWorkflows();\n      res.setHeader('Cache-Control', 'no-store');\n      return res.status(result.ok ? 200 : 502).json(result);\n    }\n    const zr = getZrSafeConfig();`,
  "req.query?.debug === 'zr-workflows'"
);

console.log('✅ Temporary Preview-only ZR workflow diagnostics applied');
