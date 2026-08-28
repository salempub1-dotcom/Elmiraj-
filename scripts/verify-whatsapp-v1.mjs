import assert from 'node:assert/strict';
import {
  buildWhatsAppTemplatePayload,
  hasWhatsAppConsent,
  normalizeAlgerianWhatsAppNumber,
  sendOrderReceivedWhatsApp,
} from '../lib/whatsapp.js';

assert.equal(normalizeAlgerianWhatsAppNumber('0555123456'), '213555123456');
assert.equal(normalizeAlgerianWhatsAppNumber('+213555123456'), '213555123456');
assert.equal(normalizeAlgerianWhatsAppNumber('213 555 123 456'), '213555123456');
assert.equal(normalizeAlgerianWhatsAppNumber('05 55-12-34-56'), '213555123456');
assert.equal(normalizeAlgerianWhatsAppNumber('12345'), null);
assert.equal(hasWhatsAppConsent('foo=1; almiraj_whatsapp_consent=1; bar=2'), true);
assert.equal(hasWhatsAppConsent('almiraj_whatsapp_consent=0'), false);

const order = { customer: 'Test Teacher', tracking: 'AM-TEST-001', phone: '0555123456', total: 12500 };
const env = {
  WHATSAPP_ENABLED: 'true',
  WHATSAPP_ACCESS_TOKEN: 'test-token',
  WHATSAPP_PHONE_NUMBER_ID: '123456',
  WHATSAPP_TEMPLATE_NAME: 'order_received_ar',
  WHATSAPP_TEMPLATE_LANG: 'ar',
  META_GRAPH_API_VERSION: 'v99.0',
};

const built = buildWhatsAppTemplatePayload(order, env);
assert.equal(built.ok, true);
assert.equal(built.payload.to, '213555123456');
assert.deepEqual(
  built.payload.template.components[0].parameters.map((p) => p.text),
  ['Test Teacher', 'AM-TEST-001', '12500']
);

let called = 0;
const successFetch = async (_url, options) => {
  called += 1;
  const payload = JSON.parse(options.body);
  assert.equal(payload.to, '213555123456');
  assert.equal(payload.template.name, 'order_received_ar');
  return new Response(JSON.stringify({ messages: [{ id: 'wamid.test' }] }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
};
const sent = await sendOrderReceivedWhatsApp(order, { env, fetchImpl: successFetch });
assert.equal(sent.sent, true);
assert.equal(called, 1);

const failed = await sendOrderReceivedWhatsApp(order, {
  env,
  fetchImpl: async () => new Response(JSON.stringify({ error: { code: 131000, message: 'test failure' } }), {
    status: 400,
    headers: { 'content-type': 'application/json' },
  }),
});
assert.equal(failed.sent, false);
assert.equal(failed.skipped, 'META_REJECTED');

called = 0;
const disabled = await sendOrderReceivedWhatsApp(order, {
  env: { ...env, WHATSAPP_ENABLED: 'false' },
  fetchImpl: async () => { called += 1; throw new Error('must not be called'); },
});
assert.equal(disabled.sent, false);
assert.equal(disabled.skipped, 'DISABLED');
assert.equal(called, 0);

console.log('✅ WhatsApp V1 safety checks passed');
