const test = require('node:test');
const assert = require('node:assert/strict');
const Validator = require('../ai-response-validator.js');
const valid = () => ({ summary: 'Resumo.', observations: [{ type: 'FACT', text: 'Fato.' }], recommendations: [{ type: 'REDUCE_LOAD', goalId: 'goal-a', reason: 'Razão.', confidence: 'MEDIUM', suggestedChange: { minimumMinutes: 30, idealMinutes: 60 } }] });

test('accepts a valid structured response', () => assert.ok(Validator.validateCoachResponse(valid(), { goalIds: ['goal-a'] })));
test('rejects invalid recommendation data and unsafe commands', () => {
  assert.equal(Validator.validateCoachResponse({ ...valid(), recommendations: [{ ...valid().recommendations[0], type: 'RUN_CODE' }] }, { goalIds: ['goal-a'] }), null);
  assert.equal(Validator.validateCoachResponse({ ...valid(), recommendations: [{ ...valid().recommendations[0], goalId: 'missing' }] }, { goalIds: ['goal-a'] }), null);
  assert.equal(Validator.validateCoachResponse({ ...valid(), recommendations: [{ ...valid().recommendations[0], suggestedChange: { minimumMinutes: 90, idealMinutes: 30 } }] }, { goalIds: ['goal-a'] }), null);
  assert.equal(Validator.validateCoachResponse({ ...valid(), summary: 'runCommand now' }, { goalIds: ['goal-a'] }), null);
});
