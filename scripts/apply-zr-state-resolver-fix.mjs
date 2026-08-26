import fs from 'node:fs';

function replaceOnce(file, from, to, label) {
  let source = fs.readFileSync(file, 'utf8');
  if (source.includes(to)) {
    console.log(`ℹ️ ${label}: already applied`);
    return;
  }
  if (!source.includes(from)) throw new Error(`Expected block not found: ${label}`);
  source = source.replace(from, to);
  fs.writeFileSync(file, source);
  console.log(`✅ ${label}`);
}

const oldResolver = `async function resolveReadyToDispatchStateId() {
  const r = await zrRequest('workflows/search', { method: 'POST', body: { pageNumber: 1, pageSize: 100 } });
  if (!r.ok) return r;
  const items = r.data?.items ?? r.data?.data ?? [];
  const states = (Array.isArray(items) ? items : []).flatMap((w) => w?.states ?? w?.workflowStates ?? [w]);
  const ready = states.find((st) => {
    const name = String(st?.name || '').toLowerCase().replace(/[\\s_-]/g, '');
    return name === 'readytodispatch';
  });
  if (!ready?.id) {
    return {
      ok: false,
      error: 'ZR_READY_STATE_NOT_FOUND',
      message: 'تعذر العثور على حالة ReadyToDispatch في ZR Express؛ أوقفت إنشاء الشحنة حتى لا تبقى معلقة في OrderReceived.',
    };
  }
  return { ok: true, data: String(ready.id) };
}`;

const newResolver = `function normalizeZrWorkflowToken(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\\u0300-\\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

function zrStateObjectId(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const candidates = [value.id, value.stateId, value.workflowStateId, value.workflow_state_id];
  for (const candidate of candidates) {
    if (candidate === null || candidate === undefined) continue;
    const text = String(candidate).trim();
    if (text) return text;
  }
  return null;
}

// ZR has returned workflow payloads in more than one shape across API versions/accounts.
// Instead of assuming workflow.states[].name, search the authenticated response tree for
// an object that directly identifies ReadyToDispatch and carries a state id. This stays
// read-only and never guesses an id.
function deepFindReadyToDispatchState(root) {
  const queue = [{ value: root, parent: null }];
  const seen = new WeakSet();
  let visited = 0;

  while (queue.length && visited < 10_000) {
    const { value, parent } = queue.shift();
    if (!value || typeof value !== 'object') continue;
    if (seen.has(value)) continue;
    seen.add(value);
    visited += 1;

    if (!Array.isArray(value)) {
      const primitiveValues = Object.entries(value)
        .filter(([, v]) => ['string', 'number'].includes(typeof v))
        .map(([, v]) => normalizeZrWorkflowToken(v));
      const saysReady = primitiveValues.some((token) => token === 'readytodispatch');
      if (saysReady) {
        const ownId = zrStateObjectId(value);
        if (ownId) return { id: ownId, source: 'deep-object' };
        const parentId = zrStateObjectId(parent);
        if (parentId) return { id: parentId, source: 'deep-parent' };
      }
    }

    if (Array.isArray(value)) {
      for (const child of value) queue.push({ value: child, parent });
    } else {
      for (const child of Object.values(value)) {
        if (child && typeof child === 'object') queue.push({ value: child, parent: value });
      }
    }
  }
  return null;
}

function collectZrWorkflowDiagnostics(root) {
  const labels = new Set();
  const topKeys = root && typeof root === 'object' && !Array.isArray(root) ? Object.keys(root).slice(0, 20) : [];
  const queue = [root];
  const seen = new WeakSet();
  let visited = 0;

  while (queue.length && visited < 2_000 && labels.size < 30) {
    const value = queue.shift();
    if (!value || typeof value !== 'object') continue;
    if (seen.has(value)) continue;
    seen.add(value);
    visited += 1;

    if (Array.isArray(value)) {
      queue.push(...value);
      continue;
    }

    for (const [key, child] of Object.entries(value)) {
      if (typeof child === 'string') {
        const keyToken = normalizeZrWorkflowToken(key);
        if (/name|state|status|code|key|slug|title|label/.test(keyToken)) {
          const clean = child.trim().slice(0, 80);
          if (clean) labels.add(clean);
        }
      } else if (child && typeof child === 'object') {
        queue.push(child);
      }
    }
  }
  return { topKeys, labels: [...labels].slice(0, 30), visited };
}

async function resolveReadyToDispatchStateId() {
  const r = await zrRequest('workflows/search', { method: 'POST', body: { pageNumber: 1, pageSize: 100 } });
  if (!r.ok) return r;

  const ready = deepFindReadyToDispatchState(r.data);
  if (ready?.id) {
    console.log('[ZREXPRESS] ReadyToDispatch workflow state resolved safely:', ready.source);
    return { ok: true, data: String(ready.id) };
  }

  const diagnostics = collectZrWorkflowDiagnostics(r.data);
  console.warn('[ZREXPRESS] ReadyToDispatch state not found in workflow response', diagnostics);
  return {
    ok: false,
    error: 'ZR_READY_STATE_NOT_FOUND',
    message: 'تعذر العثور على حالة ReadyToDispatch في ZR Express؛ لم يتم إنشاء أي شحنة. تم تسجيل شكل Workflow بشكل آمن للتشخيص.',
    diagnostics,
  };
}`;

replaceOnce('lib/deliveryProviders.js', oldResolver, newResolver, 'robust ReadyToDispatch resolver');

let verify = fs.readFileSync('scripts/verify-delivery-integration.mjs', 'utf8');
const marker = "assert.match(providerSource, /ZR_READY_STATE_NOT_FOUND/);";
const replacement = `${marker}\nassert.match(providerSource, /deepFindReadyToDispatchState/);\nassert.match(providerSource, /collectZrWorkflowDiagnostics/);\nassert.match(providerSource, /workflow response tree/);`;
if (!verify.includes('deepFindReadyToDispatchState')) {
  if (!verify.includes(marker)) throw new Error('Verification marker not found');
  verify = verify.replace(marker, replacement);
  fs.writeFileSync('scripts/verify-delivery-integration.mjs', verify);
  console.log('✅ state resolver verification added');
}
