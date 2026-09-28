const test = require('node:test');
const assert = require('node:assert/strict');
const Provider = require('../groq-provider.js');

test('returns parsed response from Groq', async () => {
  const response = await Provider.generateCoachResponse({}, { apiKey: 'test', fetchImpl: async () => ({ ok: true, json: async () => ({ choices: [{ message: { content: '{"summary":"ok","observations":[],"recommendations":[]}' } }] }) }) });
  assert.equal(response.summary, 'ok');
});
test('handles HTTP and malformed provider responses', async () => {
  await assert.rejects(Provider.generateCoachResponse({}, { apiKey: 'test', fetchImpl: async () => ({ ok: false, status: 429 }) }));
  await assert.rejects(Provider.generateCoachResponse({}, { apiKey: 'test', fetchImpl: async () => ({ ok: true, json: async () => ({ choices: [] }) }) }));
});
